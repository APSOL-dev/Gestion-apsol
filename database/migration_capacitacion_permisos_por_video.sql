-- ============================================================
-- Capacitación: permisos de visualización por VIDEO (no por tema)
-- ============================================================
-- Aplicado en producción (proyecto kursvmadozcqxoaeaccd).
--
-- Contexto: se está reconstruyendo el módulo de Capacitación importando el
-- historial del Excel de AppSheet. Se decidió que "quién puede ver esto" se
-- define por video individual (no por tema completo), y que se aplica como
-- control de acceso real vía RLS (no solo informativo).
--
-- Antes: capacitacion.destinatarios / capacitacion.visto_por eran TEXT[]
-- (nombres sueltos, sin RLS real) y videos.visto_por era TEXT[]. No existía
-- ninguna columna de "destinatarios" en videos.
--
-- Después: capacitacion pierde esas dos columnas (el permiso ya no vive ahí).
-- videos gana `destinatarios UUID[]` (quién puede ver ESE video puntual) y
-- `visto_por` pasa a ser UUID[] (usuarios reales, no texto libre), para que
-- ambas listas puedan compararse con auth.uid() en las políticas de RLS.
-- ============================================================

-- Las vistas son `SELECT *`, así que hay que dropearlas antes de tocar las
-- columnas de las que dependen (si no, Postgres no deja alterar la tabla).
DROP VIEW IF EXISTS public.apsol_capacitacion;
DROP VIEW IF EXISTS public.apsol_videos;

ALTER TABLE apsol_private.capacitacion
  DROP COLUMN IF EXISTS destinatarios,
  DROP COLUMN IF EXISTS visto_por;

ALTER TABLE apsol_private.videos
  ADD COLUMN IF NOT EXISTS destinatarios UUID[] NOT NULL DEFAULT '{}',
  DROP COLUMN IF EXISTS visto_por,
  ADD COLUMN IF NOT EXISTS visto_por UUID[] NOT NULL DEFAULT '{}';

CREATE VIEW public.apsol_capacitacion WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.capacitacion;
CREATE VIEW public.apsol_videos WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.videos;

GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.apsol_capacitacion TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.apsol_videos TO anon, authenticated, service_role;

-- ==========================================
-- Funciones de apoyo para las políticas de RLS
-- ==========================================
-- Ya existía apsol_private.es_admin(uuid) (usada por otros triggers); se
-- reutiliza en vez de duplicar la lógica de "¿es Admin?".

CREATE OR REPLACE FUNCTION apsol_private.puede_ver_tema(p_capacitacion_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT apsol_private.es_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM apsol_private.videos v
      WHERE v.capacitacion_id = p_capacitacion_id
        AND auth.uid() = ANY(v.destinatarios)
    );
$$;

-- ==========================================
-- Políticas de RLS
-- ==========================================
-- Se reemplaza la política única "Acceso total a autenticados" (FOR ALL)
-- por políticas separadas: el SELECT queda restringido por destinatarios,
-- el resto de operaciones sigue abierto a cualquier usuario logueado
-- (igual que en el resto del sistema, donde el equipo interno es de
-- confianza para crear/editar/borrar).

DROP POLICY IF EXISTS "Acceso total a autenticados" ON apsol_private.capacitacion;
DROP POLICY IF EXISTS "Acceso total a autenticados" ON apsol_private.videos;
DROP POLICY IF EXISTS "Acceso total a autenticados" ON apsol_private.comentarios;

-- VIDEOS
CREATE POLICY "Ver videos permitidos" ON apsol_private.videos
  FOR SELECT USING (
    apsol_private.es_admin(auth.uid()) OR auth.uid() = ANY(destinatarios)
  );
CREATE POLICY "Crear videos - autenticados" ON apsol_private.videos
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Editar videos - autenticados" ON apsol_private.videos
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Eliminar videos - autenticados" ON apsol_private.videos
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- CAPACITACION (temas): visible si tiene al menos un video permitido
CREATE POLICY "Ver temas permitidos" ON apsol_private.capacitacion
  FOR SELECT USING (apsol_private.puede_ver_tema(id));
CREATE POLICY "Crear temas - autenticados" ON apsol_private.capacitacion
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Editar temas - autenticados" ON apsol_private.capacitacion
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Eliminar temas - autenticados" ON apsol_private.capacitacion
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- COMENTARIOS: visibles si el tema al que pertenecen es visible
CREATE POLICY "Ver comentarios de temas permitidos" ON apsol_private.comentarios
  FOR SELECT USING (apsol_private.puede_ver_tema(capacitacion_id));
CREATE POLICY "Crear comentarios - autenticados" ON apsol_private.comentarios
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Editar comentarios - autenticados" ON apsol_private.comentarios
  FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "Eliminar comentarios - autenticados" ON apsol_private.comentarios
  FOR DELETE USING (auth.uid() IS NOT NULL);
