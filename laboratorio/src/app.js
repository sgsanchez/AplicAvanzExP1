/**
 * =====================================================================
 *  TurnoConnect - Aplicación Express
 *  Estudiante: SANTIAGO GEOVANNY SANCHEZ CAMACHO - NRC 37869
 * =====================================================================
 *  Configura los middlewares globales, las rutas de la API y el
 *  servicio de archivos estáticos de la interfaz web.
 */
'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');

const config = require('./config/env');
const authRoutes = require('./routes/auth.routes');
const turnosRoutes = require('./routes/turnos.routes');
const { manejadorErrores, noEncontrado } = require('./middleware/errorHandler.middleware');
const { estaConectado } = require('./config/db');
const turnoService = require('./services/turnoService');

/**
 * Crea y configura la aplicación Express.
 * @returns {import('express').Express}
 */
function crearApp() {
  const app = express();

  // --- Middlewares globales -----------------------------------------
  app.use(cors()); // permite probar la API desde Postman o cualquier origen
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // --- Registro simple de peticiones (útil para las evidencias) -----
  app.use((req, _res, next) => {
    console.log(
      `\x1b[90m[REST]\x1b[0m ${new Date().toLocaleTimeString('es-EC')} ${req.method} ${req.originalUrl}`
    );
    next();
  });

  // --- Archivos estáticos de la interfaz web ------------------------
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // --- Ruta de verificación de estado -------------------------------
  app.get('/api/health', async (_req, res) => {
    let stats = null;
    try {
      if (estaConectado()) stats = await turnoService.estadisticas();
    } catch (_e) {
      stats = null;
    }
    res.status(200).json({
      ok: true,
      servicio: 'TurnoConnect',
      estudiante: config.estudiante,
      nrc: config.nrc,
      baseDeDatos: estaConectado() ? 'conectada' : 'desconectada',
      estadisticas: stats,
      fecha: new Date().toISOString()
    });
  });

  // --- Rutas de la API ----------------------------------------------
  app.use('/api/auth', authRoutes);
  app.use('/api/turnos', turnosRoutes);

  // --- Manejo de rutas inexistentes y errores -----------------------
  app.use(noEncontrado);
  app.use(manejadorErrores);

  return app;
}

module.exports = { crearApp };
