-- Migration: 05_reservas.sql
-- Añade índices, vista y restricción de no solapamiento para la agenda
-- NOTA: Revisar compatibilidad de `btree_gist` y tipos en tu instancia de Supabase

-- Habilitar extensión necesaria para exclusion constraints con GIST
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1) Índices para consultas de calendario y disponibilidad
CREATE INDEX IF NOT EXISTS idx_slot_reserva_groomer_fecha ON public.slot_reserva (groomer_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_slot_reserva_cliente_fecha ON public.slot_reserva (cliente_id, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_slot_reserva_servicio_fecha ON public.slot_reserva (servicio_id, fecha_inicio);

-- Índice GIST sobre bloques con rango en timestamptz
CREATE INDEX IF NOT EXISTS idx_bloqueo_agenda_period_gist ON public.bloqueo_agenda USING gist (groomer_id, tstzrange(fecha_inicio, fecha_fin));

-- 2) Columna generada `period` en `slot_reserva` para simplificar operaciones por rango
ALTER TABLE public.slot_reserva
  ADD COLUMN IF NOT EXISTS period tstzrange GENERATED ALWAYS AS (tstzrange(fecha_inicio, fecha_fin)) STORED;

-- 3) Restricción de exclusión para evitar solapamientos de citas por `groomer`
-- Evita solapamientos de `period` para el mismo `groomer_id` cuando el estado no sea 'cancelada'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE c.contype = 'x' AND t.relname = 'slot_reserva' AND c.conname = 'slot_reserva_no_solapamiento_groomer'
  ) THEN
    ALTER TABLE public.slot_reserva
      ADD CONSTRAINT slot_reserva_no_solapamiento_groomer
      EXCLUDE USING GIST (groomer_id WITH =, period WITH &&)
      WHERE (estado <> 'cancelada'::estado_cita);
  END IF;
END$$;

-- 4) Vista unificada para alimentar calendarios (slots + bloqueos)
CREATE OR REPLACE VIEW public.v_agenda AS
SELECT
  id,
  'slot'::text AS tipo,
  groomer_id,
  fecha_inicio AS start,
  fecha_fin AS end,
  estado::text AS estado,
  cliente_id,
  mascota_id,
  servicio_id,
  precio_acordado,
  observaciones AS notas
FROM public.slot_reserva
UNION ALL
SELECT
  id,
  'bloqueo'::text AS tipo,
  groomer_id,
  fecha_inicio AS start,
  fecha_fin AS end,
  NULL::text AS estado,
  NULL::uuid AS cliente_id,
  NULL::uuid AS mascota_id,
  NULL::uuid AS servicio_id,
  NULL::numeric AS precio_acordado,
  motivo AS notas
FROM public.bloqueo_agenda;

-- 5) Recomendaciones (no ejecutadas):
-- - Revisar y ajustar la política RLS si usas Supabase Row Level Security.
-- - Considerar triggers para auditar reprogramaciones y cambios de groomer.
-- - Validar que el valor de cancelacion en `estado_cita` sea 'cancelada'.

-- FIN de migración
