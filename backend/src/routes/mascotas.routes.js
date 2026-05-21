// ============================================================
// PawSpa — Rutas: Mascotas
// ============================================================
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/mascotas.controller');
const { autenticar, autorizar, registrarAuditoria } = require('../middleware/auth.middleware');

router.use(autenticar);

router.get('/',    ctrl.listar);
router.get('/:id', ctrl.obtener);
router.get('/:id/historial', autorizar('admin','recepcion','cliente'), ctrl.historial);
router.post('/',   autorizar('admin','recepcion','cliente'), registrarAuditoria('crear','mascotas'), ctrl.crear);
router.put('/:id', autorizar('admin','recepcion','cliente'), registrarAuditoria('actualizar','mascotas'), ctrl.actualizar);
router.delete('/:id', autorizar('admin','recepcion'), registrarAuditoria('eliminar','mascotas'), ctrl.eliminar);

module.exports = router;
