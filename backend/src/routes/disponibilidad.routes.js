// ============================================================
// PawSpa — Disponibilidad de Groomers
// ============================================================
const express = require('express');
const router = express.Router();

const { supabaseAdmin } = require('../services/supabase');
const { autenticar } = require('../middleware/auth.middleware');
const {
  calcularDuracionServicio,
  validarHorarioAtencion,
  buscarGroomersDisponibles,
  evaluarGroomersDisponibilidad,
} = require('../utils/bookingAvailability');

router.use(autenticar);

// ── Obtener disponibilidad ──────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { fecha_inicio, servicio_id, mascota_id } = req.query;

    if (fecha_inicio && servicio_id) {
      const fechaInicioDate = new Date(fecha_inicio);

      if (Number.isNaN(fechaInicioDate.getTime())) {
        return res.status(400).json({ error: 'fecha_inicio inválida.' });
      }

      const { data: servicio, error: servicioError } = await supabaseAdmin
        .from('servicios')
        .select('id, duracion_min')
        .eq('id', servicio_id)
        .single();

      if (servicioError || !servicio) {
        return res.status(404).json({ error: 'Servicio no encontrado.' });
      }

      let tamanoMascota = null;

      if (mascota_id) {
        const { data: mascota, error: mascotaError } = await supabaseAdmin
          .from('mascotas')
          .select('tamano')
          .eq('id', mascota_id)
          .single();

        if (mascotaError || !mascota) {
          return res.status(404).json({ error: 'Mascota no encontrada.' });
        }

        tamanoMascota = mascota.tamano;
      }

      const duracion = calcularDuracionServicio(servicio, tamanoMascota);
      const fechaFinDate = new Date(fechaInicioDate.getTime() + duracion * 60000);
      const errorHorario = validarHorarioAtencion(fechaInicioDate, fechaFinDate);

      if (errorHorario) {
        return res.status(400).json({ error: errorHorario });
      }

      const { libres } = await buscarGroomersDisponibles({
        supabaseAdmin,
        fechaInicioDate,
        fechaFinDate,
        diaSemana: fechaInicioDate.getDay(),
      });

      const { groomers: groomersConEstado } = await evaluarGroomersDisponibilidad({
        supabaseAdmin,
        fechaInicioDate,
        fechaFinDate,
        diaSemana: fechaInicioDate.getDay(),
      });

      return res.json({
        data: groomersConEstado,
        total: groomersConEstado.length,
        disponibles: libres.length,
        fecha_fin: fechaFinDate.toISOString()
      });
    }

    const { data, error } = await supabaseAdmin
      .from('groomer_disponibilidad')
      .select(`
        id,
        dia_semana,
        hora_inicio,
        hora_fin,
        groomers (
          id,
          usuarios (
            nombre,
            apellido
          )
        )
      `)
      .eq('activo', true)
      .order('dia_semana', { ascending: true });

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