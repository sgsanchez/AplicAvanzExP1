/**
 * =====================================================================
 *  TurnoConnect - Constantes compartidas del dominio
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Se centralizan los estados y tipos de atención para que REST,
 *  WebSocket, TCP y UDP usen exactamente los mismos valores.
 */
'use strict';

/** Estados permitidos de un turno (en el orden natural del flujo). */
const ESTADOS = Object.freeze({
  PENDIENTE: 'Pendiente',
  EN_ATENCION: 'En atención',
  FINALIZADO: 'Finalizado'
});

/** Lista de estados válidos. */
const ESTADOS_VALIDOS = Object.freeze(Object.values(ESTADOS));

/** Tipos de atención que puede solicitar un usuario. */
const TIPOS_ATENCION = Object.freeze([
  'General',
  'Preferencial',
  'Trámites',
  'Soporte Técnico'
]);

/** Transiciones de estado permitidas por el servidor. */
const TRANSICIONES = Object.freeze({
  [ESTADOS.PENDIENTE]: [ESTADOS.EN_ATENCION],
  [ESTADOS.EN_ATENCION]: [ESTADOS.FINALIZADO],
  [ESTADOS.FINALIZADO]: []
});

module.exports = { ESTADOS, ESTADOS_VALIDOS, TIPOS_ATENCION, TRANSICIONES };
