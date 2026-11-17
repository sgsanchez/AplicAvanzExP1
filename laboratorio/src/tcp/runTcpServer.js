/**
 * =====================================================================
 *  TurnoConnect - Arranque independiente del servidor TCP (opcional)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Permite levantar SOLO el servidor TCP (útil para demostrar que el
 *  servicio es independiente). En el modo normal se arranca junto con
 *  todo el sistema mediante "npm start".
 *
 *  Uso:  npm run tcp
 */
'use strict';

const config = require('../config/env');
const { conectarDB, desconectarDB } = require('../config/db');
const { iniciarServidorTCP } = require('./tcpServer');

async function main() {
  console.log(
    `\x1b[35m[TCP]\x1b[0m Arranque independiente · ${config.estudiante} · NRC ${config.nrc}`
  );
  await conectarDB();
  const servidor = iniciarServidorTCP({ port: config.tcpPort });

  const cerrar = async () => {
    servidor.close();
    await desconectarDB();
    process.exit(0);
  };

  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((error) => {
  console.error('[TCP] No fue posible iniciar el servidor:', error.message);
  process.exit(1);
});
