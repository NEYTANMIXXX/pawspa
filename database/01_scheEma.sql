-- ============================================================
-- PawSpa — Sistema Integral de Gestión Spa & Tienda de Mascotas
-- Base de Datos PostgreSQL (Supabase)
-- Versión: 1.0.0
-- ============================================================

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE rol_usuario AS ENUM ('admin', 'recepcion', 'groomer', 'cliente');
CREATE TYPE estado_cita AS ENUM ('pendiente', 'confirmada', 'en_progreso', 'completada', 'cancelada', 'no_show');
CREATE TYPE estado_pedido AS ENUM ('pendiente', 'confirmado', 'preparando', 'listo', 'entregado', 'cancelado');
CREATE TYPE tipo_movimiento AS ENUM ('entrada', 'salida', 'ajuste', 'devolucion');
CREATE TYPE tipo_auditoria AS ENUM ('login', 'logout', 'crear', 'actualizar', 'eliminar', 'ver');
CREATE TYPE estado_notificacion AS ENUM ('no_leida', 'leida', 'archivada');
CREATE TYPE tipo_notificacion AS ENUM ('cita', 'pago', 'sistema', 'grooming', 'stock');
CREATE TYPE tipo_pago AS ENUM ('efectivo', 'tarjeta_credito', 'tarjeta_debito', 'transferencia', 'qr');
CREATE TYPE estado_pago AS ENUM ('pendiente', 'pagado', 'parcial', 'anulado', 'reembolsado');
CREATE TYPE especie_mascota AS ENUM ('perro', 'gato', 'conejo', 'ave', 'otro');
CREATE TYPE tamano_mascota AS ENUM ('mini', 'pequeno', 'mediano', 'grande', 'gigante');
CREATE TYPE sexo_mascota AS ENUM ('macho', 'hembra');

-- ============================================================
-- SEGURIDAD — TABLA USUARIOS (Auth principal)
-- ============================================================

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_id         UUID UNIQUE,                            -- Supabase auth.users ID
    email           VARCHAR(255) NOT NULL UNIQUE,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100) NOT NULL,
    telefono        VARCHAR(20),
    rol             rol_usuario NOT NULL DEFAULT 'cliente',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url      TEXT,
    intentos_login  INT NOT NULL DEFAULT 0,
    bloqueado_hasta TIMESTAMPTZ,
    ultimo_login    TIMESTAMPTZ,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email   ON usuarios(email);
CREATE INDEX idx_usuarios_rol     ON usuarios(rol);
CREATE INDEX idx_usuarios_activo  ON usuarios(activo);
CREATE INDEX idx_usuarios_auth_id ON usuarios(auth_id);

-- ============================================================
-- CLIENTES (extensión de usuarios con datos adicionales)
-- ============================================================

CREATE TABLE clientes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    direccion       TEXT,
    ciudad          VARCHAR(100),
    notas           TEXT,
    referido_por    UUID REFERENCES clientes(id) ON DELETE SET NULL,
    puntos_fidelidad INT NOT NULL DEFAULT 0 CHECK (puntos_fidelidad >= 0),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_usuario_id ON clientes(usuario_id);

-- ============================================================
-- GROOMERS (extensión de usuarios)
-- ============================================================

