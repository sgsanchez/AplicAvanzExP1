/**
 * =====================================================================
 *  TurnoConnect - Cliente UDP
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  MODOS DE USO
 *  -------------
 *  1) Consulta directa (ideal para capturas con dos clientes distintos):
 *         node clientes/clienteUDP.js Santiago ESTADISTICAS
 *         node clientes/clienteUDP.js Maria    PENDIENTES
 *
 *  2) Todas las consultas de una vez:
 *         node clientes/clienteUDP.js Santiago
 *
 *  3) Menú interactivo:
 *         node clientes/clienteUDP.js
 *
 *  Los datagramas son independientes: no se mantiene una conexión abierta.
 */
'use strict';

const dgram = require('dgram');
const readline = require('readline');

const config = require('../src/config/env');

const [, , argCliente, argConsulta] = process.argv;
const HOST = process.env.UDP_HOST || '127.0.0.1';
const PORT = Number(process.env.UDP_PORT || config.udpPort);

const linea = '═'.repeat(62);
console.log(`\x1b[36m${linea}\x1b[0m`);
console.log('  TurnoConnect · CLIENTE UDP');
console.log(`  Estudiante: ${config.estudiante} · NRC ${config.nrc}`);
console.log(`  Servidor  : ${HOST}:${PORT} (sin conexión, datagramas)`);
console.log(`\x1b[36m${linea}\x1b[0m`);

const cliente = dgram.createSocket('udp4');
let nombre = argCliente || 'cliente-udp';
let pendientesEsperadas = 0;

/**
 * Envía una consulta y espera la respuesta.
 * @param {string} tipo Tipo de consulta.
 * @param {Function} [alRecibir] Callback al recibir la respuesta.
 */
function consultar(tipo, alRecibir) {
  const solicitud = { tipo, cliente: nombre };
  const carga = Buffer.from(JSON.stringify(solicitud), 'utf8');

  pendientesEsperadas += 1;
  console.log(
    `\x1b[90m[ENVÍO]\x1b[0m ${JSON.stringify(solicitud)}  →  ${HOST}:${PORT}`
  );

  cliente.send(carga, PORT, HOST, (error) => {
    if (error) {
      console.error(`\x1b[31m[CLIENTE]\x1b[0m Error al enviar: ${error.message}`);
      process.exit(1);
    }
    if (alRecibir) cliente.once('nueva-respuesta', alRecibir);
  });
}

/**
 * Imprime de forma legible la respuesta recibida.
 */
function imprimirRespuesta(msg) {
  console.log('\x1b[32m[RESPUESTA]\x1b[0m');
  if (msg.tipo === 'ESTADISTICAS') {
    console.log('\x1b[34m  ┌──────────── ESTADÍSTICAS DEL SISTEMA ────────────┐\x1b[0m');
    console.log(`\x1b[34m  │\x1b[0m  Pendientes   : \x1b[1m${msg.pendientes}\x1b[0m`);
    console.log(`\x1b[34m  │\x1b[0m  En atención  : \x1b[1m${msg.enAtencion}\x1b[0m`);
    console.log(`\x1b[34m  │\x1b[0m  Finalizados  : \x1b[1m${msg.finalizados}\x1b[0m`);
    console.log(`\x1b[34m  │\x1b[0m  Total        : \x1b[1m${msg.total}\x1b[0m`);
    console.log(`\x1b[34m  │\x1b[0m  Consultó     : ${msg.cliente}`);
    console.log(`\x1b[34m  │\x1b[0m  Hora         : ${msg.hora}`);
    console.log('\x1b[34m  └──────────────────────────────────────────────────┘\x1b[0m');
  } else if (msg.tipo === 'CONTEO') {
    console.log(`  Consulta : ${msg.consulta}`);
    console.log(`  Cantidad : \x1b[1m${msg.cantidad}\x1b[0m`);
    console.log(`  Cliente  : ${msg.cliente}`);
  } else if (msg.tipo === 'ERROR') {
    console.log(`\x1b[31m  ERROR: ${msg.mensaje}\x1b[0m`);
  } else if (msg.tipo === 'AYUDA') {
    msg.consultas.forEach((c) => console.log(`   ${c}`));
  } else {
    console.log(JSON.stringify(msg, null, 2));
  }

  if (msg.estudiante) {
    console.log(`\x1b[90m  (servidor de ${msg.estudiante} · NRC ${msg.nrc})\x1b[0m`);
  }
  console.log('');
}

