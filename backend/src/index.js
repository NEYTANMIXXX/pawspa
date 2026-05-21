// ============================================================
// PawSpa — Servidor Express principal
// ============================================================
require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');

const authRoutes        = require('./routes/auth.routes');
const usuariosRoutes    = require('./routes/usuarios.routes');
const clientesRoutes    = require('./routes/clientes.routes');
const mascotasRoutes    = require('./routes/mascotas.routes');
const serviciosRoutes   = require('./routes/servicios.routes');
const reservasRoutes    = require('./routes/reservas.routes');
const groomingRoutes    = require('./routes/grooming.routes');
const productosRoutes   = require('./routes/productos.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const groomersRoutes = require('./routes/groomers.routes');
const disponibilidadRoutes = require('./routes/disponibilidad.routes');

const app = express();

// ── Seguridad y parseo ──────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Rate limiting global ────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  message: { error: 'Demasiadas solicitudes. Inténtalo más tarde.' },
});
app.use(limiter);

// ── Rate limiting estricto para login ──────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos de login.' },
});

// ── Health check ────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PawSpa API', version: '1.0.0' });
});

// ── Rutas ───────────────────────────────────────────────────
app.use('/api/auth',       loginLimiter, authRoutes);
app.use('/api/usuarios',   usuariosRoutes);
app.use('/api/clientes',   clientesRoutes);
app.use('/api/mascotas',   mascotasRoutes);
app.use('/api/servicios',  serviciosRoutes);
app.use('/api/reservas',   reservasRoutes);
app.use('/api/grooming',   groomingRoutes);
app.use('/api/groomers', groomersRoutes);
app.use('/api/productos',  productosRoutes);
app.use('/api/dashboard',  dashboardRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);


// ── Manejo de errores global ────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

app.use((req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🐾 PawSpa API corriendo en http://localhost:${PORT}`);
});

module.exports = app;
