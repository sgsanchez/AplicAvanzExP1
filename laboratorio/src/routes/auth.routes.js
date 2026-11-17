/**
 * =====================================================================
 *  TurnoConnect - Rutas de autenticación (Parte 4)
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  POST /api/auth/registro  -> registrar usuario
 *  POST /api/auth/login     -> autenticar y obtener token JWT
 *  GET  /api/auth/perfil    -> datos del usuario autenticado (protegida)
 */
'use strict';

const express = require('express');

const authService = require('../services/authService');
const { autenticar } = require('../middleware/auth.middleware');
const AppError = require('../utils/AppError');

const router = express.Router();

// POST /api/auth/registro ------------------------------------------------
router.post('/registro', async (req, res, next) => {
  try {
    const { nombre, password, email } = req.body || {};
    const resultado = await authService.registrar({ nombre, password, email });

    res.status(201).json({
      ok: true,
      mensaje: 'Usuario registrado correctamente',
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/auth/login ---------------------------------------------------
router.post('/login', async (req, res, next) => {
  try {
    const { nombre, password } = req.body || {};
    const resultado = await authService.login({ nombre, password });

    res.status(200).json({
      ok: true,
      mensaje: `Bienvenido ${resultado.usuario.nombre}`,
      datos: resultado
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/auth/perfil (protegida) --------------------------------------
router.get('/perfil', autenticar, (req, res, next) => {
  try {
    if (!req.usuario) {
      throw new AppError(401, 'No autorizado');
    }
    res.status(200).json({
      ok: true,
      datos: req.usuario
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
