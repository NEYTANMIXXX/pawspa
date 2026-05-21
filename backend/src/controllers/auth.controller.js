// ============================================================
// PawSpa — Controlador de Autenticación
// ============================================================
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { supabase, supabaseAdmin } = require('../services/supabase');
const { generarSecretTotp, verificarTokenTotp, generarCodigosRespaldo } = require('../utils/totpHelper');
const { enviarCorreoVerificacion } = require('../services/email.service');

const BCRYPT_ROUNDS     = parseInt(process.env.BCRYPT_ROUNDS)  || 12;
const MAX_INTENTOS      = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
const LOCKOUT_MINUTOS   = parseInt(process.env.LOCKOUT_MINUTES) || 15;

const generarTokenVerificacionEmail = (usuario) => {
  return jwt.sign(
    {
      sub: usuario.id,
      email: usuario.email,
      purpose: 'email_verification',
      jti: crypto.randomUUID(),
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

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
    const { data: existe, error: existeError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existeError) {
      throw existeError;
    }

    if (existe) {
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    // Crear usuario en Supabase Auth con contraseña real
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
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
        email_verificado: false,
      })
      .select('id, email, nombre, apellido, rol, telefono, email_verificado')
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

    const verificationToken = generarTokenVerificacionEmail(usuario);
    const expiraEn = new Date(Date.now() + 15 * 60000).toISOString();
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;

    await supabaseAdmin.from('email_verification_tokens').insert({
      usuario_id: usuario.id,
      token: verificationToken,
      email,
      expira_en: expiraEn,
    });

    const resultadoEnvio = await enviarCorreoVerificacion({
      to: email,
      link: verificationLink,
      nombre,
    });

    return res.status(201).json({
      mensaje: resultadoEnvio.enviado
        ? 'Usuario registrado. Revisa tu correo para activar la cuenta.'
        : 'Usuario registrado, pero no se pudo enviar el correo de verificación. Revisa la configuración SMTP.',
      verificacion_requerida: true,
      correo_enviado: resultadoEnvio.enviado,
      correo_modo: resultadoEnvio.modo,
      correo_error: resultadoEnvio.razon,
      verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined,
      verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined,
      usuario: { id: usuario.id, email: usuario.email, nombre: usuario.nombre, apellido: usuario.apellido, rol: usuario.rol, email_verificado: false },
    });
  } catch (err) {
    next(err);
  }
};

// ── Login ─────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password, captchaToken} = req.body;

    if (!captchaToken) {
      return res.status(400).json({
        error: 'CAPTCHA requerido.'
      });
    }

    const captchaResponse = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: captchaToken,
        }),
      }
    );

    const captchaData =
      await captchaResponse.json();

    if (!captchaData.success) {
      return res.status(400).json({
        error: 'CAPTCHA inválido.'
      });
    }

    // Buscar usuario
    const { data: usuario, error } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre, apellido, rol, activo, intentos_login, bloqueado_hasta, auth_id, email_verificado')
      .eq('email', email)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    if (!usuario.activo) {
      return res.status(403).json({ error: 'Cuenta desactivada.' });
    }

    if (!usuario.email_verificado) {
      return res.status(403).json({
        error: 'Debes verificar tu correo antes de iniciar sesión.',
        requiereVerificacion: true,
      });
    }

    // Verificar si cuenta está bloqueada
    if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
      return res.status(403).json({
        error: `Cuenta bloqueada. Intenta después de ${new Date(usuario.bloqueado_hasta).toLocaleTimeString()}.`
      });
    }

    // Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      // Incrementar intentos fallidos
      const nuevoIntento = (usuario.intentos_login || 0) + 1;
      const bloqueado = nuevoIntento >= MAX_INTENTOS;
      
      const actualizacion = { intentos_login: nuevoIntento };
      if (bloqueado) {
        actualizacion.bloqueado_hasta = new Date(Date.now() + LOCKOUT_MINUTOS * 60000).toISOString();
      }
      
      await supabaseAdmin.from('usuarios').update(actualizacion).eq('id', usuario.id);

      return res.status(401).json({ 
        error: bloqueado 
          ? `Cuenta bloqueada por demasiados intentos. Intenta en ${LOCKOUT_MINUTOS} minutos.`
          : 'Credenciales inválidas.'
      });
    }

    // Verificar si el usuario tiene 2FA activo
    const { data: secret2fa } = await supabaseAdmin
      .from('user_2fa_secrets')
      .select('activo')
      .eq('usuario_id', usuario.id)
      .single();

    const tiene2faActivo = secret2fa?.activo === true;

    if (tiene2faActivo) {
      // Generar token temporal para 2FA (válido 5 minutos)
      const tokenTemporal = jwt.sign(
        {
          sub: usuario.id,
          email: usuario.email,
          pendiente2fa: true,
        },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({
        pendiente2fa: true,
        tokenTemporal,
        mensaje: 'Verifica tu código de autenticación',
      });
    }

    // Resetear intentos y actualizar último login
    await supabaseAdmin.from('usuarios').update({
      ultimo_login: new Date().toISOString(),
      intentos_login: 0,
      bloqueado_hasta: null,
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
      pendiente2fa: false,
      token,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Forgot Password ───────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre')
      .eq('email', email)
      .maybeSingle();

    if (!usuario) {
      // No revelar si el email existe o no (seguridad)
      return res.status(200).json({
        mensaje: 'Si el email existe, recibirás instrucciones para resetear tu contraseña.',
      });
    }

    const resetToken = jwt.sign(
      { sub: usuario.id, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    await supabaseAdmin.from('password_reset_tokens').insert({
      usuario_id: usuario.id,
      token: resetToken,
      expira_en: new Date(Date.now() + 60 * 60000).toISOString(),
    });

    const resetLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // TODO: Enviar email con resetLink
    console.log(`🔗 Reset password link: ${resetLink}`);

    return res.status(200).json({
      mensaje: 'Si el email existe, recibirás instrucciones para resetear tu contraseña.',
    });
  } catch (err) {
    next(err);
  }
};

// ── Email: Enviar Token de Verificación ──────────────────────
const sendVerificationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email requerido.'
      });
    }

    // Buscar usuario
    const { data: usuario, error: usuarioError } = await supabaseAdmin
      .from('usuarios')
      .select('id, email_verificado')
      .eq('email', email)
      .single();

    if (usuarioError || !usuario) {
      return res.status(404).json({
        error: 'Usuario no encontrado.'
      });
    }

    if (usuario.email_verificado) {
      return res.status(200).json({
        mensaje: 'Este correo ya fue verificado.'
      });
    }

    // Generar token firmado de verificación
    const token = generarTokenVerificacionEmail({ id: usuario.id, email });
    const expiracion = new Date(Date.now() + 15 * 60000).toISOString(); // 15 minutos

    // Guardar token en DB
    await supabaseAdmin
      .from('email_verification_tokens')
      .insert({
        usuario_id: usuario.id,
        token,
        email,
        expira_en: expiracion,
      });

    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

    const resultadoEnvio = await enviarCorreoVerificacion({
      to: email,
      link: verificationLink,
      nombre: usuario.email,
    });

    if (!resultadoEnvio.enviado) {
      return res.status(200).json({
        mensaje: 'No se pudo enviar el correo de verificación. Revisa la configuración SMTP.',
        correo_enviado: false,
        correo_modo: resultadoEnvio.modo,
        correo_error: resultadoEnvio.razon,
        verificationLink: process.env.NODE_ENV === 'development' ? verificationLink : undefined,
      });
    }

    return res.json({
      mensaje: 'Email de verificación enviado.',
      correo_enviado: true,
      correo_modo: resultadoEnvio.modo,
    });
  } catch (err) {
    next(err);
  }
};

