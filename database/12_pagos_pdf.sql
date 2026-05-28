-- 12_pagos_pdf.sql
-- Añadir campo para URL de comprobante PDF en pago_factura
ALTER TABLE IF EXISTS pago_factura
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- Refrescar cache de PostgREST
NOTIFY pgrst, 'reload schema';
