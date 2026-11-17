/**
 * =====================================================================
 *  TurnoConnect - Modelo Contador (generación de códigos de turno)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Se usa un documento contador con "$inc" atómico para que, aunque
 *  varios clientes (REST, TCP, WebSocket) creen turnos al mismo tiempo,
 *  los códigos nunca se repitan.
 */
'use strict';

const mongoose = require('mongoose');

const ContadorSchema = new mongoose.Schema(
  {
    // El identificador del documento es el nombre del contador, p. ej. "turno"
    _id: { type: String, required: true },
    secuencia: { type: Number, default: 0 }
  },
  { versionKey: false, collection: 'contadores' }
);

/**
 * Obtiene el siguiente número de secuencia de forma atómica.
 * @param {string} nombre Nombre del contador.
 * @returns {Promise<number>}
 */
ContadorSchema.statics.siguiente = async function siguiente(nombre) {
  const doc = await this.findByIdAndUpdate(
    nombre,
    { $inc: { secuencia: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc.secuencia;
};

module.exports = mongoose.model('Contador', ContadorSchema);
