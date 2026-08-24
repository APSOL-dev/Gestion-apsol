# Migración y Carga de Datos desde Excel

Este documento detalla la lógica técnica y de negocio utilizada para migrar y cargar los datos históricos provenientes del archivo de Excel (`Apsol App.xlsx`) hacia la base de datos relacional normalizada de Supabase (`apsol_private`), consumida por el frontend de React.

---

## 1. Lógica de Identificadores (IDs de AppSheet a UUIDs)

**Qué hace:** Convierte los identificadores cortos generados por AppSheet (ej. `4af047dd` de 8 caracteres hexadecimales) en tipos de datos UUID estándar que requiere la base de datos de PostgreSQL.

**Cómo se resuelve:**
* Para asegurar la integridad referencial y mantener los enlaces entre tablas sin perder los datos originales, cada ID corto se rellena con ceros hasta completar el formato estándar de un UUID de 128 bits.
* *Ejemplo:*
  * ID original de Empresa: `4af047dd`
  * UUID resultante: `4af047dd-0000-0000-0000-000000000000`
* Este mapeo es consistente a lo largo de todas las tablas: si un contacto o prospecto hace referencia a la empresa `4af047dd`, el script le asigna la clave foránea `4af047dd-0000-0000-0000-000000000000`.

---

## 2. Lógica por Entidad y Mapeo de Datos

### A. Empresas
* **Origen:** Hoja `Empresa`.
* **Destino:** Tabla física `apsol_private.empresas`.
* **Reglas de transformación:**
  * `ID_cliente` se convierte a UUID.
  * `Tamaño de la empresa` y `Días de espera facturación` se convierten a enteros (`INTEGER`).
  * Los campos de texto (`Empresa`, `Provincia`, `Pais`, `Industria/sector`) se guardan directamente.
* **Razones Sociales:**
  * En el Excel, una empresa contiene columnas planas para sus razones sociales y CUITs (ej. `Razon Social 1`, `Cuit 1`).
  * En la base de datos, esta relación se normaliza en la tabla `apsol_private.razones_sociales`, insertando un registro independiente por cada combinación no nula vinculada al `empresa_id`.

### B. Contactos
* **Origen:** Hoja `Contactos`.
* **Destino:** Tabla física `apsol_private.contactos`.
* **Reglas de transformación:**
  * `ID_contacto` se convierte a UUID.
  * `Empresa` (que en el Excel contiene el ID de cliente de AppSheet) se mapea a su UUID equivalente como clave foránea (`empresa_id`).
  * Los teléfonos se formatean como texto para evitar pérdida de dígitos significativos o prefijos internacionales.

### C. Prospectos
* **Origen:** Hoja `Prospectos`.
* **Destino:** Tablas `apsol_private.prospectos` y `apsol_private.prospectos_servicios`.
* **Reglas de transformación:**
  * `Id_prospectos` y `Contacto` se mapean a sus respectivos UUIDs.
  * **Mapeo de Estados:** Se preserva el valor de texto exacto del Excel (ej. `'6A - En producción'`, `'3H - Caido luego del presupuesto'`) en lugar de palabras simplificadas. Esto permite que el componente de React (`Prospectos.jsx`) realice el agrupamiento, filtros y estilos por columna de manera correcta.
  * **Servicios Requeridos (Normalización):** Las cadenas de texto con servicios múltiples separados por comas se descomponen y se insertan como filas individuales en la tabla relacional intermedia `apsol_private.prospectos_servicios` para garantizar la integridad de los datos.
  * **Tarifas y Fechas:** Se limpian los campos convirtiendo las fechas con horas a formato limpio de fecha de Postgres (`YYYY-MM-DD`) y las mensualidades a valores numéricos válidos.

---

## 3. Resiliencia de Carga y Manejo de Concurrencia

* **Bypass de Locks del Navegador:** Durante la carga de múltiples registros, el sistema `navigator.locks` de Supabase podía generar bloqueos silenciosos (locks huérfanos) en Chrome. Para solucionar esto, el cliente se inyecta con un bypass para que ignore los bloqueos y garantice que las consultas masivas se completen de inmediato.
* **Transaccionalidad (All-or-Nothing):** Todo el proceso de inserción y normalización de un grupo de datos relacionados se ejecuta envuelto en un bloque transaccional (`BEGIN; ... COMMIT;`) para asegurar que si un registro falla, la base de datos no quede en un estado inconsistente o a medio cargar.

---

## 4. Lógica de Facturación y Pagos (Amipack)

* **Origen:** Hojas `Facturación` y `Pagos` del Excel.
* **Destino:** Tablas físicas `apsol_private.facturacion` y `apsol_private.pagos`.
* **Reglas de mapeo de columnas físicas:**
  * **Facturas:**
    * El número identificador de la factura se guarda en la columna física `numero_factura` (no `numero`).
    * Las observaciones generales o leyendas de la factura se guardan en la columna física `notas` (no `observaciones`).
    * La fecha de emisión de la factura se guarda en la columna física `fecha_emision` (no `fecha`).
  * **Pagos:**
    * El monto pagado se almacena en la columna física `monto` (no `pago`).
* **Optimización y Cálculo de Saldos Dinámicos:**
  * El frontend espera leer el total de la factura en `monto_bruto` y el saldo restante en `saldo_pendiente` para listados y filtros.
  * Para evitar inconsistencias de datos y bugs de visualización (como mostrar facturas en `$0.00` por falta de columnas físicas en la tabla principal), se redefinió la vista pública de Postgres `public.apsol_facturacion`:
    ```sql
    CREATE OR REPLACE VIEW public.apsol_facturacion WITH (security_invoker = true) AS 
      SELECT f.*,
             f.monto AS monto_bruto,
             COALESCE(f.monto - (SELECT COALESCE(SUM(p.monto), 0) FROM apsol_private.pagos p WHERE p.facturacion_id = f.id), f.monto) AS saldo_pendiente
      FROM apsol_private.facturacion f;
    ```
  * Esta vista calcula de manera dinámica el saldo pendiente restando de forma subconsultada la suma de todos los pagos correspondientes a esa factura. De esta manera, el listado de facturas en React muestra de inmediato la información real de saldos sin sobrecargar el almacenamiento físico.

* **Validación de Claves Foráneas de Contactos (Manejo de IDs Huérfanos):**
  * **Problema:** En el histórico de la hoja `Facturación` de AppSheet existen registros de cobro asociados a IDs de contactos (ej. `62660d5b` o `79c13bda`) que no existen en la hoja de `Contactos` (fueron eliminados o modificados en el origen). Intentar insertarlos tal cual violaba la restricción de clave foránea (`foreign key`) de la tabla física `facturacion` en Supabase.
  * **Solución:** El script de importación lee de antemano el conjunto de todos los IDs de contacto válidos existentes en la hoja `Contactos`. Al iterar las facturas, valida si el `Contacto 1` o `Contacto 2` del Excel pertenece a este conjunto. Si no existe, se mapea a `NULL` de manera segura, evitando fallos de integridad referencial.

* **Importación de Fechas de Notificación y Retraso:**
  * Las columnas `Ultima notificación` y `Proxima notificación` se mapean y guardan en `ultima_notificacion` y `proxima_notificacion` de Supabase.
  * El estado de cobro se normaliza conforme al tipo ENUM de base de datos (`Pendiente`, `Enviada`, `Cobrada parcial`, `Cobrada total`).
  * En el listado de la app, si una factura no se encuentra en estado `Cobrada total`, se calcula de forma dinámica y visualiza el **Retraso** transcurrido en días restando la fecha de emisión de la factura a la fecha del día de hoy.


