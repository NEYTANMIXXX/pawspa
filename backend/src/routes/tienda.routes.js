// ============================================================
// PawSpa — Configuración de cobro de la tienda
// ============================================================
const express = require('express');
const r = express.Router();
const { supabaseAdmin } = require('../services/supabase');
const { autenticar, autorizar } = require('../middleware/auth.middleware');

const BUCKET_NAME = 'tienda';
const QR_OBJECT_PATH = 'qr/qr_tienda.png';

const ensureBucket = async () => {
  const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
  if (listError) throw listError;

  const exists = (buckets || []).some((bucket) => bucket.name === BUCKET_NAME);
  if (!exists) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(BUCKET_NAME, { public: true });
    if (createError) throw createError;
  }
};

const buildQrResponse = async () => {
  const { data } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(QR_OBJECT_PATH);
  return {
    id: 1,
    qr_imagen_url: data?.publicUrl || null,
    qr_descripcion: 'Escanea el QR para completar tu pago.',
    actualizado_en: null,
  };
};

// Crear pedido desde la tienda: items, subtotal, descuento, impuestos, total, notas
// Opcional: crear pago automático si se envía payment: { crear: true, tipo_pago }
r.post('/pedidos', autenticar, async (req, res, next) => {
  try {
    const { items = [], subtotal = 0, descuento = 0, impuestos = 0, total = 0, notas = null, crear_pago = false, payment = {}, promocion_id, promocion_codigo } = req.body;

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items es requerido.' });

    // obtener cliente_id del usuario autenticado
    const { id: usuarioId, rol } = req.usuario;
    let clienteId = null;
    if (rol === 'cliente') {
      const { data: c } = await supabaseAdmin.from('clientes').select('id').eq('usuario_id', usuarioId).single();
      if (!c) return res.status(400).json({ error: 'Perfil de cliente no encontrado.' });
      clienteId = c.id;
    } else {
      // si no es cliente, se puede permitir enviar cliente_id en body
      clienteId = req.body.cliente_id || null;
      if (!clienteId) return res.status(403).json({ error: 'Se requiere cliente_id para usuarios no cliente.' });
    }

    // insertar pedido
    const { data: pedido, error: pedidoError } = await supabaseAdmin.from('carrito_pedido').insert({
      cliente_id: clienteId,
      estado: 'pendiente',
      subtotal,
      descuento,
      total: total || subtotal - descuento + impuestos,
      notas,
    }).select().single();

    if (pedidoError) throw pedidoError;

    // insertar detalles
    const detalleRows = items.map(it => ({
      pedido_id: pedido.id,
      producto_id: it.producto_id,
      variante_id: it.variante_id || null,
      cantidad: it.cantidad || 1,
      precio_unitario: it.precio_unitario || 0,
    }));

    const { data: detalles, error: detallesError } = await supabaseAdmin.from('pedido_detalle').insert(detalleRows).select();
    if (detallesError) throw detallesError;

    // confirmar pedido para aplicar stock (trigger en DB)
    const { error: confirmError } = await supabaseAdmin.from('carrito_pedido').update({ estado: 'confirmado' }).eq('id', pedido.id);
    if (confirmError) throw confirmError;

    let pago = null;
    if (crear_pago) {
      const tipo_pago = payment.tipo_pago || 'efectivo';
      const estadoPago = payment.estado || 'pagado';
      const { data: pagoData, error: pagoError } = await supabaseAdmin.from('pago_factura').insert({
        cliente_id: clienteId,
        pedido_id: pedido.id,
        numero_factura: `FAC-${Date.now()}`,
        subtotal,
        descuento,
        impuestos,
        total: total || subtotal - descuento + impuestos,
        tipo_pago,
        estado: estadoPago,
        fecha_pago: new Date().toISOString(),
        notas: notas || null,
        creado_por: usuarioId
      }).select().single();
      if (pagoError) throw pagoError;
      pago = pagoData;
    }

    // Registrar movimiento de caja para pago de tienda
    try {
      if (pago && pago.id) {
        await supabaseAdmin.from('movimiento_caja').insert({
          pago_id: pago.id,
          pedido_id: pedido.id,
          tipo_movimiento: 'ingreso',
          metodo_pago: payment.tipo_pago || 'efectivo',
          monto: pago.total || total || subtotal - descuento + impuestos,
          referencia: `Pedido tienda ${pedido.id}`,
          creado_por: usuarioId
        });
      }
    } catch (mcErr) {
      console.error('[caja] error registrando movimiento (tienda):', mcErr.message || mcErr);
    }

    // Generar comprobante PDF para pago de tienda
    try {
      const { generatePdfAndUpload } = require('../services/pdf.service');
      const pagoObj = pago;
      const html = `
        <html><head><meta charset="utf-8"><title>Recibo ${pagoObj.numero_factura}</title></head><body>
        <h1>Recibo de pago - Tienda</h1>
        <p>Factura: ${pagoObj.numero_factura}</p>
        <p>Pedido: ${pedido.id}</p>
        <p>Monto: ${Number(pagoObj.total).toFixed(2)}</p>
        <p>Método: ${pagoObj.tipo_pago}</p>
        <p>Fecha: ${pagoObj.fecha_pago}</p>
        </body></html>
      `;
      const pdfPath = `recibos/${pagoObj.id}.pdf`;
      const publicUrl = await generatePdfAndUpload({ html, bucket: 'documentos', path: pdfPath });
      if (publicUrl) {
        const { error: upErr } = await supabaseAdmin.from('pago_factura').update({ comprobante_url: publicUrl }).eq('id', pagoObj.id);
        if (upErr) console.error('[pago] no se pudo actualizar comprobante_url:', upErr.message || upErr);
        pago.comprobante_url = publicUrl;
      }
    } catch (pdfErr) {
      console.error('[pago] error generando comprobante PDF (tienda):', pdfErr.message || pdfErr);
    }

    // Enviar comprobante por email
    try {
      const { data: clienteInfo } = await supabaseAdmin.from('clientes').select('id, usuarios (email, nombre)').eq('id', clienteId).single();
      const email = clienteInfo?.usuarios?.email;
      const nombre = clienteInfo?.usuarios?.nombre;
      if (email && pago && pago.comprobante_url) {
        const html = `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">
            <h2>Hola ${nombre || ''}</h2>
            <p>Hemos registrado tu pago. Descarga tu recibo aquí:</p>
            <p><a href="${pago.comprobante_url}">Descargar comprobante</a></p>
            <p>Pedido: <strong>${pedido.id}</strong></p>
            <p>Monto: <strong>Bs. ${Number(pago.total).toFixed(2)}</strong></p>
          </div>
        `;
        const { enviarNotificacionReserva } = require('../services/email.service');
        await enviarNotificacionReserva({ to: email, asunto: 'Recibo de pago — PawSpa', html });
      }
    } catch (mailErr) {
      console.error('[pago] error enviando comprobante por email (tienda):', mailErr.message || mailErr);
    }

    // registrar redención de promoción si aplica
    try {
      let promoIdToInsert = promocion_id || null;
      if (!promoIdToInsert && promocion_codigo) {
        const { data: promos } = await supabaseAdmin.from('promocion').select('id').eq('codigo', promocion_codigo).limit(1);
        if (promos && promos[0]) promoIdToInsert = promos[0].id;
      }
      const montoDescuento = Number(descuento || 0);
      if (promoIdToInsert && montoDescuento > 0) {
        await supabaseAdmin.from('promocion_redencion').insert({
          promocion_id: promoIdToInsert,
          cliente_id: clienteId,
          pedido_id: pedido.id,
          monto_descuento: montoDescuento
        });
      }
    } catch (e) {
      console.error('[promocion] error registrando redención (tienda):', e.message || e);
    }

    const { data: pedidoFull } = await supabaseAdmin.from('carrito_pedido').select('*, pedido_detalle(*)').eq('id', pedido.id).single();

    return res.status(201).json({ mensaje: 'Pedido creado.', data: { pedido: pedidoFull, pago } });
  } catch (e) {
    next(e);
  }
});

