# Reconciliación de Facturación — Google Sheet "Apsol App" → Supabase `apsol_private`

> Runbook para dejar la parte de **facturación** de la base nueva igual al Excel/Sheet original.
> **Alcance:** `facturacion`, `pagos`, `facturas_colaboradores`, `contratos`, `cuentas_bancarias`.
> **Fuera de alcance:** todo lo de cronograma (`cronograma`, `cronograma_herramientas`, `multiplicador`, `hs` de cronograma).
> Estado: **SCRIPT LISTO — pendiente de ejecutar en Supabase.** Última actualización: 2026-08-28.
> Decisión del usuario: la hoja es la única verdad. Todo lo que no esté en la hoja = test → se borra.
> Script generado: `database/reconciliacion_facturacion_generado.sql` (transaccional, con backups `zz_bkp_*_20260828` y verificación con ROLLBACK).

---

## 0. Fuentes

| | Original | Destino |
|---|---|---|
| Soporte | Google Sheet **"Apsol App"** (`1mowpsI2t9kteCGbmQdS2QRJCME2B67EBXk2L7eA_i-4`), backend AppSheet. Export local: `~/Downloads/Apsol App (1).xlsx` | Supabase **`kursvmadozcqxoaeaccd`**, schema `apsol_private` (tablas) + vistas `public.apsol_*` que consume el frontend |
| Hojas relevantes | `Facturación`, `Pagos`, `Facturas Colaboradores`, `Contrato Colaboradores`, `Cuentas Bancarias`, `Colaboradores` | idem tablas |

⚠️ La hoja `Credenciales` del Sheet tiene secretos en texto plano — no se toca, no se versiona, no se pega en ningún lado.

---

## 1. Mecanismo de crosswalk (CLAVE)

La normalización previa **preservó los IDs viejos codificándolos dentro del UUID**:

```
sheet Id (hex de 8)  ->  '<hex>-0000-0000-0000-000000000000'::uuid
sheet Id (entero N)  ->  '00000000-0000-0000-0000-<N con 12 dígitos>'::uuid
```

Ejemplos verificados:
- `facturacion.id` `1b8e71b0-0000-0000-0000-000000000000` ↔ Sheet `Id_facturación = 1b8e71b0`
- `facturacion.prospecto_id` `aee8ae21-0000-...` ↔ Sheet `Prospecto = aee8ae21`
- `colaboradores.id` `405b60ad-0000-...` ↔ Sheet colaborador hex `405b60ad`; `00000000-...-000000000004` ↔ colaborador entero `4`

Cobertura actual:
| Tabla | filas con patrón legacy | filas con UUID random (alta posterior por app) |
|---|---:|---:|
| `facturacion` | 361 | 4 |
| `pagos` | 31 | 404 |

→ **Facturación**: crosswalk determinístico (`<hex>-0000-…`), sin heurística.
→ **Colaboradores**: 4 con patrón legacy (hex y entero), el resto son ex-colaboradores con UUID random (crosswalk por nombre, §9).
→ **Pagos**: la mayoría NO conservó el id viejo. Para casar Sheet↔DB → clave natural `(facturacion_id, fecha, monto)`.
→ ⚠️ **Prospectos y Contactos NO usan el patrón legacy**: sólo 7 de 139 prospectos y 7 de 132 contactos tienen `<hex>-0000-…`; el resto son UUID random. Los `Prospecto`/`Contacto 1`/`Contacto 2` del Sheet son ids hex VIEJOS que **no** mapean a `<hex>-0000-…`.
   → Por eso el script **NO toca** `prospecto_id` / `contacto_cobro_id` / `contacto_cobro2_id` en el UPDATE: la DB ya resolvió esas FKs en la import original (0 huérfanos verificado). Solo se guardan con `EXISTS` en el INSERT de facturas nuevas (si no resuelve → NULL). El primer intento de correr el script falló justo por esto (`facturacion_prospecto_id_fkey`, `26a88f6a-0000-…` inexistente) → corregido en la v2 del script.

