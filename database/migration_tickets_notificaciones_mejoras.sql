-- Mejoras de Tickets / notificaciones (2026-09-23)
-- Aplicada en producción con apply_migration: tickets_notificaciones_mejoras
--
-- 1) La tabla apsol_notificaciones NO estaba publicada en Realtime, así que
--    la campanita solo se enteraba de una notificación nueva al recargar la
--    página. Con esto llegan en vivo.
-- 2) La notificación "Ticket asignado" armaba el título con la DESCRIPCIÓN,
--    que es opcional y casi siempre está vacía (salía "Ticket asignado: " sin
--    más). Ahora usa el TÍTULO del ticket y, si no hubiera, la descripción.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'apsol_notificaciones'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.apsol_notificaciones;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.apsol_notif_ticket_asignado()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_usuario_id uuid;
BEGIN
  IF NEW.responsable_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.responsable_id IS NOT DISTINCT FROM NEW.responsable_id THEN RETURN NEW; END IF;

  SELECT usuario_id INTO v_usuario_id FROM apsol_private.colaboradores WHERE id = NEW.responsable_id;

  PERFORM public.apsol_crear_notificacion(
    v_usuario_id, 'ticket_asignado',
    'Ticket asignado: ' || left(
      COALESCE(NULLIF(btrim(NEW.titulo), ''), NULLIF(btrim(NEW.descripcion), ''), 'sin título'),
      80
    ),
    'ticket', NEW.id
  );
  RETURN NEW;
END;
$function$;
