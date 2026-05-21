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
    
    // Reintentar si hay error de rate limit
    let auth, authError;
    let intentos = 0;
    const maxIntentos = 5;
    
    while (intentos < maxIntentos) {
      try {
        const response = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
          redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password`
        });
        auth = response.data;
        authError = response.error;
        
        if (!authError) {
          break; // Éxito, salir del loop
        }
      } catch (e) {
        authError = { message: e.message };
      }
      
      // Si hay error de rate limit, reintentar
      if (authError && (authError.message?.toLowerCase().includes('rate') || authError.message?.toLowerCase().includes('too many'))) {
        intentos++;
        if (intentos < maxIntentos) {
          // Esperar más tiempo (3-5 segundos progresivamente)
          const delay = 5000 + (intentos * 1000);
          console.log(`Rate limit en ${email}, reintentando en ${delay}ms (intento ${intentos}/${maxIntentos})`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        break; // Si no es rate limit, salir
      }
    }
    
    if (authError) return res.status(400).json({ error: authError.message });
    const { data, error } = await supabaseAdmin.from('usuarios').insert({ auth_id: auth.user.id, email, nombre, apellido, telefono, rol }).select().single();
    if (error) throw error;
    if (rol === 'cliente') await supabaseAdmin.from('clientes').insert({ usuario_id: data.id });
    if (rol === 'groomer') await supabaseAdmin.from('groomers').insert({ usuario_id: data.id });
    res.status(201).json({ mensaje: 'Usuario creado. Se envió un correo de invitación.', data });
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
