-- ============================================================
-- Notificaciones internas — Fase 2 del plan (ver artifact de
-- propuesta compartido con Adrian). A diferencia de las alertas
-- derivadas de Fase 1 (src/services/notificaciones-utils.js, se
-- calculan al vuelo con datos ya cargados), esto SÍ queda guardado:
-- se puede marcar como leído y no reaparece.
--
-- Se llena únicamente vía triggers SECURITY DEFINER sobre el cambio
-- real en la tabla de origen — nunca insertada directo por el
-- cliente (no hay policy de INSERT para `authenticated`), así no se
-- puede "olvidar" de notificar ni depender de que el código de la
-- app se acuerde de llamarlo.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el
-- 2026-08-30 vía MCP de Supabase, como migración `notificaciones_fase2`.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.apsol_notificaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id uuid NOT NULL REFERENCES apsol_private.usuarios(id) ON DELETE CASCADE,
  tipo            text NOT NULL,
  titulo          text NOT NULL,
  entidad_tipo    text,
  entidad_id      uuid,
  leido_en        timestamptz,
  creado_en       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_apsol_notificaciones_destinatario
  ON public.apsol_notificaciones (destinatario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_apsol_notificaciones_no_leidas
  ON public.apsol_notificaciones (destinatario_id) WHERE leido_en IS NULL;

ALTER TABLE public.apsol_notificaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usuario ve sus notificaciones" ON public.apsol_notificaciones;
CREATE POLICY "usuario ve sus notificaciones"
  ON public.apsol_notificaciones FOR SELECT TO authenticated
  USING (destinatario_id = (select auth.uid()));

DROP POLICY IF EXISTS "usuario marca leidas las propias" ON public.apsol_notificaciones;
CREATE POLICY "usuario marca leidas las propias"
  ON public.apsol_notificaciones FOR UPDATE TO authenticated
  USING (destinatario_id = (select auth.uid()))
  WITH CHECK (destinatario_id = (select auth.uid()));

GRANT SELECT, UPDATE ON public.apsol_notificaciones TO authenticated;

-- ------------------------------------------------------------
-- Helper: inserta una notificación (no-op si no hay destinatario).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_crear_notificacion(
  p_destinatario uuid, p_tipo text, p_titulo text, p_entidad_tipo text, p_entidad_id uuid
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  IF p_destinatario IS NULL THEN RETURN; END IF;
  INSERT INTO public.apsol_notificaciones (destinatario_id, tipo, titulo, entidad_tipo, entidad_id)
  VALUES (p_destinatario, p_tipo, p_titulo, p_entidad_tipo, p_entidad_id);
END;
$$;

-- ------------------------------------------------------------
-- 1) Ticket nuevo asignado -> el colaborador responsable.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_notif_ticket_asignado() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  IF NEW.responsable_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.responsable_id IS NOT DISTINCT FROM NEW.responsable_id THEN RETURN NEW; END IF;

  SELECT usuario_id INTO v_usuario_id FROM apsol_private.colaboradores WHERE id = NEW.responsable_id;

  PERFORM public.apsol_crear_notificacion(
    v_usuario_id, 'ticket_asignado',
    'Ticket asignado: ' || left(COALESCE(NEW.descripcion, 'sin descripción'), 80),
    'ticket', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_ticket_asignado ON apsol_private.tickets;
CREATE TRIGGER trg_notif_ticket_asignado
  AFTER INSERT OR UPDATE OF responsable_id ON apsol_private.tickets
  FOR EACH ROW EXECUTE FUNCTION public.apsol_notif_ticket_asignado();

-- ------------------------------------------------------------
-- 2) Punto de sprint pasa a rojo -> todos los Admin.
--    (Se actualiza en Fase 3 para sumar también a los Team Lead.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_notif_sprint_item_rojo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_admin record;
  v_sprint record;
  v_titulo text;
BEGIN
  IF NEW.estado IS DISTINCT FROM 'rojo' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.estado IS NOT DISTINCT FROM NEW.estado THEN RETURN NEW; END IF;

  SELECT s.numero, p.nombre AS proyecto_nombre
    INTO v_sprint
    FROM public.apsol_sprints s
    JOIN apsol_private.proyectos p ON p.id = s.proyecto_id
    WHERE s.id = NEW.sprint_id;

  v_titulo := 'Bloqueado: "' || left(NEW.titulo, 60) || '" — Sprint ' ||
    COALESCE(v_sprint.numero::text, '?') || COALESCE(' · ' || v_sprint.proyecto_nombre, '');

  FOR v_admin IN SELECT id FROM apsol_private.usuarios WHERE cargo = 'Admin' LOOP
    PERFORM public.apsol_crear_notificacion(v_admin.id, 'sprint_item_rojo', v_titulo, 'sprint', NEW.sprint_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_sprint_item_rojo ON public.apsol_sprint_items;
CREATE TRIGGER trg_notif_sprint_item_rojo
  AFTER UPDATE OF estado ON public.apsol_sprint_items
  FOR EACH ROW EXECUTE FUNCTION public.apsol_notif_sprint_item_rojo();

-- ------------------------------------------------------------
-- 3) Factura de colaborador nueva (para pagar) -> todos los Admin.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_notif_factura_colab_nueva() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_admin record;
  v_nombre text;
  v_titulo text;
BEGIN
  SELECT COALESCE(u.nombre, c.nombre_manual, 'Colaborador') INTO v_nombre
    FROM apsol_private.colaboradores c
    LEFT JOIN apsol_private.usuarios u ON u.id = c.usuario_id
    WHERE c.id = NEW.colaborador_id;

  v_titulo := 'Factura de ' || COALESCE(v_nombre, 'colaborador') || ' para pagar ($' || to_char(NEW.monto, 'FM999G999G999') || ')';

  -- entidad_tipo/entidad_id apuntan al COLABORADOR (donde se paga), no a
  -- la fila de la factura: no hay pantalla propia para una factura de
  -- colaborador individual, vive dentro de ColaboradorDetalle / MiPerfil.
  FOR v_admin IN SELECT id FROM apsol_private.usuarios WHERE cargo = 'Admin' LOOP
    PERFORM public.apsol_crear_notificacion(v_admin.id, 'factura_colaborador_pagar', v_titulo, 'colaborador', NEW.colaborador_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_factura_colab_nueva ON apsol_private.facturas_colaboradores;
CREATE TRIGGER trg_notif_factura_colab_nueva
  AFTER INSERT ON apsol_private.facturas_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.apsol_notif_factura_colab_nueva();

-- ------------------------------------------------------------
-- 4) Factura de colaborador pagada -> avisa a ese colaborador.
--    (Cierra el círculo del evento 3 — mismo costo, no estaba en el
--    plan original pero es la mitad que faltaba del mismo evento.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_notif_factura_colab_pagada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id uuid;
BEGIN
  IF NEW.fecha_pago IS NULL THEN RETURN NEW; END IF;
  IF OLD.fecha_pago IS NOT NULL THEN RETURN NEW; END IF;

  SELECT usuario_id INTO v_usuario_id FROM apsol_private.colaboradores WHERE id = NEW.colaborador_id;

  PERFORM public.apsol_crear_notificacion(
    v_usuario_id, 'factura_colaborador_pagada',
    'Te pagaron tu factura ($' || to_char(NEW.monto, 'FM999G999G999') || ')',
    'colaborador', NEW.colaborador_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notif_factura_colab_pagada ON apsol_private.facturas_colaboradores;
CREATE TRIGGER trg_notif_factura_colab_pagada
  AFTER UPDATE OF fecha_pago ON apsol_private.facturas_colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.apsol_notif_factura_colab_pagada();

NOTIFY pgrst, 'reload schema';
