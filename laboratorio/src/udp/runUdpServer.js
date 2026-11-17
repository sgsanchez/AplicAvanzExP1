/**
 * =====================================================================
 *  TurnoConnect - Arranque independiente del servidor UDP (opcional)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Uso:  npm run udp
 */
'use strict';

const config = require('../config/env');
const { conectarDB, desconectarDB } = require('../config/db');
const { iniciarServidorUDP } = require('./udpServer');

async function main() {
  console.log(
    `\x1b[34m[UDP]\x1b[0m Arranque independiente · ${config.estudiante} · NRC ${config.nrc}`
  );
  await conectarDB();
  const socket = iniciarServidorUDP({ port: config.udpPort });

  const cerrar = async () => {
    socket.close();
    await desconectarDB();
    process.exit(0);
  };

  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
}

main().catch((error) => {
  console.error('[UDP] No fue posible iniciar el servidor:', error.message);
  process.exit(1);
});
