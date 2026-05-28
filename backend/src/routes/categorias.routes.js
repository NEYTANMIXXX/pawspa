// ============================================================
// PawSpa — Categorías de Tienda
// ============================================================
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');

r.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('categoria')
      .select('id, nombre, descripcion, icono_url, padre_id, activo')
      .eq('activo', true)
      .order('nombre');

    if (error) throw error;
    res.json({ data });
  } catch (e) {
    next(e);
  }
});

module.exports = r;