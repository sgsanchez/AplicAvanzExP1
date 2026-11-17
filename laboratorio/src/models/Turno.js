/**
 * =====================================================================
 *  TurnoConnect - Modelo de Turno
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Documento central del sistema. Todos los mecanismos de comunicación
 *  (REST, WebSocket, TCP, UDP) leen y escriben sobre esta colección.
 *
 *  Campos obligatorios exigidos por el examen:
 *    - Código del turno        -> codigo
 *    - Nombre del solicitante  -> solicitante
 *    - Tipo de atención        -> tipoAtencion
 *    - Estado del turno        -> estado
 *    - Fecha y hora de registro-> fechaRegistro
 */
'use strict';

const mongoose = require('mongoose');
const {
  ESTADOS,
  ESTADOS_VALIDOS,
  TIPOS_ATENCION
} = require('../utils/constantes');

/** Entrada del historial de cambios de estado. */
const HistorialSchema = new mongoose.Schema(
  {
    estado: {
      type: String,
      enum: ESTADOS_VALIDOS,
      required: true
    },
    usuario: {
      type: String,
      required: true,
      trim: true
    },
    fecha: {
      type: Date,
      default: Date.now
    }
  },
  { _id: false }
);

const TurnoSchema = new mongoose.Schema(
  {
    /** Código legible y único del turno, por ejemplo: T-001 */
    codigo: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      uppercase: true
    },

    /** Nombre de la persona que solicita la atención */
    solicitante: {
      type: String,
      required: [true, 'El nombre del solicitante es obligatorio'],
      trim: true,
      minlength: [3, 'El nombre del solicitante debe tener al menos 3 caracteres'],
      maxlength: [80, 'El nombre del solicitante no puede superar 80 caracteres']
    },

    /** Tipo de atención solicitada */
    tipoAtencion: {
      type: String,
      required: [true, 'El tipo de atención es obligatorio'],
      enum: {
        values: TIPOS_ATENCION,
        message: `El tipo de atención debe ser uno de: ${TIPOS_ATENCION.join(', ')}`
      }
    },

    /** Estado actual del turno */
    estado: {
      type: String,
      enum: {
        values: ESTADOS_VALIDOS,
        message: `El estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`
      },
      default: ESTADOS.PENDIENTE,
      index: true
    },

    /** Fecha y hora en que se registró el turno */
    fechaRegistro: {
      type: Date,
      default: Date.now,
      index: true
    },

    /** Usuario que inició la atención */
    iniciadoPor: { type: String, default: null },
    iniciadoEn: { type: Date, default: null },

    /** Usuario que finalizó la atención */
    finalizadoPor: { type: String, default: null },
    finalizadoEn: { type: Date, default: null },

    /** Trazabilidad completa de los cambios de estado */
    historial: {
      type: [HistorialSchema],
      default: []
    }
  },
  {
    timestamps: { createdAt: 'creadoEn', updatedAt: 'actualizadoEn' },
    versionKey: false,
    collection: 'turnos'
  }
);

/** Índice compuesto útil para ordenar la cola de atención. */
TurnoSchema.index({ estado: 1, fechaRegistro: 1 });

/**
 * Representación JSON uniforme del turno.
 * Se usa la MISMA estructura en REST, TCP y WebSocket para que la
 * información sea consistente entre todos los mecanismos.
 * @returns {object}
 */
TurnoSchema.methods.aJSON = function aJSON() {
  return {
    id: this._id.toString(),
    codigo: this.codigo,
    solicitante: this.solicitante,
    tipoAtencion: this.tipoAtencion,
    estado: this.estado,
    fechaRegistro: this.fechaRegistro,
    iniciadoPor: this.iniciadoPor,
    iniciadoEn: this.iniciadoEn,
    finalizadoPor: this.finalizadoPor,
    finalizadoEn: this.finalizadoEn,
    historial: this.historial,
    actualizadoEn: this.actualizadoEn
  };
};

module.exports = mongoose.model('Turno', TurnoSchema);
