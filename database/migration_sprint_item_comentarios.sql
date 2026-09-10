-- ============================================================
-- Comentarios por punto de sprint (hilo con autor + fecha)
-- ------------------------------------------------------------
-- Mismo patrón que apsol_sprint_notas (nota del sprint entero), pero a
-- nivel de cada punto. El "responsable" del punto NO va acá: ya existía
-- la columna apsol_sprint_items.responsable_id.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el 2026-09-10
-- vía MCP de Supabase, como migración `sprint_item_comentarios`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apsol_sprint_item_comentarios (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES public.apsol_sprint_items(id) ON DELETE CASCADE,
  creado_por uuid REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  texto      text NOT NULL,
  fecha      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apsol_sprint_item_comentarios_item
  ON public.apsol_sprint_item_comentarios (item_id);

ALTER TABLE public.apsol_sprint_item_comentarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados pueden gestionar sprint_item_comentarios"
  ON public.apsol_sprint_item_comentarios;
CREATE POLICY "autenticados pueden gestionar sprint_item_comentarios"
  ON public.apsol_sprint_item_comentarios FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
