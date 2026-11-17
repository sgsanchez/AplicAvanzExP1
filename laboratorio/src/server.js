/**
 * =====================================================================
 *  TurnoConnect - Punto de entrada principal
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Levanta en un solo proceso los cuatro mecanismos de comunicación:
 *
 *    1. REST + JWT           -> HTTP  :3000  (/api/...)
 *    2. WebSockets           -> HTTP  :3000  (Socket.IO)
 *    3. Sockets TCP          -> TCP   :5000
 *    4. Sockets UDP          -> UDP   :5001
 *
 *  Todos comparten la MISMA conexión a MongoDB a través de
 *  "turnoService", por lo que la información siempre es consistente.
 */
'use strict';

const http = require('http');

const config = require('./config/env');
const { conectarDB, desconectarDB } = require('./config/db');
const { crearApp } = require('./app');
const { registrarWebSockets } = require('./sockets/turno.socket');
const { iniciarServidorTCP } = require('./tcp/tcpServer');
const { iniciarServidorUDP } = require('./udp/udpServer');

/** Imprime el banner de identificación del trabajo. */
function banner() {
  const linea = '═'.repeat(66);
  console.log(`\x1b[36m${linea}\x1b[0m`);
  console.log('\x1b[1m  TurnoConnect — Sistema Distribuido de Gestión de Turnos\x1b[0m');
  console.log(`  Estudiante : ${config.estudiante}`);
  console.log(`  NRC        : ${config.nrc}`);
  console.log('  Asignatura : Aplicaciones Distribuidas — ESPE');
  console.log(`\x1b[36m${linea}\x1b[0m`);
}

async function main() {
  banner();

  // 1) Base de datos (obligatoria para todos los mecanismos)
  await conectarDB();

  // 2) Aplicación Express + servidor HTTP
  const app = crearApp();
  const httpServer = http.createServer(app);

  // 3) WebSockets sobre el mismo servidor HTTP
  registrarWebSockets(httpServer);

  // 4) Servidores de sockets TCP y UDP
  const tcpServer = iniciarServidorTCP({ port: config.tcpPort });
  const udpServer = iniciarServidorUDP({ port: config.udpPort });

  // 5) Escuchar peticiones HTTP
  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.port, config.host, resolve);
  });

  const linea = '─'.repeat(66);
  console.log(`\x1b[32m${linea}\x1b[0m`);
  console.log('\x1b[32m✔ SERVICIOS ACTIVOS\x1b[0m');
  console.log(`  REST API     →  http://localhost:${config.port}/api`);
  console.log(`  Interfaz web →  http://localhost:${config.port}`);
  console.log(`  WebSocket    →  ws://localhost:${config.port}  (Socket.IO)`);
  console.log(`  Socket TCP   →  tcp://localhost:${config.tcpPort}`);
  console.log(`  Socket UDP   →  udp://localhost:${config.udpPort}`);
  console.log(`\x1b[32m${linea}\x1b[0m`);

  // ------------------------------------------------------------------
  //  Apagado ordenado
  // ------------------------------------------------------------------
  const apagar = async (senal) => {
    console.log(`\n\x1b[33m[${senal}]\x1b[0m Cerrando TurnoConnect...`);
    try {
      tcpServer.close();
      udpServer.close();
      httpServer.close();
      await desconectarDB();
    } catch (error) {
      console.error('Error durante el cierre:', error.message);
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => apagar('SIGINT'));
  process.on('SIGTERM', () => apagar('SIGTERM'));
}

main().catch((error) => {
  console.error('\x1b[31m✘ No fue posible iniciar TurnoConnect\x1b[0m');
  console.error(' ', error.message);
  process.exit(1);
});
