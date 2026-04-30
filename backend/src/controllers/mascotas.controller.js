// ============================================================
// PawSpa — Controlador de Mascotas (CRUD completo)
// ============================================================
const { supabaseAdmin } = require('../services/supabase');

// ── Listar mascotas ──────────────────────────────────────────
const listar = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    const { activo = 'true', search, cliente_id } = req.query;

    let query = supabaseAdmin
      .from('mascotas')
      .select(`
        *,
        clientes (
          id,
          usuarios (id, nombre, apellido, email, telefono)
        )
      `)
      .order('nombre');

    // Clientes solo ven sus mascotas
    if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin
        .from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (cliente) query = query.eq('cliente_id', cliente.id);
    } else if (cliente_id) {
      query = query.eq('cliente_id', cliente_id);
    }

    if (activo !== 'all') query = query.eq('activo', activo === 'true');
    if (search) query = query.ilike('nombre', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;

    return res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

// ── Obtener una mascota ──────────────────────────────────────
const obtener = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('mascotas')
      .select(`
        *,
        clientes (
          id,
          usuarios (id, nombre, apellido, email, telefono)
        ),
        slot_reserva (
          id, fecha_inicio, estado,
          servicios (nombre),
          groomers (usuarios (nombre, apellido))
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) return res.status(404).json({ error: 'Mascota no encontrada.' });
    return res.json({ data });
  } catch (err) {
    next(err);
  }
};

// ── Crear mascota ────────────────────────────────────────────
const crear = async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    let { cliente_id, ...campos } = req.body;

    // Si es cliente, asignar su propio cliente_id
    if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin
        .from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (!cliente) return res.status(400).json({ error: 'Perfil de cliente no encontrado.' });
      cliente_id = cliente.id;
    }

    const { data, error } = await supabaseAdmin
      .from('mascotas')
      .insert({ ...campos, cliente_id })
      .select()
      .single();

    if (error) throw error;
    return res.status(201).json({ mensaje: 'Mascota registrada.', data });
  } catch (err) {
    next(err);
  }
};

// ── Actualizar mascota ───────────────────────────────────────
const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cliente_id, ...campos } = req.body; // No permitir cambiar dueño por este endpoint

    const { data, error } = await supabaseAdmin
      .from('mascotas')
      .update(campos)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Mascota no encontrada.' });
    return res.json({ mensaje: 'Mascota actualizada.', data });
  } catch (err) {
    next(err);
  }
};

// ── Desactivar mascota (soft delete) ────────────────────────
const eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabaseAdmin
      .from('mascotas')
      .update({ activo: false })
      .eq('id', id)
      .select('id, nombre')
      .single();

    if (error || !data) return res.status(404).json({ error: 'Mascota no encontrada.' });
    return res.json({ mensaje: `Mascota "${data.nombre}" desactivada.` });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
