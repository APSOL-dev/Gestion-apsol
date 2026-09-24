-- =====================================================================
-- Keys (ex "Credenciales"): réplica mejorada de la sección "Keys" de la
-- app AppSheet vieja.
--
-- * Una sola columna por dato (la tabla tenía duplicados de dos diseños
--   distintos: nombre/sistema_plataforma, password/contrasena, etc.).
--   La tabla estaba VACÍA al aplicar esto, por eso se pueden borrar.
-- * Ámbito Propio / Cliente. Si es Cliente, la empresa es obligatoria.
-- * Criticidad Baja / Media / Alta.
-- * Lectores: colaboradores (ids de apsol_private.colaboradores) que
--   pueden VER la key. Los administradores ven y editan todas.
--   Un lector solo ve las keys ACTIVAS y no puede modificarlas.
-- * La fecha de creación no se puede pisar al editar (en AppSheet se
--   reseteaba a "hoy" al abrir el formulario).
-- * Adjuntos en un bucket PRIVADO (no en "Bucket Publico").
-- =====================================================================

DROP VIEW IF EXISTS public.apsol_credenciales;

ALTER TABLE apsol_private.credenciales
  DROP COLUMN IF EXISTS sistema_plataforma,
  DROP COLUMN IF EXISTS contrasena,
  DROP COLUMN IF EXISTS link_acceso,
  DROP COLUMN IF EXISTS tipo_acceso,
  DROP COLUMN IF EXISTS notas_adicionales;

ALTER TABLE apsol_private.credenciales
  ADD COLUMN IF NOT EXISTS criticidad text NOT NULL DEFAULT 'Media',
  ADD COLUMN IF NOT EXISTS lectores uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archivo_path text,
  ADD COLUMN IF NOT EXISTS archivo_nombre text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE apsol_private.credenciales
  ALTER COLUMN ambito SET DEFAULT 'Propio',
  ALTER COLUMN ambito SET NOT NULL,
  ALTER COLUMN tipo SET NOT NULL,
  ALTER COLUMN servicio SET NOT NULL,
  ALTER COLUMN password SET NOT NULL,
  ALTER COLUMN estado SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE apsol_private.credenciales
  ADD CONSTRAINT credenciales_nombre_no_vacio CHECK (btrim(nombre) <> ''),
  ADD CONSTRAINT credenciales_tipo_no_vacio CHECK (btrim(tipo) <> ''),
  ADD CONSTRAINT credenciales_servicio_no_vacio CHECK (btrim(servicio) <> ''),
  ADD CONSTRAINT credenciales_password_no_vacio CHECK (password <> ''),
  ADD CONSTRAINT credenciales_ambito_valido CHECK (ambito IN ('Propio', 'Cliente')),
  ADD CONSTRAINT credenciales_criticidad_valida CHECK (criticidad IN ('Baja', 'Media', 'Alta')),
  ADD CONSTRAINT credenciales_empresa_segun_ambito CHECK (
    (ambito = 'Propio' AND empresa_id IS NULL) OR
    (ambito = 'Cliente' AND empresa_id IS NOT NULL)
  );

-- Si se borra la empresa, se borran sus keys (antes quedaban huérfanas con
-- empresa NULL, lo que ahora violaría la regla de ámbito Cliente).
ALTER TABLE apsol_private.credenciales DROP CONSTRAINT IF EXISTS credenciales_empresa_id_fkey;
ALTER TABLE apsol_private.credenciales
  ADD CONSTRAINT credenciales_empresa_id_fkey FOREIGN KEY (empresa_id)
  REFERENCES apsol_private.empresas(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS credenciales_empresa_id_idx ON apsol_private.credenciales (empresa_id);
CREATE INDEX IF NOT EXISTS credenciales_lectores_idx ON apsol_private.credenciales USING gin (lectores);

-- created_at inmutable + updated_at automático
CREATE OR REPLACE FUNCTION apsol_private.credenciales_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = apsol_private AS $$
BEGIN
  NEW.created_at := OLD.created_at;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS credenciales_before_update ON apsol_private.credenciales;
CREATE TRIGGER credenciales_before_update
  BEFORE UPDATE ON apsol_private.credenciales
  FOR EACH ROW EXECUTE FUNCTION apsol_private.credenciales_before_update();

-- Nombre de la empresa para la vista: un lector (Colaborador) no puede leer
-- apsol_private.empresas por RLS, pero sí tiene que ver de qué cliente es
-- la key que le compartieron.
CREATE OR REPLACE FUNCTION apsol_private.nombre_empresa(p_empresa_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = apsol_private AS $$
  SELECT e.nombre FROM apsol_private.empresas e WHERE e.id = p_empresa_id
$$;
REVOKE ALL ON FUNCTION apsol_private.nombre_empresa(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION apsol_private.nombre_empresa(uuid) TO authenticated;

-- RLS
DROP POLICY IF EXISTS "Acceso exclusivo a Admins" ON apsol_private.credenciales;
DROP POLICY IF EXISTS keys_admin_todo ON apsol_private.credenciales;
DROP POLICY IF EXISTS keys_lector_ve ON apsol_private.credenciales;

CREATE POLICY keys_admin_todo ON apsol_private.credenciales
  FOR ALL TO authenticated
  USING (apsol_private.soy_admin())
  WITH CHECK (apsol_private.soy_admin());

CREATE POLICY keys_lector_ve ON apsol_private.credenciales
  FOR SELECT TO authenticated
  USING (estado = 'Activo' AND apsol_private.mi_colaborador_id() = ANY (lectores));

-- Vista pública (SIEMPRE con security_invoker, si no saltea el RLS)
CREATE VIEW public.apsol_credenciales WITH (security_invoker = true) AS
SELECT
  c.id, c.nombre, c.tipo, c.ambito, c.empresa_id, c.servicio, c.usuario,
  c.password, c.url, c.puerto, c.nombre_bd, c.notas, c.estado, c.criticidad,
  c.lectores, c.archivo_path, c.archivo_nombre, c.created_at, c.updated_at,
  apsol_private.nombre_empresa(c.empresa_id) AS empresa_nombre
FROM apsol_private.credenciales c;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apsol_credenciales TO authenticated;
REVOKE ALL ON public.apsol_credenciales FROM anon;

-- Bucket privado para adjuntos de keys: carpeta = id de la key
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('keys-archivos', 'keys-archivos', false, 10485760,
        ARRAY['application/pdf', 'image/png', 'image/jpeg', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS keys_archivos_ver ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_admin_insert ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_admin_update ON storage.objects;
DROP POLICY IF EXISTS keys_archivos_admin_delete ON storage.objects;

CREATE POLICY keys_archivos_ver ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'keys-archivos' AND (
      apsol_private.soy_admin() OR EXISTS (
        SELECT 1 FROM apsol_private.credenciales k
        WHERE k.id::text = (storage.foldername(name))[1]
      )
    )
  );
CREATE POLICY keys_archivos_admin_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'keys-archivos' AND apsol_private.soy_admin());
CREATE POLICY keys_archivos_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'keys-archivos' AND apsol_private.soy_admin());
CREATE POLICY keys_archivos_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'keys-archivos' AND apsol_private.soy_admin());
