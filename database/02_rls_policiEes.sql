-- ============================================================
-- PawSpa — Políticas Row Level Security (RLS) v2
-- CORRECCIÓN: funciones auxiliares en schema PUBLIC (no auth)
-- Archivo: 02_rls_policies.sql
-- ============================================================

-- ============================================================
-- PASO 1: Habilitar RLS en todas las tablas
-- ============================================================

ALTER TABLE usuarios              ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE groomers              ENABLE ROW LEVEL SECURITY;
ALTER TABLE mascotas              ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios             ENABLE ROW LEVEL SECURITY;
ALTER TABLE groomer_disponibilidad ENABLE ROW LEVEL SECURITY;
ALTER TABLE bloqueo_agenda        ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_reserva          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ficha_grooming        ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_item        ENABLE ROW LEVEL SECURITY;
ALTER TABLE foto_servicio         ENABLE ROW LEVEL SECURITY;
ALTER TABLE categoria             ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto              ENABLE ROW LEVEL SECURITY;
ALTER TABLE variante_producto     ENABLE ROW LEVEL SECURITY;
ALTER TABLE carrito_pedido        ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_detalle        ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimiento_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE pago_factura          ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones        ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PASO 2: Funciones auxiliares en schema PUBLIC
-- NOTA: auth.uid() está permitido en políticas y funciones.
--       Lo que NO se puede hacer es CREATE FUNCTION dentro
--       del schema "auth". Por eso usamos "public".
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_mi_rol()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT rol::TEXT FROM public.usuarios
  WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_mi_usuario_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.usuarios
  WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_mi_cliente_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id FROM public.clientes c
  JOIN public.usuarios u ON u.id = c.usuario_id
  WHERE u.auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_mi_groomer_id()
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT g.id FROM public.groomers g
  JOIN public.usuarios u ON u.id = g.usuario_id
  WHERE u.auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.es_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_id = auth.uid() AND rol = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.es_staff()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE auth_id = auth.uid()
      AND rol IN ('admin', 'recepcion', 'groomer')
  );
$$;

-- ============================================================
-- PASO 3: POLÍTICAS — USUARIOS
-- ============================================================

CREATE POLICY "usuarios_select" ON usuarios FOR SELECT
  USING (
    public.es_admin()
    OR id = public.get_mi_usuario_id()
    OR (public.es_staff() AND rol = 'cliente')
  );

CREATE POLICY "usuarios_insert" ON usuarios FOR INSERT
  WITH CHECK (public.es_admin());

CREATE POLICY "usuarios_update" ON usuarios FOR UPDATE
  USING (public.es_admin() OR id = public.get_mi_usuario_id());

CREATE POLICY "usuarios_delete" ON usuarios FOR DELETE
  USING (public.es_admin());

-- ============================================================
-- PASO 4: POLÍTICAS — CLIENTES
-- ============================================================

CREATE POLICY "clientes_select" ON clientes FOR SELECT
  USING (
    public.es_staff()
    OR usuario_id = public.get_mi_usuario_id()
  );

CREATE POLICY "clientes_insert" ON clientes FOR INSERT
  WITH CHECK (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR usuario_id = public.get_mi_usuario_id()
  );

CREATE POLICY "clientes_update" ON clientes FOR UPDATE
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR usuario_id = public.get_mi_usuario_id()
  );

-- ============================================================
-- PASO 5: POLÍTICAS — GROOMERS
-- ============================================================

CREATE POLICY "groomers_select" ON groomers FOR SELECT USING (TRUE);

CREATE POLICY "groomers_insert" ON groomers FOR INSERT
  WITH CHECK (public.es_admin());

CREATE POLICY "groomers_update" ON groomers FOR UPDATE
  USING (public.es_admin() OR usuario_id = public.get_mi_usuario_id());

-- ============================================================
-- PASO 6: POLÍTICAS — MASCOTAS
-- ============================================================

