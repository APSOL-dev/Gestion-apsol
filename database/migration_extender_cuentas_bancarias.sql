-- Ejecutar una sola vez en el SQL Editor de Supabase (proyecto kursvmadozcqxoaeaccd).
-- Agrega los campos necesarios para registrar cuentas cripto y transferencias
-- internacionales en el módulo Cuentas Bancarias.

ALTER TABLE apsol_private.cuentas_bancarias
  ADD COLUMN IF NOT EXISTS red TEXT,
  ADD COLUMN IF NOT EXISTS wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS direccion_banco TEXT,
  ADD COLUMN IF NOT EXISTS numero_ruta_aba TEXT,
  ADD COLUMN IF NOT EXISTS codigo_swift TEXT,
  ADD COLUMN IF NOT EXISTS numero_cuenta_intl TEXT;

-- Recrear la vista pública para que exponga las columnas nuevas
CREATE OR REPLACE VIEW public.apsol_cuentas_bancarias WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.cuentas_bancarias;
