-- El "Saldo de Horas" del Cronograma se calculaba mal: netaba solo el mes
-- actual (horas contratadas del mes vs. usadas ese mes), un cálculo propio
-- inventado en la migración a React que nunca coincidió con la fórmula real
-- que usaba AppSheet. La fórmula correcta (confirmada por Adrian, y
-- verificada recalculándola a mano contra ~12 prospectos reales del
-- histórico) es acumulada desde el inicio del servicio:
--
--   Saldo = Horas Dedicadas (TODO el historial) - Horas Teóricas
--   Horas Dedicadas = SUM(duracion_horas * multiplicador) de TODAS las
--                      actividades del prospecto, sin importar el mes
--   Horas Teóricas  = semanas_transcurridas_desde_inicio_servicio * (hs_mensuales / 4.33)
--
-- (el "Horas Teóricas" se calcula en JS - ver calcularHorasTeoricas en
-- services/cronograma.js - porque depende de WEEKNUM, no de datos de la DB)
--
-- Esta función agrega server-side las horas dedicadas por prospecto (un
-- SUM+GROUP BY sobre un índice existente en prospecto_id) para no tener que
-- traer al cliente las 5000+ filas de actividades históricas solo para
-- sumarlas.
-- SECURITY DEFINER a propósito (no INVOKER): `cronograma_select_por_rol`
-- esconde de un no-Admin las actividades donde el responsable es Admin
-- (privacidad de la agenda de Adrian) — correcto para el calendario, pero
-- el Saldo de Horas es una cifra de negocio: tiene que sumar TODO el
-- historial real sin importar quién esté logueado. Como esta función solo
-- devuelve una suma agregada (nunca una fila de actividad individual), no
-- filtra esa privacidad - no hay filas ni contenido que se filtre.
CREATE OR REPLACE FUNCTION public.get_horas_dedicadas_por_prospecto()
RETURNS TABLE(prospecto_id uuid, horas_dedicadas numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    prospecto_id,
    SUM(COALESCE(duracion_horas, 0) * COALESCE(multiplicador, 1)) AS horas_dedicadas
  FROM apsol_private.cronograma
  WHERE prospecto_id IS NOT NULL
  GROUP BY prospecto_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_horas_dedicadas_por_prospecto() TO authenticated;

-- Mismo motivo: "días desde la última reunión" (columna Días del panel) es
-- otra cifra de negocio que no puede depender de si quien mira el panel es
-- la persona que cargó esa reunión puntual en la agenda. Reemplaza la
-- consulta directa a apsol_cronograma que hacía getUltimasReunionesPorProspecto
-- en services/cronograma.js (esa sí quedaba sujeta a la RLS de privacidad
-- del calendario). Solo devuelve una fecha agregada (MAX) por prospecto,
-- nunca el detalle de la actividad.
CREATE OR REPLACE FUNCTION public.get_ultima_reunion_por_prospecto(p_hasta timestamptz)
RETURNS TABLE(prospecto_id uuid, ultima_reunion timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT prospecto_id, MAX(inicio) AS ultima_reunion
  FROM apsol_private.cronograma
  WHERE reunion_cliente = true
    AND prospecto_id IS NOT NULL
    AND inicio <= p_hasta
  GROUP BY prospecto_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_ultima_reunion_por_prospecto(timestamptz) TO authenticated;
