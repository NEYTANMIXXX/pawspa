-- ============================================================
-- Tienda: catálogo, precio promocional y stock para pedidos
-- ============================================================

-- Precio promocional opcional por producto
ALTER TABLE public.producto
  ADD COLUMN IF NOT EXISTS precio_promocional NUMERIC(10,2) CHECK (precio_promocional >= 0);

-- Índices útiles para catálogo y venta
CREATE INDEX IF NOT EXISTS idx_producto_precio_promocional ON public.producto (precio_promocional);
CREATE INDEX IF NOT EXISTS idx_variante_activo ON public.variante_producto (activo);

DO $$
BEGIN
  ALTER TYPE public.tipo_pago ADD VALUE IF NOT EXISTS 'otros';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Categorías base para la tienda
INSERT INTO public.categoria (nombre, descripcion) VALUES
  ('Alimentos', 'Alimentos secos y húmedos para mascotas'),
  ('Accesorios', 'Correas, collares, guantes y otros accesorios'),
  ('Higiene', 'Shampoos, perfumes, cepillos y cuidado personal'),
  ('Juguetes', 'Juguetes y entretenimiento'),
  ('Salud', 'Vitaminas, antiparasitarios y cuidado médico')
ON CONFLICT (nombre) DO NOTHING;

-- Productos sugeridos para la tienda
INSERT INTO public.producto (
  id, categoria_id, nombre, descripcion, marca,
  precio_compra, precio_venta, precio_promocional,
  stock_actual, stock_minimo, unidad_medida, imagen_url
) VALUES
  ('11111111-1111-1111-1111-111111111101', (SELECT id FROM public.categoria WHERE nombre = 'Higiene' LIMIT 1),
   'Guantes descartables', 'Guantes para grooming y manipulación higiénica', 'PawSafe',
   7.00, 14.90, NULL, 80, 20, 'caja', NULL),
  ('11111111-1111-1111-1111-111111111102', (SELECT id FROM public.categoria WHERE nombre = 'Salud' LIMIT 1),
   'Spray antipulgas', 'Spray antipulgas para higiene y prevención', 'VetGuard',
   22.00, 39.90, 34.90, 18, 5, 'frasco', NULL),
  ('11111111-1111-1111-1111-111111111103', (SELECT id FROM public.categoria WHERE nombre = 'Higiene' LIMIT 1),
   'Perfume para mascotas 250ml', 'Perfume suave para acabado del servicio', 'FreshPaw',
   15.00, 29.90, NULL, 35, 8, 'frasco', NULL),
  ('11111111-1111-1111-1111-111111111104', (SELECT id FROM public.categoria WHERE nombre = 'Higiene' LIMIT 1),
   'Shampoo Neutro 500ml', 'Shampoo hipoalergénico para perros y gatos', 'PetClean',
   12.00, 24.90, NULL, 40, 10, 'frasco', NULL)
ON CONFLICT (id) DO NOTHING;

-- Stock: se descuenta al confirmar el pedido y se repone al cancelar.
CREATE OR REPLACE FUNCTION public.aplicar_stock_pedido()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  stock_producto INT;
  stock_variante INT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.estado <> 'confirmado' AND NEW.estado = 'confirmado' THEN
      FOR item IN
        SELECT producto_id, variante_id, cantidad, precio_unitario
        FROM public.pedido_detalle
        WHERE pedido_id = NEW.id
      LOOP
        SELECT stock_actual INTO stock_producto
        FROM public.producto
        WHERE id = item.producto_id
        FOR UPDATE;

        IF stock_producto IS NULL OR stock_producto < item.cantidad THEN
          RAISE EXCEPTION 'Stock insuficiente para el producto %', item.producto_id;
        END IF;

        UPDATE public.producto
          SET stock_actual = stock_actual - item.cantidad
        WHERE id = item.producto_id;

        IF item.variante_id IS NOT NULL THEN
          SELECT stock INTO stock_variante
          FROM public.variante_producto
          WHERE id = item.variante_id
          FOR UPDATE;

          IF stock_variante IS NOT NULL THEN
            IF stock_variante < item.cantidad THEN
              RAISE EXCEPTION 'Stock insuficiente para la variante %', item.variante_id;
            END IF;

            UPDATE public.variante_producto
              SET stock = stock - item.cantidad
            WHERE id = item.variante_id;
          END IF;
        END IF;

        INSERT INTO public.movimiento_inventario (
          producto_id, variante_id, tipo, cantidad,
          stock_anterior, stock_nuevo, referencia_id, motivo, creado_por
        ) VALUES (
          item.producto_id,
          item.variante_id,
          'salida',
          item.cantidad,
          stock_producto,
          stock_producto - item.cantidad,
          NEW.id,
          'Pedido confirmado desde tienda',
          NULL
        );
      END LOOP;
    ELSIF OLD.estado = 'confirmado' AND NEW.estado = 'cancelado' THEN
      FOR item IN
        SELECT producto_id, variante_id, cantidad, precio_unitario
        FROM public.pedido_detalle
        WHERE pedido_id = NEW.id
      LOOP
        SELECT stock_actual INTO stock_producto
        FROM public.producto
        WHERE id = item.producto_id
        FOR UPDATE;

        UPDATE public.producto
          SET stock_actual = stock_actual + item.cantidad
        WHERE id = item.producto_id;

        IF item.variante_id IS NOT NULL THEN
          UPDATE public.variante_producto
            SET stock = stock + item.cantidad
          WHERE id = item.variante_id;
        END IF;

        INSERT INTO public.movimiento_inventario (
          producto_id, variante_id, tipo, cantidad,
          stock_anterior, stock_nuevo, referencia_id, motivo, creado_por
        ) VALUES (
          item.producto_id,
          item.variante_id,
          'devolucion',
          item.cantidad,
          COALESCE(stock_producto, 0),
          COALESCE(stock_producto, 0) + item.cantidad,
          NEW.id,
          'Pedido cancelado desde tienda',
          NULL
        );
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_aplicar_stock_pedido ON public.carrito_pedido;
CREATE TRIGGER trg_aplicar_stock_pedido
AFTER UPDATE OF estado ON public.carrito_pedido
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_stock_pedido();

-- Refrescar el cache de esquema de PostgREST después de aplicar la migración.
NOTIFY pgrst, 'reload schema';
