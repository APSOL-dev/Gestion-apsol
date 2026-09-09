-- ============================================================
-- Sprints: autor del sprint (creado_por)
-- ------------------------------------------------------------
-- Se agrega para habilitar el borrado de un sprint VACÍO (sin puntos
-- ni notas) a "el que lo creó", además de Admin/Dueño.
--
-- Nullable a propósito: los sprints creados antes de esta migración
-- quedan sin autor registrado y solo los puede eliminar un Dueño.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el 2026-09-09
-- vía MCP de Supabase, como migración `sprints_creado_por`.
-- ============================================================

ALTER TABLE public.apsol_sprints
  ADD COLUMN IF NOT EXISTS creado_por uuid
  REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_apsol_sprints_creado_por
  ON public.apsol_sprints (creado_por);
