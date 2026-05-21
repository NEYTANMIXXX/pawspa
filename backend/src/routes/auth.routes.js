// ============================================================
// PawSpa — Rutas de Autenticación
// ============================================================
const express = require('express');
const { body, validationResult } = require('express-validator');
const router  = express.Router();
const { registrar, login, logout, perfil, forgotPassword, sendVerificationEmail, verifyEmail, verify2faLogin, setup2fa, verify2fa } = require('../controllers/auth.controller');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
const { validarComplejidad, obtenerMensajeError } = require('../utils/passwordValidator');

// Middleware de validación
const validar = (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(422).json({ errores: errores.array() });
  }
  next();
};

// Validación personalizada para contraseña estricta
const validarPasswordEstricto = (password) => {
  const validacion = validarComplejidad(password);
  if (!validacion.esValida) {
    const mensajes = obtenerMensajeError(validacion);
    throw new Error(mensajes.join('. '));
  }
  return true;
};

// POST /api/auth/registro
router.post('/registro', [
  body('nombre').trim().notEmpty().withMessage('Nombre requerido'),
  body('apellido').trim().notEmpty().withMessage('Apellido requerido'),
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Contraseña mínimo 8 caracteres')
    .custom(validarPasswordEstricto),
  body('telefono').optional().isMobilePhone(),
  validar,
], registrar);

// POST /api/auth/login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validar,
], login);

// POST /api/auth/2fa/verify-login - Verifica 2FA después de login
router.post('/2fa/verify-login', [
  body('token').notEmpty().withMessage('Token temporal requerido'),
  body('codigo').notEmpty().withMessage('Código de autenticación requerido'),
  validar,
], verify2faLogin);

// POST /api/auth/forgot-password
router.post('/forgot-password', [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  validar,
], forgotPassword); 

// POST /api/auth/email/send-verification - Envía token de verificación
router.post('/email/send-verification', [
  body('email').isEmail().normalizeEmail().withMessage('Email inválido'),
  validar,
], sendVerificationEmail);

// POST /api/auth/email/verify - Verifica el email con token
router.post('/email/verify', [
  body('token').notEmpty().withMessage('Token requerido'),
  validar,
], verifyEmail);

// POST /api/auth/logout (requiere token)
router.post('/logout', autenticar, logout);

// GET /api/auth/perfil
router.get('/perfil', autenticar, perfil);

// ────────────────────────────────────────────────────────────
// RUTAS 2FA (solo para Admin)
// ────────────────────────────────────────────────────────────

// POST /api/auth/2fa/setup - Genera QR para autenticador TOTP
router.post('/2fa/setup', autenticar, autorizar('admin'), setup2fa);

// POST /api/auth/2fa/verify - Verifica y activa 2FA
router.post('/2fa/verify', autenticar, autorizar('admin'), [
  body('token').matches(/^\d{6}$/).withMessage('Token de 6 dígitos requerido'),
  validar,
], verify2fa);

module.exports = router;
