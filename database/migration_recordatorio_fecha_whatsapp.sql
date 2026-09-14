-- ============================================================
-- Recordatorios de pago: fecha de próximo aviso separada por canal
-- ============================================================
-- Hasta ahora `apsol_private.facturacion.proxima_notificacion` era una
-- sola fecha compartida por email y WhatsApp: se mandaban los dos avisos
-- juntos en la misma corrida de n8n.
--
-- Adrian pidió poder mandarlos en días distintos: WhatsApp es más
-- invasivo, así que sale un tiempo después del email (no el mismo día).
-- La cadencia de cada empresa sigue viviendo en un solo lugar
-- (`apsol_private.empresas.dias_espera_facturacion`, ya existente,
-- pantalla "Días espera facturación"):
--   - próxima notificación EMAIL    = hoy + dias_espera_facturacion días hábiles
--   - próxima notificación WHATSAPP = hoy + (dias_espera_facturacion + 2) días hábiles
--
-- `proxima_notificacion` (ya existente) queda siendo la fecha de EMAIL,
-- sin tocarla, para no romper las pantallas que ya la leen
-- (FacturaDetalle.jsx, FacturacionDrawer.jsx, Facturacion.jsx). Se agrega
-- `proxima_notificacion_whatsapp` para el otro canal.
--
-- El flujo de n8n (snippet-envio-archivos-texto-email.json) es quien
-- calcula y pisa ambas fechas tras cada envío, con
-- apsol_sumar_dias_habiles(fecha, n) (ya existente, ver
-- migration_recordatorios_pago.sql):
--   UPDATE apsol_private.facturacion
--   SET proxima_notificacion = apsol_sumar_dias_habiles(CURRENT_DATE, :dias_espera_facturacion)
--   WHERE id = :factura_id;                      -- solo si se mandó el email
--
--   UPDATE apsol_private.facturacion
--   SET proxima_notificacion_whatsapp = apsol_sumar_dias_habiles(CURRENT_DATE, :dias_espera_facturacion + 2)
--   WHERE id = :factura_id;                      -- solo si se mandó el whatsapp
--
-- APLICADA en producción (proyecto kursvmadozcqxoaeaccd) el 2026-09-14
-- vía MCP de Supabase, como migración `recordatorio_pago_fecha_whatsapp`.
-- ============================================================

ALTER TABLE apsol_private.facturacion
  ADD COLUMN IF NOT EXISTS proxima_notificacion_whatsapp date;

-- Backfill: arranca en la misma fecha que la de email; desde el próximo
-- envío de cada canal, cada una recalcula la suya por separado.
UPDATE apsol_private.facturacion
SET proxima_notificacion_whatsapp = proxima_notificacion
WHERE estado <> 'Cobrada total'
  AND proxima_notificacion_whatsapp IS NULL;
