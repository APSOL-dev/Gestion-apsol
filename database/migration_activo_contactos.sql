-- La app (crearContactoRapido en ProspectoDetalle.jsx, y el toggle de
-- activar/desactivar de ContactoDrawer.jsx) ya asume que apsol_contactos
-- tiene una columna `activo` - pero nunca se creó. Eso rompía la creación
-- de contactos nuevos (insert con un campo inexistente -> error 400) y
-- dejaba sin funcionar el activar/desactivar.

ALTER TABLE apsol_private.contactos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT true;

-- La vista pública expone columnas explícitas (no SELECT *), hay que
-- agregarla ahí también para que el cliente (PostgREST) la vea. Va al
-- final del SELECT a propósito: CREATE OR REPLACE VIEW no permite
-- reordenar/insertar columnas en el medio, solo agregar al final.
CREATE OR REPLACE VIEW public.apsol_contactos AS
SELECT id, empresa_id, nombre, apellido, telefono, email, cargo, area, created_at, activo
FROM apsol_private.contactos;
