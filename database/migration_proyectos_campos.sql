-- ============================================================
-- Proyectos: alinear la tabla con la UI (ProyectoDetalle)
-- ------------------------------------------------------------
-- La pantalla de Proyectos ya pedía descripción, fechas, líder y % de
-- avance, y ofrecía 5 estados (Planificación/Activo/Pausado/Completado/
-- Cancelado), pero apsol_private.proyectos solo tenía
-- id/prospecto_id/nombre/tipo/responsable_id/colaborador_id/estado, con
-- `estado` sobre el enum `estado_general` (solo 'Activo'/'Inactivo').
-- Resultado: "Error al guardar los datos" al crear cualquier proyecto.
--
-- La tabla tiene 0 filas, así que el cambio de tipo de `estado` no
-- necesita backfill.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el 2026-08-29
-- vía MCP de Supabase, como migración `proyectos_campos`.
-- ============================================================

-- 1. Columnas nuevas que la UI ya usaba
ALTER TABLE apsol_private.proyectos
  ADD COLUMN IF NOT EXISTS descripcion          text,
  ADD COLUMN IF NOT EXISTS fecha_inicio         date,
  ADD COLUMN IF NOT EXISTS fecha_fin_estimada   date,
  ADD COLUMN IF NOT EXISTS lider_colaborador_id uuid REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS porcentaje_avance    integer NOT NULL DEFAULT 0
    CHECK (porcentaje_avance BETWEEN 0 AND 100);

-- 2. `estado`: enum estado_general -> text con los estados reales del flujo
DROP VIEW IF EXISTS public.apsol_proyectos;

ALTER TABLE apsol_private.proyectos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.proyectos ALTER COLUMN estado TYPE text USING estado::text;
ALTER TABLE apsol_private.proyectos ALTER COLUMN estado SET DEFAULT 'Planificación';
ALTER TABLE apsol_private.proyectos DROP CONSTRAINT IF EXISTS proyectos_estado_check;
ALTER TABLE apsol_private.proyectos
  ADD CONSTRAINT proyectos_estado_check
  CHECK (estado IN ('Planificación', 'Activo', 'Pausado', 'Completado', 'Cancelado'));

-- 3. Recrear la vista pública con las columnas nuevas al final
CREATE VIEW public.apsol_proyectos WITH (security_invoker = true) AS
SELECT
  id, prospecto_id, nombre, tipo, responsable_id, colaborador_id, estado, created_at,
  descripcion, fecha_inicio, fecha_fin_estimada, lider_colaborador_id, porcentaje_avance
FROM apsol_private.proyectos;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apsol_proyectos TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
