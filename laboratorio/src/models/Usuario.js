/**
 * =====================================================================
 *  TurnoConnect - Modelo de Usuario
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  La contraseña NUNCA se almacena en texto plano: se guarda el hash
 *  generado con bcryptjs en el campo "passwordHash".
 */
'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UsuarioSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: [true, 'El nombre de usuario es obligatorio'],
      unique: true,
      trim: true,
      minlength: [3, 'El nombre de usuario debe tener al menos 3 caracteres'],
      maxlength: [40, 'El nombre de usuario no puede superar 40 caracteres']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },
    passwordHash: {
      type: String,
      required: true,
      select: false // no se devuelve por defecto en las consultas
    },
    rol: {
      type: String,
      enum: ['usuario', 'admin'],
      default: 'usuario'
    }
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
    versionKey: false,
    collection: 'usuarios'
  }
);

/**
 * Genera el hash de una contraseña en texto plano.
 * @param {string} password
 * @returns {Promise<string>}
 */
UsuarioSchema.statics.hashearPassword = function hashearPassword(password) {
  return bcrypt.hash(password, 10);
};

/**
 * Compara una contraseña en texto plano con el hash almacenado.
 * @param {string} password
 * @returns {Promise<boolean>}
 */
UsuarioSchema.methods.verificarPassword = function verificarPassword(password) {
  return bcrypt.compare(password, this.passwordHash);
};

/**
 * Representación pública del usuario (sin datos sensibles).
 * @returns {{id: string, nombre: string, email: string|null, rol: string}}
 */
UsuarioSchema.methods.aJSON = function aJSON() {
  return {
    id: this._id.toString(),
    nombre: this.nombre,
    email: this.email,
    rol: this.rol
  };
};

module.exports = mongoose.model('Usuario', UsuarioSchema);
