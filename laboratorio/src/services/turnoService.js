/**
 * =====================================================================
 *  TurnoConnect - Servicio de Turnos (NÚCLEO DEL SISTEMA)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  FUENTE ÚNICA DE VERDAD del sistema.
 *
 *  Los cuatro mecanismos de comunicación llaman a este servicio; ninguno
 *  mantiene datos propios en memoria. Por eso TCP, UDP, REST y WebSocket
 *  siempre devuelven información consistente (Parte 5 del examen).
 *
 *  Además, cada operación publica un evento en el bus interno, que el
 *  módulo de WebSockets reenvía a todos los navegadores conectados.
 */
'use strict';

const mongoose = require('mongoose');

const Turno = require('../models/Turno');
const Contador = require('../models/Contador');
const AppError = require('../utils/AppError');
const bus = require('./eventBus');
const {
  ESTADOS,
  ESTADOS_VALIDOS,
  TIPOS_ATENCION,
  TRANSICIONES
} = require('../utils/constantes');

// =====================================================================
//  Utilidades internas
// =====================================================================

/**
 * Genera el siguiente código de turno con formato T-001, T-002, ...
 * Usa un incremento atómico en MongoDB para evitar duplicados.
 * @returns {Promise<string>}
 */
async function generarCodigo() {
  const secuencia = await Contador.siguiente('turno');
  return `T-${String(secuencia).padStart(3, '0')}`;
}

/**
 * Construye el filtro de búsqueda aceptando id de Mongo o código de turno.
 * @param {string} identificador
 * @returns {object}
 */
function filtroPorIdentificador(identificador) {
  const valor = String(identificador || '').trim();
  if (!valor) {
    throw new AppError(400, 'Debe indicar el identificador o código del turno');
  }

  // Si es un ObjectId válido de Mongo se busca por _id; si no, por código
  if (mongoose.Types.ObjectId.isValid(valor)) {
    return { _id: valor };
  }
  return { codigo: valor.toUpperCase() };
}

/**
 * Normaliza y valida los datos de entrada para crear un turno.
 * @param {{solicitante: string, tipoAtencion: string}} datos
 */
function validarDatosTurno({ solicitante, tipoAtencion }) {
  const nombre = String(solicitante || '').trim();
  const tipo = String(tipoAtencion || '').trim();

  if (!nombre) {
    throw new AppError(400, 'El nombre del solicitante es obligatorio');
  }
  if (nombre.length < 3) {
    throw new AppError(400, 'El nombre del solicitante debe tener al menos 3 caracteres');
  }
  if (nombre.length > 80) {
    throw new AppError(400, 'El nombre del solicitante no puede superar 80 caracteres');
  }
  if (!tipo) {
    throw new AppError(400, 'El tipo de atención es obligatorio');
  }
  if (!TIPOS_ATENCION.includes(tipo)) {
    throw new AppError(
      400,
      `Tipo de atención inválido. Valores permitidos: ${TIPOS_ATENCION.join(', ')}`
    );
  }

  return { solicitante: nombre, tipoAtencion: tipo };
}

// =====================================================================
//  Operaciones sobre turnos
// =====================================================================

/**
 * Registra un nuevo turno en estado "Pendiente".
 * @param {{solicitante: string, tipoAtencion: string}} datos
 * @param {string} usuario Nombre del usuario que registra el turno.
 * @returns {Promise<object>} Turno creado (JSON plano).
 */
async function crearTurno(datos, usuario = 'sistema') {
  const { solicitante, tipoAtencion } = validarDatosTurno(datos);
  const codigo = await generarCodigo();

  const turno = await Turno.create({
    codigo,
    solicitante,
    tipoAtencion,
    estado: ESTADOS.PENDIENTE,
    fechaRegistro: new Date(),
    historial: [
      { estado: ESTADOS.PENDIENTE, usuario, fecha: new Date() }
    ]
  });

  const json = turno.aJSON();
  bus.emit('turno:creado', { turno: json, usuario });
  return json;
}

/**
 * Lista los turnos registrados, opcionalmente filtrados por estado.
 * @param {{estado?: string, limite?: number}} [opciones]
 * @returns {Promise<object[]>}
 */
