-- 09_promociones.sql
-- Tablas para promociones y redenciones
CREATE TABLE IF NOT EXISTS promocion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  codigo varchar(64) UNIQUE,
  tipo varchar(32) NOT NULL CHECK (tipo IN ('porcentaje','fijo','precio_promocional')),
  valor numeric NOT NULL,
  aplica_a varchar(32) DEFAULT 'all', -- 'producto' | 'servicio' | 'all'
  aplica_item_id uuid, -- id del producto/servicio si aplica_a != 'all'
  fecha_inicio timestamptz,
  fecha_fin timestamptz,
  activo boolean DEFAULT true,
  uso_max integer, -- uso máximo global
  uso_por_cliente integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promocion_codigo ON promocion(codigo);

CREATE TABLE IF NOT EXISTS promocion_redencion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promocion_id uuid NOT NULL REFERENCES promocion(id) ON DELETE CASCADE,
  cliente_id uuid,
  pedido_id uuid,
  monto_descuento numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Nota: las reglas de negocio sobre usos por cliente y uso_max se aplican en la capa de aplicación.
