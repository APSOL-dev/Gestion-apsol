-- ============================================================
-- APSOL — Esquema de base de datos completo
-- Ejecutar en Supabase > SQL Editor
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
-- MÓDULO: USUARIOS / AUTH
-- ========================

CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT,
  apellido TEXT,
  email TEXT NOT NULL,
  email_personal TEXT,
  cargo TEXT DEFAULT 'Colaborador', -- 'Dueño' o 'Colaborador'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- MÓDULO: CRM
-- ========================

CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  provincia TEXT,
  pais TEXT DEFAULT 'Argentina',
  industria TEXT,
  tamanio INTEGER,
  dias_espera_facturacion INTEGER DEFAULT 4,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS razones_sociales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  razon_social TEXT NOT NULL,
  cuit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contactos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  nombre TEXT,
  apellido TEXT,
  telefono TEXT,
  email TEXT,
  cargo TEXT,
  area TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  estado TEXT DEFAULT 'Nuevo',
  -- Estados posibles: Nuevo, Contactado, Propuesta, Negociación, Ganado, Perdido
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  contacto_id UUID REFERENCES contactos(id) ON DELETE SET NULL,
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  fecha_proxima_tarea DATE,
  canal_contacto TEXT,
  servicios_requeridos TEXT[],
  adjuntos TEXT,
  presupuesto TEXT,
  necesidad TEXT,
  proxima_tarea TEXT,
  -- Campos del servicio contratado (para facturación)
  tarifa_base NUMERIC(12,2),
  frecuencia_actualizacion INTEGER DEFAULT 1,
  inicio_servicio DATE,
  proxima_actualizacion_tarifa DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS observaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE CASCADE,
  observacion TEXT,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadena_emails (
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

-- ========================
-- MÓDULO: FACTURACIÓN
-- ========================

CREATE TABLE IF NOT EXISTS valores_uva (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL UNIQUE,
  valor NUMERIC(12,4) NOT NULL
);

CREATE TABLE IF NOT EXISTS facturacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE SET NULL,
  fecha DATE DEFAULT CURRENT_DATE,
  monto NUMERIC(14,2),
  periodo_desde DATE,
  periodo_hasta DATE,
  contacto_cobro_id UUID REFERENCES contactos(id) ON DELETE SET NULL,
  contacto_cobro2_id UUID REFERENCES contactos(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'Pendiente',
  -- Estados: Pendiente, Enviada, Cobrada parcial, Cobrada total
  proxima_notificacion DATE,
  ultima_notificacion DATE,
  solo_invoice BOOLEAN DEFAULT FALSE,
  numero_factura TEXT,
  archivo_factura TEXT, -- URL en Supabase Storage
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facturacion_id UUID REFERENCES facturacion(id) ON DELETE CASCADE,
  fecha DATE DEFAULT CURRENT_DATE,
  monto NUMERIC(14,2) NOT NULL,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cuentas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_interno TEXT NOT NULL,
  moneda TEXT DEFAULT 'ARS',
  tipo_cuenta TEXT,
  cbu TEXT,
  cuit TEXT,
  alias TEXT,
  banco TEXT,
  titular TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- MÓDULO: RRHH
-- ========================

CREATE TABLE IF NOT EXISTS colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  puesto TEXT,
  fecha_inicio DATE,
  frecuencia_pago INTEGER, -- días entre pagos
  proxima_fecha_pago DATE,
  renovacion_contrato DATE,
  estado TEXT DEFAULT 'Activo',
  whatsapp TEXT,
  prospectos_asignados TEXT[], -- array de UUIDs como texto
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
  tipo_contrato TEXT,
  fecha_inicio DATE,
  fecha_fin DATE,
  dias_libres_por_mes NUMERIC(5,1),
  tipo_honorarios TEXT,
  honorarios NUMERIC(14,2),
  adjunto TEXT, -- URL en Storage
  adjunto2 TEXT,
  estado TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS facturas_colaboradores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
  fecha_factura DATE,
  numero_factura TEXT,
  monto NUMERIC(14,2),
  archivo_factura TEXT, -- URL en Storage
  fecha_pago DATE,
  comprobante_pago TEXT, -- URL en Storage
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- MÓDULO: PROYECTOS
-- ========================

CREATE TABLE IF NOT EXISTS proyectos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id UUID REFERENCES prospectos(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  tipo TEXT,
  responsable_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  estado TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preventivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_mantenimiento TEXT,
  descripcion TEXT,
  frecuencia_dias INTEGER,
  proxima_realizacion DATE,
  ultima_realizacion DATE,
  responsable_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  adjuntos TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  preventivo_id UUID REFERENCES preventivos(id) ON DELETE SET NULL,
  tipo_ticket TEXT,
  prioridad TEXT DEFAULT 'Media',
  descripcion TEXT NOT NULL,
  tipo_problema TEXT,
  responsable_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  fecha_resolucion DATE,
  recordatorio BOOLEAN DEFAULT FALSE,
  fecha_recordatorio DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- MÓDULO: CAPACITACIÓN
-- ========================

CREATE TABLE IF NOT EXISTS capacitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  clasificacion TEXT,
  destinatarios TEXT[],
  visto_por TEXT[], -- array de user IDs
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha_creacion DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id UUID REFERENCES capacitacion(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS comentarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  capacitacion_id UUID REFERENCES capacitacion(id) ON DELETE CASCADE,
  comentario TEXT NOT NULL,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- MÓDULO: AGENDA
-- ========================

CREATE TABLE IF NOT EXISTS cronograma (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_nombre TEXT,
  inicio TIMESTAMPTZ NOT NULL,
  fin TIMESTAMPTZ NOT NULL,
  duracion_horas NUMERIC(4,1) DEFAULT 1,
  descripcion TEXT,
  responsable_id UUID REFERENCES colaboradores(id) ON DELETE SET NULL,
  reunion_cliente BOOLEAN DEFAULT FALSE,
  link_reunion TEXT,
  comentarios_reunion TEXT,
  herramientas TEXT[],
  google_calendar_id TEXT, -- ID del evento en Google Calendar
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- MÓDULO: CREDENCIALES
-- ========================

CREATE TABLE IF NOT EXISTS credenciales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT,
  ambito TEXT DEFAULT 'Interno', -- Interno o Cliente
  empresa_id UUID REFERENCES empresas(id) ON DELETE SET NULL,
  servicio TEXT,
  usuario TEXT,
  password TEXT, -- En producción: usar Supabase Vault
  url TEXT,
  puerto TEXT,
  nombre_bd TEXT,
  notas TEXT,
  estado TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================
-- POLÍTICAS DE SEGURIDAD (RLS)
-- ========================

-- Habilitar RLS en todas las tablas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE razones_sociales ENABLE ROW LEVEL SECURITY;
ALTER TABLE contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE observaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadena_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE valores_uva ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE facturas_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE proyectos ENABLE ROW LEVEL SECURITY;
ALTER TABLE preventivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacitacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comentarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE credenciales ENABLE ROW LEVEL SECURITY;

-- Política base: solo usuarios autenticados pueden ver y editar
-- Se puede refinar por rol más adelante

CREATE POLICY "Usuarios autenticados pueden ver todo"
  ON usuarios FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - empresas"
  ON empresas FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - razones_sociales"
  ON razones_sociales FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - contactos"
  ON contactos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - prospectos"
  ON prospectos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - observaciones"
  ON observaciones FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - cadena_emails"
  ON cadena_emails FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - valores_uva"
  ON valores_uva FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - facturacion"
  ON facturacion FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - pagos"
  ON pagos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - cuentas_bancarias"
  ON cuentas_bancarias FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - colaboradores"
  ON colaboradores FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - contratos"
  ON contratos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - facturas_colaboradores"
  ON facturas_colaboradores FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - proyectos"
  ON proyectos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - preventivos"
  ON preventivos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - tickets"
  ON tickets FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - capacitacion"
  ON capacitacion FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - videos"
  ON videos FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - comentarios"
  ON comentarios FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - cronograma"
  ON cronograma FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Acceso total a usuarios autenticados - credenciales"
  ON credenciales FOR ALL
  USING (auth.uid() IS NOT NULL);

-- ========================
-- TRIGGER: Crear perfil de usuario al registrarse
-- ========================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.usuarios (id, email, nombre)
  VALUES (NEW.id, NEW.email, split_part(NEW.email, '@', 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
