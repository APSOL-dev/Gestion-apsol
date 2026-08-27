-- ============================================================
-- APSOL — Esquema de base de datos privado con vistas públicas
-- ============================================================

-- Crear esquema privado si no existe
CREATE SCHEMA IF NOT EXISTS apsol_private;

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- TABLAS FÍSICAS EN EL ESQUEMA PRIVADO
-- ==========================================

-- MÓDULO: USUARIOS / AUTH
CREATE TABLE IF NOT EXISTS apsol_private.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  apellido TEXT,
  email TEXT NOT NULL,
  email_personal TEXT,
  cargo TEXT DEFAULT 'Colaborador', -- 'Dueño' o 'Colaborador'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: CRM
CREATE TABLE IF NOT EXISTS apsol_private.empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  provincia TEXT,
  pais TEXT DEFAULT 'Argentina',
  industria TEXT,
  tamanio INTEGER,
  dias_espera_facturacion INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.razones_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES apsol_private.empresas(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  cuit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES apsol_private.empresas(id) ON DELETE SET NULL,
  nombre TEXT,
  apellido TEXT,
  telefono TEXT,
  email TEXT,
  cargo TEXT,
  area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.prospectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  estado TEXT DEFAULT 'Nuevo',
  empresa_id UUID REFERENCES apsol_private.empresas(id) ON DELETE SET NULL,
  contacto_id UUID REFERENCES apsol_private.contactos(id) ON DELETE SET NULL,
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  fecha_proxima_tarea DATE,
  canal_contacto TEXT,
  servicios_requeridos TEXT[],
  adjuntos TEXT,
  presupuesto TEXT,
  necesidad TEXT,
  proxima_tarea TEXT,
  tarifa_base NUMERIC(12,2),
  frecuencia_actualizacion INTEGER DEFAULT 1,
  inicio_servicio DATE,
  proxima_actualizacion_tarifa DATE,
  base_indice_valor NUMERIC,
  hs_mensuales NUMERIC,
  mensualidad_vigente_actual NUMERIC,
  moneda_cobro TEXT DEFAULT 'Pesos',
  indice_cobro TEXT,
  proxima_factura DATE,
  ultima_actualizacion_tarifa DATE,
  dias_entre_reuniones INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.observaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID REFERENCES apsol_private.prospectos(id) ON DELETE CASCADE,
  observacion TEXT,
  creado_por UUID REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.cadena_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  dias_desde_inicio INTEGER DEFAULT 0,
  ruta_documento TEXT,
  estado TEXT DEFAULT 'Activo',
  tipo_secuencia TEXT,
  adjunto TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: FACTURACIÓN
CREATE TABLE IF NOT EXISTS apsol_private.valores_uva (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  valor NUMERIC(12,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS apsol_private.facturacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID REFERENCES apsol_private.prospectos(id) ON DELETE SET NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  monto NUMERIC(14,2),
  periodo_desde DATE,
  periodo_hasta DATE,
  contacto_cobro_id UUID REFERENCES apsol_private.contactos(id) ON DELETE SET NULL,
  contacto_cobro2_id UUID REFERENCES apsol_private.contactos(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'Pendiente',
  proxima_notificacion DATE,
  ultima_notificacion DATE,
  solo_invoice BOOLEAN DEFAULT FALSE,
  numero_factura TEXT,
  archivo_factura TEXT,
  notas TEXT,
  documento_general TEXT,
  fecha_vencimiento DATE,
  leyenda TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facturacion_id UUID REFERENCES apsol_private.facturacion(id) ON DELETE CASCADE,
  fecha DATE DEFAULT CURRENT_DATE,
  monto NUMERIC(14,2) NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.cuentas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_interno TEXT NOT NULL,
  moneda TEXT DEFAULT 'ARS',
  tipo_cuenta TEXT,
  cbu TEXT,
  cuit TEXT,
  alias TEXT,
  banco TEXT,
  titular TEXT,
  red TEXT,
  wallet_address TEXT,
  direccion_banco TEXT,
  numero_ruta_aba TEXT,
  codigo_swift TEXT,
  numero_cuenta_intl TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: RRHH
CREATE TABLE IF NOT EXISTS apsol_private.colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  puesto TEXT,
  fecha_inicio DATE,
  frecuencia_pago INTEGER,
  proxima_fecha_pago DATE,
  renovacion_contrato DATE,
  estado TEXT DEFAULT 'Activo',
  whatsapp TEXT,
  prospectos_asignados TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE CASCADE,
  tipo_contrato TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  dias_libres_por_mes NUMERIC(5,1),
  tipo_honorarios TEXT,
  honorarios NUMERIC(14,2),
  adjunto TEXT,
  adjunto2 TEXT,
  estado TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.facturas_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE CASCADE,
  fecha_factura DATE,
  numero_factura TEXT,
  monto NUMERIC(14,2),
  archivo_factura TEXT,
  fecha_pago DATE,
  comprobante_pago TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: PROYECTOS
CREATE TABLE IF NOT EXISTS apsol_private.proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID REFERENCES apsol_private.prospectos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  tipo TEXT,
  responsable_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  colaborador_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.preventivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES apsol_private.proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_mantenimiento TEXT,
  descripcion TEXT,
  frecuencia_dias INTEGER,
  proxima_realizacion DATE,
  ultima_realizacion DATE,
  responsable_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  adjuntos TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES apsol_private.proyectos(id) ON DELETE CASCADE,
  preventivo_id UUID REFERENCES apsol_private.preventivos(id) ON DELETE SET NULL,
  tipo_ticket TEXT,
  prioridad TEXT DEFAULT 'Media',
  descripcion TEXT NOT NULL,
  tipo_problema TEXT,
  responsable_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  fecha_resolucion DATE,
  recordatorio BOOLEAN DEFAULT FALSE,
  fecha_recordatorio DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: CAPACITACIÓN
CREATE TABLE IF NOT EXISTS apsol_private.capacitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  clasificacion TEXT,
  destinatarios TEXT[],
  visto_por TEXT[],
  creado_por UUID REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id UUID REFERENCES apsol_private.capacitacion(id) ON DELETE CASCADE,
  link TEXT,
  es_link_externo BOOLEAN DEFAULT TRUE,
  archivo_video TEXT,
  autor TEXT,
  revision TEXT,
  resumen TEXT,
  fecha_subida DATE DEFAULT CURRENT_DATE,
  visto_por TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS apsol_private.comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id UUID REFERENCES apsol_private.capacitacion(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  creado_por UUID REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: AGENDA
CREATE TABLE IF NOT EXISTS apsol_private.cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_nombre TEXT,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  duracion_horas NUMERIC(4,1) DEFAULT 1,
  descripcion TEXT,
  responsable_id UUID REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  reunion_cliente BOOLEAN DEFAULT FALSE,
  link_reunion TEXT,
  comentarios_reunion TEXT,
  herramientas TEXT[],
  google_calendar_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- MÓDULO: CREDENCIALES
CREATE TABLE IF NOT EXISTS apsol_private.credenciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT,
  ambito TEXT DEFAULT 'Interno',
  empresa_id UUID REFERENCES apsol_private.empresas(id) ON DELETE SET NULL,
  servicio TEXT,
  usuario TEXT,
  password TEXT,
  url TEXT,
  puerto TEXT,
  nombre_bd TEXT,
  notas TEXT,
  estado TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- POLÍTICAS DE SEGURIDAD (RLS) EN PRIVADO
-- ==========================================

ALTER TABLE apsol_private.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.razones_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.cadena_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.valores_uva ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.facturacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.facturas_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.preventivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE apsol_private.credenciales ENABLE ROW LEVEL SECURITY;

-- Políticas para permitir acceso a usuarios autenticados
CREATE POLICY "Permitir select a autenticados" ON apsol_private.usuarios FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.empresas FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.razones_sociales FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.contactos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.prospectos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.observaciones FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.cadena_emails FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.valores_uva FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.facturacion FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.pagos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.cuentas_bancarias FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.colaboradores FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.contratos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.facturas_colaboradores FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.proyectos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.preventivos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.tickets FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.capacitacion FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.videos FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.comentarios FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.cronograma FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "Acceso total a autenticados" ON apsol_private.credenciales FOR ALL USING (auth.uid() IS NOT NULL);

-- ==========================================
-- VISTAS PÚBLICAS EN EL ESQUEMA PUBLIC
-- ==========================================

CREATE OR REPLACE VIEW public.apsol_usuarios WITH (security_invoker = true) AS SELECT * FROM apsol_private.usuarios;
CREATE OR REPLACE VIEW public.apsol_empresas WITH (security_invoker = true) AS SELECT * FROM apsol_private.empresas;
CREATE OR REPLACE VIEW public.apsol_razones_sociales WITH (security_invoker = true) AS SELECT * FROM apsol_private.razones_sociales;
CREATE OR REPLACE VIEW public.apsol_contactos WITH (security_invoker = true) AS SELECT * FROM apsol_private.contactos;
CREATE OR REPLACE VIEW public.apsol_prospectos WITH (security_invoker = true) AS SELECT * FROM apsol_private.prospectos;
CREATE OR REPLACE VIEW public.apsol_observaciones WITH (security_invoker = true) AS SELECT * FROM apsol_private.observaciones;
CREATE OR REPLACE VIEW public.apsol_cadena_emails WITH (security_invoker = true) AS SELECT * FROM apsol_private.cadena_emails;
CREATE OR REPLACE VIEW public.apsol_valores_uva WITH (security_invoker = true) AS SELECT * FROM apsol_private.valores_uva;
CREATE OR REPLACE VIEW public.apsol_facturacion WITH (security_invoker = true) AS SELECT * FROM apsol_private.facturacion;
CREATE OR REPLACE VIEW public.apsol_pagos WITH (security_invoker = true) AS SELECT * FROM apsol_private.pagos;
CREATE OR REPLACE VIEW public.apsol_cuentas_bancarias WITH (security_invoker = true) AS SELECT * FROM apsol_private.cuentas_bancarias;
CREATE OR REPLACE VIEW public.apsol_colaboradores WITH (security_invoker = true) AS SELECT * FROM apsol_private.colaboradores;
CREATE OR REPLACE VIEW public.apsol_contratos WITH (security_invoker = true) AS SELECT * FROM apsol_private.contratos;
CREATE OR REPLACE VIEW public.apsol_facturas_colaboradores WITH (security_invoker = true) AS SELECT * FROM apsol_private.facturas_colaboradores;
CREATE OR REPLACE VIEW public.apsol_proyectos WITH (security_invoker = true) AS SELECT * FROM apsol_private.proyectos;
CREATE OR REPLACE VIEW public.apsol_preventivos WITH (security_invoker = true) AS SELECT * FROM apsol_private.preventivos;
CREATE OR REPLACE VIEW public.apsol_tickets WITH (security_invoker = true) AS SELECT * FROM apsol_private.tickets;
CREATE OR REPLACE VIEW public.apsol_capacitacion WITH (security_invoker = true) AS SELECT * FROM apsol_private.capacitacion;
CREATE OR REPLACE VIEW public.apsol_videos WITH (security_invoker = true) AS SELECT * FROM apsol_private.videos;
CREATE OR REPLACE VIEW public.apsol_comentarios WITH (security_invoker = true) AS SELECT * FROM apsol_private.comentarios;
CREATE OR REPLACE VIEW public.apsol_cronograma WITH (security_invoker = true) AS SELECT * FROM apsol_private.cronograma;
CREATE OR REPLACE VIEW public.apsol_credenciales WITH (security_invoker = true) AS SELECT * FROM apsol_private.credenciales;

-- ==========================================
-- TRIGGER DE AUTENTICACIÓN
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO apsol_private.usuarios (id, email, nombre)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
