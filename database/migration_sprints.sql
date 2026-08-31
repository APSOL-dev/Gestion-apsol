-- ============================================================
-- Módulo SPRINTS (reemplazo del cuadernito de OneNote)
-- ------------------------------------------------------------
-- Cada proyecto (apsol_private.proyectos) tiene N sprints. Cada sprint
-- tiene una lista de "puntos" (apsol_sprint_items) con un semáforo de 5
-- estados y, opcionalmente, imágenes adjuntas (apsol_sprint_item_adjuntos).
--
-- Sigue el patrón del módulo Planificación: tablas reales en `public`
-- con prefijo apsol_, RLS ON + una policy única "autenticados FOR ALL".
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el 2026-08-29
-- vía MCP de Supabase, como migración `sprints`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Sprints
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apsol_sprints (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id     uuid NOT NULL REFERENCES apsol_private.proyectos(id) ON DELETE CASCADE,
  numero          integer NOT NULL DEFAULT 1,
  nombre          text NOT NULL DEFAULT '',
  objetivo        text NOT NULL DEFAULT '',
  fecha_inicio    date,
  fecha_fin       date,
  estado          text NOT NULL DEFAULT 'planificado'
                    CHECK (estado IN ('planificado', 'activo', 'cerrado')),
  notas           text NOT NULL DEFAULT '',        -- "hoja en blanco" markdown del sprint
  resumen_estados jsonb,                           -- foto de conteos al cerrar
  cerrado_en      timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 2. Puntos del sprint (lo que en OneNote era cada renglón)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apsol_sprint_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id      uuid NOT NULL REFERENCES public.apsol_sprints(id) ON DELETE CASCADE,
  orden          integer NOT NULL DEFAULT 0,
  titulo         text NOT NULL DEFAULT 'Nuevo punto',
  detalle        text NOT NULL DEFAULT '',         -- nota rica (markdown/texto libre)
  estado         text NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente', 'en_progreso', 'verde', 'amarillo', 'rojo')),
  comentario     text NOT NULL DEFAULT '',         -- el porqué del amarillo / rojo
  responsable_id uuid REFERENCES apsol_private.colaboradores(id) ON DELETE SET NULL,
  actualizado_por uuid REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 3. Adjuntos por punto (fotos que antes se pegaban en OneNote)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.apsol_sprint_item_adjuntos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id    uuid NOT NULL REFERENCES public.apsol_sprint_items(id) ON DELETE CASCADE,
  url        text NOT NULL,
  nombre     text NOT NULL DEFAULT '',
  subido_por uuid REFERENCES apsol_private.usuarios(id) ON DELETE SET NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- 4. Índices sobre las FK
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_apsol_sprints_proyecto
  ON public.apsol_sprints (proyecto_id);
CREATE INDEX IF NOT EXISTS idx_apsol_sprint_items_sprint
  ON public.apsol_sprint_items (sprint_id);
CREATE INDEX IF NOT EXISTS idx_apsol_sprint_item_adjuntos_item
  ON public.apsol_sprint_item_adjuntos (item_id);

-- ------------------------------------------------------------
-- 5. RLS: mismo criterio que el resto de la app (todo usuario logueado)
-- ------------------------------------------------------------
ALTER TABLE public.apsol_sprints              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apsol_sprint_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.apsol_sprint_item_adjuntos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados pueden gestionar sprints" ON public.apsol_sprints;
CREATE POLICY "autenticados pueden gestionar sprints"
  ON public.apsol_sprints FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "autenticados pueden gestionar sprint_items" ON public.apsol_sprint_items;
CREATE POLICY "autenticados pueden gestionar sprint_items"
  ON public.apsol_sprint_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "autenticados pueden gestionar sprint_item_adjuntos" ON public.apsol_sprint_item_adjuntos;
CREATE POLICY "autenticados pueden gestionar sprint_item_adjuntos"
  ON public.apsol_sprint_item_adjuntos FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Refrescar el cache de esquema de PostgREST
NOTIFY pgrst, 'reload schema';