async function listarTurnos(opciones = {}) {
  const filtro = {};

  if (opciones.estado) {
    if (!ESTADOS_VALIDOS.includes(opciones.estado)) {
      throw new AppError(
        400,
        `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
      );
    }
    filtro.estado = opciones.estado;
  }

  const limite = Math.min(Number(opciones.limite) || 200, 500);

  const turnos = await Turno.find(filtro)
    .sort({ fechaRegistro: 1 })
    .limit(limite);

  return turnos.map((t) => t.aJSON());
}

/**
 * Busca un turno por su identificador o por su código (T-001).
 * @param {string} identificador ObjectId o código.
 * @returns {Promise<object>}
 */
async function obtenerTurno(identificador) {
  const turno = await Turno.findOne(filtroPorIdentificador(identificador));
  if (!turno) {
    throw new AppError(404, `No existe un turno con el identificador "${identificador}"`);
  }
  return turno.aJSON();
}

/**
 * Busca un turno por código devolviendo SOLO los datos que exige el
 * cliente TCP (código, solicitante y estado), aunque se incluyen algunos
 * adicionales útiles para las evidencias.
 * @param {string} codigo
 * @returns {Promise<object>}
 */
async function consultarPorCodigo(codigo) {
  const turno = await Turno.findOne({ codigo: String(codigo || '').trim().toUpperCase() });
  if (!turno) {
    throw new AppError(404, `No existe un turno con el código "${codigo}"`);
  }

  return {
    codigo: turno.codigo,
    solicitante: turno.solicitante,
    estado: turno.estado,
    tipoAtencion: turno.tipoAtencion,
    fechaRegistro: turno.fechaRegistro,
    iniciadoPor: turno.iniciadoPor
  };
}

/**
 * Inicia la atención de un turno (Pendiente -> En atención).
 *
 * La actualización es ATÓMICA: el filtro incluye { estado: 'Pendiente' },
 * de modo que si dos usuarios intentan tomar el mismo turno al mismo
 * tiempo, solo el primero lo consigue y el segundo recibe un error 409.
 *
 * @param {string} identificador ObjectId o código del turno.
 * @param {string} usuario Nombre del usuario que inicia la atención.
 * @returns {Promise<object>}
 */
async function iniciarAtencion(identificador, usuario) {
  const filtro = filtroPorIdentificador(identificador);
  const ahora = new Date();

  const turno = await Turno.findOneAndUpdate(
    { ...filtro, estado: ESTADOS.PENDIENTE },
    {
      $set: {
        estado: ESTADOS.EN_ATENCION,
        iniciadoPor: usuario,
        iniciadoEn: ahora
      },
      $push: {
        historial: { estado: ESTADOS.EN_ATENCION, usuario, fecha: ahora }
      }
    },
    { new: true }
  );

  if (!turno) {
    // No se pudo actualizar: determinar la causa real para informar bien
    const existente = await Turno.findOne(filtro);
    if (!existente) {
      throw new AppError(404, `No existe un turno con el identificador "${identificador}"`);
    }
    if (existente.estado === ESTADOS.EN_ATENCION) {
      throw new AppError(
        409,
        `El turno ${existente.codigo} ya está en atención por "${existente.iniciadoPor}". ` +
          'No es posible que dos usuarios atiendan el mismo turno.'
      );
    }
    throw new AppError(
      409,
      `El turno ${existente.codigo} está en estado "${existente.estado}" y no puede iniciarse.`
    );
  }

  const json = turno.aJSON();
  bus.emit('turno:actualizado', {
    turno: json,
    usuario,
    accion: 'iniciar',
    estadoAnterior: ESTADOS.PENDIENTE
  });
  return json;
}

/**
 * Finaliza la atención de un turno (En atención -> Finalizado).
 * También es atómico: solo el primero en finalizar tiene efecto.
 * @param {string} identificador ObjectId o código.
 * @param {string} usuario Nombre del usuario que finaliza.
 * @returns {Promise<object>}
 */
async function finalizarAtencion(identificador, usuario) {
  const filtro = filtroPorIdentificador(identificador);
  const ahora = new Date();

  const turno = await Turno.findOneAndUpdate(
    { ...filtro, estado: ESTADOS.EN_ATENCION },
    {
      $set: {
        estado: ESTADOS.FINALIZADO,
        finalizadoPor: usuario,
        finalizadoEn: ahora
      },
      $push: {
        historial: { estado: ESTADOS.FINALIZADO, usuario, fecha: ahora }
      }
    },
    { new: true }
  );

  if (!turno) {
    const existente = await Turno.findOne(filtro);
    if (!existente) {
      throw new AppError(404, `No existe un turno con el identificador "${identificador}"`);
    }
    throw new AppError(
      409,
      `El turno ${existente.codigo} está en estado "${existente.estado}". ` +
        'Solo se puede finalizar un turno que esté "En atención".'
    );
  }

  const json = turno.aJSON();
  bus.emit('turno:actualizado', {
    turno: json,
    usuario,
    accion: 'finalizar',
    estadoAnterior: ESTADOS.EN_ATENCION
  });
  return json;
}

/**
 * Cambia el estado de un turno respetando las transiciones permitidas.
 * Se usa findOneAndUpdate condicionado al estado leído para que la
 * operación sea segura ante accesos concurrentes.
 *
 * @param {string} identificador ObjectId o código.
 * @param {string} nuevoEstado Estado destino.
 * @param {string} usuario Nombre del usuario que realiza el cambio.
 * @returns {Promise<object>}
 */
async function cambiarEstado(identificador, nuevoEstado, usuario) {
  if (!ESTADOS_VALIDOS.includes(nuevoEstado)) {
    throw new AppError(
      400,
      `Estado inválido. Valores permitidos: ${ESTADOS_VALIDOS.join(', ')}`
    );
  }

  const filtro = filtroPorIdentificador(identificador);
  const actual = await Turno.findOne(filtro);
  if (!actual) {
    throw new AppError(404, `No existe un turno con el identificador "${identificador}"`);
  }

  if (actual.estado === nuevoEstado) {
    throw new AppError(
      409,
      `El turno ${actual.codigo} ya se encuentra en estado "${nuevoEstado}".`
    );
  }

  const permitidos = TRANSICIONES[actual.estado] || [];
  if (!permitidos.includes(nuevoEstado)) {
    throw new AppError(
      409,
      `Transición no permitida: "${actual.estado}" → "${nuevoEstado}". ` +
        (permitidos.length
          ? `Desde "${actual.estado}" solo puede pasar a: ${permitidos.join(', ')}.`
          : `El estado "${actual.estado}" es final.`)
    );
  }

  const ahora = new Date();
  const cambios = {
    estado: nuevoEstado,
    $push: { historial: { estado: nuevoEstado, usuario, fecha: ahora } }
  };

  // Se rellenan los campos de auditoría según el estado destino
  if (nuevoEstado === ESTADOS.EN_ATENCION) {
    cambios.$set = { iniciadoPor: usuario, iniciadoEn: ahora };
  } else if (nuevoEstado === ESTADOS.FINALIZADO) {
    cambios.$set = { finalizadoPor: usuario, finalizadoEn: ahora };
  }

  const turno = await Turno.findOneAndUpdate(
    { _id: actual._id, estado: actual.estado },
    cambios,
    { new: true }
  );

  if (!turno) {
    throw new AppError(
      409,
      'El turno fue modificado por otro usuario mientras se procesaba la solicitud. ' +
        'Actualice la información e intente nuevamente.'
    );
  }

  const json = turno.aJSON();
  bus.emit('turno:actualizado', {
    turno: json,
    usuario,
    accion: 'cambiarEstado',
    estadoAnterior: actual.estado
  });
  return json;
}

/**
 * Elimina un turno de la base de datos.
 * @param {string} identificador ObjectId o código.
 * @param {string} usuario Nombre del usuario que elimina.
 * @returns {Promise<{codigo: string}>}
 */
async function eliminarTurno(identificador, usuario = 'sistema') {
  const turno = await Turno.findOneAndDelete(filtroPorIdentificador(identificador));

  if (!turno) {
    throw new AppError(404, `No existe un turno con el identificador "${identificador}"`);
  }

  const json = turno.aJSON();
  bus.emit('turno:eliminado', { turno: json, usuario });
  return { codigo: json.codigo, id: json.id };
}

/**
 * Calcula las estadísticas generales del sistema (usadas por UDP).
 * @returns {Promise<{pendientes: number, enAtencion: number, finalizados: number, total: number}>}
 */
async function estadisticas() {
  const agrupado = await Turno.aggregate([
    { $group: { _id: '$estado', cantidad: { $sum: 1 } } }
  ]);

  const resultado = {
    pendientes: 0,
    enAtencion: 0,
    finalizados: 0,
    total: 0
  };

  for (const grupo of agrupado) {
    if (grupo._id === ESTADOS.PENDIENTE) resultado.pendientes = grupo.cantidad;
    if (grupo._id === ESTADOS.EN_ATENCION) resultado.enAtencion = grupo.cantidad;
    if (grupo._id === ESTADOS.FINALIZADO) resultado.finalizados = grupo.cantidad;
    resultado.total += grupo.cantidad;
  }

  return resultado;
}

module.exports = {
  generarCodigo,
  crearTurno,
  listarTurnos,
  obtenerTurno,
  consultarPorCodigo,
  iniciarAtencion,
  finalizarAtencion,
  cambiarEstado,
  eliminarTurno,
  estadisticas
};
