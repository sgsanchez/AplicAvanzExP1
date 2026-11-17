/**
 * =====================================================================
 *  TurnoConnect - Conexión a MongoDB mediante Mongoose
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Este módulo es el ÚNICO punto de acceso a la base de datos.
 *  Los cuatro mecanismos de comunicación (REST, WebSocket, TCP y UDP)
 *  comparten la misma conexión, garantizando que todos operen sobre la
 *  misma información (requisito de integración del examen).
 */
'use strict';

const mongoose = require('mongoose');
const config = require('./env');

let conectado = false;

/**
 * Establece la conexión con MongoDB.
 * @returns {Promise<typeof mongoose>}
 */
async function conectarDB() {
  if (conectado) return mongoose;

  // Desactiva el "strictQuery" para evitar advertencias de Mongoose 7+
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 8000
    });

    conectado = true;
    const { name, host, port } = mongoose.connection;
    console.log(
      `\x1b[32m[BD]\x1b[0m Conectado a MongoDB → base de datos "${name}" en ${host}:${port}`
    );
    return mongoose;
  } catch (error) {
    console.error('\x1b[31m[BD]\x1b[0m No fue posible conectar con MongoDB.');
    console.error(`      URI: ${config.mongoUri}`);
    console.error(`      Detalle: ${error.message}`);
    console.error(
      '      Verifique que el contenedor esté activo:  docker compose up -d'
    );
    throw error;
  }
}

/**
 * Cierra la conexión (usado en el apagado ordenado del servidor).
 */
async function desconectarDB() {
  if (!conectado) return;
  await mongoose.connection.close();
  conectado = false;
  console.log('[BD] Conexión con MongoDB cerrada.');
}

/**
 * Indica si la conexión está disponible.
 * @returns {boolean}
 */
function estaConectado() {
  return mongoose.connection.readyState === 1;
}

// Eventos de la conexión para trazabilidad
mongoose.connection.on('disconnected', () => {
  conectado = false;
  console.warn('\x1b[33m[BD]\x1b[0m Conexión con MongoDB perdida.');
});

mongoose.connection.on('reconnected', () => {
  conectado = true;
  console.log('\x1b[32m[BD]\x1b[0m Conexión con MongoDB restablecida.');
});

module.exports = { conectarDB, desconectarDB, estaConectado };
