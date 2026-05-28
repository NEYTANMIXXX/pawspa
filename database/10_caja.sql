-- 10_caja.sql
-- Movimientos de caja y cierre diario

-- Tabla de movimientos de caja (ingresos/egresos)
CREATE TABLE IF NOT EXISTS movimiento_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id uuid REFERENCES pago_factura(id) ON DELETE SET NULL,
  pedido_id uuid REFERENCES carrito_pedido(id) ON DELETE SET NULL,
  tipo_movimiento varchar(16) NOT NULL CHECK (tipo_movimiento IN ('ingreso','egreso')),
  metodo_pago tipo_pago,
  monto numeric(12,2) NOT NULL CHECK (monto >= 0),
  referencia text, -- texto libre o id externo
  creado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_movcaja_pago ON movimiento_caja(pago_id);
CREATE INDEX IF NOT EXISTS idx_movcaja_pedido ON movimiento_caja(pedido_id);
CREATE INDEX IF NOT EXISTS idx_movcaja_creado_en ON movimiento_caja(creado_en);

-- Tabla para cierres de caja diarios (borrador y finalizados)
CREATE TABLE IF NOT EXISTS cierre_caja (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  apertura numeric(12,2) NOT NULL DEFAULT 0,
  cierre_declarado numeric(12,2),
  total_ingresos numeric(12,2) NOT NULL DEFAULT 0,
  total_egresos numeric(12,2) NOT NULL DEFAULT 0,
  diferencia numeric(12,2),
  estado varchar(16) NOT NULL DEFAULT 'abierto', -- abierto|cerrado|conciliado
  notas text,
  creado_en timestamptz NOT NULL DEFAULT now(),
  cerrado_en timestamptz
);

CREATE TABLE IF NOT EXISTS cierre_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cierre_id uuid NOT NULL REFERENCES cierre_caja(id) ON DELETE CASCADE,
  metodo_pago tipo_pago,
  total numeric(12,2) NOT NULL DEFAULT 0,
  cantidad_transacciones integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cierre_fecha ON cierre_caja(fecha);

-- Notificar PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
