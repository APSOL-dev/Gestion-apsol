-- =====================================================================
-- Keys: los colaboradores también pueden dar de alta claves (p. ej. al
-- crear una aplicación, para no tener que pedírselas después).
--
-- Reglas (se aplican en la base, aunque alguien llame a la API directo):
-- * Cualquier colaborador con ficha puede CREAR una key. Queda como
--   "creado_por" y como lector (así la sigue viendo).
-- * El creador puede EDITAR sus propias keys (y verlas aunque estén
--   inactivas), pero no puede cambiar los lectores ni el creador.
-- * Borrar y elegir lectores sigue siendo solo de administradores.
-- * Cuando un colaborador carga una key, se avisa a los administradores
--   por la campanita.
-- =====================================================================

ALTER TABLE apsol_private.credenciales
  ADD COLUMN IF NOT EXISTS creado_por uuid REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS credenciales_creado_por_idx ON apsol_private.credenciales (creado_por);

CREATE OR REPLACE FUNCTION apsol_private.credenciales_reglas_por_rol()
RETURNS trigger LANGUAGE plpgsql SET search_path = apsol_private AS $$
DECLARE
  v_yo uuid := apsol_private.mi_colaborador_id();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.creado_por := COALESCE(NEW.creado_por, v_yo);
    IF NOT apsol_private.soy_admin() THEN
      NEW.creado_por := v_yo;
      NEW.lectores := CASE WHEN v_yo IS NULL THEN '{}'::uuid[] ELSE ARRAY[v_yo] END;
    END IF;
  ELSE
    NEW.creado_por := OLD.creado_por;            -- nadie cambia quién la cargó
    IF NOT apsol_private.soy_admin() THEN
      NEW.lectores := OLD.lectores;              -- compartir es cosa de admins
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credenciales_reglas_por_rol ON apsol_private.credenciales;
CREATE TRIGGER credenciales_reglas_por_rol
  BEFORE INSERT OR UPDATE ON apsol_private.credenciales
  FOR EACH ROW EXECUTE FUNCTION apsol_private.credenciales_reglas_por_rol();

DROP POLICY IF EXISTS keys_colab_crea ON apsol_private.credenciales;
DROP POLICY IF EXISTS keys_creador_ve ON apsol_private.credenciales;
DROP POLICY IF EXISTS keys_creador_edita ON apsol_private.credenciales;

CREATE POLICY keys_colab_crea ON apsol_private.credenciales
  FOR INSERT TO authenticated
  WITH CHECK (creado_por IS NOT NULL AND creado_por = apsol_private.mi_colaborador_id());

CREATE POLICY keys_creador_ve ON apsol_private.credenciales
  FOR SELECT TO authenticated
  USING (creado_por = apsol_private.mi_colaborador_id());

CREATE POLICY keys_creador_edita ON apsol_private.credenciales
  FOR UPDATE TO authenticated
  USING (creado_por = apsol_private.mi_colaborador_id())
  WITH CHECK (creado_por = apsol_private.mi_colaborador_id());

-- Aviso a los administradores cuando un colaborador carga una key
CREATE OR REPLACE FUNCTION apsol_private.credenciales_avisar_alta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = apsol_private, public AS $$
DECLARE
  v_admin record;
  v_quien text;
BEGIN
  IF apsol_private.soy_admin() THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(btrim(COALESCE(u.nombre, c.nombre_manual, '') || ' ' || COALESCE(u.apellido, c.apellido_manual, '')), ''), 'Un colaborador')
    INTO v_quien
    FROM apsol_private.colaboradores c
    LEFT JOIN apsol_private.usuarios u ON u.id = c.usuario_id
   WHERE c.id = NEW.creado_por;
  FOR v_admin IN SELECT id FROM apsol_private.usuarios WHERE apsol_private.es_cargo_admin(cargo) LOOP
    PERFORM public.apsol_crear_notificacion(
      v_admin.id, 'key_nueva',
      left(COALESCE(v_quien, 'Un colaborador') || ' cargó la key: ' || NEW.nombre, 120),
      'key', NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION apsol_private.credenciales_avisar_alta() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS credenciales_avisar_alta ON apsol_private.credenciales;
CREATE TRIGGER credenciales_avisar_alta
  AFTER INSERT ON apsol_private.credenciales
  FOR EACH ROW EXECUTE FUNCTION apsol_private.credenciales_avisar_alta();

-- Lista mínima de empresas (id + nombre) para el selector de la key: los
-- colaboradores no pueden leer apsol_private.empresas por RLS.
CREATE OR REPLACE FUNCTION public.apsol_empresas_nombres()
RETURNS TABLE (id uuid, nombre text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = apsol_private AS $$
  SELECT e.id, e.nombre FROM apsol_private.empresas e
  WHERE (SELECT auth.uid()) IS NOT NULL
  ORDER BY e.nombre
$$;
REVOKE ALL ON FUNCTION public.apsol_empresas_nombres() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.apsol_empresas_nombres() TO authenticated;

-- Vista: se suma creado_por
DROP VIEW IF EXISTS public.apsol_credenciales;
CREATE VIEW public.apsol_credenciales WITH (security_invoker = true) AS
SELECT
  c.id, c.nombre, c.tipo, c.ambito, c.empresa_id, c.servicio, c.usuario,
  c.password, c.url, c.puerto, c.nombre_bd, c.notas, c.estado, c.criticidad,
  c.lectores, c.archivo_path, c.archivo_nombre, c.created_at, c.updated_at,
  c.creado_por,
  apsol_private.nombre_empresa(c.empresa_id) AS empresa_nombre
FROM apsol_private.credenciales c;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.apsol_credenciales TO authenticated;
REVOKE ALL ON public.apsol_credenciales FROM anon;

-- Adjuntos: el creador también puede subir / reemplazar / quitar el de SU key
DROP POLICY IF EXISTS keys_archivos_admin_insert ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_admin_update ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_admin_delete ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_escribir ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_actualizar ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_borrar ON storage.objects;

CREATE POLICY keys_archivos_escribir ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'keys-archivos' AND (
    apsol_private.soy_admin() OR EXISTS (
      SELECT 1 FROM apsol_private.credenciales k
      WHERE k.id::text = (storage.foldername(name))[1]
        AND k.creado_por = apsol_private.mi_colaborador_id())));
CREATE POLICY keys_archivos_actualizar ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'keys-archivos' AND (
    apsol_private.soy_admin() OR EXISTS (
      SELECT 1 FROM apsol_private.credenciales k
      WHERE k.id::text = (storage.foldername(name))[1]
        AND k.creado_por = apsol_private.mi_colaborador_id())));
CREATE POLICY keys_archivos_borrar ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'keys-archivos' AND (
    apsol_private.soy_admin() OR EXISTS (
      SELECT 1 FROM apsol_private.credenciales k
      WHERE k.id::text = (storage.foldername(name))[1]
        AND k.creado_por = apsol_private.mi_colaborador_id())));
