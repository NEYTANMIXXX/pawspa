// ============================================================
// PawSpa — Utilidades de disponibilidad para reservas
// ============================================================

const pad = (n) => n.toString().padStart(2, '0');

const formatearHora = (fecha) => `${pad(fecha.getHours())}:${pad(fecha.getMinutes())}`;

const horaEnMinutos = (hora) => {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
};

const estaDentroDeVentana = (inicioVentana, finVentana, inicioPedido, finPedido) => {
  return horaEnMinutos(inicioVentana) <= horaEnMinutos(inicioPedido)
    && horaEnMinutos(finVentana) >= horaEnMinutos(finPedido);
};

const calcularDuracionServicio = (servicio, tamanoMascota) => {
  let duracion = servicio.duracion_min;

  switch (tamanoMascota) {
    case 'mini':
    case 'pequeno':
      break;
    case 'mediano':
      duracion = Math.ceil(duracion * 1.10);
      break;
    case 'grande':
      duracion = Math.ceil(duracion * 1.15);
      break;
    case 'gigante':
      duracion = Math.ceil(duracion * 1.30);
      break;
  }

  return duracion;
};

const validarHorarioAtencion = (fechaInicioDate, fechaFinDate) => {
  if (fechaInicioDate.getDay() === 0) {
    return 'La atención solo está disponible de lunes a sábado.';
  }

  const apertura = new Date(fechaInicioDate);
  apertura.setHours(9, 0, 0, 0);

  const cierre = new Date(fechaInicioDate);
  cierre.setHours(18, 0, 0, 0);

  if (fechaInicioDate < apertura || fechaFinDate > cierre) {
    return 'El horario de atención es de 09:00 a 18:00.';
  }

  return null;
};

const buscarGroomersDisponibles = async ({
  supabaseAdmin,
  fechaInicioDate,
  fechaFinDate,
  diaSemana,
  groomerId = null,
}) => {
  const inicioTime = formatearHora(fechaInicioDate);
  const finTime = formatearHora(fechaFinDate);

  let groomersQuery = supabaseAdmin
    .from('groomers')
    .select('id, activo')
    .eq('activo', true)
    .order('creado_en', { ascending: true });

  if (groomerId) {
    groomersQuery = groomersQuery.eq('id', groomerId);
  }

  const { data: groomersActivos, error } = await groomersQuery;

  if (error) {
    throw error;
  }

  const candidatos = (groomersActivos || []).map((item) => item.id);
  const libres = [];
  const detalles = [];

  const horariosDefault = {
    1: [{ inicio: '09:00', fin: '18:00' }],
    2: [{ inicio: '09:00', fin: '18:00' }],
    3: [{ inicio: '09:00', fin: '18:00' }],
    4: [{ inicio: '09:00', fin: '18:00' }],
    5: [{ inicio: '09:00', fin: '18:00' }],
    6: [{ inicio: '09:00', fin: '14:00' }],
  };

  for (const candidateId of candidatos) {
    const { data: disponibilidades, error: disponibilidadError } = await supabaseAdmin
      .from('groomer_disponibilidad')
      .select('dia_semana, hora_inicio, hora_fin')
      .eq('groomer_id', candidateId)
      .eq('activo', true)
      .eq('dia_semana', diaSemana);

    if (disponibilidadError) {
      throw disponibilidadError;
    }

    const ventanas = (disponibilidades || []).length
      ? (disponibilidades || []).map((item) => ({ inicio: item.hora_inicio, fin: item.hora_fin }))
      : (horariosDefault[diaSemana] || []);

    const cubreHorario = ventanas.some((ventana) => estaDentroDeVentana(ventana.inicio, ventana.fin, inicioTime, finTime));

    if (!cubreHorario) {
      detalles.push({ groomer_id: candidateId, tieneBloqueo: false, conflicto: false, cubreHorario: false });
      continue;
    }

    const [bloqueosResp, reservasResp] = await Promise.all([
      supabaseAdmin
        .from('bloqueo_agenda')
        .select('id')
        .eq('groomer_id', candidateId)
        .lt('fecha_inicio', fechaFinDate.toISOString())
        .gt('fecha_fin', fechaInicioDate.toISOString()),
      supabaseAdmin
        .from('slot_reserva')
        .select('id')
        .eq('groomer_id', candidateId)
        .not('estado', 'in', '("cancelada","completada","no_show")')
        .lt('fecha_inicio', fechaFinDate.toISOString())
        .gt('fecha_fin', fechaInicioDate.toISOString()),
    ]);

    const tieneBloqueo = Boolean(bloqueosResp.data?.length);
    const conflicto = Boolean(reservasResp.data?.length);

    detalles.push({ groomer_id: candidateId, tieneBloqueo, conflicto, cubreHorario: true });

    if (!tieneBloqueo && !conflicto) {
      libres.push(candidateId);
    }
  }

  return {
    inicioTime,
    finTime,
    candidatos,
    libres,
    detalles,
  };
};

const evaluarGroomersDisponibilidad = async ({
  supabaseAdmin,
  fechaInicioDate,
  fechaFinDate,
  diaSemana,
}) => {
  const { libres, candidatos, detalles, inicioTime, finTime } = await buscarGroomersDisponibles({
    supabaseAdmin,
    fechaInicioDate,
    fechaFinDate,
    diaSemana,
  });

  const detallePorGroomer = new Map(detalles.map((detalle) => [detalle.groomer_id, detalle]));

  const { data: groomers, error } = await supabaseAdmin
    .from('groomers')
    .select(`
      id,
      bio,
      especialidades,
      activo,
      usuarios (
        id,
        nombre,
        apellido,
        email,
        telefono,
        avatar_url
      )
    `)
    .eq('activo', true)
    .order('creado_en', { ascending: true });

  if (error) {
    throw error;
  }

  const groomersConEstado = (groomers || []).map((groomer) => {
    const detalle = detallePorGroomer.get(groomer.id);

    const horarioBase = !detalle || detalle.cubreHorario === undefined ? 'Horario no evaluado.' : null;

    if (!candidatos.includes(groomer.id)) {
      return {
        ...groomer,
        disponible: false,
        motivo_disponibilidad: 'No tiene horario para ese día u hora.',
      };
    }

    if (libres.includes(groomer.id)) {
      return {
        ...groomer,
        disponible: true,
        motivo_disponibilidad: null,
      };
    }

    return {
      ...groomer,
      disponible: false,
      motivo_disponibilidad: detalle?.tieneBloqueo
        ? 'Tiene un bloqueo en ese horario.'
        : detalle?.cubreHorario === false
          ? 'No tiene horario cargado para ese día; usa horario general del local.'
          : 'Ya tiene una reserva en ese horario.',
    };
  });

  return {
    inicioTime,
    finTime,
    candidatos,
    libres,
    detalles,
    groomers: groomersConEstado,
  };
};

module.exports = {
  calcularDuracionServicio,
  validarHorarioAtencion,
  buscarGroomersDisponibles,
  evaluarGroomersDisponibilidad,
};