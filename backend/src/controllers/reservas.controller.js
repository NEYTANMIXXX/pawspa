// ============================================================
// PawSpa — Controlador de Reservas
// ============================================================
const { supabaseAdmin } = require('../services/supabase');

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
    const { groomer_id, mascota_id, servicio_id, fecha_inicio, precio_acordado, observaciones } = req.body;
    const { rol, id: usuarioId } = req.usuario;

    // Obtener cliente_id
    let cliente_id = req.body.cliente_id;
    if (rol === 'cliente') {
      const { data: c } = await supabaseAdmin.from('clientes').select('id').eq('usuario_id', usuarioId).single();
      cliente_id = c?.id;
    }

    // Calcular fecha_fin según duración del servicio
    const { data: servicio } = await supabaseAdmin.from('servicios').select('duracion_min').eq('id', servicio_id).single();
    const fecha_fin = new Date(new Date(fecha_inicio).getTime() + servicio.duracion_min * 60000).toISOString();

    // Verificar doble reserva
    const { data: conflicto } = await supabaseAdmin
      .from('slot_reserva')
      .select('id')
      .eq('groomer_id', groomer_id)
      .eq('fecha_inicio', fecha_inicio)
      .not('estado', 'in', '("cancelada","no_show")')
      .single();

    if (conflicto) return res.status(409).json({ error: 'El groomer ya tiene una cita en ese horario.' });

    const { data, error } = await supabaseAdmin
      .from('slot_reserva')
      .insert({ groomer_id, mascota_id, cliente_id, servicio_id, fecha_inicio, fecha_fin, precio_acordado, observaciones, creado_por: usuarioId })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ mensaje: 'Reserva creada exitosamente.', data });
  } catch (err) { next(err); }
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
      .select()
      .single();

    if (error) throw error;
    return res.json({ mensaje: 'Estado actualizado.', data });
  } catch (err) { next(err); }
};

module.exports = { listar, obtener, crear, cancelar, actualizarEstado };
