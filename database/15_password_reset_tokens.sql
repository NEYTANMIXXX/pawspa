-- Migration: 15_password_reset_tokens.sql
-- Tabla para almacenar tokens de recuperación de contraseña.

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id  UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    expira_en   TIMESTAMPTZ NOT NULL,
    usado       BOOLEAN NOT NULL DEFAULT FALSE,
    usado_en    TIMESTAMPTZ,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_usuario_id ON public.password_reset_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- FIN de migración