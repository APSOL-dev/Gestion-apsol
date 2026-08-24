-- ============================================================
-- APSOL — Saneamiento y Normalización de Base de Datos
-- ============================================================

-- 1. Eliminar vistas existentes para evitar bloqueos por dependencias de tipos
DROP VIEW IF EXISTS public.apsol_cronograma CASCADE;
DROP VIEW IF EXISTS public.apsol_credenciales CASCADE;
DROP VIEW IF EXISTS public.apsol_usuarios CASCADE;
DROP VIEW IF EXISTS public.apsol_empresas CASCADE;
DROP VIEW IF EXISTS public.apsol_razones_sociales CASCADE;
DROP VIEW IF EXISTS public.apsol_contactos CASCADE;
DROP VIEW IF EXISTS public.apsol_prospectos CASCADE;
DROP VIEW IF EXISTS public.apsol_observaciones CASCADE;
DROP VIEW IF EXISTS public.apsol_cadena_emails CASCADE;
DROP VIEW IF EXISTS public.apsol_valores_uva CASCADE;
DROP VIEW IF EXISTS public.apsol_facturacion CASCADE;
DROP VIEW IF EXISTS public.apsol_pagos CASCADE;
DROP VIEW IF EXISTS public.apsol_cuentas_bancarias CASCADE;
DROP VIEW IF EXISTS public.apsol_colaboradores CASCADE;
DROP VIEW IF EXISTS public.apsol_contratos CASCADE;
DROP VIEW IF EXISTS public.apsol_facturas_colaboradores CASCADE;
DROP VIEW IF EXISTS public.apsol_proyectos CASCADE;
DROP VIEW IF EXISTS public.apsol_preventivos CASCADE;
DROP VIEW IF EXISTS public.apsol_tickets CASCADE;
DROP VIEW IF EXISTS public.apsol_capacitacion CASCADE;
DROP VIEW IF EXISTS public.apsol_videos CASCADE;
DROP VIEW IF EXISTS public.apsol_comentarios CASCADE;

-- 2. Crear tipos ENUM para restringir estados válidos
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_prospecto' AND typnamespace = 'apsol_private'::regnamespace) THEN
    CREATE TYPE apsol_private.estado_prospecto AS ENUM ('Nuevo', 'Contactado', 'Propuesta', 'Negociación', 'Ganado', 'Perdido');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_factura' AND typnamespace = 'apsol_private'::regnamespace) THEN
    CREATE TYPE apsol_private.estado_factura AS ENUM ('Pendiente', 'Enviada', 'Cobrada parcial', 'Cobrada total');
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_general' AND typnamespace = 'apsol_private'::regnamespace) THEN
    CREATE TYPE apsol_private.estado_general AS ENUM ('Activo', 'Inactivo');
  END IF;
END $$;

-- 3. Crear las tablas relacionales intermedias (reemplazando arrays TEXT[])
CREATE TABLE IF NOT EXISTS apsol_private.prospectos_servicios (
  prospecto_id UUID REFERENCES apsol_private.prospectos(id) ON DELETE CASCADE,
  servicio TEXT NOT NULL,
  PRIMARY KEY (prospecto_id, servicio)
);

CREATE TABLE IF NOT EXISTS apsol_private.colaboradores_prospectos (
  colaborador_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE CASCADE,
  prospecto_id UUID REFERENCES apsol_private.prospectos(id) ON DELETE CASCADE,
  PRIMARY KEY (colaborador_id, prospecto_id)
);

