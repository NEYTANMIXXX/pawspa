// reservas.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/reservas.controller');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
router.use(autenticar);
router.get('/', ctrl.listar);
router.get('/:id', ctrl.obtener);
router.post('/', autorizar('admin','recepcion','cliente'), ctrl.crear);
router.patch('/:id/cancelar', ctrl.cancelar);
router.patch('/:id/estado', autorizar('admin','recepcion','groomer'), ctrl.actualizarEstado);
module.exports = router;
