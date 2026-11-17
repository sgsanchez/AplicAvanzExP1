/**
 * =====================================================================
 *  TurnoConnect - Servidor de Sockets UDP (Parte 2)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Mecanismo INDEPENDIENTE del TCP para consultar información general
 *  del sistema. Responde estadísticas calculadas directamente en MongoDB
 *  a través de "turnoService", por lo que los valores siempre coinciden
 *  con los que muestra la API REST y la interfaz web.
 *
 *  ESTRUCTURA DE LOS MENSAJES (JSON en un datagrama)
 *  --------------------------------------------------
 *  Cliente -> Servidor
 *    {"tipo":"ESTADISTICAS","cliente":"Santiago"}
 *    {"tipo":"PENDIENTES","cliente":"Santiago"}
 *    {"tipo":"EN_ATENCION"}
 *    {"tipo":"FINALIZADOS"}
 *    {"tipo":"AYUDA"}
 *
 *  Servidor -> Cliente
 *    {"tipo":"ESTADISTICAS","pendientes":2,"enAtencion":1,"finalizados":1,"total":4,...}
 *    {"tipo":"CONTEO","consulta":"PENDIENTES","cantidad":2,...}
 *    {"tipo":"ERROR","mensaje":"..."}
 *
 *  Características propias de UDP:
 *   - Sin conexión: cada datagrama es independiente.
 *   - Varios clientes pueden consultar en paralelo.
 *   - La respuesta se envía a la dirección/puerto del remitente (rinfo).
 */
'use strict';

const dgram = require('dgram');

const turnoService = require('../services/turnoService');
const config = require('../config/env');

const AYUDA = [
  'Consultas UDP disponibles:',
  '  {"tipo":"ESTADISTICAS"}  -> pendientes, en atención y finalizados',
  '  {"tipo":"PENDIENTES"}    -> cantidad de turnos pendientes',
  '  {"tipo":"EN_ATENCION"}   -> cantidad de turnos en atención',
  '  {"tipo":"FINALIZADOS"}   -> cantidad de turnos finalizados'
];

/**
 * Crea y arranca el servidor UDP.
 * @param {{port?: number, host?: string}} [opciones]
 * @returns {dgram.Socket}
 */
function iniciarServidorUDP(opciones = {}) {
  const port = opciones.port || config.udpPort;
  const host = opciones.host || '0.0.0.0';

  const socket = dgram.createSocket('udp4');
  let consultasAtendidas = 0;

  socket.on('message', async (mensaje, rinfo) => {
    consultasAtendidas += 1;
    const origen = `${rinfo.address}:${rinfo.port}`;
    const texto = mensaje.toString('utf8').trim();

    console.log(
      `\x1b[34m[UDP]\x1b[0m Consulta #${consultasAtendidas} de ${origen} → ${texto}`
    );

    /** Envía la respuesta al cliente que consultó. */
    const responder = (objeto) => {
      const carga = Buffer.from(JSON.stringify(objeto), 'utf8');
      socket.send(carga, rinfo.port, rinfo.address, (error) => {
        if (error) console.error(`\x1b[31m[UDP]\x1b[0m Error al responder: ${error.message}`);
      });
    };

    let solicitud;
    try {
      solicitud = JSON.parse(texto);
    } catch (_error) {
      return responder({
        tipo: 'ERROR',
        mensaje:
          'Formato inválido. Envíe un objeto JSON. Ej: {"tipo":"ESTADISTICAS","cliente":"Santiago"}'
      });
    }

    const tipo = String(solicitud.tipo || '').toUpperCase();
    const cliente = String(solicitud.cliente || 'cliente-anonimo').trim();

    const base = {
      protocolo: 'UDP',
      servidor: 'TurnoConnect',
      estudiante: config.estudiante,
      nrc: config.nrc,
      cliente,
      origen,
      hora: new Date().toLocaleString('es-EC'),
      fechaISO: new Date().toISOString()
    };

    try {
      switch (tipo) {
        // -----------------------------------------------------------
        case 'ESTADISTICAS':
        case 'ESTADÍSTICAS':
        case 'STATS': {
          const stats = await turnoService.estadisticas();
          return responder({
            tipo: 'ESTADISTICAS',
            ...base,
            ...stats,
            mensaje: `Turnos → Pendientes: ${stats.pendientes} | En atención: ${stats.enAtencion} | Finalizados: ${stats.finalizados}`
          });
        }

        // -----------------------------------------------------------
        case 'PENDIENTES': {
          const stats = await turnoService.estadisticas();
          return responder({
            tipo: 'CONTEO',
            ...base,
            consulta: 'PENDIENTES',
            cantidad: stats.pendientes,
            mensaje: `Turnos pendientes: ${stats.pendientes}`
          });
        }

        // -----------------------------------------------------------
        case 'EN_ATENCION':
        case 'ENATENCION': {
          const stats = await turnoService.estadisticas();
          return responder({
            tipo: 'CONTEO',
            ...base,
            consulta: 'EN_ATENCION',
            cantidad: stats.enAtencion,
            mensaje: `Turnos en atención: ${stats.enAtencion}`
          });
        }

        // -----------------------------------------------------------
        case 'FINALIZADOS': {
          const stats = await turnoService.estadisticas();
          return responder({
            tipo: 'CONTEO',
            ...base,
            consulta: 'FINALIZADOS',
            cantidad: stats.finalizados,
            mensaje: `Turnos finalizados: ${stats.finalizados}`
          });
        }

        // -----------------------------------------------------------
        case 'AYUDA':
          return responder({ tipo: 'AYUDA', ...base, consultas: AYUDA });

        // -----------------------------------------------------------
        default:
          return responder({
            tipo: 'ERROR',
            ...base,
            mensaje: `Consulta desconocida: "${tipo}". Use ESTADISTICAS, PENDIENTES, EN_ATENCION o FINALIZADOS.`
          });
      }
    } catch (error) {
      return responder({
        tipo: 'ERROR',
        ...base,
        mensaje: error.message || 'Error al procesar la consulta UDP'
      });
    }
  });

  socket.on('error', (error) => {
    console.error(`\x1b[31m[UDP]\x1b[0m Error del servidor: ${error.message}`);
    socket.close();
  });

  socket.on('listening', () => {
    const dir = socket.address();
    console.log(`\x1b[34m[UDP]\x1b[0m Servidor UDP escuchando en ${dir.address}:${dir.port}`);
  });

  socket.bind(port, host);

  return socket;
}

module.exports = { iniciarServidorUDP };
