/**
 * =====================================================================
 *  TurnoConnect - Middleware de autenticación JWT
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Protege las rutas que requieren sesión. Exige el encabezado:
 *      Authorization: Bearer <token>
 *  Si no hay token o es inválido, responde 401 en formato JSON.
 */
'use strict';

const AppError = require('../utils/AppError');
const { verificarToken } = require('../services/authService');

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function autenticar(req, res, next) {
  const encabezado = req.headers.authorization || '';

  if (!encabezado.startsWith('Bearer ')) {
    return next(
      new AppError(
        401,
        'No autorizado: se requiere un token JWT. Envíe el encabezado "Authorization: Bearer <token>".'
      )
    );
  }

  const token = encabezado.slice(7).trim();
  if (!token) {
    return next(new AppError(401, 'No autorizado: el token está vacío'));
  }

  try {
    const payload = verificarToken(token);
    // Disponible para los controladores y para la auditoría de los turnos
    req.usuario = {
      id: payload.sub,
      nombre: payload.nombre,
      rol: payload.rol
    };
    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = { autenticar };
