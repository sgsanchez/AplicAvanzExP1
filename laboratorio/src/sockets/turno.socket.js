/**
 * =====================================================================
 *  TurnoConnect - Módulo de WebSockets (Parte 3)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Sincroniza en TIEMPO REAL todos los navegadores conectados.
 *
 *  Estrategia:
 *   1. Al conectarse un cliente se le envía el estado completo
 *      ("estado:inicial"), de modo que quien llega tarde ve la misma
 *      información que los demás.
 *   2. Cuando el servicio de turnos cambia algo, publica un evento en el
 *      bus y aquí se difunde a TODOS los clientes con io.emit(...).
 *
 *  Eventos emitidos hacia el cliente:
 *   - estado:inicial    { turnos, estadisticas, conectados, usuario }
 *   - turno:creado      { turno, usuario, accion, mensaje, fecha }
 *   - turno:actualizado { turno, usuario, accion, estadoAnterior, mensaje, fecha }
 *   - turno:eliminado   { turno, usuario, mensaje, fecha }
 *   - estadisticas      { pendientes, enAtencion, finalizados, total }
 *   - clientes:total    { conectados }
 *   - aviso             { mensaje, tipo }
 */
'use strict';

const { Server } = require('socket.io');

const bus = require('../services/eventBus');
const turnoService = require('../services/turnoService');
const config = require('../config/env');

/**
 * Descripción legible de la acción realizada (para mostrar en la interfaz).
 */
function describir(accion, estado) {
  switch (accion) {
    case 'iniciar':
      return 'inició la atención';
    case 'finalizar':
      return 'finalizó la atención';
    case 'cambiarEstado':
      return `cambió el estado a "${estado}"`;
    default:
      return 'actualizó el turno';
  }
}

/**
 * Registra todos los manejadores de Socket.IO sobre el servidor HTTP.
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function registrarWebSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    // Reconexión automática del cliente
    pingTimeout: 30000,
    pingInterval: 25000
  });

  // -------------------------------------------------------------------
  //  Conexión de un navegador
  // -------------------------------------------------------------------
  io.on('connection', async (socket) => {
    const usuario = socket.handshake.auth?.usuario || socket.handshake.query?.usuario || 'anónimo';

    console.log(
      `\x1b[36m[WS]\x1b[0m Cliente conectado: ${usuario} (socket ${socket.id}) · total: ${io.engine.clientsCount}`
    );

    // 1) Estado inicial: los clientes que llegan tarde reciben TODO
    try {
      const [turnos, estadisticas] = await Promise.all([
        turnoService.listarTurnos(),
        turnoService.estadisticas()
      ]);

      socket.emit('estado:inicial', {
        turnos,
        estadisticas,
        conectados: io.engine.clientsCount,
        usuario,
        estudiante: config.estudiante,
        fecha: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('aviso', { tipo: 'error', mensaje: 'No se pudo cargar el estado inicial' });
      console.error('[WS] Error al enviar estado inicial:', error.message);
    }

    // 2) Notificar a todos cuántos clientes hay conectados
    io.emit('clientes:total', { conectados: io.engine.clientsCount });

    // 3) Red de seguridad: petición explícita de refresco
    socket.on('solicitar:estado', async () => {
      try {
        const [turnos, estadisticas] = await Promise.all([
          turnoService.listarTurnos(),
          turnoService.estadisticas()
        ]);
        socket.emit('estado:inicial', {
          turnos,
          estadisticas,
          conectados: io.engine.clientsCount,
          usuario,
          fecha: new Date().toISOString()
        });
      } catch (error) {
        socket.emit('aviso', { tipo: 'error', mensaje: 'No se pudo refrescar el estado' });
      }
    });

    // 4) Desconexión
    socket.on('disconnect', (motivo) => {
      console.log(
        `\x1b[36m[WS]\x1b[0m Cliente desconectado: ${usuario} (${motivo}) · total: ${io.engine.clientsCount}`
      );
      io.emit('clientes:total', { conectados: io.engine.clientsCount });
    });
  });

  // -------------------------------------------------------------------
  //  Difusión de los cambios originados en CUALQUIER mecanismo
  //  (REST, TCP, UDP o el propio WebSocket) -> consistencia total
  // -------------------------------------------------------------------
  bus.on('turno:creado', ({ turno, usuario }) => {
    io.emit('turno:creado', {
      turno,
      usuario,
      accion: 'crear',
      mensaje: `${usuario} registró el turno ${turno.codigo} (${turno.solicitante})`,
      fecha: new Date().toISOString()
    });
    refrescarEstadisticas(io);
  });

  bus.on('turno:actualizado', ({ turno, usuario, accion, estadoAnterior }) => {
    io.emit('turno:actualizado', {
      turno,
      usuario,
      accion,
      estadoAnterior,
      mensaje: `${usuario} ${describir(accion, turno.estado)} — turno ${turno.codigo}`,
      fecha: new Date().toISOString()
    });
    refrescarEstadisticas(io);
  });

  bus.on('turno:eliminado', ({ turno, usuario }) => {
    io.emit('turno:eliminado', {
      turno,
      usuario,
      accion: 'eliminar',
      mensaje: `${usuario} eliminó el turno ${turno.codigo}`,
      fecha: new Date().toISOString()
    });
    refrescarEstadisticas(io);
  });

  /**
   * Recalcula y difunde las estadísticas actualizadas.
   */
  async function refrescarEstadisticas(ioRef) {
    try {
      const estadisticas = await turnoService.estadisticas();
      ioRef.emit('estadisticas', estadisticas);
    } catch (error) {
      console.error('[WS] Error al recalcular estadísticas:', error.message);
    }
  }

  return io;
}

module.exports = { registrarWebSockets };
