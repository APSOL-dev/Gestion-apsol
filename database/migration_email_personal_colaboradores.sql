-- ============================================================
-- Seed de emails personales (apsol_private.usuarios.email_personal)
-- ============================================================
-- La columna `email_personal` en apsol_private.usuarios ya existe (la
-- agrega el trabajo del módulo "Mi Perfil"). Acá solo se cargan los
-- valores actuales del equipo, matcheando por el email de trabajo.
--
-- `email_personal` = adónde se le avisan a cada uno los pagos de sus
-- facturas de colaborador. El email *.apsol@gmail.com es solo el login.
-- El webhook de facturas de colaboradores manda este email personal en
-- el payload (`colaborador.email_personal`).
--
-- Idempotente: solo completa filas vacías.
-- ============================================================

UPDATE apsol_private.usuarios u
SET email_personal = v.personal
FROM (VALUES
  ('apatriarca.apsol@gmail.com',  'a_patriarca@hotmail.com'),
  ('renatamorano.apsol@gmail.com', 'moranorenata@gmail.com'),
  ('asistente.apsol@gmail.com',   'felipeduarte120@gmail.com'),
  ('santiagot.apsol@gmail.com',   'santiagotoscanom@gmail.com'),
  ('mateo.apsol@gmail.com',       'couraultmateo@gmail.com')
) AS v(apsol, personal)
WHERE u.email = v.apsol
  AND (u.email_personal IS NULL OR u.email_personal = '');
