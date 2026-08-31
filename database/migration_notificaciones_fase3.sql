-- ============================================================
-- Notificaciones internas — Fase 3 del plan.
--
-- 1) Team Lead: NO es un cargo nuevo (usuarios.cargo sigue siendo solo
--    Admin/Colaborador) — es un flag sobre colaboradores, porque todo
--    Team Lead es también Colaborador (ver conversación con Adrian:
--    "el team lead también actúa como colaborador, no es únicamente
--    team lead"). Actualiza el trigger de sprint en rojo (Fase 2) para
--    sumarlos como destinatarios, además de los Admin.
--
-- 2) Preferencias: qué tipos de notificación no querés ver, por
--    usuario. Filtro simple del lado del cliente (src/services/
--    notificaciones-utils.js -> filtrarPorPreferencias), no toca los
--    triggers ni la tabla apsol_notificaciones.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el
-- 2026-08-30 vía MCP de Supabase, como migración `notificaciones_fase3`.
-- ============================================================

ALTER TABLE apsol_private.colaboradores
  ADD COLUMN IF NOT EXISTS es_team_lead boolean NOT NULL DEFAULT false;

-- La vista pública de colaboradores expone columnas explícitas (no
-- SELECT *): hay que recrearla agregando la nueva al final.
CREATE OR REPLACE VIEW public.apsol_colaboradores WITH (security_invoker = true) AS
SELECT
  id, usuario_id, puesto, fecha_inicio, frecuencia_pago, proxima_fecha_pago,
  renovacion_contrato, estado, whatsapp, created_at, dni, cuit_cuil, direccion,
  fecha_nacimiento, nacionalidad, estado_civil, tarifa_base_hora,
  dedicacion_mensual_horas, banco, cbu_cvu, alias, nombre_manual, apellido_manual,
  es_team_lead
FROM apsol_private.colaboradores;

ALTER TABLE apsol_private.usuarios
  ADD COLUMN IF NOT EXISTS notif_tipos_desactivados text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE VIEW public.apsol_usuarios WITH (security_invoker = true) AS
SELECT * FROM apsol_private.usuarios;

-- ------------------------------------------------------------
-- Actualiza el trigger de sprint en rojo (creado en Fase 2, ver
-- migration_notificaciones_fase2.sql) para sumar también a los Team
-- Lead — antes solo notificaba a Admin porque el flag no existía.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_notif_sprint_item_rojo() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_destinatario record;
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

  -- Admins + Team Leads (un usuario puede caer en las dos ramas del
  -- UNION si es Admin y además tiene ficha de colaborador con el flag;
  -- UNION ya deduplica, así que no notifica dos veces).
  FOR v_destinatario IN
    SELECT id FROM apsol_private.usuarios WHERE cargo = 'Admin'
    UNION
    SELECT c.usuario_id AS id FROM apsol_private.colaboradores c
      WHERE c.es_team_lead = true AND c.usuario_id IS NOT NULL
  LOOP
    PERFORM public.apsol_crear_notificacion(v_destinatario.id, 'sprint_item_rojo', v_titulo, 'sprint', NEW.sprint_id);
  END LOOP;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
