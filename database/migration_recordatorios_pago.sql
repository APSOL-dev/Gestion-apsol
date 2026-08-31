-- ============================================================
-- Recordatorios de pago periódicos (flujo n8n)
-- ------------------------------------------------------------
-- Objetivo: que un cron de n8n (diario 09:00 AR) escanee UNA vista con
-- todo lo necesario para reclamar el pago de las facturas Pendientes, y
-- que cada factura tenga a la vista su "próxima notificación" = fecha de
-- emisión + `dias_espera_facturacion` de la empresa, contada en días
-- hábiles (solo se saltan sábados y domingos; sin feriados).
--
--   - 1ª próxima_notificacion: la calcula la app al emitir la factura
--     (src/services/facturacion.js -> saveFactura), con la función JS
--     `sumarDiasHabiles` de src/utils/fecha.js — que debe quedar
--     SINCRONIZADA con la función SQL de acá abajo.
--   - Las siguientes: las recalcula n8n tras enviar el recordatorio,
--     usando la función SQL `apsol_sumar_dias_habiles`:
--       UPDATE apsol_facturacion
--       SET ultima_notificacion   = CURRENT_DATE,
--           proxima_notificacion  = apsol_sumar_dias_habiles(CURRENT_DATE, :dias_espera_facturacion),
--           recordatorios_enviados = recordatorios_enviados + 1
--       WHERE id = :factura_id;
--
-- Solo se reclaman facturas en estado 'Pendiente' (sin ningún pago). Las
-- parciales y las cobradas no entran. Todas las facturas tienen prospecto
-- (y por lo tanto empresa), así que el JOIN es INNER.
--
-- APLICADO en producción (proyecto kursvmadozcqxoaeaccd) el 2026-08-28
-- vía MCP de Supabase, como migración `recordatorios_pago`.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Contador de recordatorios ya enviados por factura
-- ------------------------------------------------------------
ALTER TABLE apsol_private.facturacion
  ADD COLUMN IF NOT EXISTS recordatorios_enviados integer NOT NULL DEFAULT 0;

-- La vista pública expone columnas explícitas (no SELECT *): hay que
-- recrearla agregando la nueva al final. CREATE OR REPLACE conserva los
-- permisos ya otorgados.
CREATE OR REPLACE VIEW public.apsol_facturacion
WITH (security_invoker = true) AS
SELECT
  id,
  prospecto_id,
  fecha_emision,
  monto,
  periodo_desde,
  periodo_hasta,
  contacto_cobro_id,
  contacto_cobro2_id,
  estado,
  proxima_notificacion,
  ultima_notificacion,
  solo_invoice,
  numero_factura,
  archivo_factura,
  notas,
  created_at,
  comprobantes_adjuntos,
  cuenta_bancaria_id,
  razon_social_id,
  tarifa_base_uva,
  valor_uva_dia,
  porcentaje_descuento,
  documento_general,
  fecha_vencimiento,
  leyenda,
  hs_facturadas,
  recordatorios_enviados
FROM apsol_private.facturacion;

-- ------------------------------------------------------------
-- 2. Estándar de días de espera: 4 (default ya está en 4; esto solo
--    normaliza filas viejas que hubieran quedado en NULL)
-- ------------------------------------------------------------
UPDATE apsol_private.empresas
SET dias_espera_facturacion = 4
WHERE dias_espera_facturacion IS NULL;

-- ------------------------------------------------------------
-- 3. Función: sumar N días hábiles a una fecha (solo salta sáb/dom)
--    Usada por la app (RPC) y por el UPDATE del flujo n8n.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apsol_sumar_dias_habiles(fecha date, n integer)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d date := fecha;
  restantes integer := GREATEST(COALESCE(n, 0), 0);
BEGIN
  WHILE restantes > 0 LOOP
    d := d + 1;
    IF EXTRACT(ISODOW FROM d) < 6 THEN   -- 1..5 = lunes a viernes
      restantes := restantes - 1;
    END IF;
  END LOOP;
  RETURN d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apsol_sumar_dias_habiles(date, integer)
  TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 4. Vista que escanea n8n: una fila por factura a reclamar, con todo
--    desnormalizado para armar el mensaje sin más consultas.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.apsol_recordatorios_pago
WITH (security_invoker = true) AS
SELECT
  f.id,
  f.numero_factura,
  f.fecha_emision,
  f.monto,
  f.leyenda,
  f.periodo_desde,
  f.periodo_hasta,
  f.proxima_notificacion,
  f.ultima_notificacion,
  f.recordatorios_enviados,
  (CURRENT_DATE - f.fecha_emision)        AS dias_mora,
  p.id                                    AS prospecto_id,
  p.nombre                                AS prospecto_nombre,
  e.id                                    AS empresa_id,
  e.nombre                                AS empresa_nombre,
  COALESCE(e.dias_espera_facturacion, 4)  AS dias_espera_facturacion,
  c1.nombre                               AS contacto_nombre,
  c1.apellido                             AS contacto_apellido,
  c1.telefono                             AS contacto_telefono,
  c1.email                                AS contacto_email,
  c2.nombre                               AS contacto2_nombre,
  c2.apellido                             AS contacto2_apellido,
  c2.telefono                             AS contacto2_telefono,
  c2.email                                AS contacto2_email,
  cb.banco                                AS cuenta_banco,
  cb.cbu                                  AS cuenta_cbu,
  cb.alias                                AS cuenta_alias,
  cb.titular                              AS cuenta_titular
FROM apsol_private.facturacion f
JOIN      apsol_private.prospectos       p  ON p.id  = f.prospecto_id
JOIN      apsol_private.empresas         e  ON e.id  = p.empresa_id
LEFT JOIN apsol_private.contactos        c1 ON c1.id = f.contacto_cobro_id
LEFT JOIN apsol_private.contactos        c2 ON c2.id = f.contacto_cobro2_id
LEFT JOIN apsol_private.cuentas_bancarias cb ON cb.id = f.cuenta_bancaria_id
WHERE f.estado = 'Pendiente'
  AND (f.proxima_notificacion IS NULL OR f.proxima_notificacion <= CURRENT_DATE);

GRANT SELECT ON public.apsol_recordatorios_pago
  TO anon, authenticated, service_role;

-- ------------------------------------------------------------
-- 5. Backfill: cargar proxima_notificacion en las Pendientes que aún no
--    la tienen (emisión + días hábiles según la empresa).
-- ------------------------------------------------------------
UPDATE apsol_private.facturacion f
SET proxima_notificacion = public.apsol_sumar_dias_habiles(
      f.fecha_emision,
      COALESCE(e.dias_espera_facturacion, 4)
    )
FROM apsol_private.prospectos p
JOIN apsol_private.empresas e ON e.id = p.empresa_id
WHERE f.prospecto_id = p.id
  AND f.estado = 'Pendiente'
  AND f.proxima_notificacion IS NULL
  AND f.fecha_emision IS NOT NULL;

-- Refrescar el cache de esquema de PostgREST (para que exponga la nueva
-- función RPC y la nueva vista de inmediato).
NOTIFY pgrst, 'reload schema';
