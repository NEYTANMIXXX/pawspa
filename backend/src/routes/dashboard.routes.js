// dashboard.routes.js
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar } = require('../middleware/auth.middleware');
const { generatePdfBuffer } = require('../services/pdf.service');
r.use(autenticar);

const construirReporteDueno = async ({ cliente, promociones = [], completadas = 0, nivel = 'Cliente', beneficio = null }) => {
  const { data: serviciosCompletados } = await supabaseAdmin
    .from('slot_reserva')
    .select(`
      id,
      fecha_inicio,
      fecha_fin,
      estado,
      servicio_id,
      precio_acordado,
      observaciones,
      mascotas (id, nombre, especie, raza, foto_url),
      servicios (id, nombre, duracion_min),
      groomers (id, usuarios (nombre, apellido))
    `)
    .eq('cliente_id', cliente.id)
    .eq('estado', 'completada')
    .order('fecha_inicio', { ascending: false })
    .limit(8);

  const slotsCompletados = serviciosCompletados || [];
  const slotIds = slotsCompletados.map((slot) => slot.id);
  const fichasPorSlotId = new Map();
  const fotosPorFichaId = new Map();

  if (slotIds.length) {
    const { data: fichas } = await supabaseAdmin
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

    (fichas || []).forEach((ficha) => fichasPorSlotId.set(ficha.slot_id, ficha));

    const fichaIds = (fichas || []).map((ficha) => ficha.id);
    if (fichaIds.length) {
      const { data: fotos } = await supabaseAdmin
        .from('foto_servicio')
        .select('id, ficha_id, url, tipo, descripcion, creado_en')
        .in('ficha_id', fichaIds)
        .order('creado_en', { ascending: true });

      (fotos || []).forEach((foto) => {
        if (!fotosPorFichaId.has(foto.ficha_id)) fotosPorFichaId.set(foto.ficha_id, []);
        fotosPorFichaId.get(foto.ficha_id).push(foto);
      });
    }
  }

  const historialClinicoEstetico = slotsCompletados.map((slot) => {
    const ficha = fichasPorSlotId.get(slot.id) || null;
    const fotos = ficha ? (fotosPorFichaId.get(ficha.id) || []) : [];

    return {
      ...slot,
      ficha_grooming: ficha,
      fotos_servicio: fotos,
      fotos_antes: fotos.filter((foto) => foto.tipo === 'antes'),
      fotos_despues: fotos.filter((foto) => foto.tipo === 'despues'),
    };
  });

  const galeriaEvolucion = historialClinicoEstetico
    .filter((slot) => slot.fotos_antes.length || slot.fotos_despues.length)
    .map((slot) => ({
      id: slot.id,
      fecha_inicio: slot.fecha_inicio,
      mascota: slot.mascotas,
      servicio: slot.servicios,
      groomer: slot.groomers,
      antes: slot.fotos_antes[0] || null,
      despues: slot.fotos_despues[0] || null,
      fotos: slot.fotos_servicio,
    }));

  return {
    resumen: {
      servicios_completados: completadas,
      ultima_visita: historialClinicoEstetico[0]?.fecha_inicio || null,
      fotos_evolucion: galeriaEvolucion.length,
    },
    historial_clinico_estetico: historialClinicoEstetico,
    galeria_evolucion: galeriaEvolucion,
    estado_puntos_promociones: {
      puntos_fidelidad: cliente.puntos_fidelidad,
      nivel,
      completadas,
      beneficio,
      promociones_temporales: promociones,
      cupones: promociones.filter((p) => p.codigo),
    },
  };
};

