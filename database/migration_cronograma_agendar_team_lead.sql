-- ============================================================
-- Cronograma: el Team Lead puede agendar para otros
-- ------------------------------------------------------------
-- Hasta ahora un Colaborador solo podía crear / editar / borrar
-- actividades del Cronograma donde ÉL era el responsable (políticas
-- cronograma_{insert,update,delete}_por_rol de migration_cronograma_visibilidad.sql).
--
-- Cambio: además del Admin, un COLABORADOR con el flag `es_team_lead`
-- (hoy: Renata) puede hacerlo para cualquier responsable. El resto de los
-- colaboradores sigue igual (solo lo suyo).
--
-- Se refleja en el front:
--   - src/utils/cronogramaVisibilidad.js  (normalizarResponsableEInvitados)
--   - src/pages/Cronograma.jsx            (selector de Responsable / Invitados)
-- ============================================================

CREATE OR REPLACE FUNCTION apsol_private.soy_team_lead()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = apsol_private AS $$
  SELECT EXISTS (
    SELECT 1 FROM apsol_private.colaboradores c
    WHERE c.usuario_id = (SELECT auth.uid()) AND c.es_team_lead = true
  )
$$;

DROP POLICY IF EXISTS "cronograma_insert_por_rol" ON apsol_private.cronograma;
CREATE POLICY "cronograma_insert_por_rol" ON apsol_private.cronograma
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      apsol_private.soy_admin()
      OR apsol_private.soy_team_lead()
      OR responsable_id = apsol_private.mi_colaborador_id()
    )
  );

DROP POLICY IF EXISTS "cronograma_update_por_rol" ON apsol_private.cronograma;
CREATE POLICY "cronograma_update_por_rol" ON apsol_private.cronograma
  FOR UPDATE TO authenticated
  USING (
    apsol_private.soy_admin()
    OR apsol_private.soy_team_lead()
    OR responsable_id = apsol_private.mi_colaborador_id()
  )
  WITH CHECK (
    apsol_private.soy_admin()
    OR apsol_private.soy_team_lead()
    OR responsable_id = apsol_private.mi_colaborador_id()
  );

DROP POLICY IF EXISTS "cronograma_delete_por_rol" ON apsol_private.cronograma;
CREATE POLICY "cronograma_delete_por_rol" ON apsol_private.cronograma
  FOR DELETE TO authenticated
  USING (
    apsol_private.soy_admin()
    OR apsol_private.soy_team_lead()
    OR responsable_id = apsol_private.mi_colaborador_id()
  );

NOTIFY pgrst, 'reload schema';
