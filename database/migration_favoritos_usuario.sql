-- ============================================================
-- Favoritos del sidebar (pins) por usuario
--
-- Antes vivían solo en localStorage del navegador (clave 'apsol_favorites'),
-- por eso no persistían entre navegadores/dispositivos y además se
-- compartían/pisaban entre distintos usuarios que usaran el mismo
-- navegador. Se guardan ahora en apsol_usuarios.favoritos, por cuenta.
--
-- La política "Permitir modificar su propio perfil" en apsol_private.usuarios
-- (id = auth.uid() OR admin) ya permite que cada usuario actualice esta
-- columna en su propia fila.
-- ============================================================

ALTER TABLE apsol_private.usuarios
  ADD COLUMN IF NOT EXISTS favoritos JSONB NOT NULL DEFAULT '[]'::jsonb;

-- apsol_usuarios es una vista simple (SELECT * FROM apsol_private.usuarios).
-- Con SELECT *, la lista de columnas queda fija en el momento en que se
-- crea la vista, así que agregar la columna a la tabla de abajo no alcanza
-- para que la API la exponga: hay que recrearla.
DROP VIEW IF EXISTS public.apsol_usuarios;

CREATE VIEW public.apsol_usuarios WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.usuarios;

-- Restaurar los permisos de la vista (se pierden al dropearla y recrearla).
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.apsol_usuarios TO anon, authenticated, service_role;
