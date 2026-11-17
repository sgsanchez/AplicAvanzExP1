/**
 * =====================================================================
 *  TurnoConnect - Cliente TCP interactivo
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  MODOS DE USO
 *  -------------
 *  1) Interactivo (menú):
 *         node clientes/clienteTCP.js
 *         node clientes/clienteTCP.js Santiago          (usuario predefinido)
 *
 *  2) Consulta directa (ideal para capturas del informe):
 *         node clientes/clienteTCP.js Santiago T-001
 *
 *  El cliente muestra en pantalla el nombre del estudiante para que las
 *  capturas evidencien la autoría del trabajo.
 */
'use strict';

const net = require('net');
const readline = require('readline');

const config = require('../src/config/env');

// ---------------------------------------------------------------------
//  Configuración desde argumentos de línea de comandos
// ---------------------------------------------------------------------
const [, , argUsuario, argCodigo] = process.argv;
const HOST = process.env.TCP_HOST || '127.0.0.1';
const PORT = Number(process.env.TCP_PORT || config.tcpPort);

const linea = '═'.repeat(62);
console.log(`\x1b[36m${linea}\x1b[0m`);
console.log('  TurnoConnect · CLIENTE TCP');
console.log(`  Estudiante: ${config.estudiante} · NRC ${config.nrc}`);
console.log(`  Servidor  : ${HOST}:${PORT}`);
console.log(`\x1b[36m${linea}\x1b[0m`);

// ---------------------------------------------------------------------
//  Conexión
// ---------------------------------------------------------------------
const socket = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log(`\x1b[32m[CLIENTE]\x1b[0m Conectado al servidor TCP ${HOST}:${PORT}`);
});

let identificado = false;
let buffer = '';
let rl = null;

/**
 * Envía un objeto JSON terminado en "\n".
 */
function enviar(objeto) {
  if (socket.destroyed) {
    console.log('\x1b[31m[CLIENTE]\x1b[0m El socket está cerrado.');
    return;
  }
  socket.write(`${JSON.stringify(objeto)}\n`);
}

/**
 * Formatea un turno para imprimirlo en consola.
 */
function imprimirTurno(turno) {
  console.log('\x1b[36m  ┌────────────────────────────────────────────────┐\x1b[0m');
  console.log(`\x1b[36m  │\x1b[0m Código      : \x1b[1m${turno.codigo}\x1b[0m`);
  console.log(`\x1b[36m  │\x1b[0m Solicitante : ${turno.solicitante}`);
  console.log(`\x1b[36m  │\x1b[0m Estado      : ${turno.estado}`);
  if (turno.tipoAtencion) console.log(`\x1b[36m  │\x1b[0m Tipo        : ${turno.tipoAtencion}`);
  if (turno.fechaRegistro) {
    console.log(
      `\x1b[36m  │\x1b[0m Registro    : ${new Date(turno.fechaRegistro).toLocaleString('es-EC')}`
    );
  }
  if (turno.iniciadoPor) console.log(`\x1b[36m  │\x1b[0m En atención : ${turno.iniciadoPor}`);
  console.log('\x1b[36m  └────────────────────────────────────────────────┘\x1b[0m');
}

// ---------------------------------------------------------------------
//  Recepción y procesamiento de respuestas
// ---------------------------------------------------------------------
socket.on('data', (chunk) => {
  buffer += chunk.toString('utf8');

  let indice = buffer.indexOf('\n');
  while (indice !== -1) {
    const texto = buffer.slice(0, indice).trim();
    buffer = buffer.slice(indice + 1);
    if (texto) procesarRespuesta(texto);
    indice = buffer.indexOf('\n');
  }
});

