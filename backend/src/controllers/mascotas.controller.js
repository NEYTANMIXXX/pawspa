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

    // Verificar ownership: si es cliente, solo puede actualizar sus propias mascotas
    if (req.usuario.rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('usuario_id', req.usuario.id)
        .single();

      if (!cliente) return res.status(400).json({ error: 'Perfil de cliente no encontrado.' });

      const { data: mascotaActual } = await supabaseAdmin
        .from('mascotas')
        .select('id, cliente_id')
        .eq('id', id)
        .single();

      if (!mascotaActual) return res.status(404).json({ error: 'Mascota no encontrada.' });
      if (mascotaActual.cliente_id !== cliente.id) return res.status(403).json({ error: 'No tienes permisos sobre esta mascota.' });
    }

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
    // Si es cliente, verificar que la mascota pertenezca a él
    if (req.usuario.rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('usuario_id', req.usuario.id)
        .single();

      if (!cliente) return res.status(400).json({ error: 'Perfil de cliente no encontrado.' });

      const { data: mascotaActual } = await supabaseAdmin
        .from('mascotas')
        .select('id, cliente_id, nombre')
        .eq('id', id)
        .single();

      if (!mascotaActual) return res.status(404).json({ error: 'Mascota no encontrada.' });
      if (mascotaActual.cliente_id !== cliente.id) return res.status(403).json({ error: 'No tienes permisos sobre esta mascota.' });

      const { data, error } = await supabaseAdmin
        .from('mascotas')
        .update({ activo: false })
        .eq('id', id)
        .select('id, nombre')
        .single();

      if (error || !data) return res.status(404).json({ error: 'Mascota no encontrada.' });
      return res.json({ mensaje: `Mascota "${data.nombre}" desactivada.` });
    }

    // Permitir a admins/desarrolladores desactivar cualquier mascota
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

// ── Historial de servicios por mascota ───────────────────────
const historial = async (req, res, next) => {
  try {
    const { id } = req.params; // mascota id
    const { rol, id: usuarioId } = req.usuario;

    // Si es cliente, verificar ownership
    if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('usuario_id', usuarioId)
        .single();

      if (!cliente) return res.status(400).json({ error: 'Perfil de cliente no encontrado.' });

      const { data: mascota } = await supabaseAdmin
        .from('mascotas')
        .select('id, cliente_id')
        .eq('id', id)
        .single();

      if (!mascota) return res.status(404).json({ error: 'Mascota no encontrada.' });
      if (mascota.cliente_id !== cliente.id) return res.status(403).json({ error: 'No tienes permisos sobre esta mascota.' });
    }

    const { data: historialBase, error } = await supabaseAdmin
      .from('slot_reserva')
      .select(`
        id,
        fecha_inicio,
        fecha_fin,
        estado,
        servicio_id,
        precio_acordado,
        observaciones,
        servicios (id, nombre, duracion_min),
        groomers (id, usuarios (nombre, apellido)),
        clientes (id, usuarios (nombre, apellido))
      `)
      .eq('mascota_id', id)
      .eq('estado', 'completada')
      .order('fecha_inicio', { ascending: false });

    if (error) throw error;

    const slots = historialBase || [];
    const slotIds = slots.map((item) => item.id);

    if (!slotIds.length) {
      return res.json({ data: [], total: 0 });
    }

    const { data: fichas, error: fichasError } = await supabaseAdmin
      .from('ficha_grooming')
      .select(`
        id,
        slot_id,
        hora_inicio,
        hora_fin,
        observaciones_ini,
        observaciones_fin,
        estado_pelaje,
        incidentes,
        recomendaciones,
        cerrada
      `)
      .in('slot_id', slotIds);

    if (fichasError) throw fichasError;

    const fichasPorSlotId = new Map((fichas || []).map((ficha) => [ficha.slot_id, ficha]));
    const fichaIds = (fichas || []).map((ficha) => ficha.id);

    let fotosPorFichaId = new Map();
    if (fichaIds.length) {
      const { data: fotos, error: fotosError } = await supabaseAdmin
        .from('foto_servicio')
        .select('id, ficha_id, url, tipo, descripcion, creado_en')
        .in('ficha_id', fichaIds)
        .order('creado_en', { ascending: true });

      if (fotosError) throw fotosError;

      fotosPorFichaId = (fotos || []).reduce((map, foto) => {
        if (!map.has(foto.ficha_id)) map.set(foto.ficha_id, []);
        map.get(foto.ficha_id).push(foto);
        return map;
      }, new Map());
    }

    const data = slots.map((slot) => {
      const ficha = fichasPorSlotId.get(slot.id) || null;
      const fotos = ficha ? (fotosPorFichaId.get(ficha.id) || []) : [];

      return {
        ...slot,
        ficha_grooming: ficha,
        fotos_servicio: fotos,
      };
    });

    return res.json({ data, total: data.length });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, historial };