const renderReporteDuenoHtml = ({ usuario, reporteDueno }) => {
  const historial = reporteDueno?.historial_clinico_estetico || [];
  const galeria = reporteDueno?.galeria_evolucion || [];
  const promociones = reporteDueno?.estado_puntos_promociones?.promociones_temporales || [];
  const cupones = reporteDueno?.estado_puntos_promociones?.cupones || [];

  const historialItems = historial.length
    ? historial.map((item) => `
      <div class="card">
        <div class="row space-between">
          <div>
            <h3>${item.servicios?.nombre || 'Servicio'}</h3>
            <p>${item.mascotas?.nombre || 'Mascota'} · ${new Date(item.fecha_inicio).toLocaleDateString('es-PE')}</p>
          </div>
          <div class="right">
            <p>${item.groomers?.usuarios ? `${item.groomers.usuarios.nombre} ${item.groomers.usuarios.apellido}`.trim() : 'Groomer'}</p>
            <strong>${item.precio_acordado ? `Bs. ${item.precio_acordado}` : '—'}</strong>
          </div>
        </div>
        ${item.ficha_grooming?.observaciones_fin ? `<p><strong>Resultado:</strong> ${item.ficha_grooming.observaciones_fin}</p>` : ''}
        ${item.ficha_grooming?.recomendaciones ? `<p><strong>Recomendaciones:</strong> ${item.ficha_grooming.recomendaciones}</p>` : ''}
      </div>
    `).join('')
    : '<div class="empty">No hay servicios completados para mostrar.</div>';

  const galeriaItems = galeria.length
    ? galeria.map((item) => `
      <div class="card">
        <h3>${item.mascota?.nombre || 'Mascota'}</h3>
        <p>${item.servicio?.nombre || 'Servicio'} · ${new Date(item.fecha_inicio).toLocaleDateString('es-PE')}</p>
        <div class="grid-2">
          <div>
            <div class="label">Antes</div>
            ${item.antes ? `<img src="${item.antes.url}" alt="Antes" />` : '<div class="placeholder">Sin foto</div>'}
          </div>
          <div>
            <div class="label">Después</div>
            ${item.despues ? `<img src="${item.despues.url}" alt="Después" />` : '<div class="placeholder">Sin foto</div>'}
          </div>
        </div>
      </div>
    `).join('')
    : '<div class="empty">No hay fotos antes/después registradas todavía.</div>';

  const promocionesItems = promociones.length
    ? promociones.map((p) => `<li>${p.nombre}${p.codigo ? ` - ${p.codigo}` : ''}</li>`).join('')
    : '<li>Sin promociones activas.</li>';

  const cuponesItems = cupones.length
    ? cupones.map((c) => `<li>${c.nombre} - ${c.codigo}</li>`).join('')
    : '<li>Sin cupones disponibles.</li>';

  return `
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte de mascota</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 28px; color: #1f2937; background: #f8fafc; }
          h1, h2, h3, p { margin: 0 0 8px 0; }
          .header { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #e5e7eb; }
          .muted { color: #6b7280; }
          .section { margin-top: 18px; }
          .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px; margin-bottom: 12px; page-break-inside: avoid; }
          .row { display: flex; gap: 12px; }
          .space-between { justify-content: space-between; align-items: flex-start; }
          .right { text-align: right; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
          .label { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #6b7280; margin-bottom: 4px; }
          img { width: 100%; height: 160px; object-fit: cover; border-radius: 10px; border: 1px solid #e5e7eb; }
          .placeholder, .empty { min-height: 160px; display: flex; align-items: center; justify-content: center; border: 1px dashed #d1d5db; border-radius: 10px; color: #6b7280; background: #f9fafb; }
          .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
          .summary .card { margin-bottom: 0; }
          ul { margin: 8px 0 0 18px; padding: 0; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Reporte para ${usuario?.nombre || 'tu mascota'}</h1>
          <p class="muted">Historial clínico y estético, galería de evolución y estado de beneficios.</p>
        </div>
        <div class="summary">
          <div class="card"><h3>Servicios completados</h3><p>${reporteDueno?.resumen?.servicios_completados || 0}</p></div>
          <div class="card"><h3>Puntos</h3><p>${reporteDueno?.estado_puntos_promociones?.puntos_fidelidad || 0}</p></div>
          <div class="card"><h3>Nivel</h3><p>${reporteDueno?.estado_puntos_promociones?.nivel || 'Cliente'}</p></div>
        </div>
        <div class="section">
          <h2>Historial clínico y estético</h2>
          ${historialItems}
        </div>
        <div class="section">
          <h2>Galería de evolución</h2>
          ${galeriaItems}
        </div>
        <div class="section">
          <h2>Estado de puntos o promociones</h2>
          <div class="card">
            <p><strong>Puntos de fidelidad:</strong> ${reporteDueno?.estado_puntos_promociones?.puntos_fidelidad || 0}</p>
            <p><strong>Nivel:</strong> ${reporteDueno?.estado_puntos_promociones?.nivel || 'Cliente'}</p>
            <p><strong>Beneficio:</strong> ${reporteDueno?.estado_puntos_promociones?.beneficio?.descripcion || 'Sigue acumulando servicios para desbloquear beneficios.'}</p>
            <p><strong>Última visita:</strong> ${reporteDueno?.resumen?.ultima_visita ? new Date(reporteDueno.resumen.ultima_visita).toLocaleString('es-PE') : '—'}</p>
          </div>
          <div class="card">
            <h3>Promociones activas</h3>
            <ul>${promocionesItems}</ul>
          </div>
          <div class="card">
            <h3>Cupones</h3>
            <ul>${cuponesItems}</ul>
          </div>
        </div>
      </body>
    </html>
  `;
};

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
      // adicional: calcular insumos técnicos en stock bajo
      const { data: insumosAll } = await supabaseAdmin.from('producto').select('id,nombre,stock_actual,stock_minimo,categoria(nombre)').eq('activo', true);
      const insumosStockBajo = (insumosAll || []).filter(p => (p.categoria && /insum/i.test(p.categoria.nombre)) && Number(p.stock_actual) <= Number(p.stock_minimo));

      // alto consumo: movimientos de inventario tipo 'salida' últimos 30 días
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: movimientos } = await supabaseAdmin.from('movimiento_inventario').select('id,producto_id,cantidad,tipo,referencia_id,creado_en').gte('creado_en', since).eq('tipo', 'salida');
      const consumoPorProducto = {};
      const consumoPorFicha = {};
      (movimientos || []).forEach(m => {
        const pid = m.producto_id;
        consumoPorProducto[pid] = (consumoPorProducto[pid] || 0) + Number(m.cantidad || 0);
        if (m.referencia_id) consumoPorFicha[m.referencia_id] = (consumoPorFicha[m.referencia_id] || 0) + Number(m.cantidad || 0);
      });
      // top productos por consumo
      const topProductos = Object.keys(consumoPorProducto)
        .map(id => ({ id, cantidad: consumoPorProducto[id] }))
        .sort((a,b)=>b.cantidad-a.cantidad)
        .slice(0,5);
      // map product details
      const prodIds = topProductos.map(p=>p.id).filter(Boolean);
      let topProductosDetalle = [];
      if (prodIds.length) {
        const { data: prods } = await supabaseAdmin.from('producto').select('id,nombre,stock_actual,stock_minimo').in('id', prodIds);
        topProductosDetalle = (prods || []).map(p => ({ ...p, consumo_30d: consumoPorProducto[p.id] || 0 }));
      }

      // consumo por groomer: map referencia_id (ficha) -> ficha.groomer_id
      const fichaIds = Object.keys(consumoPorFicha);
      let consumoPorGroomer = [];
      if (fichaIds.length) {
        const { data: fichas } = await supabaseAdmin.from('ficha_grooming').select('id,groomer_id').in('id', fichaIds);
        const byG = {};
        (fichas || []).forEach(f => {
          const q = consumoPorFicha[f.id] || 0;
          if (f.groomer_id) byG[f.groomer_id] = (byG[f.groomer_id] || 0) + q;
        });
        const groomerIds = Object.keys(byG);
        if (groomerIds.length) {
          const { data: gs } = await supabaseAdmin.from('groomers').select('id, usuarios (nombre, apellido)').in('id', groomerIds);
          consumoPorGroomer = (gs || []).map(g => ({ groomer_id: g.id, nombre: `${g.usuarios?.nombre || ''} ${g.usuarios?.apellido || ''}`.trim(), consumo_30d: byG[g.id] || 0 }))
            .sort((a,b)=>b.consumo_30d - a.consumo_30d)
            .slice(0,5);
        }
      }

      // recomendaciones de reabastecimiento: sugerir llevar a 4x stock_minimo
      const recomendaciones = (insumosAll || []).filter(p => Number(p.stock_minimo) > 0).map(p => {
        const objetivo = Number(p.stock_minimo) * 4;
        const sugerido = Math.max(0, Math.ceil(objetivo - Number(p.stock_actual || 0)));
        return { id: p.id, nombre: p.nombre, stock_actual: Number(p.stock_actual||0), stock_minimo: Number(p.stock_minimo||0), sugerido_cantidad: sugerido };
      }).filter(r => r.sugerido_cantidad > 0).slice(0,10);

      stats = {
        usuarios: usuarios.count,
        clientes: clientes.count,
        mascotas: mascotas.count,
        reservasHoy: reservasHoy.count,
        ingresosDelMes: totalIngresos.toFixed(2),
        productosStockBajo: stockBajo.data || [],
        insumosStockBajo,
        altoConsumo: { productos: topProductosDetalle, groomers: consumoPorGroomer },
        recomendacionesReabastecimiento: recomendaciones,
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
      // añadir alertas de inventario ligeras para recepción
      const { data: insumosAll } = await supabaseAdmin.from('producto').select('id,nombre,stock_actual,stock_minimo,categoria(nombre)').eq('activo', true);
      const insumosStockBajo = (insumosAll || []).filter(p => (p.categoria && /insum/i.test(p.categoria.nombre)) && Number(p.stock_actual) <= Number(p.stock_minimo));
      const recomendaciones = (insumosAll || []).filter(p => Number(p.stock_minimo) > 0).map(p => {
        const objetivo = Number(p.stock_minimo) * 3;
        const sugerido = Math.max(0, Math.ceil(objetivo - Number(p.stock_actual || 0)));
        return { id: p.id, nombre: p.nombre, stock_actual: Number(p.stock_actual||0), stock_minimo: Number(p.stock_minimo||0), sugerido_cantidad: sugerido };
      }).filter(r => r.sugerido_cantidad > 0).slice(0,8);

      stats = { reservasHoy: reservasHoy.data, totalPendientes: pendientes.count, totalMascotas: mascotas.count, insumosStockBajo, recomendacionesReabastecimiento: recomendaciones };

    } else if (rol === 'groomer') {

      // para groomers y recepcion queremos exponer alertas simples de inventario también
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
        // Promociones activas y cupones disponibles
        const now = new Date();
        // Obtener promociones activas y filtrar por rango de fechas en la capa de aplicación
        const { data: promosAll } = await supabaseAdmin.from('promocion').select('id,nombre,codigo,tipo,valor,fecha_inicio,fecha_fin,descripcion,visible_en_dashboard').eq('activo', true).eq('visible_en_dashboard', true);
        const promos = (promosAll || []).filter(p => {
          if (p.fecha_inicio && new Date(p.fecha_inicio) > now) return false;
          if (p.fecha_fin && new Date(p.fecha_fin) < now) return false;
          return true;
        });

        // Cliente frecuente: contar servicios completados
        const { count: completadas } = await supabaseAdmin.from('slot_reserva').select('id', { count: 'exact' }).eq('cliente_id', cliente.id).eq('estado', 'completada');
        let nivel = 'Cliente';
        let beneficio = null;
        if (completadas >= 20) { nivel = 'Platinum'; beneficio = { descripcion: '15% descuento en servicios', codigo: null }; }
        else if (completadas >= 10) { nivel = 'Gold'; beneficio = { descripcion: '10% descuento en servicios', codigo: null }; }
        else if (completadas >= 5) { nivel = 'Silver'; beneficio = { descripcion: '5% descuento en servicios', codigo: null }; }
        const reporteDueno = await construirReporteDueno({
          cliente,
          promociones: promos || [],
          completadas,
          nivel,
          beneficio,
        });

        stats = {
          mascotas: mascotas.data,
          reservasRecientes: reservas.data,
          puntosFidelidad: cliente.puntos_fidelidad,
          promocionesTemporales: promos || [],
          clienteFrecuente: { nivel, completadas, beneficio },
          cupones: (promos || []).filter((p) => p.codigo),
          reporteDueno,
        };
      }
    }

    return res.json({ rol, stats });
  } catch (err) { next(err); }
});