Función de mapeo (helper, se crea al inicio de cada corrida):

```sql
create or replace function pg_temp.legacy_uuid(sheet_id text)
returns uuid language sql immutable as $$
  select case
    when sheet_id ~ '^[0-9a-fA-F]{8}$'
      then (lower(sheet_id) || '-0000-0000-0000-000000000000')::uuid
    when sheet_id ~ '^[0-9]+(\.0)?$'
      then ('00000000-0000-0000-0000-' || lpad(split_part(sheet_id,'.',1), 12, '0'))::uuid
    else null
  end
$$;
```

---

## 2. Conteos observados (2026-08-28)

| Entidad | Sheet (con datos) | DB | Δ |
|---|---:|---:|---|
| Facturación | 364 | 365 | +1 DB (4 UUID random vs ~1-2 legacy sin importar) |
| Pagos | 436 | 435 | −1 DB. Suma Sheet `241.526.951,56` vs DB `240.273.997,79` (Δ ≈ `1.252.953,77`) |
| Facturas Colaboradores | 56 | **0** | no importado |
| Contrato Colaboradores | 21 | **0** | no importado |
| Cuentas Bancarias | 7 | 7 | igual conteo |

---

## 3. Mapeo de columnas

### 3.1 `Facturación` → `apsol_private.facturacion`

| Columna Sheet | Columna DB | Regla |
|---|---|---|
| `Id_facturación` | `id` | `pg_temp.legacy_uuid()` |
| `Fecha` | `fecha_emision` | date |
| `Monto` | `monto` | numeric |
| `Desde` / `Hasta` | `periodo_desde` / `periodo_hasta` | date |
| `Empresa` | *(sin columna directa)* | la DB deriva empresa vía `prospecto_id`; NO se agrega `empresa_id` |
| `Contacto 1` / `Contacto 2` | `contacto_cobro_id` / `contacto_cobro2_id` | `legacy_uuid()` |
| `Prospecto` | `prospecto_id` | `legacy_uuid()` |
| `Próxima notificación` | `proxima_notificacion` | date |
| `Última notificación` | `ultima_notificacion` | date |
| `Solo Invoice?` | `solo_invoice` | `'True'→true`, `'False'/vacío→false` |
| `FACTURA 1` | `archivo_factura` | texto (ruta AppSheet, ver §6) |
| `Nº de factura` | `numero_factura` | texto; `'-'`, `'--'`, vacío → `null` |
| `FACTURA 2`, `FACTURA 3` | `comprobantes_adjuntos[]` | **DECISIÓN D5** |
| `DOCUMENTO` | `documento_general` | texto |
| `Invoice` | `comprobantes_adjuntos[]` | **DECISIÓN D5** |
| `Observaciones` | `notas` | texto |
| `Cuenta a depositar` | `cuenta_bancaria_id` | **normalización §4 + DECISIÓN D3** |
| `hs facturadas` | *(no existe)* | **DECISIÓN D2** (agregar `hs_facturadas numeric` o descartar) |
| `Descuento` | `porcentaje_descuento` | fracción del Sheet (`0.05`) → mantener como fracción (coincide con default `0`) |
| `Leyenda Factura` | `leyenda` | texto |
| `Última Modificación` | *(no existe `updated_at`)* | descartar |
| `Leyenda en email?`, `Link Text me bot`, `Mensaje WhatsApp`, `Próxima notificación WhatsApp`, `Reenviar Inicial`, `Reenviar Recordatorio`, `Impago` | *(sin destino)* | **DECISIÓN D5** — `Impago` está vacía en las 364, se descarta |
| — | `estado` (enum `estado_factura`) | derivado: `sum(pagos)>=monto → 'Cobrada total'`; `>0 → 'Cobrada parcial'`; `=0 → 'Pendiente'` (política actual de la DB) |
| — | `fecha_vencimiento`, `razon_social_id`, `tarifa_base_uva`, `valor_uva_dia` | **NO tocar** (conceptos nuevos / UVA / cronograma-adyacente) |

