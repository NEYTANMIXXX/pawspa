// ============================================================
// PawSpa — Servicio de Correo
// ============================================================
const nodemailer = require('nodemailer');

const tieneConfigSMTP = () => {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  );
};

const crearTransporter = () => {
  if (!tieneConfigSMTP()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    logger: process.env.NODE_ENV !== 'production',
    debug: process.env.NODE_ENV !== 'production',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

const enviarCorreoVerificacion = async ({ to, link, nombre }) => {
  const transporter = crearTransporter();

  if (!transporter) {
    console.log(`📧 Verificación pendiente para ${to}: ${link}`);
    return { enviado: false, modo: 'console', razon: 'SMTP_NO_CONFIG' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Activa tu cuenta de PawSpa',
      text: `Hola ${nombre || ''}\n\nGracias por registrarte en PawSpa. Usa este enlace para activar tu cuenta:\n${link}\n\nEste enlace expira en 15 minutos.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2>Hola ${nombre || ''}</h2>
          <p>Gracias por registrarte en PawSpa. Usa este enlace para activar tu cuenta:</p>
          <p><a href="${link}">${link}</a></p>
          <p>Este enlace expira en 15 minutos.</p>
        </div>
      `,
    });

    return {
      enviado: true,
      modo: 'smtp',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (error) {
    console.error('Error enviando correo SMTP:', error.message);
    return { enviado: false, modo: 'smtp_error', razon: error.message };
  }
};

const enviarCorreoRecuperacion = async ({ to, link, nombre }) => {
  const transporter = crearTransporter();

  if (!transporter) {
    console.log(`📧 Recuperación pendiente para ${to}: ${link}`);
    return { enviado: false, modo: 'console', razon: 'SMTP_NO_CONFIG' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Recupera tu contraseña de PawSpa',
      text: `Hola ${nombre || ''}\n\nRecibimos una solicitud para restablecer tu contraseña en PawSpa. Usa este enlace:\n${link}\n\nEste enlace expira en 1 hora.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2>Hola ${nombre || ''}</h2>
          <p>Recibimos una solicitud para restablecer tu contraseña en PawSpa.</p>
          <p><a href="${link}">${link}</a></p>
          <p>Este enlace expira en 1 hora.</p>
        </div>
      `,
    });

    return {
      enviado: true,
      modo: 'smtp',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (error) {
    console.error('Error enviando correo de recuperación:', error.message);
    return { enviado: false, modo: 'smtp_error', razon: error.message };
  }
};

const enviarNotificacionReserva = async ({ to, asunto, html }) => {
  const transporter = crearTransporter();

  if (!transporter) {
    console.log(`📧 Notificación pendiente para ${to}: ${asunto}`);
    return { enviado: false, modo: 'console', razon: 'SMTP_NO_CONFIG' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: asunto,
      replyTo: process.env.SMTP_USER,
      text: html
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
      html,
    });

    return {
      enviado: true,
      modo: 'smtp',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (error) {
    console.error('Error enviando correo SMTP:', error.message);
    return { enviado: false, modo: 'smtp_error', razon: error.message };
  }
};

const enviarRecordatorioReserva = async ({ to, nombreCliente, nombreMascota, fechaInicio, enlace }) => {
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
      <h2>Hola ${nombreCliente || ''}</h2>
      <p>Te recordamos que tienes una cita para <strong>${nombreMascota}</strong> el <strong>${new Date(fechaInicio).toLocaleString()}</strong>.</p>
      ${enlace ? `<p>Ver detalles: <a href="${enlace}">${enlace}</a></p>` : ''}
      <p>Si necesitas reprogramar o cancelar, por favor ingresa a tu cuenta.</p>
    </div>
  `;

  return enviarNotificacionReserva({ to, asunto: 'Recordatorio de cita PawSpa', html });
};

module.exports = {
  enviarCorreoVerificacion,
  enviarCorreoRecuperacion,
  enviarNotificacionReserva,
  enviarRecordatorioReserva,
};