// ── Email: Verificar Email ────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        error: 'Token requerido.'
      });
    }

    // Verificar token
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        error: 'Token inválido.'
      });
    }

    // Obtener registro del token
    const { data: registro, error } = await supabaseAdmin
      .from('email_verification_tokens')
      .select('id, usuario_id, expira_en, usado')
      .eq('token', token)
      .single();

    if (error || !registro) {
      return res.status(400).json({
        error: 'Token inválido.'
      });
    }

    // Verificar expiración
    if (new Date(registro.expira_en) < new Date()) {
      return res.status(400).json({
        error: 'Token expirado. Solicita uno nuevo.'
      });
    }

    // Verificar si ya fue usado
    if (registro.usado) {
      return res.status(400).json({
        error: 'Este token ya fue utilizado.'
      });
    }

    // Marcar como usado
    await supabaseAdmin
      .from('email_verification_tokens')
      .update({
        usado: true,
        usado_en: new Date().toISOString(),
      })
      .eq('id', registro.id);

    // Actualizar usuario como verificado
    await supabaseAdmin
      .from('usuarios')
      .update({
        email_verificado: true,
        email_verificado_en: new Date().toISOString(),
      })
      .eq('id', registro.usuario_id);

    // Auditoría
    await supabaseAdmin.from('auditoria_log').insert({
      usuario_id: registro.usuario_id,
      accion: 'actualizar',
      tabla_afectada: 'usuarios',
      datos_nuevos: { email_verificado: true },
      ip_address: req.ip,
    });

    return res.json({
      mensaje: '✅ Email verificado exitosamente.'
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA: Verify Login (Completa login con 2FA) ────────────────
const verify2faLogin = async (req, res, next) => {
  try {
    const { token, codigo } = req.body;

    if (!token || !codigo) {
      return res.status(400).json({
        error: 'Token temporal y código de autenticación requeridos.'
      });
    }

    // Verificar token temporal
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
      if (!payload.pendiente2fa) {
        return res.status(401).json({ error: 'Token inválido.' });
      }
    } catch (err) {
      return res.status(401).json({ error: 'Token expirado. Inicia sesión nuevamente.' });
    }

    // Obtener secret del usuario
    const { data: secret2fa, error } = await supabaseAdmin
      .from('user_2fa_secrets')
      .select('secret, backup_codes, activo')
      .eq('usuario_id', payload.sub)
      .single();

    if (error || !secret2fa || !secret2fa.activo) {
      return res.status(400).json({
        error: '2FA no está activo.'
      });
    }

    // Verificar token TOTP o código de respaldo
    const esCodigoValido = codigo.length === 6 && /^\d+$/.test(codigo);
    let esValido = false;

    if (esCodigoValido) {
      // Intentar como código TOTP
      esValido = verificarTokenTotp(codigo, secret2fa.secret);
    } else if (codigo.length === 8) {
      // Intentar como código de respaldo
      esValido = secret2fa.backup_codes && secret2fa.backup_codes.includes(codigo.toUpperCase());
      if (esValido) {
        // Remover código de respaldo usado
        const codigosActualizados = secret2fa.backup_codes.filter(c => c !== codigo.toUpperCase());
        await supabaseAdmin
          .from('user_2fa_secrets')
          .update({ backup_codes: codigosActualizados })
          .eq('usuario_id', payload.sub);
      }
    }

    if (!esValido) {
      return res.status(401).json({
        error: 'Código de autenticación inválido.'
      });
    }

    // Obtener usuario completo
    const { data: usuario } = await supabaseAdmin
      .from('usuarios')
      .select('id, email, nombre, apellido, rol')
      .eq('id', payload.sub)
      .single();

    // Actualizar último login
    await supabaseAdmin.from('usuarios').update({
      ultimo_login: new Date().toISOString(),
      intentos_login: 0,
      bloqueado_hasta: null,
    }).eq('id', payload.sub);

    // Auditoría
    await supabaseAdmin.from('auditoria_log').insert({
      usuario_id: payload.sub,
      accion: 'login',
      tabla_afectada: 'usuarios',
      datos_nuevos: { '2fa': 'verificado' },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    const tokenFinal = generarToken(usuario);
    return res.json({
      token: tokenFinal,
      usuario: {
        id: usuario.id,
        email: usuario.email,
        nombre: usuario.nombre,
        apellido: usuario.apellido,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA: Setup (Genera QR) ────────────────────────────────────
const setup2fa = async (req, res, next) => {
  try {
    const usuarioId = req.usuario.id;

    // Verificar si ya existe 2FA
    const { data: existing2fa } = await supabaseAdmin
      .from('user_2fa_secrets')
      .select('id')
      .eq('usuario_id', usuarioId)
      .single();

    // Generar nuevo secret
    const { secret, qrCode, otpauth_url } = await generarSecretTotp(req.usuario.email);
    const codigosRespaldo = generarCodigosRespaldo();

    if (existing2fa) {
      // Actualizar existente
      await supabaseAdmin
        .from('user_2fa_secrets')
        .update({
          secret,
          qr_code: qrCode,
          backup_codes: codigosRespaldo,
          activo: false,
        })
        .eq('usuario_id', usuarioId);
    } else {
      // Crear nuevo
      await supabaseAdmin
        .from('user_2fa_secrets')
        .insert({
          usuario_id: usuarioId,
          secret,
          qr_code: qrCode,
          backup_codes: codigosRespaldo,
          activo: false,
        });
    }

    // Auditoría
    await supabaseAdmin.from('auditoria_log').insert({
      usuario_id: usuarioId,
      accion: 'actualizar',
      tabla_afectada: 'user_2fa_secrets',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    return res.json({
      qrCode,
      secret,
      codigosRespaldo,
      otpauth_url,
      mensaje: 'QR generado. Escanea con tu autenticador y verifica con el código.',
    });
  } catch (err) {
    next(err);
  }
};

// ── 2FA: Verify (Activa 2FA) ──────────────────────────────────
const verify2fa = async (req, res, next) => {
  try {
    const { token } = req.body;
    const usuarioId = req.usuario.id;

    // Obtener secret del usuario
    const { data: secret2fa, error } = await supabaseAdmin
      .from('user_2fa_secrets')
      .select('secret, backup_codes')
      .eq('usuario_id', usuarioId)
      .single();

    if (error || !secret2fa) {
      return res.status(400).json({
        error: '2FA no configurado. Primero ejecuta setup2fa.'
      });
    }

    // Verificar token TOTP
    const esValido = verificarTokenTotp(token, secret2fa.secret);

    if (!esValido) {
      return res.status(401).json({
        error: 'Token TOTP inválido. Intenta de nuevo.'
      });
    }

    // Activar 2FA
    await supabaseAdmin
      .from('user_2fa_secrets')
      .update({ activo: true })
      .eq('usuario_id', usuarioId);

    // Auditoría
    await supabaseAdmin.from('auditoria_log').insert({
      usuario_id: usuarioId,
      accion: 'actualizar',
      tabla_afectada: 'user_2fa_secrets',
      datos_nuevos: { activo: true },
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
    });

    return res.json({
      mensaje: '✅ 2FA activado exitosamente',
      codigosRespaldo: secret2fa.backup_codes,
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

    if (error || !data) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    return res.json({
      usuario: data,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  registrar, 
  login, 
  logout, 
  perfil, 
  forgotPassword, 
  sendVerificationEmail, 
  verifyEmail, 
  verify2faLogin, 
  setup2fa, 
  verify2fa 
};
