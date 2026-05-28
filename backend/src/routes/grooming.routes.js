// grooming.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const emailService = require('../services/email.service');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
r.use(autenticar);

// Abrir ficha de grooming
r.post('/ficha', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const { slot_id, observaciones_ini, estado_pelaje, incidentes } = req.body;
    const { rol, id: usuarioId } = req.usuario;
    const { data: slot } = await supabaseAdmin.from('slot_reserva').select('groomer_id,mascota_id').eq('id', slot_id).single();
    if (!slot) return res.status(404).json({ error: 'Slot no encontrado.' });
    // Si el usuario es un groomer, validar que el slot le pertenezca
    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g || g.id !== slot.groomer_id) return res.status(403).json({ error: 'No tienes permiso para abrir esta ficha.' });
    }
    const insertPayload = {
      slot_id,
      groomer_id: slot.groomer_id,
      mascota_id: slot.mascota_id,
      hora_inicio: new Date().toISOString(),
      observaciones_ini: observaciones_ini || null,
      estado_pelaje: estado_pelaje || null,
      incidentes: incidentes || null
    };

    const { data, error } = await supabaseAdmin.from('ficha_grooming')
      .insert(insertPayload)
      .select().single();
    if (error) throw error;
    // Actualizar estado del slot
    await supabaseAdmin.from('slot_reserva').update({ estado: 'en_progreso' }).eq('id', slot_id);
    res.status(201).json({ mensaje: 'Ficha abierta.', data });
  } catch (e) { next(e); }
});

// Ver ficha
r.get('/ficha/:id', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('ficha_grooming')
      .select('*, checklist_item(*), foto_servicio(*), mascotas(*), groomers(*, usuarios(*))')
      .eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ error: 'Ficha no encontrada.' });
    res.json({ data });
  } catch (e) { next(e); }
});

// Listado de fichas con fotos y checklist para el panel operativo
r.get('/fichas', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;

    let query = supabaseAdmin
      .from('ficha_grooming')
      .select('*, checklist_item(*), foto_servicio(*), mascotas(*), groomers(*, usuarios(*)), slot_reserva(*, servicios(*), clientes(*, usuarios(*)))')
      .order('hora_inicio', { ascending: false });

    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g) return res.json({ data: [], total: 0 });
      query = query.eq('groomer_id', g.id);
    }

    const { data, error } = await query;
    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

// Agenda — devolver slots entre un rango (día/semana)
r.get('/agenda', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const { desde, hasta, groomer_id } = req.query;
    const { rol, id: usuarioId } = req.usuario;

    let gId = groomer_id || null;
    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g) return res.status(404).json({ error: 'Groomer no encontrado para el usuario.' });
      gId = g.id;
    }

    const q = supabaseAdmin.from('slot_reserva')
      .select('id, fecha_inicio, fecha_fin, estado, mascotas(id,nombre,raza,foto_url,tamano), servicios(id,nombre,duracion_min), clientes(id, usuarios(nombre,apellido)), groomers(id, usuarios(nombre,apellido))')
      .order('fecha_inicio', { ascending: true });

    if (gId) q.eq('groomer_id', gId);
    if (desde) q.gte('fecha_inicio', desde);
    if (hasta) q.lte('fecha_inicio', hasta);
    q.not('estado', 'in', '("cancelada","completada","no_show")');

    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

// Checklist templates (simple hardcoded templates for now)
const CHECKLIST_TEMPLATES = [
  { id: 'baño_basico', nombre: 'Baño básico', items: [
    'Revisión general',
    'Cepillado previo',
    'Colocación de guantes',
    'Aplicación de shampoo',
    'Aplicación antipulgas',
    'Baño',
    'Secado',
    'Corte de uñas',
    'Perfume y revisión final'
  ]},
  { id: 'corte_estandar', nombre: 'Corte estándar', items: [
    'Revisión pelaje',
    'Cepillado',
    'Colocación de guantes',
    'Aplicación antipulgas',
    'Corte general',
    'Ajustes de detalles',
    'Revisión de orejas',
    'Perfume final',
    'Entrega al cliente'
  ]},
];

r.get('/checklist-templates', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try { res.json({ data: CHECKLIST_TEMPLATES }); } catch (e) { next(e); }
});

// Asegurar que exista el bucket público de fotos
r.post('/storage/fotos/ensure', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const bucketName = 'fotos';
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;

    const exists = (buckets || []).some(b => b.name === bucketName);
    if (!exists) {
      const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, { public: true });
      if (createError) throw createError;
      return res.status(201).json({ mensaje: 'Bucket creado.', bucket: bucketName });
    }

    return res.json({ mensaje: 'Bucket ya existe.', bucket: bucketName });
  } catch (e) { next(e); }
});

