// servicios.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
r.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('servicios').select('*').eq('activo', true).order('nombre');
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});
r.post('/', autenticar, autorizar('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('servicios').insert(req.body).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (e) { next(e); }
});
r.put('/:id', autenticar, autorizar('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('servicios').update(req.body).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});
module.exports = r;
