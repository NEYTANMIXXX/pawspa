// Script para enviar recordatorios de reservas próximas.
// Uso:
//   node scripts/send_reminders.js [horas]

const { supabaseAdmin } = require('../src/services/supabase');
const { enviarRecordatorioReserva } = require('../src/services/email.service');

(async () => {
  try {
    const argHoras = process.argv[2] || process.env.REMINDER_HOURS || '24';
    const horas = parseInt(argHoras, 10);
    if (Number.isNaN(horas) || horas <= 0) {
      console.error('Horas inválidas:', argHoras);
      process.exit(1);
    }

    const ahora = new Date();
    const hasta = new Date(ahora.getTime() + horas * 3600000);

    console.log(`Buscando reservas entre ${ahora.toISOString()} y ${hasta.toISOString()}`);

    const { data: reservas, error } = await supabaseAdmin
      .from('slot_reserva')
      .select('id, fecha_inicio, estado, cliente_id, mascotas (nombre), clientes (usuarios (email, nombre))')
      .gte('fecha_inicio', ahora.toISOString())
      .lte('fecha_inicio', hasta.toISOString())
      .in('estado', ['pendiente','confirmada']);

    if (error) throw error;

    let enviados = 0;
    for (const r of reservas || []) {
      const email = r.clientes?.usuarios?.email;
      const nombreCli = r.clientes?.usuarios?.nombre;
      const nombreMasc = r.mascotas?.nombre || '';
      if (!email) continue;

      try {
        await enviarRecordatorioReserva({
          to: email,
          nombreCliente: nombreCli,
          nombreMascota: nombreMasc,
          fechaInicio: r.fecha_inicio,
          enlace: `${process.env.FRONTEND_URL || ''}/reservas/${r.id}`
        });
        enviados += 1;
        console.log('Recordatorio enviado a', email);
      } catch (e) {
        console.error('Fallo al enviar recordatorio a', email, e.message || e);
      }
    }

    console.log(`Proceso finalizado. Recordatorios enviados: ${enviados}`);
    process.exit(0);
  } catch (err) {
    console.error('Error en send_reminders:', err.message || err);
    process.exit(2);
  }
})();