function procesarRespuesta(texto) {
  let msg;
  try {
    msg = JSON.parse(texto);
  } catch (_e) {
    console.log(`\x1b[90m<< ${texto}\x1b[0m`);
    return;
  }

  switch (msg.tipo) {
    case 'BIENVENIDA':
      console.log(`\x1b[32m[SERVIDOR]\x1b[0m ${msg.mensaje}`);
      console.log(`\x1b[90m           Estudiante del servidor: ${msg.estudiante}\x1b[0m`);
      // Si se recibió el usuario por argumento, iniciar sesión de inmediato
      if (argUsuario) {
        enviar({ tipo: 'LOGIN', usuario: argUsuario });
      } else {
        iniciarInteractivo();
      }
      break;

    case 'LOGIN_OK':
      identificado = true;
      console.log(`\x1b[32m[SERVIDOR]\x1b[0m ${msg.mensaje}`);
      console.log(`\x1b[90m           Hora del servidor: ${msg.hora}\x1b[0m`);

      // Modo consulta directa
      if (argCodigo) {
        enviar({ tipo: 'CONSULTAR', codigo: argCodigo });
      } else {
        mostrarMenu();
      }
      break;

    case 'TURNO':
      console.log(`\x1b[32m[SERVIDOR]\x1b[0m ${msg.mensaje}`);
      imprimirTurno(msg.turno);
      if (argCodigo) socket.end();
      else mostrarMenu();
      break;

    case 'TURNOS':
      console.log(`\x1b[32m[SERVIDOR]\x1b[0m ${msg.mensaje} (total: ${msg.total})`);
      msg.turnos.forEach((t) => {
        console.log(
          `   ${t.codigo.padEnd(7)} ${t.estado.padEnd(13)} ${t.solicitante}`
        );
      });
      mostrarMenu();
      break;

    case 'AYUDA':
      console.log('\x1b[90m');
      msg.comandos.forEach((c) => console.log(`   ${c}`));
      console.log('\x1b[0m');
      mostrarMenu();
      break;

    case 'PONG':
      console.log(`\x1b[90m[SERVIDOR] PONG ${msg.hora}\x1b[0m`);
      mostrarMenu();
      break;

    case 'ERROR':
      console.log(`\x1b[31m[SERVIDOR] ERROR:\x1b[0m ${msg.mensaje}`);
      if (argCodigo && !identificado) socket.end();
      else mostrarMenu();
      break;

    case 'ADIOS':
      console.log(`\x1b[33m[SERVIDOR]\x1b[0m ${msg.mensaje}`);
      break;

    default:
      console.log(`\x1b[90m<< ${texto}\x1b[0m`);
      mostrarMenu();
  }
}

// ---------------------------------------------------------------------
//  Interfaz interactiva
// ---------------------------------------------------------------------
function iniciarInteractivo() {
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question('\x1b[36mIngrese su nombre de usuario: \x1b[0m', (respuesta) => {
    const usuario = respuesta.trim();
    if (!usuario) {
      console.log('\x1b[31m[CLIENTE]\x1b[0m Debe ingresar un nombre de usuario.');
      return iniciarInteractivo();
    }
    enviar({ tipo: 'LOGIN', usuario });
  });
}

/**
 * Crea la interfaz de lectura si aún no existe.
 * @returns {readline.Interface}
 */
function asegurarReadline() {
  if (!rl) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rl;
}

function mostrarMenu() {
  // En modo "consulta directa" no se muestra menú
  if (argCodigo) return;

  console.log(`
\x1b[36m┌─ MENÚ ─────────────────────────────────────┐\x1b[0m
  \x1b[1m1\x1b[0m) Consultar turno por código
  \x1b[1m2\x1b[0m) Listar todos los turnos
  \x1b[1m3\x1b[0m) Ayuda de comandos
  \x1b[1m4\x1b[0m) Verificar conexión (PING)
  \x1b[1m0\x1b[0m) Salir
\x1b[36m└────────────────────────────────────────────┘\x1b[0m`);

  asegurarReadline().question('> Opción: ', (opcion) => {
    switch (opcion.trim()) {
      case '1':
        return preguntarCodigo();
      case '2':
        return enviar({ tipo: 'LISTAR' });
      case '3':
        return enviar({ tipo: 'AYUDA' });
      case '4':
        return enviar({ tipo: 'PING' });
      case '0':
        return enviar({ tipo: 'SALIR' });
      default:
        console.log('\x1b[31mOpción no válida.\x1b[0m');
        return mostrarMenu();
    }
  });
}

function preguntarCodigo() {
  asegurarReadline().question('Código del turno (ej. T-001): ', (codigo) => {
    enviar({ tipo: 'CONSULTAR', codigo: codigo.trim() });
  });
}

// ---------------------------------------------------------------------
//  Eventos de cierre y error
// ---------------------------------------------------------------------
socket.on('close', () => {
  console.log('\x1b[90m[CLIENTE] Conexión cerrada con el servidor TCP.\x1b[0m');
  if (rl) rl.close();
  process.exit(0);
});

socket.on('error', (error) => {
  console.error(`\x1b[31m[CLIENTE] Error de conexión:\x1b[0m ${error.message}`);
  console.error(
    `           Verifique que el servidor TCP esté activo en ${HOST}:${PORT} (npm start)`
  );
  process.exit(1);
});
