/**
 * =====================================================================
 *  TurnoConnect - Error de aplicación con código HTTP asociado
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Permite que la capa de servicio lance errores de negocio y que el
 *  middleware de Express los traduzca al código HTTP adecuado
 *  (400, 401, 404, 409, ...).
 */
'use strict';

class AppError extends Error {
  /**
   * @param {number} status Código HTTP a devolver.
   * @param {string} message Mensaje legible para el cliente.
   * @param {object} [detalles] Información adicional opcional.
   */
  constructor(status, message, detalles = null) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.detalles = detalles;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