r.get('/configuracion', autenticar, async (req, res, next) => {
  try {
    await ensureBucket();
    res.json({ data: await buildQrResponse() });
  } catch (e) {
    next(e);
  }
});

r.put('/configuracion', autenticar, autorizar('admin'), async (req, res, next) => {
  try {
    const { qr_imagen_url, qr_descripcion } = req.body;

    await ensureBucket();

    const imageValue = qr_imagen_url || null;
    if (imageValue) {
      let fileBuffer = null;
      let contentType = 'image/png';

      if (String(imageValue).startsWith('data:')) {
        const match = String(imageValue).match(/^data:(.+);base64,(.+)$/);
        const base64Data = match ? match[2] : imageValue;
        contentType = match?.[1] || contentType;
        fileBuffer = Buffer.from(base64Data, 'base64');
      } else {
        const response = await fetch(String(imageValue));
        if (!response.ok) throw new Error('No se pudo descargar la imagen del QR.');
        const arrayBuffer = await response.arrayBuffer();
        fileBuffer = Buffer.from(arrayBuffer);
        contentType = response.headers.get('content-type') || contentType;
      }

      const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET_NAME).upload(QR_OBJECT_PATH, fileBuffer, {
        contentType,
        upsert: true,
      });

      if (uploadError) throw uploadError;
    }

    const config = await buildQrResponse();
    config.qr_descripcion = qr_descripcion || 'Escanea el QR para completar tu pago.';
    res.json({ data: config });
  } catch (e) {
    next(e);
  }
});

module.exports = r;