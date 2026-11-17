/**
 * =====================================================================
 *  TurnoConnect - Carga y validación de variables de entorno
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Centraliza la lectura del archivo .env para que ningún otro módulo
 *  dependa directamente de process.env.
 */
'use strict';

const path = require('path');
const dotenv = require('dotenv');

// Carga el archivo .env ubicado en la raíz del proyecto
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

/**
 * Devuelve el valor de una variable de entorno o un valor por defecto.
 * @param {string} nombre  Nombre de la variable.
 * @param {string} defecto Valor a usar si no está definida.
 * @returns {string}
 */
const leer = (nombre, defecto) => {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? defecto : valor;
};

const config = {
  // Servidor HTTP / WebSocket
  port: Number(leer('PORT', '3000')),
  host: leer('HOST', '0.0.0.0'),

  // Servidores de sockets
  tcpPort: Number(leer('TCP_PORT', '5000')),
  udpPort: Number(leer('UDP_PORT', '5001')),

  // Base de datos
  mongoUri: leer('MONGODB_URI', 'mongodb://127.0.0.1:27017/turnoconnect'),

  // Seguridad
  jwtSecret: leer('JWT_SECRET', 'clave_de_desarrollo_no_usar_en_produccion'),
  jwtExpires: leer('JWT_EXPIRES', '2h'),

  // Datos del estudiante (usados como firma en terminal e interfaz)
  estudiante: leer('ESTUDIANTE_NOMBRE', 'SANTIAGO GEOVANNY SANCHEZ CAMACHO'),
  nrc: leer('ESTUDIANTE_NRC', '37869')
};

// ---------------------------------------------------------------------
// Advertencia de seguridad: no usar el secreto por defecto fuera de clase
// ---------------------------------------------------------------------
if (!process.env.JWT_SECRET) {
  console.warn(
    '\x1b[33m[ADVERTENCIA]\x1b[0m No se encontró JWT_SECRET en el archivo .env. ' +
      'Se usará una clave de desarrollo.'
  );
}

module.exports = config;
