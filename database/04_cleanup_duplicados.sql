-- ============================================================
-- LIMPIEZA DE DUPLICADOS
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Ver cantidad de servicios por nombre (para identificar duplicados)
SELECT nombre, COUNT(*) as cantidad, array_agg(id) as ids
FROM servicios
GROUP BY nombre
HAVING COUNT(*) > 1;

-- 2. Ver todos los servicios actuales
SELECT id, nombre, duracion_min, precio_base
FROM servicios
ORDER BY nombre;

-- 3. Eliminar servicios duplicados (mantener solo el primero por nombre)
DELETE FROM servicios
WHERE id NOT IN (
  SELECT DISTINCT ON (nombre) id
  FROM servicios
  ORDER BY nombre, creado_en ASC
);

-- 4. Verificar que quedan solo 4 servicios
SELECT COUNT(*) as total_servicios
FROM servicios;

-- 5. Listar servicios finales
SELECT id, nombre, duracion_min, precio_base, categoria
FROM servicios
ORDER BY nombre;