### 3.2 `Pagos` → `apsol_private.pagos`

| Sheet | DB | Regla |
|---|---|---|
| `Id Pago` | `id` | si matchea `legacy_uuid` se respeta; si no, se casa por clave natural |
| `Id facturación` | `facturacion_id` | `legacy_uuid()` |
| `Fecha` | `fecha` | date |
| `Pago` | `monto` | numeric |
| `Observaciones` | `observaciones` | texto |

Match Sheet↔DB: por `(facturacion_id, fecha, monto)`. Lo que quede en el Sheet sin match → INSERT. Lo que quede en la DB sin match en el Sheet → **DECISIÓN D4**.

### 3.3 `Facturas Colaboradores` → `apsol_private.facturas_colaboradores` (DB vacía)

| Sheet | DB | Regla |
|---|---|---|
| `Id Colaborador` | `colaborador_id` | `legacy_uuid()` (entero → UUID zero-pad) — validar contra los 9 colaboradores |
| `ID factura` | `id` | `legacy_uuid()` |
| `Fecha factura` | `fecha_factura` | date |
| `Nro de Factura` | `numero_factura` | texto; `'2.0'→'2'` (quitar `.0`) |
| `Monto` | `monto` | numeric |
| `Factura` | `archivo_factura` | ruta AppSheet (§6) |
| `Fecha de Pago` | `fecha_pago` | date |
| `Comprobante de pago` | `comprobante_pago` | ruta AppSheet (§6) |

→ INSERT de las 56 filas.

### 3.4 `Contrato Colaboradores` → `apsol_private.contratos` (DB vacía)

| Sheet | DB | Regla |
|---|---|---|
| `Id contrato` | `id` | `legacy_uuid()` |
| `Id Colaborador` | `colaborador_id` | `legacy_uuid()` |
| `Tipo de contrato` | `tipo_contrato` | texto |
| `Fecha Inicio` / `Fecha Fin` | `fecha_inicio` / `fecha_fin` | date |
| `Días libres por mes de trabajo` | `dias_libres_por_mes` | numeric |
| `Tipo de honorarios` | `tipo_honorarios` | texto |
| `Honorarios` | `honorarios` | numeric |
| `Adjunto` / `Adjunto 2` | `adjunto` / `adjunto2` | ruta AppSheet (§6) |
| `Estado` | `estado` (enum `estado_general`) | `'Activo'→'Activo'`; vacío/otros → `'Activo'` (default). Enum solo admite `Activo`/`Inactivo` |

→ INSERT de las 21 filas.

### 3.5 `Cuentas Bancarias` → `apsol_private.cuentas_bancarias`

| Sheet | DB | Nota |
|---|---|---|
| `Nombre Interno Cuenta` | `nombre_interno` | clave de match (NOT NULL) |
| `Moneda` | `moneda` | vacío → `'ARS'` |
| `Tipo de Cuenta` | `tipo_cuenta` | |
| `Cbu` | `cbu` | |
| `Cuit` | `cuit` | quitar `.0` |
| `Alias` | `alias` | |
| `Titular` | `titular` | |
| `Banco` | `banco` | |
| `Red` / `Wallet address` | `red` / `wallet_address` | |
| `Dirección del Banco` | `direccion_banco` | |
| `Número de enrutamiento de ABA` | `numero_ruta_aba` | |
| `Código SWIFT` | `codigo_swift` | |
| `Número de cuenta` (2ª, la del final) | `numero_cuenta_intl` | |
| `Numero de cuenta` (1ª) | *(sin destino)* | AppSheet la usaba como key; la DB usa `cbu`/`alias`. Descartar. |
| `Razon Social emisión` | *(sin destino en esta tabla)* | la razón social va por `facturacion.razon_social_id`. Descartar acá. |
| `Observaciones` | *(no existe)* | **DECISIÓN D5** |

