// caja.routes.js — Movimientos de caja y cierres
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');

// Listar movimientos de caja con filtros (fecha_desde, fecha_hasta, metodo_pago)
r.get('/movimientos', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta, metodo_pago } = req.query;
    let q = supabaseAdmin.from('movimiento_caja').select('*').order('creado_en', { ascending: false });
    if (fecha_desde) q = q.gte('creado_en', fecha_desde);
    if (fecha_hasta) q = q.lte('creado_en', fecha_hasta);
    if (metodo_pago) q = q.eq('metodo_pago', metodo_pago);
    const { data, error } = await q;
    if (error) throw error;
    return res.json({ data, total: data.length });
  } catch (e) { next(e); }
});

// Crear borrador de cierre para una fecha (date en formato YYYY-MM-DD)
r.post('/cierres', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { date } = req.body;
    const usuarioId = req.usuario.id;
    if (!date) return res.status(400).json({ error: 'date (YYYY-MM-DD) es requerido.' });

    const start = new Date(`${date}T00:00:00.000Z`).toISOString();
    const end = new Date(`${date}T23:59:59.999Z`).toISOString();

    // obtener movimientos del día
    const { data: movimientos, error: movErr } = await supabaseAdmin.from('movimiento_caja').select('*').gte('creado_en', start).lte('creado_en', end);
    if (movErr) throw movErr;

    const totalsByMethod = {};
    let totalIngresos = 0;
    let totalEgresos = 0;

    (movimientos || []).forEach(m => {
      const metodo = m.metodo_pago || 'otros';
      totalsByMethod[metodo] = totalsByMethod[metodo] || { total: 0, count: 0 };
      if (m.tipo_movimiento === 'ingreso') {
        totalsByMethod[metodo].total += Number(m.monto || 0);
        totalIngresos += Number(m.monto || 0);
      } else {
        totalsByMethod[metodo].total -= Number(m.monto || 0);
        totalEgresos += Number(m.monto || 0);
      }
      totalsByMethod[metodo].count += 1;
    });

    // crear cierre_caja
    const { data: cierre, error: cierreErr } = await supabaseAdmin.from('cierre_caja').insert({
      usuario_id: usuarioId,
      fecha: date,
      apertura: 0,
      cierre_declarado: null,
      total_ingresos: totalIngresos,
      total_egresos: totalEgresos,
      diferencia: null,
      estado: 'abierto',
    }).select().single();
    if (cierreErr) throw cierreErr;

    // insertar items por método
    const items = Object.keys(totalsByMethod).map(met => ({
      cierre_id: cierre.id,
      metodo_pago: met,
      total: totalsByMethod[met].total,
      cantidad_transacciones: totalsByMethod[met].count
    }));

    if (items.length) {
      const { error: itemsErr } = await supabaseAdmin.from('cierre_item').insert(items);
      if (itemsErr) console.error('[caja] error insert cierre_item', itemsErr.message || itemsErr);
    }

    return res.status(201).json({ mensaje: 'Cierre creado', data: cierre });
  } catch (e) { next(e); }
});

// Obtener cierre por id
r.get('/cierres/:id', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin.from('cierre_caja').select('*, cierre_item(*)').eq('id', req.params.id).single();
    if (error) throw error;
    return res.json({ data });
  } catch (e) { next(e); }
});

// Cerrar un cierre: enviar cierre_declarado
r.patch('/cierres/:id/close', autenticar, autorizar('admin','recepcion'), async (req, res, next) => {
  try {
    const { cierre_declarado, notas } = req.body;
    if (cierre_declarado === undefined || cierre_declarado === null) return res.status(400).json({ error: 'cierre_declarado es requerido.' });

    const { data: cierre, error: cErr } = await supabaseAdmin.from('cierre_caja').select('*').eq('id', req.params.id).single();
    if (cErr || !cierre) return res.status(404).json({ error: 'Cierre no encontrado.' });

    const diferencia = Number(cierre_declarado) - Number(cierre.total_ingresos || 0);

    const { data, error } = await supabaseAdmin.from('cierre_caja').update({
      cierre_declarado: Number(cierre_declarado),
      diferencia,
      estado: 'cerrado',
      notas: notas || cierre.notas,
      cerrado_en: new Date().toISOString()
    }).eq('id', req.params.id).select().single();

    if (error) throw error;
    // Generar PDF del cierre y subir a Storage
    try {
      const { generatePdfAndUpload } = require('../services/pdf.service');
      const cierreObj = data;
      // obtener items para el cierre
      const { data: items } = await supabaseAdmin.from('cierre_item').select('*').eq('cierre_id', cierreObj.id);

      const html = `
        <html><head><meta charset="utf-8"><title>Cierre ${cierreObj.fecha}</title></head><body>
        <h1>Cierre de caja — ${cierreObj.fecha}</h1>
        <p>Usuario: ${req.usuario.id}</p>
        <p>Totales: ingresos ${cierreObj.total_ingresos} | egresos ${cierreObj.total_egresos}</p>
        <h3>Totales por método</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%">
          <thead><tr><th>Método</th><th>Cantidad</th><th>Total</th></tr></thead>
          <tbody>
            ${(items || []).map(it => `<tr><td>${it.metodo_pago}</td><td>${it.cantidad_transacciones}</td><td>${Number(it.total).toFixed(2)}</td></tr>`).join('')}
          </tbody>
        </table>
        <p>Declarado: ${cierreObj.cierre_declarado || ''} — Diferencia: ${cierreObj.diferencia || ''}</p>
        <p>Cerrado en: ${cierreObj.cerrado_en}</p>
        </body></html>
      `;

      const pdfPath = `cierres/${cierreObj.id}.pdf`;
      const publicUrl = await generatePdfAndUpload({ html, bucket: 'documentos', path: pdfPath });
      if (publicUrl) {
        const { error: upErr } = await supabaseAdmin.from('cierre_caja').update({ pdf_url: publicUrl }).eq('id', cierreObj.id);
        if (upErr) console.error('[caja] no se pudo actualizar pdf_url:', upErr.message || upErr);
        data.pdf_url = publicUrl;
      }
    } catch (pdfErr) {
      console.error('[caja] error generando PDF:', pdfErr.message || pdfErr);
    }

    return res.json({ mensaje: 'Cierre cerrado', data });
  } catch (e) { next(e); }
});

module.exports = r;
