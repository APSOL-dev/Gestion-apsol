-- Ejecutar una sola vez en el SQL Editor de Supabase (proyecto kursvmadozcqxoaeaccd).
-- Soporte para la importación del "Cronograma Local" (Excel histórico):
--   1) Permite colaboradores sin cuenta de login real (ex-empleados / recursos internos),
--      agregando un nombre manual que se usa como fallback cuando no hay usuario_id.
--   2) Agrega el multiplicador de horas facturables y su nota, usados manualmente
--      en el cronograma histórico para ajustar horas de facturación.

ALTER TABLE apsol_private.colaboradores
  ADD COLUMN IF NOT EXISTS nombre_manual TEXT,
  ADD COLUMN IF NOT EXISTS apellido_manual TEXT;

ALTER TABLE apsol_private.cronograma
  ADD COLUMN IF NOT EXISTS multiplicador NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS notas_multiplicador TEXT;

-- Recrear las vistas públicas para que expongan las columnas nuevas.
-- Se usa DROP + CREATE (no CREATE OR REPLACE) porque la vista de colaboradores
-- quedó con una columna "fantasma" (prospectos_asignados) de una migración vieja
-- que ya no existe en la tabla real, y Postgres no permite reemplazar una vista
-- cambiando el nombre de una columna por posición.
DROP VIEW IF EXISTS public.apsol_colaboradores;
CREATE VIEW public.apsol_colaboradores WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.colaboradores;
GRANT ALL ON public.apsol_colaboradores TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.apsol_cronograma;
CREATE VIEW public.apsol_cronograma WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.cronograma;
GRANT ALL ON public.apsol_cronograma TO anon, authenticated, service_role;
