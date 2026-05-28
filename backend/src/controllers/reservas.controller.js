// ============================================================
// PawSpa — Controlador de Reservas
// ============================================================
const { supabaseAdmin } = require('../services/supabase');
const { enviarNotificacionReserva, enviarRecordatorioReserva } = require('../services/email.service');
const {
  calcularDuracionServicio,
  validarHorarioAtencion,
  buscarGroomersDisponibles,
} = require('../utils/bookingAvailability');

const listar = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    const { estado, fecha_desde, fecha_hasta, groomer_id } = req.query;

    let query = supabaseAdmin
      .from('slot_reserva')
      .select(`
        *,
        mascotas (id, nombre, especie, raza, foto_url),
        clientes (id, usuarios (nombre, apellido, telefono)),
        servicios (id, nombre, duracion_min),
        groomers (id, usuarios (nombre, apellido))
      `)
      .order('fecha_inicio', { ascending: true });

    if (rol === 'cliente') {
      const { data: c } = await supabaseAdmin.from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (c) query = query.eq('cliente_id', c.id);
    } else if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (g) query = query.eq('groomer_id', g.id);
    }

    if (estado)       query = query.eq('estado', estado);
    if (groomer_id)   query = query.eq('groomer_id', groomer_id);
    if (fecha_desde)  query = query.gte('fecha_inicio', fecha_desde);
    if (fecha_hasta)  query = query.lte('fecha_inicio', fecha_hasta);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (err) { next(err); }
};

// endpoint para enviar recordatorios (se puede llamar desde un cron externo)
const enviarRecordatorios = async (req, res, next) => {
  try {
    const horas = parseInt(req.body.horas || req.query.horas || '24', 10);
    const ahora = new Date();
    const hasta = new Date(ahora.getTime() + horas * 3600000);

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
      } catch (e) {
        console.error('[reservas] fallo al enviar recordatorio a', email, e.message || e);
      }
    }

    return res.json({ mensaje: 'Recordatorios enviados', cont: enviados });
  } catch (err) {
    next(err);
  }
};

const historial = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    let clienteId = req.query.cliente_id;
    const mascotaId = req.query.mascota_id;

    if (rol === 'cliente') {
      const { data: c } = await supabaseAdmin.from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (!c) return res.json({ data: [], total: 0 });
      clienteId = c.id;
    }

    if (!clienteId) return res.status(400).json({ error: 'cliente_id es requerido para roles no cliente.' });

    let query = supabaseAdmin
      .from('slot_reserva')
      .select(`
        id,
        fecha_inicio,
        fecha_fin,
        estado,
        mascota_id,
        servicio_id,
        precio_acordado,
        mascotas (id, nombre, especie, raza, foto_url),
        servicios (id, nombre),
        groomers (id, usuarios (nombre, apellido))
      `)
      .eq('cliente_id', clienteId)
      .eq('estado', 'completada')
      .order('fecha_inicio', { ascending: false });

    if (mascotaId) query = query.eq('mascota_id', mascotaId);

    const { data, error } = await query;

    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

