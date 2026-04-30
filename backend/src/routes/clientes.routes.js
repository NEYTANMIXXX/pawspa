// ============================================================
// clientes.routes.js
// ============================================================
const express = require('express');
const r1 = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
r1.use(autenticar);
r1.get('/', autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('clientes').select('*, usuarios(*)').order('creado_en', { ascending: false });
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (e) { next(e); }
});
r1.get('/:id/mascotas', autenticar, async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('mascotas').select('*').eq('cliente_id', req.params.id).eq('activo', true);
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});
module.exports = r1;