// ---------------------------------------------------------------------
//  Recepción de datagramas
// ---------------------------------------------------------------------
cliente.on('message', (msg, rinfo) => {
  let respuesta;
  try {
    respuesta = JSON.parse(msg.toString('utf8'));
  } catch (_e) {
    console.log(`\x1b[90m<< ${msg.toString('utf8')}\x1b[0m`);
    return;
  }

  console.log(`\x1b[90m[RECIBIDO]\x1b[0m datagrama de ${rinfo.address}:${rinfo.port}`);
  imprimirRespuesta(respuesta);

  pendientesEsperadas = Math.max(0, pendientesEsperadas - 1);
  cliente.emit('nueva-respuesta', respuesta);

  // Cierre automático del socket:
  //   - modo "todas las consultas": al recibir la última respuesta
  //   - modo "consulta directa": tras recibir la única respuesta
  //   - modo interactivo: el usuario decide cuándo salir (opción 0)
  if ((modoTodas || argConsulta) && pendientesEsperadas === 0) {
    setTimeout(() => cliente.close(), 300);
  }
});

cliente.on('error', (error) => {
  console.error(`\x1b[31m[CLIENTE]\x1b[0m Error: ${error.message}`);
  cliente.close();
  process.exit(1);
});

cliente.on('close', () => {
  console.log('\x1b[90m[CLIENTE] Socket UDP cerrado.\x1b[0m');
  process.exit(0);
});

// ---------------------------------------------------------------------
//  Modos de ejecución
// ---------------------------------------------------------------------
let modoTodas = false;

if (argConsulta) {
  // Modo consulta directa ------------------------------------------------
  consultar(argConsulta.toUpperCase());
  setTimeout(() => {
    if (pendientesEsperadas > 0) {
      console.log(
        '\x1b[31m[CLIENTE]\x1b[0m No se recibió respuesta (¿está activo el servidor UDP?).'
      );
      cliente.close();
    }
  }, 3000);
} else if (argCliente) {
  // Modo "todas las consultas" ------------------------------------------
  modoTodas = true;
  consultar('ESTADISTICAS');
  consultar('PENDIENTES');
  consultar('EN_ATENCION');
  consultar('FINALIZADOS');
} else {
  // Modo interactivo -----------------------------------------------------
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const menu = () => {
    console.log(`
\x1b[34m┌─ CONSULTAS UDP ────────────────────────────┐\x1b[0m
  \x1b[1m1\x1b[0m) Estadísticas generales
  \x1b[1m2\x1b[0m) Cantidad de pendientes
  \x1b[1m3\x1b[0m) Cantidad en atención
  \x1b[1m4\x1b[0m) Cantidad finalizados
  \x1b[1m0\x1b[0m) Salir
\x1b[34m└────────────────────────────────────────────┘\x1b[0m`);
    rl.question('> Opción: ', (opcion) => {
      switch (opcion.trim()) {
        case '1':
          return consultar('ESTADISTICAS', menu);
        case '2':
          return consultar('PENDIENTES', menu);
        case '3':
          return consultar('EN_ATENCION', menu);
        case '4':
          return consultar('FINALIZADOS', menu);
        case '0':
          rl.close();
          return cliente.close();
        default:
          console.log('\x1b[31mOpción no válida.\x1b[0m');
          return menu();
      }
    });
  };

  rl.question(`\x1b[36mNombre para identificar sus consultas: \x1b[0m`, (respuesta) => {
    if (respuesta.trim()) nombre = respuesta.trim();
    menu();
  });
}
