/**
 * =====================================================================
 *  TurnoConnect - Servidor de Sockets TCP (Parte 1)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Cumple los cinco requerimientos de la Parte 1:
 *   1. Permite la conexión simultánea de varios clientes
 *      (cada socket se registra en un Map independiente).
 *   2. Identifica a cada cliente mediante un nombre de usuario (LOGIN).
 *   3. Permite consultar un turno utilizando su código.
 *   4. Responde indicando código, solicitante y estado del turno.
 *   5. Gestiona correctamente la desconexión de los clientes.
 *
 *  ESTRUCTURA DE LOS MENSAJES
 *  --------------------------
 *  Se usa texto JSON terminado en el carácter de nueva línea "\n"
 *  (framing por delimitador), lo que permite enviar varios mensajes por
 *  la misma conexión y detectar el final de cada uno.
 *
 *  Cliente -> Servidor
 *    {"tipo":"LOGIN","usuario":"Santiago"}
 *    {"tipo":"CONSULTAR","codigo":"T-001"}
 *    {"tipo":"LISTAR"}
 *    {"tipo":"AYUDA"}
 *    {"tipo":"PING"}
 *    {"tipo":"SALIR"}
 *
 *  Servidor -> Cliente
 *    {"tipo":"BIENVENIDA"|"LOGIN_OK"|"TURNO"|"TURNOS"|"ERROR"|"ADIOS"|"PONG", ...}
 */
'use strict';

const net = require('net');

const turnoService = require('../services/turnoService');
const config = require('../config/env');

/** Tiempo máximo de inactividad permitido por cliente (5 minutos). */
const TIMEOUT_INACTIVIDAD_MS = 5 * 60 * 1000;

/**
 * Envía un objeto como una línea JSON.
 * @param {net.Socket} socket
 * @param {object} objeto
 */
function enviar(socket, objeto) {
  if (socket.destroyed) return;
  socket.write(`${JSON.stringify(objeto)}\n`);
}

/**
 * Envía una respuesta de error estandarizada.
 */
function enviarError(socket, mensaje) {
  enviar(socket, { tipo: 'ERROR', mensaje });
}

/**
 * Texto de ayuda con los comandos disponibles.
 */
const AYUDA = [
  'Comandos disponibles:',
  '  LOGIN {"tipo":"LOGIN","usuario":"<nombre>"}   -> identificarse (obligatorio primero)',
  '  CONSULTAR {"tipo":"CONSULTAR","codigo":"T-001"} -> consultar un turno por código',
  '  LISTAR     {"tipo":"LISTAR"}                    -> listar todos los turnos',
  '  PING       {"tipo":"PING"}                      -> verificar la conexión',
  '  SALIR      {"tipo":"SALIR"}                     -> cerrar la conexión'
];

/**
 * Crea y arranca el servidor TCP.
 * @param {{port?: number, host?: string}} [opciones]
 * @returns {net.Server}
 */
