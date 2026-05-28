// descuentos.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');

// Listar descuentos (solo porcentaje)
r.get('/', async (req, res, next) => {
  try {
    const { codigo, activos } = req.query;
    let q = supabaseAdmin.from('promocion').select('*').eq('tipo', 'porcentaje').order('created_at', { ascending: false });
    if (codigo) q = q.eq('codigo', codigo);
    if (activos === 'true') q = q.eq('activo', true).or(`fecha_inicio.is.null,fecha_inicio.lte.${new Date().toISOString()}`).or(`fecha_fin.is.null,fecha_fin.gte.${new Date().toISOString()}`);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

// Crear descuento (admin/recepcion) — fuerza tipo 'porcentaje'
r.post('/', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const payload = { ...req.body, tipo: 'porcentaje' };
    // Evitar id nulo enviado por el cliente
    delete payload.id;
    // Forzar visibilidad en dashboard por defecto
    if (payload.visible_en_dashboard === undefined) payload.visible_en_dashboard = true;
    const { data, error } = await supabaseAdmin.from('promocion').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

// Editar descuento (admin/recepcion) — evitar cambiar tipo
r.put('/:id', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const safeBody = { ...req.body };
    delete safeBody.tipo; // no permitir cambiar tipo
    delete safeBody.id; // no permitir cambiar id
    const { data, error } = await supabaseAdmin.from('promocion').update(safeBody).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

// Aplicar descuento (proxy a promocion/apply) — manteniendo validaciones
r.post('/apply', async (req, res, next) => {
  try {
    const { codigo, cliente_id, items = [], total = 0 } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Se requiere codigo' });

    const { data: promos, error: e1 } = await supabaseAdmin.from('promocion').select('*').eq('codigo', codigo).eq('tipo', 'porcentaje').limit(1);
    if (e1) throw e1;
    const promo = promos && promos[0];
    if (!promo) return res.status(404).json({ error: 'Descuento no encontrado o no es porcentaje' });

    // Reusar la lógica de cálculo simple para porcentaje
    const now = new Date();
    if (!promo.activo) return res.status(400).json({ error: 'Descuento no activo' });
    if (promo.fecha_inicio && new Date(promo.fecha_inicio) > now) return res.status(400).json({ error: 'Descuento aún no iniciada' });
    if (promo.fecha_fin && new Date(promo.fecha_fin) < now) return res.status(400).json({ error: 'Descuento expirada' });

    // Validar usos
    if (promo.uso_max) {
      const { count, error: e2 } = await supabaseAdmin.from('promocion_redencion').select('id', { count: 'estimated' }).eq('promocion_id', promo.id);
      if (e2) throw e2;
      if (count >= promo.uso_max) return res.status(400).json({ error: 'Descuento agotado' });
    }

    if (promo.uso_por_cliente && cliente_id) {
      const { count: usedByCustomer, error: e3 } = await supabaseAdmin.from('promocion_redencion').select('id', { count: 'estimated' }).eq('promocion_id', promo.id).eq('cliente_id', cliente_id);
      if (e3) throw e3;
      if (usedByCustomer >= promo.uso_por_cliente) return res.status(400).json({ error: 'Cliente ya usó este descuento el máximo permitido' });
    }

    const descuento = parseFloat(total) * (parseFloat(promo.valor) / 100);
    const total_descuento = parseFloat(descuento || 0);
    const total_con_descuento = Math.max(0, parseFloat(total) - total_descuento);

    res.json({ promocion: promo, descuento: total_descuento, total_con_descuento });
  } catch (e) { next(e); }
});

module.exports = r;
