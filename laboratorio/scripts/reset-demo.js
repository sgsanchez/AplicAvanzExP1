/**
 * =====================================================================
 *  TurnoConnect - Reinicio del escenario de demostración
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Deja la base de datos en un estado limpio y conocido, ideal para
 *  grabar el video explicativo o tomar las capturas del informe:
 *
 *    - Elimina todos los turnos y reinicia el contador de códigos
 *    - Garantiza que existan los usuarios de prueba
 *    - Crea 4 turnos en estado "Pendiente" (T-001 ... T-004)
 *
 *  Uso:  npm run demo:reset
 *
 *  ATENCIÓN: borra los turnos existentes.
 */
'use strict';

const config = require('../src/config/env');
const { conectarDB, desconectarDB } = require('../src/config/db');
const Usuario = require('../src/models/Usuario');
const Turno = require('../src/models/Turno');
const Contador = require('../src/models/Contador');
const turnoService = require('../src/services/turnoService');

const USUARIOS = [
  { nombre: 'santiago', password: 'Santiago2026*', email: 'santiago@espe.edu.ec' },
  { nombre: 'maria', password: 'Maria2026*', email: 'maria@espe.edu.ec' }
];

const TURNOS = [
  { solicitante: 'Ana Torres', tipoAtencion: 'General' },
  { solicitante: 'Luis Pérez', tipoAtencion: 'Preferencial' },
  { solicitante: 'Carla Mendoza', tipoAtencion: 'Trámites' },
  { solicitante: 'José Ramírez', tipoAtencion: 'Soporte Técnico' }
];

async function main() {
  console.log('');
  console.log('==============================================================');
  console.log('  TurnoConnect - Reinicio del escenario de demostración');
  console.log(`  Estudiante: ${config.estudiante} - NRC ${config.nrc}`);
  console.log('==============================================================');

  await conectarDB();

  // ------------------------------------------------------------------
  //  1) Limpiar turnos y reiniciar la numeración
  // ------------------------------------------------------------------
  const eliminados = await Turno.deleteMany({});
  await Contador.deleteMany({ _id: 'turno' });
  console.log(`\n  · Turnos eliminados: ${eliminados.deletedCount}`);
  console.log('  · Contador de códigos reiniciado (el próximo será T-001)');

  // ------------------------------------------------------------------
  //  2) Asegurar los usuarios de prueba
  // ------------------------------------------------------------------
  console.log('');
  for (const datos of USUARIOS) {
    const existente = await Usuario.findOne({ nombre: datos.nombre });
    if (existente) {
      console.log(`  · Usuario "${datos.nombre}" ya existe`);
      continue;
    }
    await Usuario.create({
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: await Usuario.hashearPassword(datos.password)
    });
    console.log(`  ✔ Usuario creado: ${datos.nombre} / ${datos.password}`);
  }

  // ------------------------------------------------------------------
  //  3) Crear los turnos del escenario
  // ------------------------------------------------------------------
  console.log('\n  Creando turnos iniciales...');
  for (const datos of TURNOS) {
    const turno = await turnoService.crearTurno(datos, 'santiago');
    console.log(`  ✔ ${turno.codigo} · ${turno.solicitante} · ${turno.tipoAtencion} · ${turno.estado}`);
  }

  // ------------------------------------------------------------------
  //  4) Resumen
  // ------------------------------------------------------------------
  const stats = await turnoService.estadisticas();
  console.log('\n' + '-'.repeat(62));
  console.log('  ESTADO INICIAL PARA LA DEMOSTRACIÓN');
  console.log(`    Pendientes  : ${stats.pendientes}`);
  console.log(`    En atención : ${stats.enAtencion}`);
  console.log(`    Finalizados : ${stats.finalizados}`);
  console.log(`    Total       : ${stats.total}`);
  console.log('-'.repeat(62));
  console.log('\n  Usuarios para el video:');
  console.log('    santiago / Santiago2026*');
  console.log('    maria    / Maria2026*');
  console.log('');
  console.log('  IMPORTANTE: si tiene la interfaz web abierta, recargue la');
  console.log('  pagina (F5) en cada navegador para que muestre el estado nuevo.');
  console.log('');

  await desconectarDB();
  process.exit(0);
}

main().catch(async (error) => {
  console.error('\n  [ERROR]', error.message);
  try {
    await desconectarDB();
  } catch (_e) {
    /* ignorado */
  }
  process.exit(1);
});
