/**
 * =====================================================================
 *  TurnoConnect - Servicio de Autenticación (registro, login y JWT)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 */
'use strict';

const jwt = require('jsonwebtoken');

const Usuario = require('../models/Usuario');
const AppError = require('../utils/AppError');
const config = require('../config/env');

/**
 * Genera un token JWT firmado para el usuario indicado.
 * @param {{id: string, nombre: string, rol: string}} usuario
 * @returns {string}
 */
function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
    config.jwtSecret,
    { expiresIn: config.jwtExpires }
  );
}

/**
 * Registra un nuevo usuario con la contraseña cifrada.
 * @param {{nombre: string, password: string, email?: string}} datos
 * @returns {Promise<{usuario: object, token: string}>}
 */
async function registrar({ nombre, password, email }) {
  const nombreLimpio = String(nombre || '').trim();
  const passwordLimpio = String(password || '');

  // ---- Validaciones de datos obligatorios -------------------------
  if (!nombreLimpio) {
    throw new AppError(400, 'El nombre de usuario es obligatorio');
  }
  if (nombreLimpio.length < 3) {
    throw new AppError(400, 'El nombre de usuario debe tener al menos 3 caracteres');
  }
  if (!passwordLimpio) {
    throw new AppError(400, 'La contraseña es obligatoria');
  }
  if (passwordLimpio.length < 6) {
    throw new AppError(400, 'La contraseña debe tener al menos 6 caracteres');
  }

  // ---- Evitar nombres duplicados ----------------------------------
  const existente = await Usuario.findOne({ nombre: nombreLimpio });
  if (existente) {
    throw new AppError(409, `El usuario "${nombreLimpio}" ya está registrado`);
  }

  const passwordHash = await Usuario.hashearPassword(passwordLimpio);

  const usuario = await Usuario.create({
    nombre: nombreLimpio,
    email: email ? String(email).trim().toLowerCase() : null,
    passwordHash
  });

  const publico = usuario.aJSON();
  return { usuario: publico, token: firmarToken(publico) };
}

/**
 * Autentica un usuario con sus credenciales.
 * @param {{nombre: string, password: string}} credenciales
 * @returns {Promise<{usuario: object, token: string}>}
 */
async function login({ nombre, password }) {
  const nombreLimpio = String(nombre || '').trim();
  const passwordLimpio = String(password || '');

  if (!nombreLimpio || !passwordLimpio) {
    throw new AppError(400, 'Debe indicar el nombre de usuario y la contraseña');
  }

  // Se pide explícitamente el hash porque el esquema lo oculta por defecto
  const usuario = await Usuario.findOne({ nombre: nombreLimpio }).select('+passwordHash');

  if (!usuario) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const coincide = await usuario.verificarPassword(passwordLimpio);
  if (!coincide) {
    throw new AppError(401, 'Credenciales inválidas');
  }

  const publico = usuario.aJSON();
  return { usuario: publico, token: firmarToken(publico) };
}

/**
 * Verifica y decodifica un token JWT.
 * @param {string} token
 * @returns {object} Payload del token.
 */
function verificarToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError(401, 'El token ha expirado, inicie sesión nuevamente');
    }
    throw new AppError(401, 'Token inválido');
  }
}

module.exports = { registrar, login, verificarToken, firmarToken };
