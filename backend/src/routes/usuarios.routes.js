// ============================================================
// usuarios.routes.js
// ============================================================
const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
router.use(autenticar);

router.get('/', autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { rol, search, activo = 'true' } = req.query;
    let q = supabaseAdmin.from('usuarios').select('id,email,nombre,apellido,telefono,rol,activo,ultimo_login,creado_en').order('nombre');
    if (rol) q = q.eq('rol', rol);
    if (activo !== 'all') q = q.eq('activo', activo === 'true');
    if (search) q = q.or(`nombre.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

router.get('/:id', autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('usuarios').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ data });
  } catch (e) { next(e); }
});

router.post('/', autorizar('admin'), async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, telefono, rol = 'cliente' } = req.body;
    const { data: auth, error: ae } = await supabaseAdmin.auth.admin.createUser({ email, password, email_confirm: true });
    if (ae) return res.status(400).json({ error: ae.message });
    const { data, error } = await supabaseAdmin.from('usuarios').insert({ auth_id: auth.user.id, email, nombre, apellido, telefono, rol }).select().single();
    if (error) throw error;
    if (rol === 'cliente') await supabaseAdmin.from('clientes').insert({ usuario_id: data.id });
    if (rol === 'groomer') await supabaseAdmin.from('groomers').insert({ usuario_id: data.id });
    res.status(201).json({ mensaje: 'Usuario creado.', data });
  } catch (e) { next(e); }
});

router.put('/:id', autorizar('admin'), async (req, res, next) => {
  try {
    const { password, auth_id, ...campos } = req.body;
    const { data, error } = await supabaseAdmin.from('usuarios').update(campos).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ mensaje: 'Usuario actualizado.', data });
  } catch (e) { next(e); }
});

router.patch('/:id/desactivar', autorizar('admin'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('usuarios').update({ activo: false }).eq('id', req.params.id).select('id,nombre').single();
    if (error) throw error;
    res.json({ mensaje: `Usuario ${data.nombre} desactivado.` });
  } catch (e) { next(e); }
});

module.exports = router;
