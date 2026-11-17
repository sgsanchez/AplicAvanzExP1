/**
 * =====================================================================
 *  TurnoConnect - Datos iniciales de prueba (seed)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Crea dos usuarios de prueba y algunos turnos de ejemplo para poder
 *  ejecutar el escenario de integración del examen.
 *
 *  Uso:  npm run seed
 */
'use strict';

const config = require('../src/config/env');
const { conectarDB, desconectarDB } = require('../src/config/db');
const Usuario = require('../src/models/Usuario');
const Turno = require('../src/models/Turno');
const turnoService = require('../src/services/turnoService');

/** Usuarios de prueba (la contraseña se almacena cifrada con bcrypt). */
const USUARIOS = [
  { nombre: 'santiago', password: 'Santiago2026*', email: 'santiago@espe.edu.ec' },
  { nombre: 'maria', password: 'Maria2026*', email: 'maria@espe.edu.ec' }
];

/** Turnos de ejemplo. */
const TURNOS = [
  { solicitante: 'Ana Torres', tipoAtencion: 'General' },
  { solicitante: 'Luis Pérez', tipoAtencion: 'Preferencial' },
  { solicitante: 'Carla Mendoza', tipoAtencion: 'Trámites' },
  { solicitante: 'José Ramírez', tipoAtencion: 'Soporte Técnico' }
];

async function main() {
  console.log('═'.repeat(62));
  console.log('  TurnoConnect · Carga de datos de prueba');
  console.log(`  Estudiante: ${config.estudiante} · NRC ${config.nrc}`);
  console.log('═'.repeat(62));

  await conectarDB();

  // ------------------------------------------------------------------
  //  1) Usuarios
  // ------------------------------------------------------------------
  for (const datos of USUARIOS) {
    const existente = await Usuario.findOne({ nombre: datos.nombre });
    if (existente) {
      console.log(`  · Usuario "${datos.nombre}" ya existe (no se modifica)`);
      continue;
    }

    const passwordHash = await Usuario.hashearPassword(datos.password);
    await Usuario.create({
      nombre: datos.nombre,
      email: datos.email,
      passwordHash
    });
    console.log(`\x1b[32m  ✔ Usuario creado:\x1b[0m ${datos.nombre} / ${datos.password}`);
  }

  // ------------------------------------------------------------------
  //  2) Turnos
  // ------------------------------------------------------------------
  const cantidadActual = await Turno.countDocuments();
  if (cantidadActual > 0) {
    console.log(
      `\n  · Ya existen ${cantidadActual} turno(s) en la base de datos; no se crean duplicados.`
    );
    console.log('    Para empezar de cero: elimine la colección "turnos" en MongoDB.');
  } else {
    console.log('\n  Creando turnos de ejemplo…');
    for (const datos of TURNOS) {
      const turno = await turnoService.crearTurno(datos, 'santiago');
      console.log(
        `\x1b[32m  ✔ Turno ${turno.codigo}\x1b[0m · ${turno.solicitante} · ${turno.tipoAtencion} · ${turno.estado}`
      );
    }
  }

  // ------------------------------------------------------------------
  //  3) Resumen
  // ------------------------------------------------------------------
  const stats = await turnoService.estadisticas();
  console.log('\n' + '─'.repeat(62));
  console.log('  RESUMEN DEL SISTEMA');
  console.log(`    Pendientes  : ${stats.pendientes}`);
  console.log(`    En atención : ${stats.enAtencion}`);
  console.log(`    Finalizados : ${stats.finalizados}`);
  console.log(`    Total       : ${stats.total}`);
  console.log('─'.repeat(62));
  console.log('\n  Ahora ejecute:  npm start');
  console.log('  E ingrese a:    http://localhost:3000\n');

  await desconectarDB();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('\x1b[31m✖ Error en la carga de datos:\x1b[0m', error.message);
  try {
    await desconectarDB();
  } catch (_e) {
    /* ignorado */
  }
  process.exit(1);
});
