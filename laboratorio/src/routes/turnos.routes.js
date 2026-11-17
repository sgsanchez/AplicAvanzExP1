/**
 * =====================================================================
 *  TurnoConnect - Rutas de turnos (Parte 4 - protegidas con JWT)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Todas las rutas exigen token JWT válido.
 *
 *  GET    /api/turnos                 -> listar turnos (?estado=)
 *  GET    /api/turnos/estadisticas    -> contadores por estado
 *  GET    /api/turnos/codigo/:codigo  -> consultar por código (T-001)
 *  GET    /api/turnos/:id             -> consultar un turno específico
 *  POST   /api/turnos                 -> registrar turno
 *  PATCH  /api/turnos/:id/estado      -> modificar estado
 *  PATCH  /api/turnos/:id/iniciar     -> iniciar atención
 *  PATCH  /api/turnos/:id/finalizar   -> finalizar atención
 *  DELETE /api/turnos/:id             -> eliminar turno
 */
'use strict';

const express = require('express');

const turnoService = require('../services/turnoService');
const { autenticar } = require('../middleware/auth.middleware');

const router = express.Router();

// A partir de aquí todas las rutas requieren autenticación
router.use(autenticar);

// GET /api/turnos/estadisticas -----------------------------------------
// (se declara antes de /:id para que "estadisticas" no se interprete como id)
router.get('/estadisticas', async (req, res, next) => {
  try {
    const datos = await turnoService.estadisticas();
    res.status(200).json({ ok: true, datos });
  } catch (error) {
    next(error);
  }
});

// GET /api/turnos ------------------------------------------------------
router.get('/', async (req, res, next) => {
  try {
    const datos = await turnoService.listarTurnos({
      estado: req.query.estado,
      limite: req.query.limite
    });
    res.status(200).json({ ok: true, total: datos.length, datos });
  } catch (error) {
    next(error);
  }
});

// GET /api/turnos/codigo/:codigo ---------------------------------------
router.get('/codigo/:codigo', async (req, res, next) => {
  try {
    const datos = await turnoService.obtenerTurno(req.params.codigo);
    res.status(200).json({ ok: true, datos });
  } catch (error) {
    next(error);
  }
});

// GET /api/turnos/:id --------------------------------------------------
router.get('/:id', async (req, res, next) => {
  try {
    const datos = await turnoService.obtenerTurno(req.params.id);
    res.status(200).json({ ok: true, datos });
  } catch (error) {
    next(error);
  }
});

// POST /api/turnos -----------------------------------------------------
router.post('/', async (req, res, next) => {
  try {
    const { solicitante, tipoAtencion } = req.body || {};
    const datos = await turnoService.crearTurno(
      { solicitante, tipoAtencion },
      req.usuario.nombre
    );
    res.status(201).json({
      ok: true,
      mensaje: `Turno ${datos.codigo} registrado correctamente`,
      datos
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/turnos/:id/iniciar ----------------------------------------
router.patch('/:id/iniciar', async (req, res, next) => {
  try {
    const datos = await turnoService.iniciarAtencion(req.params.id, req.usuario.nombre);
    res.status(200).json({
      ok: true,
      mensaje: `Atención del turno ${datos.codigo} iniciada por ${req.usuario.nombre}`,
      datos
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/turnos/:id/finalizar --------------------------------------
router.patch('/:id/finalizar', async (req, res, next) => {
  try {
    const datos = await turnoService.finalizarAtencion(req.params.id, req.usuario.nombre);
    res.status(200).json({
      ok: true,
      mensaje: `Turno ${datos.codigo} finalizado por ${req.usuario.nombre}`,
      datos
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/turnos/:id/estado -----------------------------------------
router.patch('/:id/estado', async (req, res, next) => {
  try {
    const { estado } = req.body || {};
    const datos = await turnoService.cambiarEstado(
      req.params.id,
      estado,
      req.usuario.nombre
    );
    res.status(200).json({
      ok: true,
      mensaje: `Estado del turno ${datos.codigo} actualizado a "${datos.estado}"`,
      datos
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/turnos/:id -----------------------------------------------
router.delete('/:id', async (req, res, next) => {
  try {
    const datos = await turnoService.eliminarTurno(req.params.id, req.usuario.nombre);
    res.status(200).json({
      ok: true,
      mensaje: `Turno ${datos.codigo} eliminado correctamente`,
      datos
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
