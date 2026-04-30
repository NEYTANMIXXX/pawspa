// grooming.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');
r.use(autenticar);

// Abrir ficha de grooming
r.post('/ficha', autorizar('admin','recepcion','groomer'), async (req, res, next) => {
  try {
    const { slot_id, observaciones_ini } = req.body;
    const { data: slot } = await supabaseAdmin.from('slot_reserva').select('groomer_id,mascota_id').eq('id', slot_id).single();
    if (!slot) return res.status(404).json({ error: 'Slot no encontrado.' });
    const { data, error } = await supabaseAdmin.from('ficha_grooming')
      .insert({ slot_id, groomer_id: slot.groomer_id, mascota_id: slot.mascota_id, hora_inicio: new Date().toISOString(), observaciones_ini })
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

module.exports = r;
