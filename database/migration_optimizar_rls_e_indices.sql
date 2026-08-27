-- Ya aplicada en Supabase (proyecto kursvmadozcqxoaeaccd) el 2026-08-27.
-- Documentada acá para que quede en el repo, no hace falta re-ejecutarla.
--
-- 1) Envuelve auth.uid() en (select auth.uid()) en todas las políticas RLS
--    de apsol_private que lo usaban directo. Mismo comportamiento de
--    acceso, pero Postgres cachea el resultado una vez por consulta en vez
--    de recalcularlo por cada fila escaneada. El advisor de Supabase lo
--    marcaba como WARN (auth_rls_initplan) en 30 políticas — con
--    cronograma en 4420 filas y creciendo, esto se sentía como demoras
--    reales al cargar la app.
--
-- 2) Agrega los dos índices de foreign key que faltaban en facturacion,
--    usados por el join que arma la lista de facturas.

ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.cadena_emails USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Crear temas - autenticados" ON apsol_private.capacitacion WITH CHECK ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Editar temas - autenticados" ON apsol_private.capacitacion USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Eliminar temas - autenticados" ON apsol_private.capacitacion USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.colaboradores USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Crear comentarios - autenticados" ON apsol_private.comentarios WITH CHECK ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Editar comentarios - autenticados" ON apsol_private.comentarios USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Eliminar comentarios - autenticados" ON apsol_private.comentarios USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.contactos USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.contratos USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.credenciales USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso total a autenticados" ON apsol_private.cronograma USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.cuentas_bancarias USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.empresas USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.facturacion USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.facturas_colaboradores USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.observaciones USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.pagos USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso total a autenticados" ON apsol_private.preventivos USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.prospectos USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso total a autenticados" ON apsol_private.proyectos USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.razones_sociales USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Acceso total a autenticados" ON apsol_private.tickets USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Permitir modificar su propio perfil" ON apsol_private.usuarios USING ((id = (select auth.uid())) OR apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Permitir ver perfiles a autenticados" ON apsol_private.usuarios USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Acceso exclusivo a Admins" ON apsol_private.valores_uva USING (apsol_private.es_admin((select auth.uid())));
ALTER POLICY "Crear videos - autenticados" ON apsol_private.videos WITH CHECK ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Editar videos - autenticados" ON apsol_private.videos USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Eliminar videos - autenticados" ON apsol_private.videos USING ((select auth.uid()) IS NOT NULL);
ALTER POLICY "Ver videos permitidos" ON apsol_private.videos USING (apsol_private.es_admin((select auth.uid())) OR ((select auth.uid()) = ANY (destinatarios)));

CREATE INDEX IF NOT EXISTS idx_facturacion_cuenta_bancaria_id ON apsol_private.facturacion (cuenta_bancaria_id);
CREATE INDEX IF NOT EXISTS idx_facturacion_razon_social_id ON apsol_private.facturacion (razon_social_id);