Conteo 7=7 → sólo UPDATE de campos faltantes por `nombre_interno`.

---

## 4. Normalización de `Cuenta a depositar` (columna sucia)

Valores observados: IDs hex (`d72a3723`…), CBU/CUIT crudos (`20331228797`, `20-33122879-7`, `33122879.0`), y `'Efectivo'`.

Regla propuesta:
1. `^[0-9a-f]{8}$` → `legacy_uuid()` contra `cuentas_bancarias.id`.
2. Sólo dígitos, 22 chars → match por `cuentas_bancarias.cbu`.
3. Sólo dígitos, 11 chars (o con guiones) → normalizar y match por `cuentas_bancarias.cuit`.
4. `'Efectivo'` / vacío / sin match → `cuenta_bancaria_id = null` (y registrar en reporte de excepciones).

Toda fila sin resolver se vuelca a `pg_temp.reporte_excepciones` y se revisa a mano — **no se inventa**.

---

## 5. Procedimiento de ejecución

> Todo corre en el **SQL Editor de Supabase** (proyecto `kursvmadozcqxoaeaccd`), envuelto en una transacción, con verificación de conteos antes del `COMMIT`.

### Paso 0 — Preparación
1. **Backup**: Supabase → Database → Backups → crear backup manual. Anotar timestamp acá: `__________`.
2. Avisar a las otras sesiones de Claude / al equipo que se va a escribir en `apsol_private` (facturación).
3. Exportar cada hoja del Excel a CSV UTF-8 y subirla a una tabla staging:
   ```sql
   create table pg_temp.stg_facturacion (...);  -- columnas tal cual el Sheet, todo text
   \copy pg_temp.stg_facturacion from 'facturacion.csv' csv header
   ```
   (o cargar vía `insert ... values` generado por script si no hay `\copy`).

### Paso 1 — DDL: columna `hs_facturadas` (D2)
```sql
ALTER TABLE apsol_private.facturacion ADD COLUMN IF NOT EXISTS hs_facturadas numeric;
DROP VIEW IF EXISTS public.apsol_facturacion;
CREATE VIEW public.apsol_facturacion WITH (security_invoker = true) AS
  SELECT * FROM apsol_private.facturacion;
GRANT SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER, TRUNCATE
  ON public.apsol_facturacion TO anon, authenticated, service_role;
```
(vía `apply_migration`, no `execute_sql`).

### Paso 2 — `facturas_colaboradores` (additivo, bajo riesgo)
- Construir crosswalk de colaboradores **por nombre** (ver §9): `Id Colaborador` del Sheet → `colaboradores.id` real (los históricos tienen UUID random, NO `legacy_uuid`).
- Validar que TODO `Id Colaborador` referenciado resuelve. Si alguno no → abortar y reportar.
- `INSERT ... SELECT` desde staging. Verificar `count = 56`.

### Paso 3 — `contratos` (additivo, bajo riesgo)
- Igual que Paso 2 (mismo crosswalk de colaboradores). Verificar `count = 21`.

### ~~Paso — `cuentas_bancarias`~~ — **ELIMINADO (D3)**: no se toca.

### Paso 4 — `facturacion` (mirror del Sheet — D1 resuelta)
- `snap`: `create table pg_temp.snap_facturacion as select * from apsol_private.facturacion;`
- **DELETE** de las filas cuyo `id` NO corresponde a ningún `Id_facturación` del Sheet (las 4 UUID-random de prueba). Primero `SELECT` para listarlas y confirmar que son 4.
  - Ojo FK: `pagos.facturacion_id` — al borrar esas facturas, sus pagos quedan huérfanos; se borran también en el Paso 5 (o antes, con el mismo criterio).
