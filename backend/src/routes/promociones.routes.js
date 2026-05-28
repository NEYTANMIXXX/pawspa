// promociones.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');

// Listar promociones activas (opcional: buscar por codigo)
r.get('/', async (req, res, next) => {
  try {
    const { codigo, activos } = req.query;
    let q = supabaseAdmin.from('promocion').select('*').order('created_at', { ascending: false });
    if (codigo) q = q.eq('codigo', codigo);
    if (activos === 'true') q = q.eq('activo', true).or(`fecha_inicio.is.null,fecha_inicio.lte.${new Date().toISOString()}`).or(`fecha_fin.is.null,fecha_fin.gte.${new Date().toISOString()}`);
    const { data, error } = await q;
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

// Crear promocion (admin/recepcion)
r.post('/', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const payload = { ...req.body };
    // Evitar que el cliente envíe id nulo y sobrescriba el DEFAULT de la tabla
    delete payload.id;
    // Asegurar visibilidad en dashboard por defecto para promos creadas por admin/recepcion
    if (payload.visible_en_dashboard === undefined) payload.visible_en_dashboard = true;
    const { data, error } = await supabaseAdmin.from('promocion').insert(payload).select().single();
    if (error) throw error;
    res.status(201).json({ data });
  } catch (e) { next(e); }
});

// Editar promocion
r.put('/:id', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const safeBody = { ...req.body };
    delete safeBody.id;
    const { data, error } = await supabaseAdmin.from('promocion').update(safeBody).eq('id', req.params.id).select().single();
    if (error) throw error;
    res.json({ data });
  } catch (e) { next(e); }
});

// Aplicar codigo de promocion: recibe { codigo, cliente_id, items, total }
// items: [{ product_id, cantidad, precio_unitario }]
r.post('/apply', async (req, res, next) => {
  try {
    const { codigo, cliente_id, items = [], total = 0 } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Se requiere codigo' });

    const { data: promos, error: e1 } = await supabaseAdmin.from('promocion').select('*').eq('codigo', codigo).limit(1);
    if (e1) throw e1;
    const promo = promos && promos[0];
    if (!promo) return res.status(404).json({ error: 'Promoción no encontrada' });

    // Validaciones de fechas y activo
    const now = new Date();
    if (!promo.activo) return res.status(400).json({ error: 'Promoción no activa' });
    if (promo.fecha_inicio && new Date(promo.fecha_inicio) > now) return res.status(400).json({ error: 'Promoción aún no iniciada' });
    if (promo.fecha_fin && new Date(promo.fecha_fin) < now) return res.status(400).json({ error: 'Promoción expirada' });

    // Validar usos (uso_max global)
    if (promo.uso_max) {
      const { count, error: e2 } = await supabaseAdmin.from('promocion_redencion').select('id', { count: 'estimated' }).eq('promocion_id', promo.id);
      if (e2) throw e2;
      if (count >= promo.uso_max) return res.status(400).json({ error: 'Promoción agotada' });
    }

    // Validar uso_por_cliente
    if (promo.uso_por_cliente && cliente_id) {
      const { count: usedByCustomer, error: e3 } = await supabaseAdmin.from('promocion_redencion').select('id', { count: 'estimated' }).eq('promocion_id', promo.id).eq('cliente_id', cliente_id);
      if (e3) throw e3;
      if (usedByCustomer >= promo.uso_por_cliente) return res.status(400).json({ error: 'Cliente ya usó esta promoción el máximo permitido' });
    }

    // Calcular descuento
    let descuento = 0;
    if (promo.tipo === 'porcentaje') {
      descuento = parseFloat(total) * (parseFloat(promo.valor) / 100);
    } else if (promo.tipo === 'fijo') {
      descuento = Math.min(parseFloat(promo.valor), parseFloat(total));
    } else if (promo.tipo === 'precio_promocional') {
      // aplica_a debe ser 'producto' y aplica_item_id definido
      if (promo.aplica_a !== 'producto' || !promo.aplica_item_id) {
        return res.status(400).json({ error: 'Promoción de precio promocional mal configurada' });
      }
      // buscar item en items
      const item = items.find(i => String(i.product_id) === String(promo.aplica_item_id));
      if (!item) return res.status(400).json({ error: 'Promoción aplica a un producto no presente en el carrito' });
      const precio_regular = parseFloat(item.precio_unitario || 0);
      const cantidad = parseInt(item.cantidad || 1, 10);
      const precio_prom = parseFloat(promo.valor);
      if (precio_prom >= precio_regular) descuento = 0;
      else descuento = (precio_regular - precio_prom) * cantidad;
    }

    const total_descuento = parseFloat(descuento || 0);
    const total_con_descuento = Math.max(0, parseFloat(total) - total_descuento);

    res.json({ promocion: promo, descuento: total_descuento, total_con_descuento });
  } catch (e) { next(e); }
});

module.exports = r;
