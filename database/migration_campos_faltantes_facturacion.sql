-- ============================================================
-- Campos de Facturación que el frontend usaba pero no existían en la base
-- Aplicado directamente en producción (proyecto kursvmadozcqxoaeaccd) el
-- 2026-08-26. src/services/facturacion.js eliminaba estos campos del
-- payload antes de guardar ("Eliminar campos de UI que no tienen columna
-- física en la DB") porque en una sesión anterior se descubrió que no
-- existían — esto los crea, así que ya no hace falta descartarlos.
--
-- Efecto visible: subir un "Documento General / Anexo" en una factura se
-- podía adjuntar al storage, pero nunca quedaba guardado en el registro de
-- la factura (por eso no aparecía para descargar después). Lo mismo con
-- "Leyenda de la Factura" y "Fecha de Vencimiento".
-- ============================================================

ALTER TABLE apsol_private.facturacion
  ADD COLUMN IF NOT EXISTS documento_general TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS leyenda TEXT;

-- apsol_facturacion es una vista simple (`SELECT * FROM apsol_private.facturacion`,
-- sin trigger INSTEAD OF, a diferencia de apsol_prospectos). Igual hay que
-- recrearla: con SELECT *, la lista de columnas queda fija en el momento en
-- que se crea, así que agregar columnas a la tabla de abajo no alcanza para
-- que la API las exponga.
DROP VIEW IF EXISTS public.apsol_facturacion;

CREATE VIEW public.apsol_facturacion WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.facturacion;

-- Restaurar los permisos de la vista (se pierden al dropearla y recrearla).
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.apsol_facturacion TO anon, authenticated, service_role;