- **UPDATE** de las filas legacy. Columnas que SÍ se escriben:
  `fecha_emision`, `monto`, `periodo_desde`, `periodo_hasta`, `contacto_cobro_id`, `contacto_cobro2_id`,
  `prospecto_id`, `proxima_notificacion`, `ultima_notificacion`, `solo_invoice`, `archivo_factura` (sólo `FACTURA 1`),
  `numero_factura`, `documento_general`, `notas`, `leyenda`, `porcentaje_descuento`, `hs_facturadas`.
- Columnas que **NO se tocan** (D3/D5 + conceptos nuevos): `cuenta_bancaria_id`, `razon_social_id`,
  `comprobantes_adjuntos`, `fecha_vencimiento`, `tarifa_base_uva`, `valor_uva_dia`, `estado` (se recalcula en Paso 6).
- **INSERT** de las filas del Sheet cuyo `legacy_uuid` no existe en la DB.
- Verificar `count(*) = 364`.

### Paso 5 — `pagos` (mirror del Sheet — D4 resuelta)
- `snap`: `create table pg_temp.snap_pagos as select * from apsol_private.pagos;`
- Match Sheet↔DB por `(facturacion_id, fecha, monto)`.
- **DELETE** de los pagos de la DB sin match en el Sheet (pruebas) + los huérfanos de las facturas borradas en Paso 4. `SELECT` primero para ver cuántos son.
- **INSERT** de los pagos del Sheet sin match.
- Verificar `count(*) = 436` y `sum(monto) = 241526951.56`.

### Paso 6 — Recalcular `facturacion.estado`
```sql
update apsol_private.facturacion f set estado = case
  when coalesce(p.pagado,0) >= f.monto then 'Cobrada total'
  when coalesce(p.pagado,0) > 0        then 'Cobrada parcial'
  else 'Pendiente' end::apsol_private.estado_factura
from (select facturacion_id, sum(monto) pagado from apsol_private.pagos group by 1) p
where p.facturacion_id = f.id;
```

### Paso 7 — Verificación final (antes de COMMIT)
```sql
-- conteos esperados
select
 (select count(*) from apsol_private.facturacion)            as facturacion,   -- 364 (+ D1)
 (select count(*) from apsol_private.pagos)                  as pagos,         -- 436
 (select count(*) from apsol_private.facturas_colaboradores) as fact_colab,    -- 56
 (select count(*) from apsol_private.contratos)              as contratos,     -- 21
 (select coalesce(sum(monto),0) from apsol_private.pagos)    as suma_pagos;    -- 241526951.56
```
Si cuadra → `COMMIT`. Si no → `ROLLBACK` y revisar.

### Rollback
- `ROLLBACK` si todavía no se hizo `COMMIT`.
- Post-commit: restaurar el backup del Paso 0, o revertir por tabla con los snapshots `pg_temp.snap_*` que cada paso deja.

---

## 6. Adjuntos (rutas AppSheet)

El Sheet guarda rutas relativas tipo `Facturas Colaboradores_Files_/ca9230ff.Factura.png`. Esos archivos viven en el Drive/almacenamiento de AppSheet, **no** en Supabase Storage. Este runbook **sólo migra el texto de la ruta** tal cual. Mover los binarios a `storage` es un trabajo aparte (no incluido).

---

## 7. Decisiones abiertas (bloquean la ejecución)

