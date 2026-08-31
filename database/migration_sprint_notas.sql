-- ============================================================
-- Sprints: notas del sprint como lista (no un solo textarea).
--
-- El campo `apsol_sprints.notas` era un único bloque de texto libre,
-- sin quién ni cuándo. El pedido real fue poder ver quién escribió
-- cada nota y cuándo -> se pasa a una tabla de notas con autor +
-- fecha, mismo patrón que `apsol_comentarios` (capacitación).
--
-- `apsol_sprints.notas` queda sin usar (no se borra la columna: solo
-- tenía una nota de prueba en producción, no hay dato real que migrar).
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apsol_sprint_notas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id  uuid NOT NULL REFERENCES public.apsol_sprints(id) ON DELETE CASCADE,
  nota       text NOT NULL,
  creado_por uuid REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  fecha      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apsol_sprint_notas_sprint
  ON public.apsol_sprint_notas (sprint_id);

ALTER TABLE public.apsol_sprint_notas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados pueden gestionar sprint_notas" ON public.apsol_sprint_notas;
CREATE POLICY "autenticados pueden gestionar sprint_notas"
  ON public.apsol_sprint_notas FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