CREATE TABLE groomers (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id          UUID NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    especialidades      TEXT[],
    certificaciones     TEXT[],
    bio                 TEXT,
    calificacion_prom   NUMERIC(3,2) DEFAULT 5.00 CHECK (calificacion_prom BETWEEN 0 AND 5),
    activo              BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_groomers_usuario_id ON groomers(usuario_id);

-- ============================================================
-- MASCOTAS
-- ============================================================

CREATE TABLE mascotas (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre          VARCHAR(100) NOT NULL,
    especie         especie_mascota NOT NULL DEFAULT 'perro',
    raza            VARCHAR(100),
    fecha_nacimiento DATE,
    sexo            sexo_mascota,
    tamano          tamano_mascota,
    peso_kg         NUMERIC(5,2) CHECK (peso_kg > 0),
    color           VARCHAR(100),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    foto_url        TEXT,
    alergias        TEXT,
    condiciones_med TEXT,
    notas           TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mascotas_cliente_id ON mascotas(cliente_id);
CREATE INDEX idx_mascotas_especie    ON mascotas(especie);
CREATE INDEX idx_mascotas_activo     ON mascotas(activo);

-- ============================================================
-- SERVICIOS DE GROOMING
-- ============================================================

CREATE TABLE servicios (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT,
    duracion_min    INT NOT NULL CHECK (duracion_min > 0),
    precio_base     NUMERIC(10,2) NOT NULL CHECK (precio_base >= 0),
    precio_mini     NUMERIC(10,2) CHECK (precio_mini >= 0),
    precio_pequeno  NUMERIC(10,2) CHECK (precio_pequeno >= 0),
    precio_mediano  NUMERIC(10,2) CHECK (precio_mediano >= 0),
    precio_grande   NUMERIC(10,2) CHECK (precio_grande >= 0),
    precio_gigante  NUMERIC(10,2) CHECK (precio_gigante >= 0),
    aplica_tamano   BOOLEAN NOT NULL DEFAULT FALSE,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    categoria       VARCHAR(100),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AGENDA — DISPONIBILIDAD DE GROOMERS
-- ============================================================

CREATE TABLE groomer_disponibilidad (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    groomer_id      UUID NOT NULL REFERENCES groomers(id) ON DELETE CASCADE,
    dia_semana      SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0=Dom, 6=Sab
    hora_inicio     TIME NOT NULL,
    hora_fin        TIME NOT NULL,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT chk_horario CHECK (hora_fin > hora_inicio),
    UNIQUE(groomer_id, dia_semana, hora_inicio)
);

CREATE INDEX idx_groomer_disp_groomer ON groomer_disponibilidad(groomer_id);

-- ============================================================
-- BLOQUEO DE AGENDA
-- ============================================================

CREATE TABLE bloqueo_agenda (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    groomer_id      UUID NOT NULL REFERENCES groomers(id) ON DELETE CASCADE,
    fecha_inicio    TIMESTAMPTZ NOT NULL,
    fecha_fin       TIMESTAMPTZ NOT NULL,
    motivo          VARCHAR(255),
    creado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_bloqueo_fechas CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX idx_bloqueo_groomer ON bloqueo_agenda(groomer_id);
CREATE INDEX idx_bloqueo_fechas  ON bloqueo_agenda(fecha_inicio, fecha_fin);

-- ============================================================
-- SLOT / RESERVAS DE CITAS
-- ============================================================

CREATE TABLE slot_reserva (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    groomer_id      UUID NOT NULL REFERENCES groomers(id) ON DELETE RESTRICT,
    mascota_id      UUID NOT NULL REFERENCES mascotas(id) ON DELETE RESTRICT,
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    servicio_id     UUID NOT NULL REFERENCES servicios(id) ON DELETE RESTRICT,
    creado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_inicio    TIMESTAMPTZ NOT NULL,
    fecha_fin       TIMESTAMPTZ NOT NULL,
    estado          estado_cita NOT NULL DEFAULT 'pendiente',
    precio_acordado NUMERIC(10,2) CHECK (precio_acordado >= 0),
    observaciones   TEXT,
    cancelado_por   UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    motivo_cancel   TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_slot_fechas CHECK (fecha_fin > fecha_inicio)
);

CREATE INDEX idx_slot_groomer   ON slot_reserva(groomer_id);
CREATE INDEX idx_slot_mascota   ON slot_reserva(mascota_id);
CREATE INDEX idx_slot_cliente   ON slot_reserva(cliente_id);
CREATE INDEX idx_slot_estado    ON slot_reserva(estado);
CREATE INDEX idx_slot_fecha     ON slot_reserva(fecha_inicio);

-- Prevenir doble reserva del mismo groomer
CREATE UNIQUE INDEX idx_slot_no_doble
    ON slot_reserva(groomer_id, fecha_inicio)
    WHERE estado NOT IN ('cancelada', 'no_show');

-- ============================================================
-- GROOMING — FICHA DE SERVICIO
-- ============================================================

CREATE TABLE ficha_grooming (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slot_id             UUID NOT NULL UNIQUE REFERENCES slot_reserva(id) ON DELETE RESTRICT,
    groomer_id          UUID NOT NULL REFERENCES groomers(id) ON DELETE RESTRICT,
    mascota_id          UUID NOT NULL REFERENCES mascotas(id) ON DELETE RESTRICT,
    hora_inicio         TIMESTAMPTZ,
    hora_fin            TIMESTAMPTZ,
    observaciones_ini   TEXT,
    observaciones_fin   TEXT,
    estado_pelaje       VARCHAR(100),
    incidentes          TEXT,
    recomendaciones     TEXT,
    checklist_completo  BOOLEAN NOT NULL DEFAULT FALSE,
    cerrada             BOOLEAN NOT NULL DEFAULT FALSE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ficha_slot    ON ficha_grooming(slot_id);
CREATE INDEX idx_ficha_groomer ON ficha_grooming(groomer_id);

-- ============================================================
-- CHECKLIST DE GROOMING
-- ============================================================

CREATE TABLE checklist_item (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id    UUID NOT NULL REFERENCES ficha_grooming(id) ON DELETE CASCADE,
    descripcion VARCHAR(255) NOT NULL,
    completado  BOOLEAN NOT NULL DEFAULT FALSE,
    orden       SMALLINT NOT NULL DEFAULT 0,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_ficha ON checklist_item(ficha_id);

-- ============================================================
-- FOTOS DE SERVICIO
-- ============================================================

CREATE TABLE foto_servicio (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ficha_id    UUID NOT NULL REFERENCES ficha_grooming(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    tipo        VARCHAR(50) CHECK (tipo IN ('antes', 'durante', 'despues')),
    descripcion TEXT,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_foto_ficha ON foto_servicio(ficha_id);

-- ============================================================
-- TIENDA — CATEGORÍAS
-- ============================================================

CREATE TABLE categoria (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre      VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    icono_url   TEXT,
    padre_id    UUID REFERENCES categoria(id) ON DELETE SET NULL,
    activo      BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TIENDA — PRODUCTOS
-- ============================================================

CREATE TABLE producto (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria_id    UUID REFERENCES categoria(id) ON DELETE SET NULL,
    nombre          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    marca           VARCHAR(100),
    codigo_barras   VARCHAR(100) UNIQUE,
    precio_compra   NUMERIC(10,2) CHECK (precio_compra >= 0),
    precio_venta    NUMERIC(10,2) NOT NULL CHECK (precio_venta >= 0),
    stock_actual    INT NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
    stock_minimo    INT NOT NULL DEFAULT 5 CHECK (stock_minimo >= 0),
    unidad_medida   VARCHAR(50) DEFAULT 'unidad',
    imagen_url      TEXT,
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_producto_categoria  ON producto(categoria_id);
CREATE INDEX idx_producto_activo     ON producto(activo);
CREATE INDEX idx_producto_stock      ON producto(stock_actual);

-- ============================================================
-- VARIANTES DE PRODUCTO
-- ============================================================

CREATE TABLE variante_producto (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id     UUID NOT NULL REFERENCES producto(id) ON DELETE CASCADE,
    nombre          VARCHAR(100) NOT NULL,  -- "500g", "Azul talla M"
    sku             VARCHAR(100) UNIQUE,
    precio_extra    NUMERIC(10,2) DEFAULT 0,
    stock           INT NOT NULL DEFAULT 0 CHECK (stock >= 0),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variante_producto ON variante_producto(producto_id);

-- ============================================================
-- CARRITO / PEDIDO
-- ============================================================

CREATE TABLE carrito_pedido (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    estado          estado_pedido NOT NULL DEFAULT 'pendiente',
    subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    descuento       NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
    total           NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
    notas           TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_carrito_cliente ON carrito_pedido(cliente_id);
CREATE INDEX idx_carrito_estado  ON carrito_pedido(estado);

-- ============================================================
-- DETALLE DE PEDIDO
-- ============================================================

CREATE TABLE pedido_detalle (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id       UUID NOT NULL REFERENCES carrito_pedido(id) ON DELETE CASCADE,
    producto_id     UUID NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    variante_id     UUID REFERENCES variante_producto(id) ON DELETE SET NULL,
    cantidad        INT NOT NULL CHECK (cantidad > 0),
    precio_unitario NUMERIC(10,2) NOT NULL CHECK (precio_unitario >= 0),
    subtotal        NUMERIC(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED
);

CREATE INDEX idx_detalle_pedido   ON pedido_detalle(pedido_id);
CREATE INDEX idx_detalle_producto ON pedido_detalle(producto_id);

-- ============================================================
-- MOVIMIENTOS DE INVENTARIO
-- ============================================================

CREATE TABLE movimiento_inventario (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    producto_id     UUID NOT NULL REFERENCES producto(id) ON DELETE RESTRICT,
    variante_id     UUID REFERENCES variante_producto(id) ON DELETE SET NULL,
    tipo            tipo_movimiento NOT NULL,
    cantidad        INT NOT NULL,
    stock_anterior  INT NOT NULL,
    stock_nuevo     INT NOT NULL,
    referencia_id   UUID,  -- pedido_id o slot_id
    motivo          TEXT,
    creado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mov_producto ON movimiento_inventario(producto_id);
CREATE INDEX idx_mov_tipo     ON movimiento_inventario(tipo);

-- ============================================================
-- PAGOS Y FACTURAS
-- ============================================================

CREATE TABLE pago_factura (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id      UUID NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
    slot_id         UUID REFERENCES slot_reserva(id) ON DELETE SET NULL,
    pedido_id       UUID REFERENCES carrito_pedido(id) ON DELETE SET NULL,
    numero_factura  VARCHAR(50) UNIQUE,
    subtotal        NUMERIC(10,2) NOT NULL CHECK (subtotal >= 0),
    descuento       NUMERIC(10,2) NOT NULL DEFAULT 0,
    impuestos       NUMERIC(10,2) NOT NULL DEFAULT 0,
    total           NUMERIC(10,2) NOT NULL CHECK (total >= 0),
    tipo_pago       tipo_pago NOT NULL DEFAULT 'efectivo',
    estado          estado_pago NOT NULL DEFAULT 'pendiente',
    fecha_pago      TIMESTAMPTZ,
    notas           TEXT,
    creado_por      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pago_cliente ON pago_factura(cliente_id);
CREATE INDEX idx_pago_estado  ON pago_factura(estado);

-- ============================================================
-- AUDITORÍA
-- ============================================================

CREATE TABLE auditoria_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    accion          tipo_auditoria NOT NULL,
    tabla_afectada  VARCHAR(100),
    registro_id     TEXT,
    datos_anteriores JSONB,
    datos_nuevos    JSONB,
    ip_address      INET,
    user_agent      TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_usuario ON auditoria_log(usuario_id);
CREATE INDEX idx_audit_accion  ON auditoria_log(accion);
CREATE INDEX idx_audit_tabla   ON auditoria_log(tabla_afectada);
CREATE INDEX idx_audit_fecha   ON auditoria_log(creado_en DESC);

-- ============================================================
-- NOTIFICACIONES
-- ============================================================

CREATE TABLE notificaciones (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    tipo            tipo_notificacion NOT NULL DEFAULT 'sistema',
    titulo          VARCHAR(200) NOT NULL,
    mensaje         TEXT NOT NULL,
    estado          estado_notificacion NOT NULL DEFAULT 'no_leida',
    referencia_id   UUID,
    referencia_tipo VARCHAR(50),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    leida_en        TIMESTAMPTZ
);

CREATE INDEX idx_notif_usuario ON notificaciones(usuario_id);
CREATE INDEX idx_notif_estado  ON notificaciones(estado);

-- ============================================================
-- FUNCIÓN: actualizar campo updated_at automáticamente
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas con actualizado_en
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['usuarios','clientes','groomers','mascotas','servicios',
                              'slot_reserva','ficha_grooming','producto','carrito_pedido','pago_factura']
    LOOP
        EXECUTE format('
            CREATE TRIGGER trg_%I_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        ', t, t);
    END LOOP;
END;
$$;

-- ============================================================
-- FUNCIÓN: Verificar stock antes de insertar pedido_detalle
-- ============================================================

CREATE OR REPLACE FUNCTION verificar_stock()
RETURNS TRIGGER AS $$
DECLARE
    stock_disponible INT;
BEGIN
    SELECT stock_actual INTO stock_disponible
    FROM producto WHERE id = NEW.producto_id;

    IF stock_disponible < NEW.cantidad THEN
        RAISE EXCEPTION 'Stock insuficiente. Disponible: %, Solicitado: %',
            stock_disponible, NEW.cantidad;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_verificar_stock
BEFORE INSERT ON pedido_detalle
FOR EACH ROW EXECUTE FUNCTION verificar_stock();

-- ============================================================
-- FUNCIÓN: Validar checklist antes de cerrar ficha
-- ============================================================

CREATE OR REPLACE FUNCTION validar_checklist_cierre()
RETURNS TRIGGER AS $$
DECLARE
    items_total INT;
    items_completos INT;
BEGIN
    IF NEW.cerrada = TRUE AND OLD.cerrada = FALSE THEN
        SELECT COUNT(*) INTO items_total FROM checklist_item WHERE ficha_id = NEW.id;
        SELECT COUNT(*) INTO items_completos FROM checklist_item WHERE ficha_id = NEW.id AND completado = TRUE;

        IF items_total = 0 THEN
            RAISE EXCEPTION 'No se puede cerrar la ficha: el checklist está vacío.';
        END IF;

        IF items_completos < items_total THEN
            RAISE EXCEPTION 'No se puede cerrar la ficha: % de % ítems del checklist pendientes.',
                (items_total - items_completos), items_total;
        END IF;

        NEW.checklist_completo = TRUE;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validar_checklist
BEFORE UPDATE ON ficha_grooming
FOR EACH ROW EXECUTE FUNCTION validar_checklist_cierre();

-- ============================================================
-- FUNCIÓN: Generar número de factura automáticamente
-- ============================================================

CREATE SEQUENCE seq_factura START 1000;

CREATE OR REPLACE FUNCTION generar_numero_factura()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.numero_factura IS NULL THEN
        NEW.numero_factura = 'FAC-' || TO_CHAR(NOW(), 'YYYY') || '-' ||
                              LPAD(nextval('seq_factura')::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_numero_factura
BEFORE INSERT ON pago_factura
FOR EACH ROW EXECUTE FUNCTION generar_numero_factura();