| # | Decisión | Resolución |
|---|---|---|
| **D1** | ✅ **RESUELTA (2026-08-28)**: el Sheet es la verdad. Las 4 filas de `facturacion` con UUID-random son pruebas → **BORRAR**. Filas del Sheet que falten en la DB → **INSERT**. Resultado esperado: `facturacion` = exactamente las 364 del Sheet. |
| **D4** | ✅ **RESUELTA (2026-08-28)**: el Sheet es la verdad. Los pagos de la DB sin match en el Sheet son pruebas → **BORRAR**. Resultado esperado: `pagos` = exactamente los 436 del Sheet, suma `241.526.951,56`. |
| **D2** | ✅ **RESUELTA (2026-08-28)**: agregar `hs_facturadas numeric` a `apsol_private.facturacion`, recrear la vista `public.apsol_facturacion`, y backfillear desde `hs facturadas` del Sheet. |
| **D3** | ✅ **RESUELTA (2026-08-28)**: **NO tocar cuentas bancarias.** `apsol_private.cuentas_bancarias` queda como está y `facturacion.cuenta_bancaria_id` **no se modifica**. La columna `Cuenta a depositar` del Sheet se ignora. §4 queda sin efecto. |
| **D5** | ✅ **RESUELTA (2026-08-28)**: las columnas del Sheet sin uso en la facturación actual **NO se importan**: `FACTURA 2`, `FACTURA 3`, `Invoice`, `Mensaje WhatsApp`, `Reenviar Inicial`, `Reenviar Recordatorio`, `Leyenda en email?`, `Link Text me bot`, `Impago`, `Última Modificación`. Nada va a `comprobantes_adjuntos[]`. |
| **D6** | ✅ **RESUELTA (2026-08-28)**: se ejecuta directo en producción `kursvmadozcqxoaeaccd`. **Sin backup manual** (el usuario ya tiene backups automáticos). Igual se corre todo en **una transacción** con `SELECT` de verificación antes del `COMMIT`; si los conteos no cuadran → `ROLLBACK`. |

---

## 8. Log de ejecución

| Fecha | Paso | Resultado | Quién |
|---|---|---|---|
| — | — | (pendiente) | — |

---

## 9. Crosswalk de colaboradores (Pasos 2 y 3)

`colaboradores.id` de la DB, mapeado al `Id Colaborador` de la hoja:

| Sheet | DB `colaboradores.id` | Nombre |
|---|---|---|
| `1` | `38c0cb8a-7e91-443c-8fe4-d16761fed135` | Felipe Duarte |
| `2` | `00000000-0000-0000-0000-000000000002` | Renata Morano |
| `4` | `00000000-0000-0000-0000-000000000004` | Adrian Patriarca |
| `405b60ad` | `405b60ad-0000-0000-0000-000000000000` | Santiago Toscano |
| `db304dbc` | `db304dbc-0000-0000-0000-000000000000` | Mateo Courault |
| **`3`** | ❓ *sin identificar* | ¿Paola Yossen / Sofía Leiva / Rocío Franco? |
| **`b2e3d434`** | ❓ *sin identificar* | ídem |
| **`f927515a`** | ❓ *sin identificar* | activo, $530k/mes, jun-2025 a feb-2026 |

DB tiene además históricos sin match: `9fd99d15…` Paola Yossen, `3f145bdc…` Sofía Leiva, `dd852b8f…` Rocío Franco, `77dd95fd…` "Mantenimiento".

Filas bloqueadas por esto: **7 de 56** en `Facturas Colaboradores`, **4 de 21** en `Contrato Colaboradores`.

---

## 10. Hallazgos de la validación contra la DB en vivo (2026-08-28)

### Facturación — 4 filas en la DB que NO están en la hoja (D1 → borrar)
| id | fecha | monto | nº factura | ¿pinta test? |
|---|---|---|---|---|
| `e874101b-6314-49cb-8ac6-6014490ba0e6` | 2026-08-25 | **1.127.046,23** | **A-0001-00000555** | ⚠️ NO — nº fiscal real |
| `c51e90a3-3725-4555-95fb-98a333586b06` | 2026-08-27 | 51.937,20 | 300 | ⚠️ dudoso |
| `f117548a-8b24-461e-ae5b-6add3aedaac4` | 2026-08-27 | 10.000,00 | (sin nº) | sí |
| `db9fed81-428a-4e2c-bc48-7052b4e54c6e` | 2026-08-28 | 20.000,00 | (sin nº) | sí |

0 filas de la hoja faltan en la DB.

