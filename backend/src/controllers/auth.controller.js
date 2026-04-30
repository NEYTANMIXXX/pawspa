// ============================================================
// PawSpa — Controlador de Autenticación
// ============================================================
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { supabase, supabaseAdmin } = require('../services/supabase');

const BCRYPT_ROUNDS     = parseInt(process.env.BCRYPT_ROUNDS)  || 12;
const MAX_INTENTOS      = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_MINUTOS   = parseInt(process.env.LOCKOUT_MINUTES) || 15;

// ── Generar JWT ──────────────────────────────────────────────
const generarToken = (usuario) => {
  return jwt.sign(
    {
      sub:   usuario.id,
      email: usuario.email,
      rol:   usuario.rol,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
};

// ── Registro ─────────────────────────────────────────────────
const registrar = async (req, res, next) => {
  try {
    const { nombre, apellido, email, password, telefono, rol = 'cliente' } = req.body;

    // Solo admin puede crear otros roles
    const rolFinal = req.usuario?.rol === 'admin' ? rol : 'cliente';

    // Verificar email único
    const { data: existe } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .single();

    if (existe) {
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    // Registrar en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    // Crear registro en tabla usuarios
    const { data: usuario, error: userError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        auth_id:   authData.user.id,
        email,
        nombre,
        apellido,
        telefono,
        rol:       rolFinal,
      })
      .select('id, email, nombre, apellido, rol, telefono')
      .single();

    if (userError) throw userError;

    // Si es cliente, crear registro en tabla clientes
    if (rolFinal === 'cliente') {
      await supabaseAdmin.from('clientes').insert({ usuario_id: usuario.id });
    }

    // Si es groomer, crear registro en tabla groomers
    if (rolFinal === 'groomer') {
      await supabaseAdmin.from('groomers').insert({ usuario_id: usuario.id });
    }

    // Auditoría
    await supabaseAdmin.from('auditoria_log').insert({
      usuario_id:     usuario.id,
      accion:         'crear',
      tabla_afectada: 'usuarios',
      registro_id:    usuario.id,
    });

    const token = generarToken(usuario);
    return res.status(201).json({
      mensaje: 'Usuario registrado exitosamente.',
      token,
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol },
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Buscar usuario
    const { data: usuario, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre, apellido, rol, activo, intentos_login, bloqueado_hasta, auth_id')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Verificar si está bloqueado
    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      const minutos = Math.ceil((new Date(usuario.bloqueado_hasta) - new Date()) / 60000);
      return res.status(403).json({
        error: `Cuenta bloqueada. Intenta en ${minutos} minuto(s).`,
      });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada.' });
    }

    // Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Incrementar intentos fallidos
      const nuevosIntentos = (usuario.intentos_login || 0) + 1;
      const bloqueo = nuevosIntentos >= MAX_INTENTOS
        ? new Date(Date.now() + LOCKOUT_MINUTOS * 60000).toISOString()
        : null;

      await supabaseAdmin.from('usuarios').update({
        intentos_login:  nuevosIntentos,
        bloqueado_hasta: bloqueo,
      }).eq('id', usuario.id);

      const restantes = MAX_INTENTOS - nuevosIntentos;
      const msg = bloqueo
        ? `Cuenta bloqueada por ${LOCKOUT_MINUTOS} minutos.`
        : `Credenciales inválidas. ${restantes > 0 ? `${restantes} intento(s) restantes.` : ''}`;

      return res.status(401).json({ error: msg });
    }

    // Resetear intentos y actualizar último login
    await supabaseAdmin.from('usuarios').update({
      intentos_login:  0,
      bloqueado_hasta: null,
      ultimo_login:    new Date().toISOString(),
    }).eq('id', usuario.id);

    // Auditoría login
    await supabaseAdmin.from('auditoria_log').insert({
      usuario_id:     usuario.id,
      accion:         'login',
      tabla_afectada: 'usuarios',
      ip_address:     req.ip,
      user_agent:     req.headers['user-agent'],
    });

    const token = generarToken(usuario);
    return res.json({
      token,
      usuario: {
        id:       usuario.id,
        email:    usuario.email,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        rol:      usuario.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Logout ────────────────────────────────────────────────────
const logout = async (req, res, next) => {
  try {
    // Registrar logout en auditoría
    if (req.usuario) {
      await supabaseAdmin.from('auditoria_log').insert({
        usuario_id:     req.usuario.id,
        accion:         'logout',
        tabla_afectada: 'usuarios',
        ip_address:     req.ip,
      });
    }
    // Supabase maneja la invalidación de sesión en el lado del cliente
    return res.json({ mensaje: 'Sesión cerrada exitosamente.' });
  } catch (err) {
    next(err);
  }
};

// ── Perfil propio ─────────────────────────────────────────────
const perfil = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre, apellido, telefono, rol, activo, avatar_url, ultimo_login, creado_en')
      .eq('id', req.usuario.id)
      .single();

    if (error) throw error;
    return res.json({ data });
  } catch (err) {
    next(err);
  }
};

module.exports = { registrar, login, logout, perfil };
