-- ============================================================
-- Campos de "Gestión y Operaciones" del prospecto
-- Aplicado directamente en producción (proyecto kursvmadozcqxoaeaccd) el
-- 2026-08-26. Se documenta acá porque database/schema_privado_normalizado.sql
-- había quedado desactualizado: el frontend (src/pages/ProspectoDetalle.jsx)
-- ya usaba estos campos hace tiempo, pero nunca existieron en la tabla real,
-- lo que rompía el guardado de la pestaña "Gestión y Operaciones" con
-- errores PGRST204 ("column not found").
-- ============================================================

-- 1. Agregar las columnas faltantes a la tabla física.
ALTER TABLE apsol_private.prospectos
  ADD COLUMN IF NOT EXISTS base_indice_valor NUMERIC,
  ADD COLUMN IF NOT EXISTS hs_mensuales NUMERIC,
  ADD COLUMN IF NOT EXISTS mensualidad_vigente_actual NUMERIC,
  ADD COLUMN IF NOT EXISTS moneda_cobro TEXT DEFAULT 'Pesos',
  ADD COLUMN IF NOT EXISTS indice_cobro TEXT,
  ADD COLUMN IF NOT EXISTS proxima_factura DATE,
  ADD COLUMN IF NOT EXISTS ultima_actualizacion_tarifa DATE,
  ADD COLUMN IF NOT EXISTS dias_entre_reuniones INTEGER;

-- 2. Recrear la vista pública: con `SELECT p.*`, la lista de columnas queda
-- fija en el momento en que se crea/reemplaza. Agregar columnas a la tabla
-- de abajo NO alcanza para que la vista (y por lo tanto la API de
-- PostgREST) las exponga — hay que recrearla. Postgres no permite insertar
-- columnas en el medio de una vista existente vía CREATE OR REPLACE
-- (solo al final), así que se dropea y se crea de nuevo.
DROP VIEW IF EXISTS public.apsol_prospectos;

CREATE VIEW public.apsol_prospectos WITH (security_invoker = true) AS
  SELECT p.*,
         (SELECT COALESCE(array_agg(servicio), '{}'::text[])
          FROM apsol_private.prospectos_servicios ps
          WHERE ps.prospecto_id = p.id) AS servicios_requeridos
  FROM apsol_private.prospectos p;

-- 3. Recrear el trigger de escritura (se cae al dropear la vista, porque
-- los triggers pertenecen a la relación), incluyendo los campos nuevos en
-- el INSERT/UPDATE — si no, se guardarían en NULL en silencio.
CREATE OR REPLACE FUNCTION public.handle_apsol_prospectos_write()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO apsol_private.prospectos (
      id, nombre, estado, empresa_id, contacto_id, fecha_creacion, fecha_proxima_tarea,
      canal_contacto, adjuntos, presupuesto, necesidad, proxima_tarea, tarifa_base,
      frecuencia_actualizacion, inicio_servicio, proxima_actualizacion_tarifa, created_at,
      base_indice_valor, hs_mensuales, mensualidad_vigente_actual, moneda_cobro, indice_cobro,
      proxima_factura, ultima_actualizacion_tarifa, dias_entre_reuniones
    )
    VALUES (
      target_id, NEW.nombre, NEW.estado, NEW.empresa_id, NEW.contacto_id, NEW.fecha_creacion, NEW.fecha_proxima_tarea,
      NEW.canal_contacto, NEW.adjuntos, NEW.presupuesto, NEW.necesidad, NEW.proxima_tarea, NEW.tarifa_base,
      NEW.frecuencia_actualizacion, NEW.inicio_servicio, NEW.proxima_actualizacion_tarifa, COALESCE(NEW.created_at, NOW()),
      NEW.base_indice_valor, NEW.hs_mensuales, NEW.mensualidad_vigente_actual, NEW.moneda_cobro, NEW.indice_cobro,
      NEW.proxima_factura, NEW.ultima_actualizacion_tarifa, NEW.dias_entre_reuniones
    );

    IF NEW.servicios_requeridos IS NOT NULL THEN
      INSERT INTO apsol_private.prospectos_servicios (prospecto_id, servicio)
      SELECT target_id, unnest(NEW.servicios_requeridos);
    END IF;

    NEW.id := target_id;
    RETURN NEW;

  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE apsol_private.prospectos
    SET nombre = NEW.nombre, estado = NEW.estado, empresa_id = NEW.empresa_id, contacto_id = NEW.contacto_id,
        fecha_creacion = NEW.fecha_creacion, fecha_proxima_tarea = NEW.fecha_proxima_tarea, canal_contacto = NEW.canal_contacto,
        adjuntos = NEW.adjuntos, presupuesto = NEW.presupuesto, necesidad = NEW.necesidad, proxima_tarea = NEW.proxima_tarea,
        tarifa_base = NEW.tarifa_base, frecuencia_actualizacion = NEW.frecuencia_actualizacion, inicio_servicio = NEW.inicio_servicio,
        proxima_actualizacion_tarifa = NEW.proxima_actualizacion_tarifa,
        base_indice_valor = NEW.base_indice_valor, hs_mensuales = NEW.hs_mensuales,
        mensualidad_vigente_actual = NEW.mensualidad_vigente_actual, moneda_cobro = NEW.moneda_cobro,
        indice_cobro = NEW.indice_cobro, proxima_factura = NEW.proxima_factura,
        ultima_actualizacion_tarifa = NEW.ultima_actualizacion_tarifa, dias_entre_reuniones = NEW.dias_entre_reuniones
    WHERE id = OLD.id;

    IF NEW.servicios_requeridos IS NOT NULL THEN
      DELETE FROM apsol_private.prospectos_servicios WHERE prospecto_id = OLD.id;
      INSERT INTO apsol_private.prospectos_servicios (prospecto_id, servicio)
      SELECT OLD.id, unnest(NEW.servicios_requeridos);
    END IF;

    RETURN NEW;

  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM apsol_private.prospectos WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_apsol_prospectos_write
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.apsol_prospectos
FOR EACH ROW EXECUTE FUNCTION public.handle_apsol_prospectos_write();

-- 4. Restaurar los permisos de la vista (se pierden al dropearla y
-- recrearla; sin esto PostgREST vuelve a fallar, ahora con un error de
-- permisos en vez de columna faltante).
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.apsol_prospectos TO anon, authenticated, service_role;