CREATE POLICY "mascotas_select" ON mascotas FOR SELECT
  USING (
    public.es_staff()
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "mascotas_insert" ON mascotas FOR INSERT
  WITH CHECK (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "mascotas_update" ON mascotas FOR UPDATE
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "mascotas_delete" ON mascotas FOR DELETE
  USING (public.es_admin() OR public.get_mi_rol() = 'recepcion');

-- ============================================================
-- PASO 7: POLÍTICAS — SERVICIOS
-- ============================================================

CREATE POLICY "servicios_select" ON servicios FOR SELECT USING (TRUE);
CREATE POLICY "servicios_insert" ON servicios FOR INSERT WITH CHECK (public.es_admin());
CREATE POLICY "servicios_update" ON servicios FOR UPDATE USING (public.es_admin());
CREATE POLICY "servicios_delete" ON servicios FOR DELETE USING (public.es_admin());

-- ============================================================
-- PASO 8: POLÍTICAS — GROOMER_DISPONIBILIDAD
-- ============================================================

CREATE POLICY "disp_select" ON groomer_disponibilidad FOR SELECT USING (TRUE);

CREATE POLICY "disp_insert" ON groomer_disponibilidad FOR INSERT
  WITH CHECK (public.es_admin() OR groomer_id = public.get_mi_groomer_id());

CREATE POLICY "disp_update" ON groomer_disponibilidad FOR UPDATE
  USING (public.es_admin() OR groomer_id = public.get_mi_groomer_id());

-- ============================================================
-- PASO 9: POLÍTICAS — BLOQUEO_AGENDA
-- ============================================================

CREATE POLICY "bloqueo_select" ON bloqueo_agenda FOR SELECT USING (public.es_staff());
CREATE POLICY "bloqueo_insert" ON bloqueo_agenda FOR INSERT WITH CHECK (public.es_staff());
CREATE POLICY "bloqueo_delete" ON bloqueo_agenda FOR DELETE USING (public.es_admin());

-- ============================================================
-- PASO 10: POLÍTICAS — SLOT_RESERVA
-- ============================================================

CREATE POLICY "slot_select" ON slot_reserva FOR SELECT
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR groomer_id = public.get_mi_groomer_id()
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "slot_insert" ON slot_reserva FOR INSERT
  WITH CHECK (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "slot_update" ON slot_reserva FOR UPDATE
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR groomer_id = public.get_mi_groomer_id()
  );

-- ============================================================
-- PASO 11: POLÍTICAS — FICHA_GROOMING
-- ============================================================

CREATE POLICY "ficha_select" ON ficha_grooming FOR SELECT
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR groomer_id = public.get_mi_groomer_id()
  );

CREATE POLICY "ficha_insert" ON ficha_grooming FOR INSERT
  WITH CHECK (public.es_staff());

CREATE POLICY "ficha_update" ON ficha_grooming FOR UPDATE
  USING (public.es_admin() OR groomer_id = public.get_mi_groomer_id());

-- ============================================================
-- PASO 12: POLÍTICAS — CHECKLIST_ITEM
-- ============================================================

CREATE POLICY "checklist_select" ON checklist_item FOR SELECT USING (public.es_staff());
CREATE POLICY "checklist_insert" ON checklist_item FOR INSERT WITH CHECK (public.es_staff());
CREATE POLICY "checklist_update" ON checklist_item FOR UPDATE USING (public.es_staff());
CREATE POLICY "checklist_delete" ON checklist_item FOR DELETE USING (public.es_admin());

-- ============================================================
-- PASO 13: POLÍTICAS — FOTO_SERVICIO
-- ============================================================

CREATE POLICY "foto_select" ON foto_servicio FOR SELECT USING (public.es_staff());
CREATE POLICY "foto_insert" ON foto_servicio FOR INSERT WITH CHECK (public.es_staff());
CREATE POLICY "foto_delete" ON foto_servicio FOR DELETE USING (public.es_admin());

-- ============================================================
-- PASO 14: POLÍTICAS — TIENDA
-- ============================================================

CREATE POLICY "categoria_select" ON categoria         FOR SELECT USING (TRUE);
CREATE POLICY "categoria_insert" ON categoria         FOR INSERT WITH CHECK (public.es_admin());
CREATE POLICY "categoria_update" ON categoria         FOR UPDATE USING (public.es_admin());

CREATE POLICY "producto_select"  ON producto          FOR SELECT USING (TRUE);
CREATE POLICY "producto_insert"  ON producto          FOR INSERT WITH CHECK (public.es_admin());
CREATE POLICY "producto_update"  ON producto          FOR UPDATE
  USING (public.es_admin() OR public.get_mi_rol() = 'recepcion');

CREATE POLICY "variante_select"  ON variante_producto FOR SELECT USING (TRUE);
CREATE POLICY "variante_insert"  ON variante_producto FOR INSERT WITH CHECK (public.es_admin());

-- ============================================================
-- PASO 15: POLÍTICAS — CARRITO_PEDIDO y PEDIDO_DETALLE
-- ============================================================

CREATE POLICY "carrito_select" ON carrito_pedido FOR SELECT
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "carrito_insert" ON carrito_pedido FOR INSERT
  WITH CHECK (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "carrito_update" ON carrito_pedido FOR UPDATE
  USING (public.es_admin() OR public.get_mi_rol() = 'recepcion');

CREATE POLICY "detalle_select" ON pedido_detalle FOR SELECT
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR EXISTS (
      SELECT 1 FROM carrito_pedido cp
      WHERE cp.id = pedido_id
        AND cp.cliente_id = public.get_mi_cliente_id()
    )
  );

CREATE POLICY "detalle_insert" ON pedido_detalle FOR INSERT
  WITH CHECK (public.es_admin() OR public.get_mi_rol() = 'recepcion');

-- ============================================================
-- PASO 16: POLÍTICAS — MOVIMIENTO_INVENTARIO
-- ============================================================

CREATE POLICY "movimiento_select" ON movimiento_inventario FOR SELECT
  USING (public.es_admin() OR public.get_mi_rol() = 'recepcion');

CREATE POLICY "movimiento_insert" ON movimiento_inventario FOR INSERT
  WITH CHECK (public.es_admin() OR public.get_mi_rol() = 'recepcion');

-- ============================================================
-- PASO 17: POLÍTICAS — PAGO_FACTURA
-- ============================================================

CREATE POLICY "pago_select" ON pago_factura FOR SELECT
  USING (
    public.es_admin()
    OR public.get_mi_rol() = 'recepcion'
    OR cliente_id = public.get_mi_cliente_id()
  );

CREATE POLICY "pago_insert" ON pago_factura FOR INSERT
  WITH CHECK (public.es_admin() OR public.get_mi_rol() = 'recepcion');

CREATE POLICY "pago_update" ON pago_factura FOR UPDATE
  USING (public.es_admin() OR public.get_mi_rol() = 'recepcion');

-- ============================================================
-- PASO 18: POLÍTICAS — AUDITORÍA
-- ============================================================

CREATE POLICY "audit_select" ON auditoria_log FOR SELECT
  USING (public.es_admin());

-- Cualquier usuario autenticado puede insertar logs de auditoría
CREATE POLICY "audit_insert" ON auditoria_log FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- PASO 19: POLÍTICAS — NOTIFICACIONES
-- ============================================================

CREATE POLICY "notif_select" ON notificaciones FOR SELECT
  USING (
    usuario_id = public.get_mi_usuario_id()
    OR public.es_admin()
  );

CREATE POLICY "notif_insert" ON notificaciones FOR INSERT
  WITH CHECK (public.es_staff());

CREATE POLICY "notif_update" ON notificaciones FOR UPDATE
  USING (usuario_id = public.get_mi_usuario_id());

-- ============================================================
-- VERIFICACIÓN: corre esto para confirmar que todo está bien
-- ============================================================
-- SELECT routine_name FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name IN (
--     'get_mi_rol','get_mi_usuario_id','get_mi_cliente_id',
--     'get_mi_groomer_id','es_admin','es_staff'
--   );
-- ============================================================