const listarAgenda = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    const { fecha_desde, fecha_hasta, groomer_id, tipo } = req.query;

    let query = supabaseAdmin
      .from('v_agenda')
      .select('*')
      .order('start', { ascending: true });

    if (rol === 'cliente') {
      const { data: c } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('usuario_id', usuarioId)
        .single();

      if (!c) {
        return res.json({ data: [], total: 0 });
      }

      query = query.eq('tipo', 'slot').eq('cliente_id', c.id);
    } else if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin
        .from('groomers')
        .select('id')
        .eq('usuario_id', usuarioId)
        .single();

      if (!g) {
        return res.json({ data: [], total: 0 });
      }

      query = query.eq('groomer_id', g.id);
    }

    if (tipo) query = query.eq('tipo', tipo);
    if (groomer_id) query = query.eq('groomer_id', groomer_id);
    if (fecha_desde) query = query.gte('start', fecha_desde);
    if (fecha_hasta) query = query.lte('start', fecha_hasta);

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('slot_reserva')
      .select(`*, mascotas(*), clientes(*, usuarios(*)), servicios(*), groomers(*, usuarios(*))`)
      .eq('id', req.params.id)
      .single();
    if (error || !data) return res.status(404).json({ error: 'Reserva no encontrada.' });
    return res.json({ data });
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    let {
      groomer_id,
      mascota_id,
      servicio_id,
      fecha_inicio,
      precio_acordado,
      observaciones
    } = req.body;

    const { rol, id: usuarioId } = req.usuario;

    // =========================================================
    // 1. Obtener cliente_id automáticamente
    // =========================================================
    let cliente_id = req.body.cliente_id;

    if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('usuario_id', usuarioId)
        .single();

      if (!cliente) {
        return res.status(400).json({
          error: 'Perfil de cliente no encontrado.'
        });
      }

      cliente_id = cliente.id;
    }

    // =========================================================
    // 2. Obtener mascota
    // =========================================================
    const { data: mascota, error: mascotaError } = await supabaseAdmin
      .from('mascotas')
      .select('*')
      .eq('id', mascota_id)
      .single();

    if (mascotaError || !mascota) {
      return res.status(404).json({
        error: 'Mascota no encontrada.'
      });
    }

    // =========================================================
    // 3. Validar ownership mascota
    // =========================================================
    if (mascota.cliente_id !== cliente_id) {
      return res.status(403).json({
        error: 'La mascota no pertenece al cliente.'
      });
    }

    // =========================================================
    // 4. Validar tamaño obligatorio
    // =========================================================
    if (!mascota.tamano) {
      return res.status(400).json({
        error: 'La mascota debe tener tamaño registrado.'
      });
    }

    // =========================================================
    // 5. Obtener servicio
    // =========================================================
    const { data: servicio, error: servicioError } = await supabaseAdmin
      .from('servicios')
      .select('*')
      .eq('id', servicio_id)
      .single();

    if (servicioError || !servicio) {
      return res.status(404).json({
        error: 'Servicio no encontrado.'
      });
    }

    // =========================================================
    // 6. Calcular duración dinámica según tamaño
    // =========================================================
    const duracion = calcularDuracionServicio(servicio, mascota.tamano);

    // =========================================================
    // 7. Calcular fecha_fin
    // =========================================================
    const fechaInicioDate = new Date(fecha_inicio);

    const fechaFinDate = new Date(
      fechaInicioDate.getTime() + duracion * 60000
    );

    const fecha_fin = fechaFinDate.toISOString();

    const diaSemana = fechaInicioDate.getDay();
    const errorHorario = validarHorarioAtencion(fechaInicioDate, fechaFinDate);

    if (errorHorario) {
      return res.status(400).json({ error: errorHorario });
    }

    const { libres, detalles, inicioTime, finTime } = await buscarGroomersDisponibles({
      supabaseAdmin,
      fechaInicioDate,
      fechaFinDate,
      diaSemana,
      groomerId: groomer_id || null,
    });

    if (groomer_id) {
      if (!libres.includes(groomer_id)) {
        const debugPayload = {
          motivo: 'groomer_sin_disponibilidad',
          pedido: { inicioTime, finTime, diaSemana, fecha_inicio: fechaInicioDate.toISOString(), fecha_fin: fechaFinDate.toISOString() },
          groomer_id,
          detalles,
        };

        console.error('[reservas] disponibilidad fallida:', JSON.stringify(debugPayload, null, 2));

        return res.status(409).json({
          error: 'El groomer no tiene disponibilidad en ese horario.',
          debug: debugPayload,
        });
      }
    } else {
      if (!libres.length) {
        const debugPayload = {
          motivo: 'ningun_groomer_libre',
          pedido: { inicioTime, finTime, diaSemana, fecha_inicio: fechaInicioDate.toISOString(), fecha_fin: fechaFinDate.toISOString() },
          detalles,
        };

        console.error('[reservas] ningun groomer libre:', JSON.stringify(debugPayload, null, 2));

        return res.status(409).json({
          error: 'No hay groomers libres en ese horario.',
          debug: debugPayload,
        });
      }

      groomer_id = libres[0];
    }

    // =========================================================
    // 11. Crear reserva
    // =========================================================
    const { data, error } = await supabaseAdmin
      .from('slot_reserva')
      .insert({
        groomer_id,
        mascota_id,
        cliente_id,
        servicio_id,
        fecha_inicio,
        fecha_fin,
        precio_acordado,
        observaciones,
        creado_por: usuarioId
      })
      .select()
      .single();

    if (error) throw error;

    // Enviar notificación al cliente según el estado de la reserva
    try {
      const { data: clienteInfo } = await supabaseAdmin
        .from('clientes')
        .select('id, usuarios (email, nombre)')
        .eq('id', cliente_id)
        .single();

      const email = clienteInfo?.usuarios?.email;
      const nombreCliente = clienteInfo?.usuarios?.nombre;
      const nombreMascota = mascota.nombre;

      if (email) {
        const enlaceReserva = `${process.env.FRONTEND_URL || ''}/reservas/${data.id}`;

        if (data.estado === 'pendiente') {
          // Solicitud en revisión
          await enviarNotificacionReserva({
            to: email,
            asunto: 'Solicitud recibida — PawSpa',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
                <h2>Hola ${nombreCliente || ''}</h2>
                <p>Hemos recibido tu solicitud de reserva para <strong>${nombreMascota}</strong> el <strong>${new Date(data.fecha_inicio).toLocaleString()}</strong>.</p>
                <p>Tu solicitud está en revisión por el equipo de recepción y te notificaremos cuando sea aprobada.</p>
                <p>Ver detalles: <a href="${enlaceReserva}">${enlaceReserva}</a></p>
              </div>
            `
          });
        } else if (data.estado === 'confirmada') {
          // Reserva confirmada
          await enviarNotificacionReserva({
            to: email,
            asunto: 'Reserva confirmada — PawSpa',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
                <h2>Hola ${nombreCliente || ''}</h2>
                <p>Tu reserva para <strong>${nombreMascota}</strong> quedó confirmada para el <strong>${new Date(data.fecha_inicio).toLocaleString()}</strong>.</p>
                <p>Ver detalles: <a href="${enlaceReserva}">${enlaceReserva}</a></p>
              </div>
            `
          });
        }
      }
    } catch (emailErr) {
      console.error('[reservas] error enviando correo de notificación tras crear reserva:', emailErr.message || emailErr);
    }

    return res.status(201).json({
      mensaje: 'Reserva creada exitosamente.',
      duracion_calculada: duracion,
      duracion_unidad: 'minutos',
      data
    });

  } catch (err) {
    next(err);
  }
};

