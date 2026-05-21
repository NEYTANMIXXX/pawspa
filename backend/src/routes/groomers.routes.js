// ============================================================
// PawSpa — Rutas de Groomers
// ============================================================
const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../services/supabase');
const { autenticar } = require('../middleware/auth.middleware');

// Todos autenticados pueden ver groomers
router.use(autenticar);

// ── Listar groomers ─────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('groomers')
      .select(`
        id,
        bio,
        especialidades,
        activo,
        usuarios (
          id,
          nombre,
          apellido,
          email,
          telefono,
          avatar_url
        )
      `)
      .eq('activo', true)
      .order('creado_en', { ascending: true });

    if (error) throw error;

    return res.json({
      data,
      total: data.length
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;