-- ============================================================
-- Visibilidad del Cronograma para Colaboradores
-- ------------------------------------------------------------
-- Hoy la RLS de apsol_private.cronograma es "Acceso total a autenticados":
-- cualquier usuario logueado lee TODAS las filas y columnas. Un Colaborador
-- ve (y desde la API, lee crudo) la agenda completa del Admin: descripción,
-- cliente, link de reunión y comentarios.
--
-- Regla nueva (para un Colaborador):
--   - Sus actividades y las de OTROS colaboradores  -> completas.
--   - Actividades del Admin en las que PARTICIPA
--     (responsable_id propio, o está en participantes_ids) -> completas.
--   - REUNIONES del Admin en las que NO participa -> bloque "Ocupado"
--     (solo inicio/fin/responsable, sin datos). Reunión = reunion_cliente,
--     o con link de reunión, o con participantes cargados.
--   - Bloques de trabajo del Admin (no-reunión) en los que no participa
--     -> NO se devuelven.
--   Un Admin ve todo completo.
--
-- Se aplica en 2 capas:
--   1. RPC public.apsol_cronograma_visible(desde, hasta)  [SECURITY DEFINER]
--      -> el frontend lee de acá; hace la redacción server-side.
--   2. RLS de SELECT sobre la tabla -> una lectura directa de un Colaborador
--      tampoco expone filas de reuniones del Admin (esas solo salen
--      redactadas por la RPC). Las escrituras se dejan como estaban.
--
-- La lógica está espejada en src/utils/cronogramaVisibilidad.js
-- (clasificarActividadCronograma). Si cambia una, cambiar la otra.
-- ============================================================

-- 1. Participantes por actividad
ALTER TABLE apsol_private.cronograma
  ADD COLUMN IF NOT EXISTS participantes_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

CREATE OR REPLACE VIEW public.apsol_cronograma
WITH (security_invoker = true) AS
SELECT
  id, inicio, fin, duracion_horas, descripcion, responsable_id, reunion_cliente,
  link_reunion, comentarios_reunion, google_calendar_id, created_at, prospecto_id,
  multiplicador, notas_multiplicador, herramientas, participantes_ids
FROM apsol_private.cronograma;

-- 2. Helpers
CREATE OR REPLACE FUNCTION apsol_private.es_cargo_admin(p_cargo text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT p_cargo IN ('Admin', 'Dueño')
$$;

CREATE OR REPLACE FUNCTION apsol_private.colaborador_es_admin(p_colab_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = apsol_private AS $$
  SELECT EXISTS (
    SELECT 1 FROM apsol_private.colaboradores c
    JOIN apsol_private.usuarios u ON u.id = c.usuario_id
    WHERE c.id = p_colab_id AND apsol_private.es_cargo_admin(u.cargo)
  )
$$;

-- 3. RPC autoritativa: cronograma ya redactado según el rol de quien pregunta
CREATE OR REPLACE FUNCTION public.apsol_cronograma_visible(p_desde timestamptz, p_hasta timestamptz)
RETURNS SETOF public.apsol_cronograma
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = apsol_private, public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mi_colab uuid;
  v_soy_admin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT c.id INTO v_mi_colab
  FROM apsol_private.colaboradores c
  WHERE c.usuario_id = v_uid
  LIMIT 1;

  SELECT apsol_private.es_cargo_admin(u.cargo) INTO v_soy_admin
  FROM apsol_private.usuarios u WHERE u.id = v_uid;
  v_soy_admin := COALESCE(v_soy_admin, false);

  RETURN QUERY
  WITH base AS (
    SELECT
      cr.*,
      apsol_private.colaborador_es_admin(cr.responsable_id) AS resp_es_admin,
      (
        v_mi_colab IS NOT NULL AND (
          cr.responsable_id = v_mi_colab
          OR v_mi_colab = ANY (COALESCE(cr.participantes_ids, '{}'::uuid[]))
        )
      ) AS participo,
      (
        COALESCE(cr.reunion_cliente, false)
        OR COALESCE(btrim(cr.link_reunion), '') <> ''
        OR COALESCE(array_length(cr.participantes_ids, 1), 0) > 0
      ) AS es_reunion
    FROM apsol_private.cronograma cr
    WHERE cr.inicio >= p_desde AND cr.inicio <= p_hasta
  ),
  clasificada AS (
    SELECT
      base.*,
      (NOT v_soy_admin AND resp_es_admin AND NOT participo AND es_reunion)       AS redactar,
      (NOT v_soy_admin AND resp_es_admin AND NOT participo AND NOT es_reunion)   AS ocultar
    FROM base
  )
  SELECT
    id, inicio, fin,
    CASE WHEN redactar THEN NULL ELSE duracion_horas END,
    CASE WHEN redactar THEN 'Ocupado' ELSE descripcion END,
    responsable_id,
    CASE WHEN redactar THEN false ELSE reunion_cliente END,
    CASE WHEN redactar THEN NULL ELSE link_reunion END,
    CASE WHEN redactar THEN NULL ELSE comentarios_reunion END,
    CASE WHEN redactar THEN NULL ELSE google_calendar_id END,
    created_at,
    CASE WHEN redactar THEN NULL ELSE prospecto_id END,
    CASE WHEN redactar THEN NULL ELSE multiplicador END,
    CASE WHEN redactar THEN NULL ELSE notas_multiplicador END,
    CASE WHEN redactar THEN NULL ELSE herramientas END,
    CASE WHEN redactar THEN '{}'::uuid[] ELSE participantes_ids END
  FROM clasificada
  WHERE NOT ocultar
  ORDER BY inicio DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apsol_cronograma_visible(timestamptz, timestamptz)
  TO authenticated, anon, service_role;

-- 4. RLS: la lectura directa de la tabla deja de exponer las reuniones del
--    Admin a un Colaborador que no participa. (Las escrituras no se tocan.)
DROP POLICY IF EXISTS "Acceso total a autenticados" ON apsol_private.cronograma;

CREATE POLICY "cronograma_select_por_rol" ON apsol_private.cronograma
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) IS NOT NULL
    AND (
      -- Admin: todo
      apsol_private.es_cargo_admin(
        (SELECT u.cargo FROM apsol_private.usuarios u WHERE u.id = (SELECT auth.uid()))
      )
      -- responsable NO es admin -> visible para todos
      OR NOT apsol_private.colaborador_es_admin(responsable_id)
      -- soy el responsable
      OR responsable_id = (SELECT c.id FROM apsol_private.colaboradores c WHERE c.usuario_id = (SELECT auth.uid()) LIMIT 1)
      -- estoy en participantes
      OR (SELECT c.id FROM apsol_private.colaboradores c WHERE c.usuario_id = (SELECT auth.uid()) LIMIT 1)
         = ANY (COALESCE(participantes_ids, '{}'::uuid[]))
    )
  );

