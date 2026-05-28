// productos.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');

r.get('/', async (req, res, next) => {
  try {
    const { categoria_id, search, bajo_stock } = req.query;
    let q = supabaseAdmin.from('producto').select('*, categoria(*), variante_producto(*)').eq('activo', true).order('nombre');
    if (categoria_id) q = q.eq('categoria_id', categoria_id);
    if (search) q = q.ilike('nombre', `%${search}%`);
    if (bajo_stock === 'true') q = q.lte('stock_actual', supabaseAdmin.raw('stock_minimo'));
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

r.post('/', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('producto').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

r.put('/:id', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('producto').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

module.exports = r;
