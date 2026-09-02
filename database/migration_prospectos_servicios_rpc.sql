-- ============================================================
-- RPC public.set_prospecto_servicios(prospecto_id, servicios[])
-- Aplicada a Supabase como migración `rpc_set_prospecto_servicios`.
-- ------------------------------------------------------------
-- public.apsol_prospectos es una VISTA sobre apsol_private.prospectos.
-- La columna servicios_requeridos de la vista es una subconsulta
-- (array_agg contra apsol_private.prospectos_servicios), NO es escribible:
-- mandarla en un INSERT/UPDATE a la vista hace que Postgres rechace TODO
-- el statement con "0A000: cannot update column servicios_requeridos of
-- view apsol_prospectos" (se veía como 400 al guardar el form completo de
-- un prospecto en ProspectoDetalle.jsx).
--
-- Los servicios del prospecto se persisten por este RPC, que hace un
-- reemplazo total ("borrar los de ese prospecto + insertar los nuevos")
-- sobre la tabla junta apsol_private.prospectos_servicios
-- (PK compuesta (prospecto_id, servicio)).
--
-- Cliente: src/services/prospectos.js -> guardarServiciosProspecto()
--          (normaliza: recorta, saca vacíos y duplicados).
--
-- Autorización: mismo criterio que la RLS "Acceso exclusivo a Admins" de
-- apsol_private.prospectos (el form completo del prospecto es solo de Admins).
-- El RPC es SECURITY DEFINER, así que el chequeo va explícito adentro.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_prospecto_servicios(
  p_prospecto_id uuid,
  p_servicios text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = apsol_private, public
AS $$
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'No autenticado' USING errcode = '28000';
  END IF;

  IF NOT apsol_private.es_admin((SELECT auth.uid())) THEN
    RAISE EXCEPTION 'No autorizado para editar los servicios del prospecto' USING errcode = '42501';
  END IF;

  IF p_prospecto_id IS NULL THEN
    RAISE EXCEPTION 'prospecto_id requerido' USING errcode = '22004';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM apsol_private.prospectos WHERE id = p_prospecto_id) THEN
    RAISE EXCEPTION 'El prospecto % no existe', p_prospecto_id USING errcode = '23503';
  END IF;

  -- Reemplazo total.
  DELETE FROM apsol_private.prospectos_servicios WHERE prospecto_id = p_prospecto_id;

  INSERT INTO apsol_private.prospectos_servicios (prospecto_id, servicio)
  SELECT p_prospecto_id, t.s
  FROM (
    SELECT DISTINCT btrim(x) AS s
    FROM unnest(COALESCE(p_servicios, ARRAY[]::text[])) AS x
    WHERE btrim(COALESCE(x, '')) <> ''
  ) t;
END;
$$;

REVOKE ALL ON FUNCTION public.set_prospecto_servicios(uuid, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_prospecto_servicios(uuid, text[]) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