r.get('/report-dueno/pdf', async (req, res, next) => {
  try {
    const { rol, id: usuarioId, nombre } = req.usuario;
    if (rol !== 'cliente') return res.status(403).json({ error: 'Acceso denegado.' });

    const { data: cliente } = await supabaseAdmin.from('clientes').select('id,puntos_fidelidad').eq('usuario_id', usuarioId).single();
    if (!cliente) return res.status(404).json({ error: 'Perfil de cliente no encontrado.' });

    const now = new Date();
    const { data: promosAll } = await supabaseAdmin.from('promocion').select('id,nombre,codigo,tipo,valor,fecha_inicio,fecha_fin,descripcion,visible_en_dashboard').eq('activo', true).eq('visible_en_dashboard', true);
    const promos = (promosAll || []).filter((p) => {
      if (p.fecha_inicio && new Date(p.fecha_inicio) > now) return false;
      if (p.fecha_fin && new Date(p.fecha_fin) < now) return false;
      return true;
    });

    const { count: completadas } = await supabaseAdmin.from('slot_reserva').select('id', { count: 'exact' }).eq('cliente_id', cliente.id).eq('estado', 'completada');
    let nivel = 'Cliente';
    let beneficio = null;
    if (completadas >= 20) { nivel = 'Platinum'; beneficio = { descripcion: '15% descuento en servicios', codigo: null }; }
    else if (completadas >= 10) { nivel = 'Gold'; beneficio = { descripcion: '10% descuento en servicios', codigo: null }; }
    else if (completadas >= 5) { nivel = 'Silver'; beneficio = { descripcion: '5% descuento en servicios', codigo: null }; }

    const reporteDueno = await construirReporteDueno({
      cliente,
      promociones: promos || [],
      completadas,
      nivel,
      beneficio,
    });

    const html = renderReporteDuenoHtml({ usuario: { nombre }, reporteDueno });
    const pdfBuffer = await generatePdfBuffer({ html });
    if (!pdfBuffer) {
      return res.status(503).json({ error: 'No se pudo generar el PDF en este entorno.' });
    }

    const archivo = `reporte-mascota-${cliente.id}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// Reportes administrativos
r.get('/reports', async (req, res, next) => {
  try {
    const { rol } = req.usuario;
    if (rol !== 'admin') return res.status(403).json({ error: 'Acceso denegado.' });

    // 1) Ventas totales y facturación (últimos 30 días)
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [pagos, pagosServicios, pedidosDetalles] = await Promise.all([
      supabaseAdmin.from('pago_factura').select('id,total,tipo_pago,estado,fecha_pago,slot_id,pedido_id').in('estado', ['pagado','verificado']).gte('fecha_pago', since),
      supabaseAdmin.from('pago_factura').select('id,total,slot_id').in('estado', ['pagado','verificado']).gte('fecha_pago', since).not('slot_id', 'is', null),
      supabaseAdmin.from('pedido_detalle').select('producto_id,variante_id,cantidad,precio_unitario').gte('creado_en', since),
    ]);

    const totalIngresos = (pagos.data || []).reduce((s, p) => s + Number(p.total || 0), 0);
    const ingresosServicios = (pagosServicios.data || []).reduce((s, p) => s + Number(p.total || 0), 0);
    const ingresosTienda = totalIngresos - ingresosServicios;

    // 2) Ranking de rentabilidad (a falta de costo, usar ingresos y volumen)
    // Productos: sumar cantidad * precio_unitario
    const productosMap = {};
    (pedidosDetalles.data || []).forEach(d => {
      const id = d.producto_id;
      productosMap[id] = productosMap[id] || { producto_id: id, cantidad: 0, ingresos: 0 };
      productosMap[id].cantidad += Number(d.cantidad || 0);
      productosMap[id].ingresos += Number(d.cantidad || 0) * Number(d.precio_unitario || 0);
    });
    let rankingProductos = Object.values(productosMap).sort((a,b)=>b.ingresos - a.ingresos).slice(0,10);
    // map product names
    const prodIdsForRank = rankingProductos.map(p => p.producto_id).filter(Boolean);
    if (prodIdsForRank.length) {
      const { data: prodRows } = await supabaseAdmin.from('producto').select('id,nombre').in('id', prodIdsForRank);
      const prodMap = {};
      (prodRows || []).forEach(pr => { prodMap[pr.id] = pr; });
      rankingProductos = rankingProductos.map(p => ({
        ...p,
        nombre: prodMap[p.producto_id]?.nombre || null,
      }));

      // calcular variante más vendida por producto (usar los pedidosDetalles que ahora incluyen variante_id)
      const variantesPorProducto = {};
      (pedidosDetalles.data || []).forEach(d => {
        if (!d.variante_id) return;
        const pid = d.producto_id;
        variantesPorProducto[pid] = variantesPorProducto[pid] || {};
        variantesPorProducto[pid][d.variante_id] = (variantesPorProducto[pid][d.variante_id] || 0) + Number(d.cantidad || 0);
      });

      const varianteIdsToFetch = [];
      const topVariantePorProducto = {};
      Object.keys(variantesPorProducto).forEach(pid => {
        const varMap = variantesPorProducto[pid];
        let topId = null; let topQty = 0;
        Object.keys(varMap).forEach(vid => {
          if (varMap[vid] > topQty) { topQty = varMap[vid]; topId = vid; }
        });
        if (topId) { topVariantePorProducto[pid] = { variante_id: topId, cantidad: topQty }; varianteIdsToFetch.push(topId); }
      });

      if (varianteIdsToFetch.length) {
        const { data: varRows } = await supabaseAdmin.from('variante_producto').select('id,sku').in('id', varianteIdsToFetch);
        const varMap = {};
        (varRows || []).forEach(v => { varMap[v.id] = v; });
        rankingProductos = rankingProductos.map(p => ({
          ...p,
          top_variante: topVariantePorProducto[p.producto_id] ? {
            variante_id: topVariantePorProducto[p.producto_id].variante_id,
            cantidad: topVariantePorProducto[p.producto_id].cantidad,
            sku: varMap[topVariantePorProducto[p.producto_id].variante_id]?.sku || null,
          } : null
        }));
      }
    }

    // Servicios: agrupar por servicio desde slot_reserva
    const { data: serviciosVentas } = await supabaseAdmin.from('slot_reserva').select('servicio_id,precio_acordado').gte('fecha_inicio', since).in('estado', ['confirmada','completada','en_progreso']);
    const serviciosMap = {};
    (serviciosVentas || []).forEach(sv => {
      const id = sv.servicio_id;
      serviciosMap[id] = serviciosMap[id] || { servicio_id: id, cantidad: 0, ingresos: 0 };
      serviciosMap[id].cantidad += 1;
      serviciosMap[id].ingresos += Number(sv.precio_acordado || 0);
    });
    let rankingServicios = Object.values(serviciosMap).sort((a,b)=>b.ingresos - a.ingresos).slice(0,10);
    // map servicio names
    const servIdsForRank = rankingServicios.map(s => s.servicio_id).filter(Boolean);
    if (servIdsForRank.length) {
      const { data: servRows } = await supabaseAdmin.from('servicios').select('id,nombre').in('id', servIdsForRank);
      const servMap = {};
      (servRows || []).forEach(sr => { servMap[sr.id] = sr; });
      rankingServicios = rankingServicios.map(s => ({
        ...s,
        nombre: servMap[s.servicio_id]?.nombre || null,
      }));
    }

    // 3) Ocupación global: minutos reservados / (groomers * 8h * días)
    const { data: groomers } = await supabaseAdmin.from('groomers').select('id').eq('activo', true);
    const groomerCount = (groomers || []).length || 1;
    const days = 30;
    const windowStart = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
    const { data: reservasWindow } = await supabaseAdmin.from('slot_reserva').select('fecha_inicio,fecha_fin,estado').gte('fecha_inicio', windowStart).lte('fecha_fin', new Date().toISOString()).not('estado','in','("cancelada","no_show")');
    let minutosReservados = 0;
    (reservasWindow || []).forEach(r => {
      const inicio = new Date(r.fecha_inicio);
      const fin = new Date(r.fecha_fin);
      minutosReservados += Math.max(0, (fin - inicio) / 60000);
    });
    const capacidadMinutos = groomerCount * 8 * 60 * days;
    const ocupacionGlobal = capacidadMinutos > 0 ? ((minutosReservados / capacidadMinutos) * 100).toFixed(2) : '0.00';

    // 4) Auditoría de insumos: entradas vs salidas vs ajustes en últimos 30 días
    const { data: movimientos } = await supabaseAdmin.from('movimiento_inventario').select('producto_id,cantidad,tipo,creado_en').gte('creado_en', since);
    const insumos = {};
    (movimientos || []).forEach(m => {
      const id = m.producto_id;
      insumos[id] = insumos[id] || { producto_id: id, entregado: 0, usado: 0, descontado: 0 };
      const q = Number(m.cantidad || 0);
      if (m.tipo === 'entrada') insumos[id].entregado += q;
      else if (m.tipo === 'salida') insumos[id].usado += q;
      else if (m.tipo === 'ajuste' || m.tipo === 'descuento') insumos[id].descontado += q;
    });
    const auditoriaInsumos = Object.values(insumos).slice(0,50);
    // mapear nombres de producto para que el frontend muestre nombres en lugar de solo UUIDs
    const prodIdsAud = auditoriaInsumos.map(i => i.producto_id).filter(Boolean);
    if (prodIdsAud.length) {
      const { data: prodRowsAud } = await supabaseAdmin.from('producto').select('id,nombre').in('id', prodIdsAud);
      const prodMapAud = {};
      (prodRowsAud || []).forEach(p => { prodMapAud[p.id] = p.nombre; });
      auditoriaInsumos.forEach(i => { i.nombre = prodMapAud[i.producto_id] || null; });
    }

    // 5) Satisfacción / NPS: buscar tabla de encuestas (si existe)
    let nps = null;
    try {
      const { data: encuestas } = await supabaseAdmin.from('encuesta_post_servicio').select('puntaje');
      if (encuestas && encuestas.length) {
        const total = encuestas.length;
        const promoters = encuestas.filter(e => Number(e.puntaje) >= 9).length;
        const detractors = encuestas.filter(e => Number(e.puntaje) <= 6).length;
        nps = Math.round(((promoters - detractors) / total) * 100);
      }
    } catch (_) { nps = null; }

    return res.json({
      ventas_totales: { totalIngresos, ingresosServicios, ingresosTienda },
      ranking: { productos: rankingProductos, servicios: rankingServicios },
      ocupacion_global: { minutosReservados, capacidadMinutos, porcentaje: ocupacionGlobal },
      auditoria_insumos: auditoriaInsumos,
      nps,
    });
  } catch (err) { next(err); }
});

module.exports = r;
// ============================================================
// Reportes administrativos (solo admin)
// ============================================================
