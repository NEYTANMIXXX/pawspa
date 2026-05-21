// dashboard.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar } = require('../middleware/auth.middleware');
r.use(autenticar);

r.get('/stats', async (req, res, next) => {
  try {
    const { rol, id: usuarioId } = req.usuario;
    let stats = {};

    if (rol === 'admin') {
      const [usuarios, clientes, mascotas, reservasHoy, ingresosMes, stockBajo] = await Promise.all([
        supabaseAdmin.from('usuarios').select('id', { count: 'exact' }).eq('activo', true),
        supabaseAdmin.from('clientes').select('id', { count: 'exact' }),
        supabaseAdmin.from('mascotas').select('id', { count: 'exact' }).eq('activo', true),
        supabaseAdmin.from('slot_reserva').select('id', { count: 'exact' })
          .gte('fecha_inicio', new Date().toISOString().split('T')[0])
          .lt('fecha_inicio', new Date(Date.now() + 86400000).toISOString().split('T')[0])
          .not('estado', 'in', '("cancelada","no_show")'),
        supabaseAdmin.from('pago_factura').select('total').in('estado', ['pagado', 'verificado'])
          .gte('creado_en', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
        supabaseAdmin.from('producto').select('id,nombre,stock_actual,stock_minimo').filter('stock_actual', 'lte', 'stock_minimo').eq('activo', true),
      ]);
      const totalIngresos = (ingresosMes.data || []).reduce((sum, p) => sum + parseFloat(p.total), 0);
      stats = {
        usuarios: usuarios.count,
        clientes: clientes.count,
        mascotas: mascotas.count,
        reservasHoy: reservasHoy.count,
        ingresosDelMes: totalIngresos.toFixed(2),
        productosStockBajo: stockBajo.data || [],
      };

    } else if (rol === 'recepcion') {
      const hoy = new Date().toISOString().split('T')[0];
      const [reservasHoy, pendientes, mascotas] = await Promise.all([
        supabaseAdmin.from('slot_reserva').select('*, mascotas(nombre), clientes(usuarios(nombre,apellido)), servicios(nombre)')
          .gte('fecha_inicio', hoy).lt('fecha_inicio', new Date(Date.now() + 86400000).toISOString().split('T')[0])
          .not('estado', 'in', '("cancelada","no_show")').order('fecha_inicio'),
        supabaseAdmin.from('slot_reserva').select('id', { count: 'exact' }).eq('estado', 'pendiente'),
        supabaseAdmin.from('mascotas').select('id', { count: 'exact' }).eq('activo', true),
      ]);
      stats = { reservasHoy: reservasHoy.data, totalPendientes: pendientes.count, totalMascotas: mascotas.count };

    } else if (rol === 'groomer') {
      const { data: groomer } = await supabaseAdmin.from('groomers').select('id').eq('usuario_id', usuarioId).single();
      if (groomer) {
        const hoy = new Date().toISOString().split('T')[0];
        const [agenda, fichasAbiertas] = await Promise.all([
          supabaseAdmin.from('slot_reserva')
            .select('*, mascotas(nombre,raza,foto_url), servicios(nombre,duracion_min)')
            .eq('groomer_id', groomer.id)
            .gte('fecha_inicio', hoy)
            .not('estado', 'in', '("cancelada","no_show")')
            .order('fecha_inicio'),
          supabaseAdmin.from('ficha_grooming')
            .select('*, mascotas(nombre), slot_reserva(fecha_inicio)')
            .eq('groomer_id', groomer.id)
            .eq('cerrada', false),
        ]);
        stats = { agendaHoy: agenda.data, fichasAbiertas: fichasAbiertas.data };
      }

    } else if (rol === 'cliente') {
      const { data: cliente } = await supabaseAdmin.from('clientes').select('id,puntos_fidelidad').eq('usuario_id', usuarioId).single();
      if (cliente) {
        const [mascotas, reservas] = await Promise.all([
          supabaseAdmin.from('mascotas').select('*').eq('cliente_id', cliente.id).eq('activo', true),
          supabaseAdmin.from('slot_reserva')
            .select('*, mascotas(nombre), servicios(nombre), groomers(usuarios(nombre,apellido))')
            .eq('cliente_id', cliente.id)
            .order('fecha_inicio', { ascending: false })
            .limit(5),
        ]);
        stats = { mascotas: mascotas.data, reservasRecientes: reservas.data, puntosFidelidad: cliente.puntos_fidelidad };
      }
    }

    return res.json({ rol, stats });
  } catch (err) { next(err); }
});

module.exports = r;
