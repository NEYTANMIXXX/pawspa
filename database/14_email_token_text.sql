-- Migration: 14_email_token_text.sql
-- Corrige el almacenamiento del token de verificación para evitar truncamiento.

ALTER TABLE public.email_verification_tokens
  ALTER COLUMN token TYPE TEXT;

-- FIN de migración