// Cerrar ficha (valida checklist via trigger de DB)
r.patch('/ficha/:id/cerrar', autorizar('admin','groomer'), async (req, res, next) => {
  try {
    const { observaciones_fin, recomendaciones } = req.body;
    const { data, error } = await supabaseAdmin.from('ficha_grooming')
      .update({ cerrada: true, hora_fin: new Date().toISOString(), observaciones_fin, recomendaciones })
      .eq('id', req.params.id).select().single();
    if (error) return res.status(400).json({ error: error.message });
    // Actualizar slot a completada
      await supabaseAdmin.from('slot_reserva').update({ estado: 'completada' }).eq('id', data.slot_id);

      // Enviar notificación al cliente (no bloqueante)
      try {
        const { data: slotInfo } = await supabaseAdmin.from('slot_reserva')
          .select('id, fecha_inicio, fecha_fin, clientes(id, usuarios(nombre,apellido,email)), mascotas(id,nombre)')
          .eq('id', data.slot_id).single();

        const cliente = slotInfo && slotInfo.clientes && slotInfo.clientes.usuarios ? slotInfo.clientes.usuarios : null;
        const mascota = slotInfo && slotInfo.mascotas ? slotInfo.mascotas : null;

        if (cliente && cliente.email) {
          const nombreCliente = `${cliente.nombre || ''} ${cliente.apellido || ''}`.trim();
          const fecha = slotInfo.fecha_inicio ? new Date(slotInfo.fecha_inicio).toLocaleString() : '';
          const html = `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
              <h2>Hola ${nombreCliente || ''}</h2>
              <p>Te informamos que la ficha de servicio para <strong>${mascota ? mascota.nombre : ''}</strong> programada para <strong>${fecha}</strong> ha sido cerrada por el equipo de PawSpa.</p>
              ${observaciones_fin ? `<p><strong>Observaciones:</strong> ${observaciones_fin}</p>` : ''}
              ${recomendaciones ? `<p><strong>Recomendaciones:</strong> ${recomendaciones}</p>` : ''}
              <p>Si tienes preguntas, responde este correo o revisa los detalles en tu cuenta.</p>
            </div>
          `;

          const result = await emailService.enviarNotificacionReserva({ to: cliente.email, asunto: 'Ficha de servicio cerrada - PawSpa', html });
          console.log('[grooming] notificación de cierre enviada:', result);
        }
      } catch (e) {
        console.warn('[grooming] fallo al enviar notificación de cierre:', e.message || e);
      }

      res.json({ mensaje: 'Ficha cerrada exitosamente.', data });
  } catch (e) { next(e); }
});

// Checklist
r.post('/ficha/:id/checklist', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const items = req.body.items.map((item, i) => ({ ficha_id: req.params.id, descripcion: item.descripcion, orden: i + 1 }));
    const { data, error } = await supabaseAdmin.from('checklist_item').insert(items).select();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

r.patch('/checklist/:itemId', autorizar('admin','groomer'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('checklist_item')
      .update({ completado: req.body.completado }).eq('id', req.params.itemId).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

const mapearTipoInsumo = (tipoUI) => {
  if (tipoUI === 'recibido') return { tipoMovimiento: 'entrada', delta: 1 };
  if (tipoUI === 'usado') return { tipoMovimiento: 'salida', delta: -1 };
  if (tipoUI === 'devuelto') return { tipoMovimiento: 'devolucion', delta: 1 };
  if (tipoUI === 'desperdiciado') return { tipoMovimiento: 'ajuste', delta: -1 };
  return null;
};

// Listar movimientos de insumos de una ficha
r.get('/ficha/:id/insumos', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const fichaId = req.params.id;
    const { rol, id: usuarioId } = req.usuario;

    const { data: ficha } = await supabaseAdmin.from('ficha_grooming').select('id, groomer_id').eq('id', fichaId).single();
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada.' });

    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g || g.id !== ficha.groomer_id) return res.status(403).json({ error: 'No tienes permiso para ver estos insumos.' });
    }

    const { data, error } = await supabaseAdmin
      .from('movimiento_inventario')
      .select('*, producto:producto_id(id, nombre, stock_actual, stock_minimo, unidad_medida)')
      .eq('referencia_id', fichaId)
      .order('creado_en', { ascending: false });

    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

// Registrar movimiento de insumo asociado a una ficha
r.post('/ficha/:id/insumos', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const fichaId = req.params.id;
    const { producto_id, cantidad, tipo, motivo } = req.body;
    const { rol, id: usuarioId } = req.usuario;

    if (!producto_id || !cantidad || !tipo) {
      return res.status(400).json({ error: 'producto_id, cantidad y tipo son obligatorios.' });
    }

    const cantidadNum = Number(cantidad);
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) {
      return res.status(400).json({ error: 'cantidad debe ser mayor a 0.' });
    }

    const tipoMap = mapearTipoInsumo(tipo);
    if (!tipoMap) {
      return res.status(400).json({ error: 'Tipo de insumo inválido.' });
    }

    const { data: ficha } = await supabaseAdmin.from('ficha_grooming').select('id, groomer_id').eq('id', fichaId).single();
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada.' });

    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g || g.id !== ficha.groomer_id) return res.status(403).json({ error: 'No tienes permiso para registrar insumos en esta ficha.' });
    }

    const { data: producto, error: productoError } = await supabaseAdmin
      .from('producto')
      .select('id, nombre, stock_actual, stock_minimo, unidad_medida')
      .eq('id', producto_id)
      .single();

    if (productoError || !producto) {
      return res.status(404).json({ error: 'Producto no encontrado.' });
    }

    const stockAnterior = Number(producto.stock_actual || 0);
    const ajuste = cantidadNum * tipoMap.delta;
    const stockNuevo = stockAnterior + ajuste;

    if (stockNuevo < 0) {
      return res.status(409).json({ error: 'No hay stock suficiente para registrar este movimiento.' });
    }

    const { error: updateError } = await supabaseAdmin
      .from('producto')
      .update({ stock_actual: stockNuevo })
      .eq('id', producto_id);

    if (updateError) throw updateError;

    const movimientoPayload = {
      producto_id,
      tipo: tipoMap.tipoMovimiento,
      cantidad: cantidadNum,
      stock_anterior: stockAnterior,
      stock_nuevo: stockNuevo,
      referencia_id: fichaId,
      motivo: motivo || null,
      creado_por: usuarioId,
    };

    const { data, error } = await supabaseAdmin
      .from('movimiento_inventario')
      .insert(movimientoPayload)
      .select('*, producto:producto_id(id, nombre, stock_actual, stock_minimo, unidad_medida)')
      .single();

    if (error) {
      await supabaseAdmin.from('producto').update({ stock_actual: stockAnterior }).eq('id', producto_id);
      throw error;
    }

    return res.status(201).json({ data });
  } catch (e) { next(e); }
});

