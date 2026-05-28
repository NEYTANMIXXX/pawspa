-- 11_caja_pdf.sql
-- Añadir columna para URL de PDF en cierre_caja
ALTER TABLE IF EXISTS cierre_caja
  ADD COLUMN IF NOT EXISTS pdf_url TEXT;

-- Refrescar cache de PostgREST
NOTIFY pgrst, 'reload schema';
