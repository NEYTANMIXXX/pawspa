-- 13_promocion_visible.sql
-- Añade columna para controlar visibilidad en el dashboard de clientes
ALTER TABLE IF EXISTS promocion
  ADD COLUMN IF NOT EXISTS visible_en_dashboard boolean DEFAULT true;

-- Asegurar que filas existentes tengan valor por defecto si null
UPDATE promocion SET visible_en_dashboard = true WHERE visible_en_dashboard IS NULL;

-- FIN
