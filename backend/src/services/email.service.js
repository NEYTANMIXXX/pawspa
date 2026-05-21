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
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: 'Activa tu cuenta de PawSpa',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2>Hola ${nombre || ''}</h2>
          <p>Gracias por registrarte en PawSpa. Usa este enlace para activar tu cuenta:</p>
          <p><a href="${link}">${link}</a></p>
          <p>Este enlace expira en 15 minutos.</p>
        </div>
      `,
    });

    return { enviado: true, modo: 'smtp' };
  } catch (error) {
    console.error('Error enviando correo SMTP:', error.message);
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
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: asunto,
      html,
    });

    return { enviado: true, modo: 'smtp' };
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
  enviarNotificacionReserva,
  enviarRecordatorioReserva,
};