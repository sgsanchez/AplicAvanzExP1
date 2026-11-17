/**
 * =====================================================================
 *  TurnoConnect - Middlewares de error y de rutas no encontradas
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Garantiza que TODAS las respuestas de error salgan en formato JSON
 *  con un código HTTP apropiado (requisito de la Parte 4).
 */
'use strict';

/**
 * Traduce cualquier error a una respuesta JSON uniforme.
 */
function manejadorErrores(err, req, res, _next) {
  // Errores de validación de Mongoose
  if (err.name === 'ValidationError') {
    const detalles = Object.values(err.errors).map((e) => ({
      campo: e.path,
      mensaje: e.message
    }));
    return res.status(400).json({
      ok: false,
      error: 'Datos inválidos',
      detalles
    });
  }

  // Clave duplicada (por ejemplo, nombre de usuario repetido)
  if (err.code === 11000) {
    const campo = Object.keys(err.keyValue || {})[0] || 'campo';
    return res.status(409).json({
      ok: false,
      error: `Ya existe un registro con el mismo valor en "${campo}"`,
      detalles: err.keyValue
    });
  }

  // Error de ObjectId mal formado
  if (err.name === 'CastError') {
    return res.status(400).json({
      ok: false,
      error: `El valor "${err.value}" no es válido para el campo "${err.path}"`
    });
  }

  // Errores de negocio lanzados con AppError
  if (err.name === 'AppError' || typeof err.status === 'number') {
    const cuerpo = { ok: false, error: err.message };
    if (err.detalles) cuerpo.detalles = err.detalles;
    return res.status(err.status || 400).json(cuerpo);
  }

  // Cualquier otro error inesperado
  console.error('\x1b[31m[ERROR]\x1b[0m', err);
  return res.status(500).json({
    ok: false,
    error: 'Error interno del servidor',
    detalle: process.env.NODE_ENV === 'production' ? undefined : err.message
  });
}

/**
 * Responde 404 en JSON para rutas de API inexistentes.
 */
function noEncontrado(req, res) {
  res.status(404).json({
    ok: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`
  });
}

module.exports = { manejadorErrores, noEncontrado };