-- Escrituras: igual que antes (cualquier autenticado). Se dejan como 3
-- políticas por comando y NO como FOR ALL, porque una FOR ALL permisiva
-- volvería a habilitar el SELECT para todos (las permisivas se combinan con OR).
-- Escritura por rol: un Colaborador solo puede crear/editar/borrar actividades
-- donde ÉL es el responsable. El Admin, cualquiera. (Ser invitado da lectura
-- completa, NO permiso de escritura.)
CREATE OR REPLACE FUNCTION apsol_private.mi_colaborador_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = apsol_private AS $$
  SELECT c.id FROM apsol_private.colaboradores c
  WHERE c.usuario_id = (SELECT auth.uid()) LIMIT 1
$$;

CREATE OR REPLACE FUNCTION apsol_private.soy_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = apsol_private AS $$
  SELECT COALESCE(apsol_private.es_cargo_admin(
    (SELECT u.cargo FROM apsol_private.usuarios u WHERE u.id = (SELECT auth.uid()))
  ), false)
$$;

CREATE POLICY "cronograma_insert_por_rol" ON apsol_private.cronograma
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) IS NOT NULL
    AND (apsol_private.soy_admin() OR responsable_id = apsol_private.mi_colaborador_id())
  );

CREATE POLICY "cronograma_update_por_rol" ON apsol_private.cronograma
  FOR UPDATE TO authenticated
  USING (apsol_private.soy_admin() OR responsable_id = apsol_private.mi_colaborador_id())
  WITH CHECK (apsol_private.soy_admin() OR responsable_id = apsol_private.mi_colaborador_id());

CREATE POLICY "cronograma_delete_por_rol" ON apsol_private.cronograma
  FOR DELETE TO authenticated
  USING (apsol_private.soy_admin() OR responsable_id = apsol_private.mi_colaborador_id());

NOTIFY pgrst, 'reload schema';

-- NOTA: la RPC apsol_cronograma_visible se recreó después con RETURNS TABLE
-- (tipos sueltos) en vez de RETURNS SETOF public.apsol_cronograma, porque el
-- SETOF exigía typmods exactos (numeric(4,1)) que el CASE ... NULL rompía.
-- Ver migración `cronograma_visible_fix_tipos` (aplicada).
