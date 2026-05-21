-- Migration: 06_pagos_estado.sql
-- Ajusta el enum de pagos para usar estados de verificación de staff

ALTER TYPE estado_pago ADD VALUE IF NOT EXISTS 'no_verificado';
ALTER TYPE estado_pago ADD VALUE IF NOT EXISTS 'verificado';

-- Mantener compatibilidad con datos previos en seed o registros antiguos
UPDATE pago_factura
SET estado = 'verificado'
WHERE estado = 'pagado';
