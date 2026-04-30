// ============================================================
// PawSpa — Middleware de Autenticación y Roles
// ============================================================
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../services/supabase');

/**
 * Middleware: verifica JWT y adjunta usuario al request
 */
const autenticar = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token de autenticación requerido.' });
    }

    const token = authHeader.split(' ')[1];
    let payload;

    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
      }
      return res.status(401).json({ error: 'Token inválido.' });
    }

    // Obtener usuario actualizado de la DB
    const { data: usuario, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre, apellido, rol, activo, bloqueado_hasta')
      .eq('id', payload.sub)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Usuario no encontrado.' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada. Contacta al administrador.' });
    }

    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      return res.status(403).json({
        error: `Cuenta bloqueada temporalmente hasta ${new Date(usuario.bloqueado_hasta).toLocaleString('es-PE')}.`
      });
    }

    req.usuario = usuario;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware: verifica que el usuario tenga uno de los roles permitidos
 * Uso: autorizar('admin', 'recepcion')
 */
const autorizar = (...rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ error: 'No autenticado.' });
    }
    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({
        error: `Acceso denegado. Rol requerido: ${rolesPermitidos.join(' o ')}.`,
        rolActual: req.usuario.rol,
      });
    }
    next();
  };
};

/**
 * Middleware: registra acción en auditoría
 */
const registrarAuditoria = (accion, tabla) => {
  return async (req, res, next) => {
    // Guardar referencia al json original
    const originalJson = res.json.bind(res);
    res.json = async (body) => {
      // Solo auditar respuestas exitosas
      if (res.statusCode >= 200 && res.statusCode < 300 && req.usuario) {
        try {
          await supabaseAdmin.from('auditoria_log').insert({
            usuario_id:      req.usuario.id,
            accion,
            tabla_afectada:  tabla,
            registro_id:     req.params.id || body?.data?.id || null,
            datos_nuevos:    ['POST', 'PUT', 'PATCH'].includes(req.method) ? req.body : null,
            ip_address:      req.ip,
            user_agent:      req.headers['user-agent'],
          });
        } catch (_) { /* Auditoría no crítica */ }
      }
      return originalJson(body);
    };
    next();
  };
};

module.exports = { autenticar, autorizar, registrarAuditoria };