// Agregar foto a una ficha (se espera URL pública ya subida)
r.post('/ficha/:id/fotos', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const { url, tipo, descripcion, file_base64, file_name, mime_type } = req.body;
    const fichaId = req.params.id;
    const { rol, id: usuarioId } = req.usuario;

    // Validar existencia de ficha y ownership si groomer
    const { data: ficha } = await supabaseAdmin.from('ficha_grooming').select('id, groomer_id, slot_id').eq('id', fichaId).single();
    if (!ficha) return res.status(404).json({ error: 'Ficha no encontrada.' });
    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g || g.id !== ficha.groomer_id) return res.status(403).json({ error: 'No tienes permiso para agregar fotos a esta ficha.' });
    }

    let photoUrl = url || null;

    if (!photoUrl && file_base64 && file_name) {
      const bucketName = 'fotos';
      const dataMatch = String(file_base64).match(/^data:(.+);base64,(.+)$/);
      const base64Data = dataMatch ? dataMatch[2] : file_base64;
      const contentType = mime_type || (dataMatch ? dataMatch[1] : 'image/jpeg');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      const safeName = String(file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `ficha_${fichaId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabaseAdmin.storage.from(bucketName).upload(path, fileBuffer, {
        contentType,
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabaseAdmin.storage.from(bucketName).getPublicUrl(path);
      photoUrl = publicData.publicUrl;
    }

    if (!photoUrl) {
      return res.status(400).json({ error: 'Debes enviar una URL o un archivo de imagen.' });
    }

    const payload = { ficha_id: fichaId, url: photoUrl, tipo: tipo || 'durante', descripcion: descripcion || null };
    const { data, error } = await supabaseAdmin.from('foto_servicio').insert(payload).select().single();
    if (error) throw error;
    return res.status(201).json({ data });
  } catch (e) { next(e); }
});

// Eliminar foto
r.delete('/fotos/:id', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const fotoId = req.params.id;
    const { rol, id: usuarioId } = req.usuario;
    const { data: foto, error: fErr } = await supabaseAdmin.from('foto_servicio').select('*').eq('id', fotoId).single();
    if (fErr || !foto) return res.status(404).json({ error: 'Foto no encontrada.' });

    // Validar ownership a través de ficha -> groomer
    const { data: ficha } = await supabaseAdmin.from('ficha_grooming').select('id,groomer_id').eq('id', foto.ficha_id).single();
    if (!ficha) return res.status(404).json({ error: 'Ficha asociada no encontrada.' });
    if (rol === 'groomer') {
      const { data: g } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (!g || g.id !== ficha.groomer_id) return res.status(403).json({ error: 'No tienes permiso para eliminar esta foto.' });
    }

    // Intentar borrar archivo del storage si la URL apunta a /storage/v1/object/public/{bucket}/{path}
    try {
      const m = foto.url.match(/\/storage\/v1\/object\/public\/(.+?)\/(.+)$/);
      if (m) {
        const bucket = m[1];
        const path = decodeURIComponent(m[2]);
        await supabaseAdmin.storage.from(bucket).remove([path]);
      }
    } catch (e) {
      // No crítico si falla borrar en storage
      console.warn('[grooming] fallo al borrar archivo en storage', e.message || e);
    }

    const { error } = await supabaseAdmin.from('foto_servicio').delete().eq('id', fotoId);
    if (error) throw error;
    return res.json({ mensaje: 'Foto eliminada.' });
  } catch (e) { next(e); }
});

module.exports = r;
