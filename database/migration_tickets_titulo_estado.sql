-- ============================================================
-- Tickets: agregar `titulo` y `estado` (el módulo estaba roto)
-- ------------------------------------------------------------
-- El formulario de tickets (src/pages/TicketDetalle.jsx) manda `titulo`,
-- `estado` y `colaborador_id`, y ninguno existía: `apsol_private.tickets`
-- tiene `responsable_id` (no `colaborador_id`) y no tenía título ni estado.
-- Resultado: crear/editar un ticket siempre fallaba
-- ("Could not find the 'colaborador_id' column of 'apsol_tickets'").
--
-- Acá se agregan las dos columnas que faltan. El renombre
-- colaborador_id -> responsable_id se hace en el front (usa el nombre real
-- de la columna).
-- ============================================================

ALTER TABLE apsol_private.tickets
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'Abierto';

-- La vista se recrea agregando las columnas AL FINAL (CREATE OR REPLACE
-- VIEW no permite intercalarlas). Lleva security_invoker = true: sin eso
-- las RLS se evaluarían como el owner de la vista, no como quien consulta.
CREATE OR REPLACE VIEW public.apsol_tickets
WITH (security_invoker = true) AS
SELECT id, proyecto_id, preventivo_id, tipo_ticket, prioridad, descripcion,
       tipo_problema, responsable_id, fecha_creacion, fecha_resolucion,
       recordatorio, fecha_recordatorio, created_at,
       titulo, estado
FROM apsol_private.tickets;

NOTIFY pgrst, 'reload schema';