function iniciarServidorTCP(opciones = {}) {
  const port = opciones.port || config.tcpPort;
  const host = opciones.host || '0.0.0.0';

  /**
   * Registro de clientes conectados.
   * clave: id interno del socket  ->  valor: { id, usuario, conectadoEn, ip }
   */
  const clientes = new Map();
  let contadorConexiones = 0;

  const servidor = net.createServer((socket) => {
    contadorConexiones += 1;
    const idCliente = contadorConexiones;
    const ip = `${socket.remoteAddress}:${socket.remotePort}`;

    // --- 1) Registro del cliente (permite múltiples conexiones) ------
    clientes.set(socket, {
      id: idCliente,
      usuario: null, // se completa con LOGIN
      conectadoEn: new Date(),
      ip
    });

    console.log(
      `\x1b[35m[TCP]\x1b[0m Cliente #${idCliente} conectado desde ${ip} · activos: ${clientes.size}`
    );

    // --- 2) Saludo inicial -------------------------------------------
    enviar(socket, {
      tipo: 'BIENVENIDA',
      mensaje: 'Conectado al servidor TCP de TurnoConnect',
      servidor: 'TurnoConnect',
      protocolo: 'TCP',
      estudiante: config.estudiante,
      nrc: config.nrc,
      cliente: `#${idCliente}`,
      requiere: 'LOGIN',
      ayuda: AYUDA
    });

    // --- 3) Buffer para el framing por "\n" --------------------------
    let buffer = '';

    socket.setTimeout(TIMEOUT_INACTIVIDAD_MS);
    socket.on('timeout', () => {
      enviar(socket, {
        tipo: 'ERROR',
        mensaje: 'Conexión cerrada por inactividad (5 minutos sin mensajes)'
      });
      socket.destroy();
    });

    socket.on('data', async (chunk) => {
      buffer += chunk.toString('utf8');

      // Mientras existan líneas completas, procesarlas
      let indice = buffer.indexOf('\n');
      while (indice !== -1) {
        const linea = buffer.slice(0, indice).trim();
        buffer = buffer.slice(indice + 1);
        if (linea) {
          await procesarMensaje(socket, linea);
        }
        indice = buffer.indexOf('\n');
      }
    });

    // --- 4) Gestión de errores de la conexión ------------------------
    socket.on('error', (error) => {
      const datos = clientes.get(socket);
      console.warn(
        `\x1b[33m[TCP]\x1b[0m Error en cliente #${datos ? datos.id : '?'}: ${error.message}`
      );
      clientes.delete(socket);
    });

    // --- 5) Gestión de la desconexión --------------------------------
    socket.on('close', () => {
      const datos = clientes.get(socket);
      clientes.delete(socket);
      console.log(
        `\x1b[35m[TCP]\x1b[0m Cliente #${datos ? datos.id : '?'} (${
          datos && datos.usuario ? datos.usuario : 'sin identificar'
        }) desconectado · activos: ${clientes.size}`
      );
    });
  });

  /**
   * Procesa una línea JSON recibida de un cliente.
   * @param {net.Socket} socket
   * @param {string} linea
   */
  async function procesarMensaje(socket, linea) {
    const datos = clientes.get(socket);
    const etiqueta = datos && datos.usuario ? datos.usuario : `#${datos ? datos.id : '?'}`;

    let mensaje;
    try {
      mensaje = JSON.parse(linea);
    } catch (_error) {
      console.log(`\x1b[90m[TCP]\x1b[0m ${etiqueta} → mensaje no válido: ${linea}`);
      return enviarError(
        socket,
        'Formato inválido. Envíe un objeto JSON terminado en salto de línea. Ej: {"tipo":"AYUDA"}'
      );
    }

    const tipo = String(mensaje.tipo || '').toUpperCase();
    console.log(`\x1b[90m[TCP]\x1b[0m ${etiqueta} → ${tipo || '(sin tipo)'}`);

    try {
      switch (tipo) {
        // -----------------------------------------------------------
        case 'LOGIN': {
          const usuario = String(mensaje.usuario || '').trim();
          if (!usuario) {
            return enviarError(socket, 'Debe indicar el campo "usuario" para identificarse');
          }
          if (usuario.length < 2 || usuario.length > 40) {
            return enviarError(socket, 'El nombre de usuario debe tener entre 2 y 40 caracteres');
          }

          // Evita dos clientes TCP con el mismo nombre
          const ocupado = [...clientes.values()].some(
            (c) => c.usuario && c.usuario.toLowerCase() === usuario.toLowerCase() && c.id !== datos.id
          );
          if (ocupado) {
            return enviarError(
              socket,
              `El usuario "${usuario}" ya está conectado por TCP. Use otro nombre.`
            );
          }

          datos.usuario = usuario;
          console.log(
            `\x1b[35m[TCP]\x1b[0m Cliente #${datos.id} identificado como "${usuario}"`
          );

          return enviar(socket, {
            tipo: 'LOGIN_OK',
            usuario,
            mensaje: `Bienvenido ${usuario}. Ya puede consultar turnos.`,
            hora: new Date().toLocaleString('es-EC')
          });
        }

        // -----------------------------------------------------------
        case 'CONSULTAR': {
          if (!datos.usuario) {
            return enviarError(
              socket,
              'Debe identificarse primero con {"tipo":"LOGIN","usuario":"<nombre>"}'
            );
          }

          const codigo = String(mensaje.codigo || '').trim();
          if (!codigo) {
            return enviarError(socket, 'Debe indicar el "codigo" del turno. Ej: {"tipo":"CONSULTAR","codigo":"T-001"}');
          }

          // Consulta sobre la MISMA información que administra el sistema
          const turno = await turnoService.consultarPorCodigo(codigo);

          return enviar(socket, {
            tipo: 'TURNO',
            mensaje: `Turno ${turno.codigo} consultado por ${datos.usuario}`,
            consultadoPor: datos.usuario,
            hora: new Date().toLocaleString('es-EC'),
            // 4) código, solicitante y estado son los datos exigidos
            turno
          });
        }

        // -----------------------------------------------------------
        case 'LISTAR': {
          if (!datos.usuario) {
            return enviarError(socket, 'Debe identificarse primero con LOGIN');
          }

          const turnos = await turnoService.listarTurnos();
          return enviar(socket, {
            tipo: 'TURNOS',
            mensaje: `Listado de turnos solicitado por ${datos.usuario}`,
            total: turnos.length,
            turnos
          });
        }

        // -----------------------------------------------------------
        case 'AYUDA':
          return enviar(socket, { tipo: 'AYUDA', comandos: AYUDA });

        // -----------------------------------------------------------
        case 'PING':
          return enviar(socket, { tipo: 'PONG', hora: new Date().toISOString() });

        // -----------------------------------------------------------
        case 'SALIR':
          enviar(socket, {
            tipo: 'ADIOS',
            mensaje: `Hasta pronto ${datos.usuario || 'cliente'}. Conexión cerrada.`
          });
          return socket.end();

        // -----------------------------------------------------------
        default:
          return enviarError(
            socket,
            `Comando desconocido: "${tipo}". Escriba {"tipo":"AYUDA"} para ver los comandos.`
          );
      }
    } catch (error) {
      return enviarError(socket, error.message || 'Error al procesar la solicitud');
    }
  }

  servidor.on('error', (error) => {
    console.error(`\x1b[31m[TCP]\x1b[0m Error del servidor: ${error.message}`);
  });

  servidor.listen(port, host, () => {
    console.log(`\x1b[35m[TCP]\x1b[0m Servidor TCP escuchando en ${host}:${port}`);
  });

  // Expone la lista de clientes para fines de depuración
  servidor.clientes = clientes;

  return servidor;
}

module.exports = { iniciarServidorTCP };
