// ============================================================
// PawSpa — Rutas de Autenticación
// ============================================================
const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const { registrar, login, logout, perfil } = require('../controllers/auth.controller');
const { autenticar } = require('../middleware/auth.middleware');

// Middleware de validación
const validar = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({ errores: errores.array() });
  }
  next();
};

// POST /api/auth/registro
router.post('/registro', [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 8 }).withMessage('Contraseña mínimo 8 caracteres'),
  body('telefono').optional().isMobilePhone(),
  validar,
], registrar);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validar,
], login);

// POST /api/auth/logout (requiere token)
router.post('/logout', autenticar, logout);

// GET /api/auth/perfil
router.get('/perfil', autenticar, perfil);

module.exports = router;
