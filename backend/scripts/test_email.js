// Script de prueba para validar el envío real por SMTP.
// Uso:
//   node scripts/test_email.js [correo_destino]

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { enviarNotificacionReserva } = require('../src/services/email.service');

const destino = process.argv[2] || process.env.SMTP_USER;

(async () => {
  try {
    if (!destino) {
      console.error('Debes indicar un correo destino o definir SMTP_USER en el .env.');
      process.exit(1);
    }

    const resultado = await enviarNotificacionReserva({
      to: destino,
      asunto: 'Prueba de correo PawSpa',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2>Prueba de correo PawSpa</h2>
          <p>Si estás viendo este mensaje, el SMTP ya está funcionando correctamente.</p>
          <p>Fecha de prueba: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    console.log('Resultado:', resultado);
    process.exit(resultado.enviado ? 0 : 2);
  } catch (error) {
    console.error('Error enviando correo de prueba:', error.message || error);
    process.exit(2);
  }
})();