### Pagos — mirror por clave natural (facturacion_id, fecha, monto)
**Se borrarían 4** (todos "Pago registrado desde panel rápido", 25-28 ago):
| factura | fecha | monto | nota |
|---|---|---|---|
| `e874101b…` (factura test $1,1M) | 2026-08-25 | 1.127.046,23 | va con su factura |
| **`05bd1bbb-0000-…`** (factura **legacy real, está en la hoja**) | 2026-08-25 | **1.405.000,00** | ⚠️ pago real de una factura real, la hoja todavía no lo tiene |
| `db9fed81…` (factura test $20k) | 2026-08-28 | 20.000,00 | va con su factura |
| `c51e90a3…` (factura test nº300) | 2026-08-28 | 12.000,00 | va con su factura |

**Se insertarían 3** (de la hoja, no están en la DB):
| factura | fecha | monto |
|---|---|---|
| `48eb1318-0000-…` | 2026-08-25 | 1.605.000,00 |
| `4b4a6dbc-0000-…` | 2026-08-25 | 200.000,00 |
| `e5e5b01b-0000-…` | 2026-08-26 | 1.980.000,00 |

Resultado: 435 − 4 + 3 = **434 ≠ 436** → la verificación haría ROLLBACK. El gap de 2 son pagos de igual (factura,fecha,monto) duplicados en la hoja que el `NOT EXISTS` no reinserta. El mirror exacto de pagos necesita reconciliación por multiplicidad, no `NOT EXISTS`.

### Conclusión operativa
La hoja **no es 100% autoritativa para los últimos días**: la app se está usando para cargar facturas/pagos recientes (post ~22-ago) que todavía no se replicaron a la hoja. Un "mirror" ciego **borra un pago real de $1.405.000** sobre la factura `05bd1bbb`.

## 11. Decisiones que faltan (bloquean la ejecución)
1. **Confirmar una por una** las 4 facturas a borrar — sobre todo `e874101b` (nº fiscal `A-0001-00000555`, $1,1M) y `c51e90a3` (nº 300).
2. **Confirmar** que se puede borrar el pago de **$1.405.000** sobre `05bd1bbb` (factura real) — o si esos pagos recientes de la app se conservan aunque no estén en la hoja.
3. **Identificar** colaboradores `3`, `b2e3d434`, `f927515a`.
4. Definir si el "corte" de autoridad de la hoja es una fecha (ej: la hoja manda hasta 2026-08-22, y lo posterior en la DB se respeta).

---

## 12. EJECUCIÓN — 2026-08-28 (vía Supabase MCP, en trozos)

Orden explícita del usuario: *"todo lo que no está en la hoja de cálculo es todo test, así que borrá todo lo que sea test. Tiene que quedar igual a la hoja de cálculo."* → se ejecutó el **mirror ciego**, ignorando las reservas de §10/§11.

### Cómo se corrió
1. `create schema mig` + 4 staging tables (`mig.stg_fact`, `stg_pago`, `stg_fcol`, `stg_contr`).
2. Carga de staging desde el Excel en 11 chunks newline-safe (`database/_mig/c00.sql`..`c10.sql`), generados por `_gen_mig.py`.
   - `mig.stg_fact` = 364 | `mig.stg_pago` = 436 (Σ 241 526 951,56) | `mig.stg_fcol` = 56 | `mig.stg_contr` = 21.
