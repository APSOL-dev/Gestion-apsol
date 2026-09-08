-- ============================================================================
-- migration_facturacion_invoice_url.sql   (aplicada: 2026-09-08)
-- ----------------------------------------------------------------------------
-- URL pública del PDF del Invoice que la app genera y sube al Storage cuando
-- la factura es "Solo Invoice". Se persiste en la fila para que viaje al
-- webhook de facturación (notificarFacturacion manda la fila completa vía la
-- vista SELECT *) y para poder descargar EXACTAMENTE ese archivo al reabrir
-- la factura.
--
-- El campo se llama `invoice_url` a propósito: el workflow de n8n de
-- facturación ya tiene la rama del Invoice y lee `factura.invoice_url`
-- (nodos "Armar Mensaje WhatsApp1", "Invoice?1", "Invoice2") -> con este
-- nombre n8n adjunta el PDF por WhatsApp/mail sin ningún cambio en el flujo.
-- ============================================================================

ALTER TABLE apsol_private.facturacion
  ADD COLUMN IF NOT EXISTS invoice_url text;

-- Refrescar la vista para exponer la columna nueva.
-- OJO (memoria del proyecto): CREATE OR REPLACE VIEW borra silenciosamente el
-- WITH (security_invoker = true) -> hay que repetirlo SIEMPRE.
CREATE OR REPLACE VIEW public.apsol_facturacion
  WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.facturacion;
