-- Pagos: columnas "comprobante" y "cuenta_bancaria_id" (2026-09-24)
-- Aplicada en producción con apply_migration: pagos_comprobante_cuenta
--
-- La pantalla de detalle de la factura (FacturaDetalle > Agregar Pago) tiene
-- los campos "Cuenta Destino" y "Comprobante / Referencia" y los manda al
-- guardar, pero la tabla de pagos nunca tuvo esas columnas: PostgREST
-- respondía 400 (PGRST204) y el pago NO se guardaba, por lo que tampoco se
-- disparaba el webhook 'pago_recibido' (el aviso por email/WhatsApp).
--
-- Las columnas nuevas van AL FINAL de la vista (CREATE OR REPLACE VIEW no
-- permite reordenar) y se conserva security_invoker = true.

ALTER TABLE apsol_private.pagos
  ADD COLUMN IF NOT EXISTS comprobante TEXT,
  ADD COLUMN IF NOT EXISTS cuenta_bancaria_id UUID
    REFERENCES apsol_private.cuentas_bancarias(id) ON DELETE SET NULL;

CREATE OR REPLACE VIEW public.apsol_pagos WITH (security_invoker = true) AS
  SELECT id, facturacion_id, fecha, monto, observaciones, created_at,
         comprobante, cuenta_bancaria_id
  FROM apsol_private.pagos;
