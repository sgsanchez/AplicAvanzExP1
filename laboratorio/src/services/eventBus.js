/**
 * =====================================================================
 *  TurnoConnect - Bus de eventos interno
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Desacopla la capa de servicio de los mecanismos de notificación.
 *  El servicio de turnos publica eventos y el módulo de WebSockets los
 *  consume para difundir los cambios a todos los navegadores.
 *
 *  Eventos publicados:
 *    - turno:creado      { turno, usuario }
 *    - turno:actualizado { turno, usuario, accion, estadoAnterior }
 *    - turno:eliminado   { turno, usuario }
 */
'use strict';

const { EventEmitter } = require('events');

const bus = new EventEmitter();

// Evita la advertencia de "MaxListenersExceededWarning" si se añaden varios
bus.setMaxListeners(50);

module.exports = bus;