const cancelar = async (req, res, next) => {
  try {
    const { motivo } = req.body;
    const { data, error } = await supabaseAdmin
      .from('slot_reserva')
      .update({ estado: 'cancelada', cancelado_por: req.usuario.id, motivo_cancel: motivo })
      .eq('id', req.params.id)
      .select('id, estado')
      .single();
    if (error || !data) return res.status(404).json({ error: 'Reserva no encontrada.' });
    return res.json({ mensaje: 'Reserva cancelada.', data });
  } catch (err) { next(err); }
};

const actualizarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const estadosValidos = ['pendiente','confirmada','en_progreso','completada','no_show'];
    if (!estadosValidos.includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });

    const { data, error } = await supabaseAdmin
      .from('slot_reserva')
      .update({ estado })
      .eq('id', req.params.id)
      .select('*, mascotas (nombre)')
      .single();

    if (error) throw error;
    // Enviar notificaciones si el estado cambió a alguno relevante
    try {
      const { data: clienteInfo } = await supabaseAdmin
        .from('clientes')
        .select('id, usuarios (email, nombre)')
        .eq('id', data.cliente_id)
        .single();

      const email = clienteInfo?.usuarios?.email;
      const nombreCliente = clienteInfo?.usuarios?.nombre;
      const nombreMascota = data?.mascotas?.nombre || '';

      if (email) {
        const enlaceReserva = `${process.env.FRONTEND_URL || ''}/reservas/${data.id}`;

        if (data.estado === 'confirmada') {
          await enviarNotificacionReserva({
            to: email,
            asunto: 'Cita confirmada — PawSpa',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
                <h2>Hola ${nombreCliente || ''}</h2>
                <p>Tu cita para <strong>${nombreMascota}</strong> ha sido aprobada y confirmada para el <strong>${new Date(data.fecha_inicio).toLocaleString()}</strong>.</p>
                <p>Ver detalles: <a href="${enlaceReserva}">${enlaceReserva}</a></p>
              </div>
            `
          });
        }

        if (data.estado === 'completada') {
          await enviarNotificacionReserva({
            to: email,
            asunto: 'Listo para recoger — PawSpa',
            html: `
              <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
                <h2>Hola ${nombreCliente || ''}</h2>
                <p>La ficha de grooming para <strong>${nombreMascota}</strong> ha sido cerrada y tu mascota está lista para ser recogida.</p>
                <p>Ver detalles: <a href="${enlaceReserva}">${enlaceReserva}</a></p>
              </div>
            `
          });
        }
      }
    } catch (notifyErr) {
      console.error('[reservas] error enviando notificación por cambio de estado:', notifyErr.message || notifyErr);
    }
    return res.json({ mensaje: 'Estado actualizado.', data });
  } catch (err) { next(err); }
};

const reprogramar = async (req, res, next) => {
  try {
    const { fecha_inicio, fecha_fin, groomer_id } = req.body;

    if (!fecha_inicio) {
      return res.status(400).json({ error: 'fecha_inicio es obligatoria.' });
    }

    const { data: reservaActual, error: reservaError } = await supabaseAdmin
      .from('slot_reserva')
      .select('id, groomer_id, fecha_inicio, fecha_fin, estado, cliente_id')
      .eq('id', req.params.id)
      .single();

    if (reservaError || !reservaActual) {
      return res.status(404).json({ error: 'Reserva no encontrada.' });
    }

    if (['cancelada', 'completada', 'no_show'].includes(reservaActual.estado)) {
      return res.status(409).json({ error: 'No se puede reprogramar una reserva cerrada.' });
    }

    // Si el usuario es cliente, validar que la reserva le pertenezca
    const { rol, id: usuarioId } = req.usuario;
    if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin.from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (!cliente || cliente.id !== reservaActual.cliente_id) {
        return res.status(403).json({ error: 'No tienes permiso para reprogramar esta reserva.' });
      }
    }

    const nuevoGroomerId = groomer_id || reservaActual.groomer_id;
    const nuevaFechaInicio = new Date(fecha_inicio);

    if (Number.isNaN(nuevaFechaInicio.getTime())) {
      return res.status(400).json({ error: 'fecha_inicio inválida.' });
    }

    let nuevaFechaFin;
    if (fecha_fin) {
      nuevaFechaFin = new Date(fecha_fin);
      if (Number.isNaN(nuevaFechaFin.getTime())) {
        return res.status(400).json({ error: 'fecha_fin inválida.' });
      }
    } else {
      const inicioActual = new Date(reservaActual.fecha_inicio);
      const finActual = new Date(reservaActual.fecha_fin);
      const duracionMs = finActual.getTime() - inicioActual.getTime();
      nuevaFechaFin = new Date(nuevaFechaInicio.getTime() + duracionMs);
    }

    if (nuevaFechaFin <= nuevaFechaInicio) {
      return res.status(400).json({ error: 'fecha_fin debe ser mayor a fecha_inicio.' });
    }

    const diaSemana = nuevaFechaInicio.getDay();
    const errorHorario = validarHorarioAtencion(nuevaFechaInicio, nuevaFechaFin);

    if (errorHorario) {
      return res.status(400).json({ error: errorHorario });
    }

    const { libres } = await buscarGroomersDisponibles({
      supabaseAdmin,
      fechaInicioDate: nuevaFechaInicio,
      fechaFinDate: nuevaFechaFin,
      diaSemana,
      groomerId: nuevoGroomerId,
    });

    if (!libres.includes(nuevoGroomerId)) {
      return res.status(409).json({ error: 'El groomer no tiene disponibilidad en ese horario.' });
    }

    const { data, error } = await supabaseAdmin
      .from('slot_reserva')
      .update({
        groomer_id: nuevoGroomerId,
        fecha_inicio: nuevaFechaInicio.toISOString(),
        fecha_fin: nuevaFechaFin.toISOString()
      })
      .eq('id', reservaActual.id)
      .select()
      .single();

    if (error) throw error;

    return res.json({
      mensaje: 'Reserva reprogramada exitosamente.',
      data
    });
  } catch (err) {
    next(err);
  }
};

const listarBloqueos = async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta, groomer_id } = req.query;

    let query = supabaseAdmin
      .from('bloqueo_agenda')
      .select(`
        id,
        groomer_id,
        fecha_inicio,
        fecha_fin,
        motivo,
        creado_por,
        creado_en,
        groomers (id, usuarios (nombre, apellido))
      `)
      .order('fecha_inicio', { ascending: true });

    if (groomer_id) query = query.eq('groomer_id', groomer_id);
    if (fecha_desde) query = query.gte('fecha_inicio', fecha_desde);
    if (fecha_hasta) query = query.lte('fecha_inicio', fecha_hasta);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

const crearBloqueo = async (req, res, next) => {
  try {
    const { groomer_id, fecha_inicio, fecha_fin, motivo } = req.body;

    if (!groomer_id || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'groomer_id, fecha_inicio y fecha_fin son obligatorios.' });
    }

    const inicio = new Date(fecha_inicio);
    const fin = new Date(fecha_fin);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      return res.status(400).json({ error: 'fecha_inicio o fecha_fin inválida.' });
    }

    if (fin <= inicio) {
      return res.status(400).json({ error: 'fecha_fin debe ser mayor a fecha_inicio.' });
    }

    const { data: groomer, error: groomerError } = await supabaseAdmin
      .from('groomers')
      .select('id')
      .eq('id', groomer_id)
      .single();

    if (groomerError || !groomer) {
      return res.status(404).json({ error: 'Groomer no encontrado.' });
    }

    const { data: bloqueosExistentes } = await supabaseAdmin
      .from('bloqueo_agenda')
      .select('id, fecha_inicio, fecha_fin')
      .eq('groomer_id', groomer_id);

    const seSolapaBloqueo = bloqueosExistentes?.some((b) =>
      inicio < new Date(b.fecha_fin) && fin > new Date(b.fecha_inicio)
    );

    if (seSolapaBloqueo) {
      return res.status(409).json({ error: 'Ya existe un bloqueo que se solapa en ese horario.' });
    }

    const { data: reservasActivas } = await supabaseAdmin
      .from('slot_reserva')
      .select('id, fecha_inicio, fecha_fin, estado')
      .eq('groomer_id', groomer_id)
      .not('estado', 'in', '("cancelada","no_show")');

    const conflictoConReserva = reservasActivas?.some((r) =>
      inicio < new Date(r.fecha_fin) && fin > new Date(r.fecha_inicio)
    );

    if (conflictoConReserva) {
      return res.status(409).json({ error: 'Existe una reserva activa en ese horario. Reprograma/cancela antes de bloquear.' });
    }

    const { data, error } = await supabaseAdmin
      .from('bloqueo_agenda')
      .insert({
        groomer_id,
        fecha_inicio: inicio.toISOString(),
        fecha_fin: fin.toISOString(),
        motivo: motivo || null,
        creado_por: req.usuario.id
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({ mensaje: 'Bloqueo creado exitosamente.', data });
  } catch (err) {
    next(err);
  }
};

const eliminarBloqueo = async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('bloqueo_agenda')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Bloqueo no encontrado.' });
    }

    return res.json({ mensaje: 'Bloqueo eliminado.', data });
  } catch (err) {
    next(err);
  }
};

const listarPagos = async (req, res, next) => {
  try {
    const { slot_id, estado, fecha_desde, fecha_hasta } = req.query;

    let query = supabaseAdmin
      .from('pago_factura')
      .select(`
        id,
        cliente_id,
        slot_id,
        numero_factura,
        subtotal,
        descuento,
        impuestos,
        total,
        tipo_pago,
        estado,
        fecha_pago,
        notas,
        creado_por,
        creado_en,
        clientes (id, usuarios (nombre, apellido)),
        slot_reserva:slot_id (id, mascotas (nombre), servicios (nombre))
      `)
      .order('creado_en', { ascending: false });

    if (slot_id) query = query.eq('slot_id', slot_id);
    if (estado) query = query.eq('estado', estadoPagoUIToDB(estado));
    if (fecha_desde) query = query.gte('creado_en', fecha_desde);
    if (fecha_hasta) query = query.lte('creado_en', fecha_hasta);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

const estadoPagoUIToDB = (estado) => {
  if (estado === 'verificado') return 'pagado';
  if (estado === 'no_verificado') return 'pendiente';
  return estado;
};

const estadoPagoDBToUI = (estado) => {
  if (estado === 'pagado') return 'verificado';
  if (estado === 'pendiente') return 'no_verificado';
  return estado;
};

const actualizarEstadoPago = async (req, res, next) => {
  try {
    const estadoUI = req.body.estado;
    const estadosValidos = ['verificado', 'no_verificado'];

    if (!estadosValidos.includes(estadoUI)) {
      return res.status(400).json({ error: `estado debe ser: ${estadosValidos.join(', ')}.` });
    }

    const estado = estadoPagoUIToDB(estadoUI);

    const { data: existente, error: existenciaError } = await supabaseAdmin
      .from('pago_factura')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (existenciaError || !existente) {
      return res.status(404).json({ error: 'Pago no encontrado.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('pago_factura')
      .update({ estado, actualizado_en: new Date().toISOString() })
      .eq('id', req.params.id);

    if (updateError) throw updateError;

    const { data, error } = await supabaseAdmin
      .from('pago_factura')
      .select(`
        id,
        cliente_id,
        slot_id,
        numero_factura,
        subtotal,
        descuento,
        impuestos,
        total,
        tipo_pago,
        estado,
        fecha_pago,
        notas,
        creado_por,
        creado_en,
        actualizado_en,
        clientes (id, usuarios (nombre, apellido)),
        slot_reserva:slot_id (id, mascotas (nombre), servicios (nombre))
      `)
      .eq('id', req.params.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Pago no encontrado.' });
    }

    return res.json({
      mensaje: 'Estado del pago actualizado.',
      data: { ...data, estado: estadoPagoDBToUI(data.estado) }
    });
  } catch (err) {
    next(err);
  }
};

const registrarPago = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    const { slot_id, monto, tipo_pago, notas } = req.body;

    if (!slot_id || !monto || !tipo_pago) {
      return res.status(400).json({ error: 'slot_id, monto y tipo_pago son obligatorios.' });
    }

    const tiposValidos = ['efectivo', 'qr', 'transferencia', 'otros'];
    if (!tiposValidos.includes(tipo_pago)) {
      return res.status(400).json({ error: `tipo_pago debe ser: ${tiposValidos.join(', ')}.` });
    }

    if (monto <= 0) {
      return res.status(400).json({ error: 'monto debe ser mayor a 0.' });
    }

    const { data: slot, error: slotError } = await supabaseAdmin
      .from('slot_reserva')
      .select('id, cliente_id, precio_acordado, estado')
      .eq('id', slot_id)
      .single();

    if (slotError || !slot) {
      return res.status(404).json({ error: 'Cita (slot) no encontrada.' });
    }

    if (!['pendiente', 'confirmada'].includes(slot.estado)) {
      return res.status(409).json({ error: 'No se puede pagar una cita que no está pendiente o confirmada.' });
    }

    if (rol === 'cliente') {
      const { data: cliente, error: clienteError } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('usuario_id', usuarioId)
        .single();

      if (clienteError || !cliente) {
        return res.status(403).json({ error: 'Perfil de cliente no encontrado.' });
      }

      if (cliente.id !== slot.cliente_id) {
        return res.status(403).json({ error: 'No puedes pagar una cita que no te pertenece.' });
      }
    }

    const { data: pagoPrevio } = await supabaseAdmin
      .from('pago_factura')
      .select('id, estado')
      .eq('slot_id', slot_id)
      .eq('estado', 'pagado')
      .single();

    if (pagoPrevio) {
      return res.status(409).json({ error: 'Esta cita ya ha sido pagada.' });
    }

    const { data: pago, error: pagoError } = await supabaseAdmin
      .from('pago_factura')
      .insert({
        cliente_id: slot.cliente_id,
        slot_id,
        numero_factura: `FAC-${Date.now()}`,
        subtotal: monto,
        descuento: req.body.descuento || 0,
        impuestos: req.body.impuestos || 0,
        total: req.body.total || monto,
        tipo_pago,
        estado: 'pendiente',
        fecha_pago: new Date().toISOString(),
        notas: notas || null,
        creado_por: req.usuario.id
      })
      .select()
      .single();

    if (pagoError) throw pagoError;

    await supabaseAdmin
      .from('slot_reserva')
      .update({ estado: 'confirmada' })
      .eq('id', slot_id);

      // Registrar redención de promoción si aplica
      try {
        const promocionId = req.body.promocion_id || null;
        let promoIdToInsert = promocionId;
        if (!promoIdToInsert && req.body.promocion_codigo) {
          const { data: promos } = await supabaseAdmin.from('promocion').select('id').eq('codigo', req.body.promocion_codigo).limit(1);
          if (promos && promos[0]) promoIdToInsert = promos[0].id;
        }

        const montoDescuento = Number(req.body.descuento || 0);
        if (promoIdToInsert && pago && montoDescuento > 0) {
          await supabaseAdmin.from('promocion_redencion').insert({
            promocion_id: promoIdToInsert,
            cliente_id: slot.cliente_id,
            pedido_id: pago.id,
            monto_descuento: montoDescuento
          });
        }
      } catch (promoErr) {
        console.error('[promocion] error registrando redención:', promoErr.message || promoErr);
      }

      // Registrar movimiento de caja para este pago
      try {
        if (pago && pago.id) {
          await supabaseAdmin.from('movimiento_caja').insert({
            pago_id: pago.id,
            pedido_id: null,
            tipo_movimiento: 'ingreso',
            metodo_pago: tipo_pago,
            monto: pago.total || monto,
            referencia: `Pago slot ${slot_id}`,
            creado_por: req.usuario.id
          });
        }
      } catch (movErr) {
        console.error('[caja] error registrando movimiento:', movErr.message || movErr);
      }

      // Generar comprobante PDF y guardar URL en pago_factura
      try {
        const { generatePdfAndUpload } = require('../services/pdf.service');
        const pagoObj = pago;
        const html = `
          <html><head><meta charset="utf-8"><title>Recibo ${pagoObj.numero_factura}</title></head><body>
          <h1>Recibo de pago</h1>
          <p>Factura: ${pagoObj.numero_factura}</p>
          <p>Monto: ${Number(pagoObj.total).toFixed(2)}</p>
          <p>Método: ${pagoObj.tipo_pago}</p>
          <p>Fecha: ${pagoObj.fecha_pago}</p>
          </body></html>
        `;
        const pdfPath = `recibos/${pagoObj.id}.pdf`;
        const publicUrl = await generatePdfAndUpload({ html, bucket: 'documentos', path: pdfPath });
        if (publicUrl) {
          const { error: updErr } = await supabaseAdmin.from('pago_factura').update({ comprobante_url: publicUrl }).eq('id', pagoObj.id);
          if (updErr) console.error('[pago] no se pudo actualizar comprobante_url:', updErr.message || updErr);
          pago.comprobante_url = publicUrl;
        }
      } catch (pdfErr) {
        console.error('[pago] error generando comprobante PDF:', pdfErr.message || pdfErr);
      }

      // Enviar comprobante por email al cliente (si tiene email)
      try {
        const { data: clienteInfo } = await supabaseAdmin.from('clientes').select('id, usuarios (email, nombre)').eq('id', slot.cliente_id).single();
        const email = clienteInfo?.usuarios?.email;
        const nombre = clienteInfo?.usuarios?.nombre;
        if (email && pago.comprobante_url) {
          const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
              <h2>Hola ${nombre || ''}</h2>
              <p>Gracias por tu pago. Puedes descargar tu recibo aquí:</p>
              <p><a href="${pago.comprobante_url}">Descargar comprobante</a></p>
              <p>Factura: <strong>${pago.numero_factura}</strong></p>
              <p>Monto: <strong>Bs. ${Number(pago.total).toFixed(2)}</strong></p>
            </div>
          `;
          await enviarNotificacionReserva({ to: email, asunto: 'Recibo de pago — PawSpa', html });
        }
      } catch (emailErr) {
        console.error('[pago] error enviando comprobante por email:', emailErr.message || emailErr);
      }

    return res.status(201).json({
      mensaje: 'Pago registrado exitosamente.',
      data: pago
    });
  } catch (err) {
    next(err);
  }
};

const enviarComprobante = async (req, res, next) => {
  try {
    const pagoId = req.params.id;
    const { rol, id: usuarioId } = req.usuario;

    const { data: pago, error: pagoErr } = await supabaseAdmin
      .from('pago_factura')
      .select(`*, clientes (id, usuarios (email, nombre)), slot_reserva:slot_id (id, mascotas (nombre))`)
      .eq('id', pagoId)
      .single();

    if (pagoErr || !pago) return res.status(404).json({ error: 'Pago no encontrado.' });

    // Si es cliente, validar propiedad
    if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin.from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (!cliente || cliente.id !== pago.cliente_id) return res.status(403).json({ error: 'No tienes permiso para enviar este comprobante.' });
    }

    let publicUrl = pago.comprobante_url;
    // Generar PDF si no existe
    if (!publicUrl) {
      try {
        const { generatePdfAndUpload } = require('../services/pdf.service');
        const html = `
          <html><head><meta charset="utf-8"><title>Recibo ${pago.numero_factura}</title></head><body>
          <h1>Recibo de pago</h1>
          <p>Factura: ${pago.numero_factura}</p>
          <p>Monto: ${Number(pago.total).toFixed(2)}</p>
          <p>Método: ${pago.tipo_pago}</p>
          <p>Fecha: ${pago.fecha_pago}</p>
          </body></html>
        `;
        const pdfPath = `recibos/${pago.id}.pdf`;
        publicUrl = await generatePdfAndUpload({ html, bucket: 'documentos', path: pdfPath });
        if (publicUrl) {
          const { error: updErr } = await supabaseAdmin.from('pago_factura').update({ comprobante_url: publicUrl }).eq('id', pago.id);
          if (updErr) console.error('[pago] no se pudo actualizar comprobante_url:', updErr.message || updErr);
        }
      } catch (e) {
        console.error('[comprobante] error generando PDF:', e.message || e);
      }
    }

    // Enviar email si hay destinatario
    try {
      const email = pago.clientes?.usuarios?.email;
      const nombre = pago.clientes?.usuarios?.nombre;
      if (!email) return res.status(400).json({ error: 'Cliente no tiene email registrado.' });
      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
          <h2>Hola ${nombre || ''}</h2>
          <p>Adjuntamos el comprobante de tu pago.</p>
          ${publicUrl ? `<p><a href="${publicUrl}">Descargar comprobante</a></p>` : `<p>El comprobante no está disponible.</p>`}
          <p>Factura: <strong>${pago.numero_factura}</strong></p>
          <p>Monto: <strong>Bs. ${Number(pago.total).toFixed(2)}</strong></p>
        </div>
      `;
      await enviarNotificacionReserva({ to: email, asunto: 'Recibo de pago — PawSpa', html });
    } catch (mailErr) {
      console.error('[comprobante] error enviando email:', mailErr.message || mailErr);
      return res.status(500).json({ error: 'Error enviando email.' });
    }

    return res.json({ mensaje: 'Comprobante enviado.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listar,
  listarAgenda,
  obtener,
  crear,
  cancelar,
  actualizarEstado,
  reprogramar,
  listarBloqueos,
  crearBloqueo,
  eliminarBloqueo,
  listarPagos,
  registrarPago,
  actualizarEstadoPago,
  historial,
  enviarRecordatorios
  ,
  enviarComprobante
};
