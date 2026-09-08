-- ============================================================================
-- migration_cronograma_mantenimiento.sql   (aplicada: 2026-09-08)
-- ----------------------------------------------------------------------------
-- Feature "Sumar mantenimiento" del Cronograma (solo admin):
--  - lista fija de clientes con sus horas de mantenimiento mensuales
--  - marca `origen` en las actividades que crea el botón, para las alertas de
--    "ya cargado este mes" y para el botón "borrar mantenimiento del mes".
--
-- Cada actividad de mantenimiento se crea igual que las que se venían haciendo
-- a mano: cliente en prospecto_id, responsable = "Mantenimiento (recurso
-- interno)" (77dd95fd-…), descripcion = 'Mantenimiento Activos', inicio = día 1
-- del mes a las 00:00, fin = +horas (se superponen), multiplicador 1. El saldo
-- de horas las toma solo (SUM(duracion_horas*multiplicador) por prospecto).
-- ============================================================================

-- 1) Marca de origen. El mes de una fila sale de `inicio` (día 1 00:00).
ALTER TABLE apsol_private.cronograma
  ADD COLUMN IF NOT EXISTS origen text;

-- OJO (memoria del proyecto): CREATE OR REPLACE VIEW borra silenciosamente el
-- WITH (security_invoker = true) -> repetirlo SIEMPRE.
CREATE OR REPLACE VIEW public.apsol_cronograma
  WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.cronograma;

-- 2) Lista fija de mantenimiento (config que edita el admin).
CREATE TABLE IF NOT EXISTS apsol_private.cronograma_mantenimiento (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id uuid NOT NULL UNIQUE REFERENCES apsol_private.prospectos(id) ON DELETE CASCADE,
  horas        numeric NOT NULL CHECK (horas > 0),
  activo       boolean NOT NULL DEFAULT true,
  orden        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE apsol_private.cronograma_mantenimiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cronograma_mantenimiento_admin ON apsol_private.cronograma_mantenimiento;
CREATE POLICY cronograma_mantenimiento_admin
  ON apsol_private.cronograma_mantenimiento
  FOR ALL
  TO authenticated
  USING (apsol_private.soy_admin())
  WITH CHECK (apsol_private.soy_admin());

CREATE OR REPLACE VIEW public.apsol_cronograma_mantenimiento
  WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.cronograma_mantenimiento;

-- 3) Semilla con los clientes que ya se venían manteniendo a mano
--    (horas = último valor usado; orden = por horas desc).
INSERT INTO apsol_private.cronograma_mantenimiento (prospecto_id, horas, orden) VALUES
  ('980643f2-e66d-43a0-a641-1e1682a030a7', 12, 1),  -- Norte 2025
  ('cf34bb7d-7a38-471a-afce-3e76bcd61a16', 10, 2),  -- Conexion Market
  ('5fc29c97-d8a7-4f94-be84-ff825f380b2e',  7, 3),  -- DG 2026
  ('fe064d5a-be61-4ecf-b63e-31df03ed9112',  5, 4),  -- MD (Futbol y Agencia)
  ('4f51f15d-be53-4b75-b84f-edceade80a99',  4, 5),  -- Escobar
  ('559adcf6-0000-0000-0000-000000000000',  4, 6),  -- Amipack 2025
  ('ac9177bb-4b92-44a5-a904-a505fc087ca1',  4, 7),  -- ATC 2025
  ('bd011eb2-5bd5-40dd-9613-915e9b0295b5',  2, 8),  -- Insuga 2025
  ('bd8e92bc-2c47-4a0f-82d7-10d14bf4d02b',  2, 9),  -- Refri 2025
  ('e63ab243-d940-427a-bd76-92a2460d5307',  1, 10)  -- Insuga Chaco
ON CONFLICT (prospecto_id) DO NOTHING;