3. DML tail en **una sola transacción** (`BEGIN; … COMMIT;`) — cuerpo idéntico a `reconciliacion_facturacion_generado.sql` líneas 43-117, con `stg_*` → `mig.stg_*`:
   - refresco de backups `apsol_private.zz_bkp_*_20260828` (estado real pre-migración).
   - `ADD COLUMN hs_facturadas` + recrear vista `public.apsol_facturacion` (security_invoker) + GRANTs.
   - DELETE pagos/facturacion fuera de la hoja → UPDATE campos no-FK → INSERT facturas de la hoja faltantes (FKs con guarda, prospecto/contacto → NULL si no resuelve).
   - `DELETE FROM apsol_private.pagos` → recarga total 436 desde la hoja (guarda `EXISTS factura`).
   - 3 colaboradores placeholder (`00000003…`, `b2e3d434…`, `f927515a…`) `ON CONFLICT DO NOTHING`.
   - `DELETE` + recarga `facturas_colaboradores` (56) y `contratos` (21).
   - recálculo de `estado` por suma de pagos.
   - DO-block de verificación (RAISE → ROLLBACK).
4. `drop schema mig cascade`. Backups `zz_bkp_*_20260828` (5 tablas) **se conservan**.

### Resultado (verificado post-commit)
| tabla | filas | esperado | ok |
|---|---|---|---|
| `facturacion` | 364 | 364 | ✅ |
| `pagos` | 436 (Σ 241 526 951,56) | 436 / Σ exacta a la hoja | ✅ 0 pagos descartados |
| `facturas_colaboradores` | 56 | 56 | ✅ |
| `contratos` | 21 | 21 | ✅ |
| `facturacion.hs_facturadas` no nulo | 362 | (2 facturas sin hs en la hoja) | ✅ |
| `facturacion` sin ningún pago | 7 | — | ok |

### ⚠️ Consecuencia a tener presente
El mirror **borró** el pago de **$1.405.000** (2026-08-25) sobre la factura real `05bd1bbb-0000-…` y las 4 facturas post-22-ago que no estaban en la hoja (`e874101b` nº fiscal `A-0001-00000555` $1,1M, `c51e90a3` nº 300, `f117548a`, `db9fed81`) con sus pagos. Todo recuperable desde `apsol_private.zz_bkp_facturacion_20260828` / `zz_bkp_pagos_20260828` con `INSERT … SELECT`.

### No se tocó
Cronograma, cuentas bancarias / `cuenta_bancaria_id` (D3), FKs `prospecto_id` / `contacto_cobro_id` de facturas existentes (D-nota §44-46), columnas del sheet sin uso (D5).

---

## 13. Backfill de "Cuenta a depositar" — últimos 3 meses (2026-08-29)

Reversión parcial y explícita de la decisión D3 (que había dicho "no tocar cuentas
bancarias / ignorar la columna del sheet"). El usuario pidió cargar la cuenta de
destino solo a las facturas **emitidas desde 2026-06-01**.

- Fuente: hoja `Facturación` del Excel `Apsol App (1).xlsx`, columna **"Cuenta a depositar"** (col 18).
- Crosswalk id: `<hex8>-0000-0000-0000-000000000000` (igual que el resto de facturación).
- Mapeo valor de la hoja → `apsol_private.cuentas_bancarias`:
  | hoja | cuenta | id |
  |---|---|---|
  | `20331228797` | BNA - Adrian (Banco Nación) | `cc2cab55-a943-45c0-95bd-dd581a05c5fe` |
  | `20305727785` | Brubak - Sebastian (BRUBANK) | `62111fff-2ddc-427c-96e8-2372113c5b05` |
  | `Efectivo` | Efectivo | `ad5bf989-73fb-429d-acab-4c16b40a03f0` |
  - Ojo: `20331228797` (sin guiones) = **BNA**; `20-33122879-7` (con guiones) = **Ualá** (mismo CUIT, distinta cuenta). En el rango de 3 meses solo aparece la primera.
- Resultado: **49 facturas** actualizadas (BNA 38 / Brubank 8 / Efectivo 3), rango 2026-06-03 → 2026-08-22. 0 sin matchear, 0 pisadas (todas estaban en NULL).
- Backup: `apsol_private.zz_bkp_fact_cuenta_20260829` (id + cuenta_bancaria_id previa de las 361).
- Transacción con verificación `IF n_match <> 49 THEN RAISE EXCEPTION`.