CREATE TABLE IF NOT EXISTS apsol_private.capacitacion_vistas (
  capacitacion_id UUID REFERENCES apsol_private.capacitacion(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES apsol_private.usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (capacitacion_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS apsol_private.videos_vistas (
  video_id UUID REFERENCES apsol_private.videos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES apsol_private.usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (video_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS apsol_private.cronograma_herramientas (
  cronograma_id UUID REFERENCES apsol_private.cronograma(id) ON DELETE CASCADE,
  herramienta TEXT NOT NULL,
  PRIMARY KEY (cronograma_id, herramienta)
);

-- 4. Modificar tablas físicas para eliminar las columnas array y agregar FKs reales

-- Prospectos
ALTER TABLE apsol_private.prospectos DROP COLUMN IF EXISTS servicios_requeridos;

ALTER TABLE apsol_private.prospectos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.prospectos ALTER COLUMN estado TYPE apsol_private.estado_prospecto USING estado::apsol_private.estado_prospecto;
ALTER TABLE apsol_private.prospectos ALTER COLUMN estado SET DEFAULT 'Nuevo'::apsol_private.estado_prospecto;

-- Colaboradores
ALTER TABLE apsol_private.colaboradores DROP COLUMN IF EXISTS prospectos_asignados;

ALTER TABLE apsol_private.colaboradores ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.colaboradores ALTER COLUMN estado TYPE apsol_private.estado_general USING estado::apsol_private.estado_general;
ALTER TABLE apsol_private.colaboradores ALTER COLUMN estado SET DEFAULT 'Activo'::apsol_private.estado_general;

-- Capacitacion
ALTER TABLE apsol_private.capacitacion DROP COLUMN IF EXISTS visto_por;

-- Videos
ALTER TABLE apsol_private.videos DROP COLUMN IF EXISTS visto_por;

-- Facturacion
ALTER TABLE apsol_private.facturacion ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.facturacion ALTER COLUMN estado TYPE apsol_private.estado_factura USING estado::apsol_private.estado_factura;
ALTER TABLE apsol_private.facturacion ALTER COLUMN estado SET DEFAULT 'Pendiente'::apsol_private.estado_factura;

-- Contratos
ALTER TABLE apsol_private.contratos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.contratos ALTER COLUMN estado TYPE apsol_private.estado_general USING estado::apsol_private.estado_general;
ALTER TABLE apsol_private.contratos ALTER COLUMN estado SET DEFAULT 'Activo'::apsol_private.estado_general;

-- Proyectos
ALTER TABLE apsol_private.proyectos ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.proyectos ALTER COLUMN estado TYPE apsol_private.estado_general USING estado::apsol_private.estado_general;
ALTER TABLE apsol_private.proyectos ALTER COLUMN estado SET DEFAULT 'Activo'::apsol_private.estado_general;

-- Credenciales
ALTER TABLE apsol_private.credenciales ALTER COLUMN estado DROP DEFAULT;
ALTER TABLE apsol_private.credenciales ALTER COLUMN estado TYPE apsol_private.estado_general USING estado::apsol_private.estado_general;
ALTER TABLE apsol_private.credenciales ALTER COLUMN estado SET DEFAULT 'Activo'::apsol_private.estado_general;

-- Cronograma
ALTER TABLE apsol_private.cronograma DROP COLUMN IF EXISTS herramientas;
ALTER TABLE apsol_private.cronograma DROP COLUMN IF EXISTS prospecto_nombre;
-- Añadir columna de llave foránea a prospecto
ALTER TABLE apsol_private.cronograma ADD COLUMN IF NOT EXISTS prospecto_id UUID REFERENCES apsol_private.prospectos(id) ON DELETE SET NULL;


-- 5. Crear índices en todas las llaves foráneas para optimizar búsquedas
CREATE INDEX IF NOT EXISTS idx_razones_sociales_empresa_id ON apsol_private.razones_sociales(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contactos_empresa_id ON apsol_private.contactos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_empresa_id ON apsol_private.prospectos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_contacto_id ON apsol_private.prospectos(contacto_id);
CREATE INDEX IF NOT EXISTS idx_observaciones_prospecto_id ON apsol_private.observaciones(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_observaciones_creado_por ON apsol_private.observaciones(creado_por);
CREATE INDEX IF NOT EXISTS idx_facturacion_prospecto_id ON apsol_private.facturacion(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_facturacion_contacto_cobro_id ON apsol_private.facturacion(contacto_cobro_id);
CREATE INDEX IF NOT EXISTS idx_facturacion_contacto_cobro2_id ON apsol_private.facturacion(contacto_cobro2_id);
CREATE INDEX IF NOT EXISTS idx_pagos_facturacion_id ON apsol_private.pagos(facturacion_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_usuario_id ON apsol_private.colaboradores(usuario_id);
CREATE INDEX IF NOT EXISTS idx_contratos_colaborador_id ON apsol_private.contratos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_facturas_colaboradores_colaborador_id ON apsol_private.facturas_colaboradores(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_prospecto_id ON apsol_private.proyectos(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_responsable_id ON apsol_private.proyectos(responsable_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_colaborador_id ON apsol_private.proyectos(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_preventivos_proyecto_id ON apsol_private.preventivos(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_preventivos_responsable_id ON apsol_private.preventivos(responsable_id);
CREATE INDEX IF NOT EXISTS idx_tickets_proyecto_id ON apsol_private.tickets(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tickets_preventivo_id ON apsol_private.tickets(preventivo_id);
CREATE INDEX IF NOT EXISTS idx_tickets_responsable_id ON apsol_private.tickets(responsable_id);
CREATE INDEX IF NOT EXISTS idx_capacitacion_creado_por ON apsol_private.capacitacion(creado_por);
CREATE INDEX IF NOT EXISTS idx_videos_capacitacion_id ON apsol_private.videos(capacitacion_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_capacitacion_id ON apsol_private.comentarios(capacitacion_id);
CREATE INDEX IF NOT EXISTS idx_comentarios_creado_por ON apsol_private.comentarios(creado_por);
CREATE INDEX IF NOT EXISTS idx_cronograma_responsable_id ON apsol_private.cronograma(responsable_id);
CREATE INDEX IF NOT EXISTS idx_cronograma_prospecto_id ON apsol_private.cronograma(prospecto_id);
CREATE INDEX IF NOT EXISTS idx_credenciales_empresa_id ON apsol_private.credenciales(empresa_id);


-- ==========================================
-- RE-CREACIÓN DE VISTAS PÚBLICAS CON AGREGADOS (LECTURA COMPATIBLE)
-- ==========================================

CREATE OR REPLACE VIEW public.apsol_usuarios WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.usuarios;

CREATE OR REPLACE VIEW public.apsol_empresas WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.empresas;

CREATE OR REPLACE VIEW public.apsol_razones_sociales WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.razones_sociales;

CREATE OR REPLACE VIEW public.apsol_contactos WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.contactos;

CREATE OR REPLACE VIEW public.apsol_observaciones WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.observaciones;

CREATE OR REPLACE VIEW public.apsol_cadena_emails WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.cadena_emails;

CREATE OR REPLACE VIEW public.apsol_valores_uva WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.valores_uva;

CREATE OR REPLACE VIEW public.apsol_facturacion WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.facturacion;

CREATE OR REPLACE VIEW public.apsol_pagos WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.pagos;

CREATE OR REPLACE VIEW public.apsol_cuentas_bancarias WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.cuentas_bancarias;

CREATE OR REPLACE VIEW public.apsol_contratos WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.contratos;

CREATE OR REPLACE VIEW public.apsol_facturas_colaboradores WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.facturas_colaboradores;

CREATE OR REPLACE VIEW public.apsol_proyectos WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.proyectos;

CREATE OR REPLACE VIEW public.apsol_preventivos WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.preventivos;

CREATE OR REPLACE VIEW public.apsol_tickets WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.tickets;

CREATE OR REPLACE VIEW public.apsol_comentarios WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.comentarios;

CREATE OR REPLACE VIEW public.apsol_credenciales WITH (security_invoker = true) AS 
  SELECT * FROM apsol_private.credenciales;

-- Vistas que reconstruyen los arrays de la base de datos física:

-- Prospectos (agrega servicios)
CREATE OR REPLACE VIEW public.apsol_prospectos WITH (security_invoker = true) AS 
  SELECT p.*,
         (SELECT COALESCE(array_agg(servicio), '{}'::text[]) 
          FROM apsol_private.prospectos_servicios ps 
          WHERE ps.prospecto_id = p.id) AS servicios_requeridos
  FROM apsol_private.prospectos p;

-- Colaboradores (agrega prospectos asignados)
CREATE OR REPLACE VIEW public.apsol_colaboradores WITH (security_invoker = true) AS 
  SELECT c.*,
         (SELECT COALESCE(array_agg(prospecto_id::text), '{}'::text[]) 
          FROM apsol_private.colaboradores_prospectos cp 
          WHERE cp.colaborador_id = c.id) AS prospectos_asignados
  FROM apsol_private.colaboradores c;

-- Capacitacion (agrega usuarios que vieron el material)
CREATE OR REPLACE VIEW public.apsol_capacitacion WITH (security_invoker = true) AS 
  SELECT ca.*,
         (SELECT COALESCE(array_agg(usuario_id::text), '{}'::text[]) 
          FROM apsol_private.capacitacion_vistas cv 
          WHERE cv.capacitacion_id = ca.id) AS visto_por
  FROM apsol_private.capacitacion ca;

-- Videos (agrega usuarios que vieron el video)
CREATE OR REPLACE VIEW public.apsol_videos WITH (security_invoker = true) AS 
  SELECT v.*,
         (SELECT COALESCE(array_agg(usuario_id::text), '{}'::text[]) 
          FROM apsol_private.videos_vistas vv 
          WHERE vv.video_id = v.id) AS visto_por
  FROM apsol_private.videos v;

-- Cronograma (agrega herramientas y resuelve el nombre del prospecto)
CREATE OR REPLACE VIEW public.apsol_cronograma WITH (security_invoker = true) AS 
  SELECT cr.*,
         p.nombre AS prospecto_nombre,
         (SELECT COALESCE(array_agg(herramienta), '{}'::text[]) 
          FROM apsol_private.cronograma_herramientas ch 
          WHERE ch.cronograma_id = cr.id) AS herramientas
  FROM apsol_private.cronograma cr
  LEFT JOIN apsol_private.prospectos p ON p.id = cr.prospecto_id;


-- ==========================================
-- DISPARADORES INSTEAD OF (ESCRITURA COMPATIBLE)
-- ==========================================

-- Trigger para PROSPECTOS
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
      frecuencia_actualizacion, inicio_servicio, proxima_actualizacion_tarifa, created_at
    )
    VALUES (
      target_id, NEW.nombre, NEW.estado::apsol_private.estado_prospecto, NEW.empresa_id, NEW.contacto_id, NEW.fecha_creacion, NEW.fecha_proxima_tarea,
      NEW.canal_contacto, NEW.adjuntos, NEW.presupuesto, NEW.necesidad, NEW.proxima_tarea, NEW.tarifa_base,
      NEW.frecuencia_actualizacion, NEW.inicio_servicio, NEW.proxima_actualizacion_tarifa, COALESCE(NEW.created_at, NOW())
    );
    
    IF NEW.servicios_requeridos IS NOT NULL THEN
      INSERT INTO apsol_private.prospectos_servicios (prospecto_id, servicio)
      SELECT target_id, unnest(NEW.servicios_requeridos);
    END IF;
    
    NEW.id := target_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE apsol_private.prospectos
    SET nombre = NEW.nombre, estado = NEW.estado::apsol_private.estado_prospecto, empresa_id = NEW.empresa_id, contacto_id = NEW.contacto_id,
        fecha_creacion = NEW.fecha_creacion, fecha_proxima_tarea = NEW.fecha_proxima_tarea, canal_contacto = NEW.canal_contacto,
        adjuntos = NEW.adjuntos, presupuesto = NEW.presupuesto, necesidad = NEW.necesidad, proxima_tarea = NEW.proxima_tarea,
        tarifa_base = NEW.tarifa_base, frecuencia_actualizacion = NEW.frecuencia_actualizacion, inicio_servicio = NEW.inicio_servicio,
        proxima_actualizacion_tarifa = NEW.proxima_actualizacion_tarifa
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


-- Trigger para COLABORADORES
CREATE OR REPLACE FUNCTION public.handle_apsol_colaboradores_write()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO apsol_private.colaboradores (
      id, usuario_id, puesto, fecha_inicio, frecuencia_pago, proxima_fecha_pago,
      renovacion_contrato, estado, whatsapp, created_at
    )
    VALUES (
      target_id, NEW.usuario_id, NEW.puesto, NEW.fecha_inicio, NEW.frecuencia_pago, NEW.proxima_fecha_pago,
      NEW.renovacion_contrato, NEW.estado::apsol_private.estado_general, NEW.whatsapp, COALESCE(NEW.created_at, NOW())
    );
    
    IF NEW.prospectos_asignados IS NOT NULL THEN
      INSERT INTO apsol_private.colaboradores_prospectos (colaborador_id, prospecto_id)
      SELECT target_id, unnest(NEW.prospectos_asignados)::UUID;
    END IF;
    
    NEW.id := target_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE apsol_private.colaboradores
    SET usuario_id = NEW.usuario_id, puesto = NEW.puesto, fecha_inicio = NEW.fecha_inicio, 
        frecuencia_pago = NEW.frecuencia_pago, proxima_fecha_pago = NEW.proxima_fecha_pago,
        renovacion_contrato = NEW.renovacion_contrato, estado = NEW.estado::apsol_private.estado_general, whatsapp = NEW.whatsapp
    WHERE id = OLD.id;
    
    IF NEW.prospectos_asignados IS NOT NULL THEN
      DELETE FROM apsol_private.colaboradores_prospectos WHERE colaborador_id = OLD.id;
      INSERT INTO apsol_private.colaboradores_prospectos (colaborador_id, prospecto_id)
      SELECT OLD.id, unnest(NEW.prospectos_asignados)::UUID;
    END IF;
    
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM apsol_private.colaboradores WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_apsol_colaboradores_write
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.apsol_colaboradores
FOR EACH ROW EXECUTE FUNCTION public.handle_apsol_colaboradores_write();


-- Trigger para CRONOGRAMA
CREATE OR REPLACE FUNCTION public.handle_apsol_cronograma_write()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
  resolved_prospecto_id UUID;
BEGIN
  -- Intentar resolver el prospecto_id a partir del prospecto_nombre si no se pasó id
  resolved_prospecto_id := NEW.prospecto_id;
  IF resolved_prospecto_id IS NULL AND NEW.prospecto_nombre IS NOT NULL THEN
    SELECT id INTO resolved_prospecto_id FROM apsol_private.prospectos WHERE nombre = NEW.prospecto_nombre LIMIT 1;
  END IF;

  IF (TG_OP = 'INSERT') THEN
    target_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO apsol_private.cronograma (
      id, prospecto_id, inicio, fin, duracion_horas, descripcion, responsable_id,
      reunion_cliente, link_reunion, comentarios_reunion, google_calendar_id, created_at
    )
    VALUES (
      target_id, resolved_prospecto_id, NEW.inicio, NEW.fin, NEW.duracion_horas, NEW.descripcion, NEW.responsable_id,
      NEW.reunion_cliente, NEW.link_reunion, NEW.comentarios_reunion, NEW.google_calendar_id, COALESCE(NEW.created_at, NOW())
    );
    
    IF NEW.herramientas IS NOT NULL THEN
      INSERT INTO apsol_private.cronograma_herramientas (cronograma_id, herramienta)
      SELECT target_id, unnest(NEW.herramientas);
    END IF;
    
    NEW.id := target_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE apsol_private.cronograma
    SET prospecto_id = resolved_prospecto_id, inicio = NEW.inicio, fin = NEW.fin, duracion_horas = NEW.duracion_horas,
        descripcion = NEW.descripcion, responsable_id = NEW.responsable_id, reunion_cliente = NEW.reunion_cliente,
        link_reunion = NEW.link_reunion, comentarios_reunion = NEW.comentarios_reunion, google_calendar_id = NEW.google_calendar_id
    WHERE id = OLD.id;
    
    IF NEW.herramientas IS NOT NULL THEN
      DELETE FROM apsol_private.cronograma_herramientas WHERE cronograma_id = OLD.id;
      INSERT INTO apsol_private.cronograma_herramientas (cronograma_id, herramienta)
      SELECT OLD.id, unnest(NEW.herramientas);
    END IF;
    
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM apsol_private.cronograma WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_apsol_cronograma_write
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.apsol_cronograma
FOR EACH ROW EXECUTE FUNCTION public.handle_apsol_cronograma_write();


-- Trigger para CAPACITACION
CREATE OR REPLACE FUNCTION public.handle_apsol_capacitacion_write()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO apsol_private.capacitacion (
      id, titulo, descripcion, clasificacion, destinatarios, creado_por, fecha_creacion, created_at
    )
    VALUES (
      target_id, NEW.titulo, NEW.descripcion, NEW.clasificacion, NEW.destinatarios, NEW.creado_por, NEW.fecha_creacion, COALESCE(NEW.created_at, NOW())
    );
    
    IF NEW.visto_por IS NOT NULL THEN
      INSERT INTO apsol_private.capacitacion_vistas (capacitacion_id, usuario_id)
      SELECT target_id, unnest(NEW.visto_por)::UUID;
    END IF;
    
    NEW.id := target_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE apsol_private.capacitacion
    SET titulo = NEW.titulo, descripcion = NEW.descripcion, clasificacion = NEW.clasificacion,
        destinatarios = NEW.destinatarios, creado_por = NEW.creado_por, fecha_creacion = NEW.fecha_creacion
    WHERE id = OLD.id;
    
    IF NEW.visto_por IS NOT NULL THEN
      DELETE FROM apsol_private.capacitacion_vistas WHERE capacitacion_id = OLD.id;
      INSERT INTO apsol_private.capacitacion_vistas (capacitacion_id, usuario_id)
      SELECT OLD.id, unnest(NEW.visto_por)::UUID;
    END IF;
    
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM apsol_private.capacitacion WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_apsol_capacitacion_write
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.apsol_capacitacion
FOR EACH ROW EXECUTE FUNCTION public.handle_apsol_capacitacion_write();


-- Trigger para VIDEOS
CREATE OR REPLACE FUNCTION public.handle_apsol_videos_write()
RETURNS TRIGGER AS $$
DECLARE
  target_id UUID;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    target_id := COALESCE(NEW.id, gen_random_uuid());
    INSERT INTO apsol_private.videos (
      id, capacitacion_id, link, es_link_externo, archivo_video, autor, revision, resumen, fecha_subida, created_at
    )
    VALUES (
      target_id, NEW.capacitacion_id, NEW.link, NEW.es_link_externo, NEW.archivo_video, NEW.autor, NEW.revision, NEW.resumen, NEW.fecha_subida, COALESCE(NEW.created_at, NOW())
    );
    
    IF NEW.visto_por IS NOT NULL THEN
      INSERT INTO apsol_private.videos_vistas (video_id, usuario_id)
      SELECT target_id, unnest(NEW.visto_por)::UUID;
    END IF;
    
    NEW.id := target_id;
    RETURN NEW;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    UPDATE apsol_private.videos
    SET capacitacion_id = NEW.capacitacion_id, link = NEW.link, es_link_externo = NEW.es_link_externo,
        archivo_video = NEW.archivo_video, autor = NEW.autor, revision = NEW.revision, resumen = NEW.resumen,
        fecha_subida = NEW.fecha_subida
    WHERE id = OLD.id;
    
    IF NEW.visto_por IS NOT NULL THEN
      DELETE FROM apsol_private.videos_vistas WHERE video_id = OLD.id;
      INSERT INTO apsol_private.videos_vistas (video_id, usuario_id)
      SELECT OLD.id, unnest(NEW.visto_por)::UUID;
    END IF;
    
    RETURN NEW;
    
  ELSIF (TG_OP = 'DELETE') THEN
    DELETE FROM apsol_private.videos WHERE id = OLD.id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER tr_apsol_videos_write
INSTEAD OF INSERT OR UPDATE OR DELETE ON public.apsol_videos
FOR EACH ROW EXECUTE FUNCTION public.handle_apsol_videos_write();


-- ==========================================
-- RESTABLECER PERMISOS SOBRE NUEVAS TABLAS
-- ==========================================

GRANT USAGE ON SCHEMA apsol_private TO authenticated;
GRANT USAGE ON SCHEMA apsol_private TO anon;
GRANT USAGE ON SCHEMA apsol_private TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA apsol_private TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA apsol_private TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA apsol_private TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA apsol_private TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA apsol_private TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA apsol_private TO service_role;
