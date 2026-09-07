# Procedimiento — carga histórica de Cronograma (para sesiones en paralelo)

Este documento es **autocontenido**: cualquier sesión de Claude puede seguirlo
para cargar un prospecto sin más contexto. La migración lleva los históricos de
actividad al `apsol_private.cronograma` (vía la vista `public.apsol_cronograma`).

Herramienta de escritura: **`mcp__supabase__execute_sql`**.

---

## 1. Qué falta y qué está hecho

La **fuente de verdad es la base**, no este archivo (que se desactualiza con
varias sesiones editando). Corré esto para ver el estado real:

```sql
with lista(nombre) as (values
 ('Acción de venta'),('Amipack 2025'),('App A todo Color'),('APSOL - Proyectos Internos'),
 ('Asistente Laboratorio'),('ATC 2025'),('Autopartes Sol'),('Beamar Alimentos'),('Capacitación'),
 ('Conexion Market'),('Conexion Market 2026'),('Consultora'),('DG'),('DG 2025'),('DG 2026'),
 ('Día Libre'),('Drumond Pet Shop'),('El Norte'),('Escobar'),('Estudio Gustavo Echarte'),
 ('Hiper Limpieza'),('Hiper Limpieza 2025'),('HQ 2025'),('Idearte Mayorista'),('Insuga 2025'),
 ('Insuga Chaco'),('Insuga Gonzalo'),('Investigación'),('ISAA'),('ISAA 2026'),('Mantenimiento'),
 ('Mantenimiento Activos Nation Marketing'),('Mantenimiento BOT Laboratorio'),
 ('Mantenimiento Nation PostVenta'),('Marketing APSOL'),('MD (Futbol y Agencia)'),
 ('Mercería La Paloma'),('Metalurgica HQ'),('Natión'),('Nation Marketing'),('Natión Marketing 2025'),
 ('Norte 2025'),('OntheRoad Viajes'),('Open Pack'),('Open Pack Estabilización'),('Open Pack Final'),
 ('Otros'),('Paralelo Sur - Sistema de Gestión de Obras'),('Proyecto Nueva Sucursal DG'),
 ('Refri 2025'),('Refri 2da parte App'),('Refri Integral'),('Reunión de Venta'),('Reunión Pactada'),
 ('Servicio continuado Amipack'),('Tablero de control Neumaticos - Marketing'),('Taller Autos'),
 ('Vertiente del Sur'),('Veterinaria Arlekyn')
)
select l.nombre, p.id as prospecto_id, p.estado, p.hs_mensuales, p.inicio_servicio,
       coalesce(cnt.filas,0) as filas_cargadas, cnt.horas_acum
from lista l
left join apsol_private.prospectos p on p.nombre = l.nombre
left join lateral (
  select count(*) filas, round(sum(c.duracion_horas*c.multiplicador)::numeric,2) horas_acum
  from apsol_private.cronograma c where c.prospecto_id = p.id
) cnt on true
order by (coalesce(cnt.filas,0) > 0) desc, l.nombre;
```

### Estado al 2026-09-05

**Ya cargados (15) — NO tocar:** Amipack 2025, APSOL - Proyectos Internos,
ATC 2025, Conexion Market 2026, DG, DG 2026, Escobar, Estudio Gustavo Echarte,
Insuga 2025, Insuga Chaco, Mantenimiento, Marketing APSOL, Norte 2025,
Open Pack Estabilización, Veterinaria Arlekyn.

**Pendientes (34 prospectos reales)** — `filas_cargadas = 0`:

| Prospecto | prospecto_id | estado | hs/mes | inicio |
|---|---|---|---:|---|
| App A todo Color | `8ace0e5d-5337-49f9-9712-b92c9810afe2` | 5H | 32 | 2024-09-04 |
| Asistente Laboratorio | `2dff8650-a3ee-4e95-9c92-5e955a9bb3e7` | 5H | 18 | 2025-06-11 |
| Autopartes Sol | `796093b4-fb69-4aec-97ee-05fb76e19b58` | 5H | 24 | 2025-05-06 |
| Beamar Alimentos | `5c924432-4b26-4c38-8ebd-51927b364ceb` | 5H | 16 | 2025-09-16 |
| Conexion Market | `cf34bb7d-7a38-471a-afce-3e76bcd61a16` | 5H | 40 | 2025-06-18 |
| DG 2025 | `31694d86-4540-4356-b4ac-3bdf5b779a76` | 5H | 48 | 2025-02-04 |
| Drumond Pet Shop | `49981761-46d6-48b7-bbfc-337b9df0da02` | 5H | 16 | 2024-08-22 |
| El Norte | `67f37649-18f9-4de9-bcd9-85ff3ecc3ee1` | 5H | 60 | 2023-11-06 |
| Hiper Limpieza | `be501ad8-9690-4f90-b259-cd3c1c854298` | 5H | 24 | 2023-12-15 |
| Hiper Limpieza 2025 | `c2fd1b7e-0709-4d6e-af45-345d347d6740` | 5H | 16 | 2025-04-15 |
| HQ 2025 | `8b3a36a1-7787-4571-8740-c08d9e75d638` | 5H | 16 | 2025-07-07 |
| Idearte Mayorista | `7104a72f-ba5e-4ef6-b08c-1a9df9215cc8` | 5H | 16 | 2024-09-13 |
| Insuga Gonzalo | `9f95aff7-431c-4745-a55a-4b855e1c94fd` | 5H | 20 | 2024-10-28 |
| ISAA | `a39154aa-aec0-4be7-8d83-45df33361f23` | 5H | 24 | 2025-10-20 |
| ISAA 2026 | `33f865ae-f7d4-4729-b18f-9af1ccaf91af` | 5H | 24 | 2026-01-23 |
| Mantenimiento Activos Nation Marketing | `79abefcd-a6d9-45e3-af2d-cabdbb92fb9d` | 6A | 0 | 2025-07-17 |
| Mantenimiento BOT Laboratorio | `0c47501b-bee3-4e41-86f3-1ee0a56c07a1` | 6A | 0 | 2026-02-24 |
| Mantenimiento Nation PostVenta | `10b2eb2b-718d-44e3-b063-24c957d1366a` | 6A | 0 | 2025-06-23 |
| MD (Futbol y Agencia) | `fe064d5a-be61-4ecf-b63e-31df03ed9112` | 5H | 24 | 2026-02-04 |
| Mercería La Paloma | `df3b8145-d4ab-40e4-80c5-c6fd57ed536e` | 5H | 24 | 2025-10-06 |
| Metalurgica HQ | `ce63ec33-3a83-4825-8c4a-9ef09844effe` | 5H | 24 | 2024-06-07 |
| Natión | `358040f1-aba7-47c0-911d-74e6b23506b2` | 5H | 40 | 2023-08-23 |
| Nation Marketing | `27890bb0-6b41-42db-8017-680d7075a190` | 5H | 16 | 2023-11-14 |
| Natión Marketing 2025 | `a41435b4-6dba-48b0-a881-72e8fc092650` | 5H | 13 | 2025-03-18 |
| OntheRoad Viajes | `1b36eda6-6c4c-402b-9a8f-4cc857ecc336` | 5H | 24 | 2025-04-14 |
| Open Pack | `fedeebf6-da13-4219-bfb6-15c18b83889b` | 5H | 24 | 2026-01-20 |
| Open Pack Final | `b06178bf-dffc-4323-a263-a92db2cb84f2` | 5H | 40 | 2026-05-22 |
| Paralelo Sur - Sistema de Gestión de Obras | `20d7cdc2-ff4c-4856-bb89-fdcc3195b168` | 6A | 16 | 2026-09-01 |
| Proyecto Nueva Sucursal DG | `2e4e705b-3f83-4c1e-8fa4-da0f3f0032ce` | 5H | 24 | 2024-05-20 |
| Refri 2025 | `bd8e92bc-2c47-4a0f-82d7-10d14bf4d02b` | 5H | 13 | 2025-07-13 |
| Refri 2da parte App | `7a9eb3fc-6ed0-4dbc-ae7d-e5a60f59d1e0` | 5H | 16 | 2024-08-28 |
| Refri Integral | `e8b80ee2-f6cd-474d-b410-0ae1562c2183` | 5H | 16 | 2024-03-26 |
| Servicio continuado Amipack | `aee8ae21-0000-0000-0000-000000000000` | 5H ⚠️ | 24 | 2023-09-11 |
| Vertiente del Sur | `9eb3b2d8-0d2c-460a-9713-8cf3d52cdfaa` | 5H | 24 | 2025-04-22 |

⚠️ `Servicio continuado Amipack`: su `estado` tiene un **espacio al final**
(`'5H - Finalizados '`) → el filtro "Ver histórico" del Cronograma no lo lista.
Para verificarlo en browser hay que corregir ese espacio primero, o verificar
solo por SQL.

**Categorías internas (8)** — NO son prospectos, se cargan distinto (ver §9):
Acción de venta, Capacitación, Consultora, Día Libre, Investigación, Otros,
Reunión de Venta, Reunión Pactada.

**A confirmar con Adrian antes de cargar:**
`Tablero de control Neumaticos - Marketing` (no existe con ese nombre; lo más
parecido es `Tablero de control Cubiertas Natión MKT`) · `Taller Autos`
(estado "3H - Caído", sin hs/mes ni inicio).

---

## 2. Reglas de oro (no negociables)

1. **`duracion_horas` = Fin − Inicio, SIEMPRE.** La columna "Rango" del paste se
   ignora por completo.
2. **Timezone:** los literales sin zona los toma como UTC; la app muestra hora
   Argentina (UTC−3). En **cada** valor de `inicio` y `fin` del INSERT:
   `'YYYY-MM-DD HH:MM:SS'::timestamptz + interval '3 hours'`.
3. **Dedupe al re-pegar:** si el prospecto ya tiene filas, insertar **solo las
   nuevas**. El "Row ID" del paste no se guarda → comparar por
   `(inicio, fin, descripcion)` contra lo ya cargado.
4. **Filas de "Ajuste" / duración negativa: se cargan tal cual, NO se saltean.**
   (Ej. `Ajuste Inicial`, `Ajuste`, o una fila con Fin < Inicio cuya descripción
   dice "es un ajuste"). Son intencionales. Flaggear al usuario después.
5. **No dar por terminado hasta confirmar en el browser** que los registros
   aparecen (ver §8).
6. **Prospecto finalizado ("5H - Finalizados") → reportar HORAS ACUMULADAS**
   (`count(*)` y `sum(duracion_horas*multiplicador)`), **no** saldo. El saldo
   solo aplica a prospectos activos ("6A - En producción").
7. **Sesiones en paralelo:** nunca `git stash` / `reset` / `checkout` global
   sobre el working tree.

---

## 3. Formato del paste (columnas separadas por TAB)

| # | Columna | Uso |
|---|---|---|
| 1 | Row ID | **ignorar** (no se guarda) |
| 2 | Prospecto / Cliente | nombre — debe matchear un prospecto real |
| 3 | Inicio | `DD/MM/YYYY H:MM[:SS]` (día/mes pueden ir sin cero: `4/10/2024`) |
| 4 | Rango | **IGNORAR** |
| 5 | Fin | mismo formato que Inicio |
| 6 | Descripción del trabajo | puede venir entre comillas, multilínea, con `""` |
| 7 | Responsable | nombre; puede estar vacío → `NULL` |
| 8 | Reunión cliente | `Si`/`Sí` → `true`; `No`/vacío → `false` |
| 9 | Link reunión | casi siempre vacío → `NULL` |
| 10 | Comentarios reunión | casi siempre vacío → `NULL` |
| 11 | Creado por / fecha | **ignorar** |
| 12 | Modificado por / fecha | **ignorar** |
| 13 | Herramienta(s) | separadas por coma; ver §5 |
| 14 | Multiplicador | decimal argentino `1,35` → `1.35`; vacío → `1` |
| 15 | Notas multiplicador | casi siempre vacío → `NULL` |

---

## 4. Mapeo Responsable → `responsable_id`

`responsable_id` apunta a `apsol_private.colaboradores.id` (NO a `usuarios`).
Verificar con: `select id, nombre, apellido, estado from public.apsol_colaboradores_lista;`

| Nombre en el paste | `responsable_id` | estado |
|---|---|---|
| Adrian Patriarca | `00000000-0000-0000-0000-000000000004` | Activo |
| Renata Morano | `00000000-0000-0000-0000-000000000002` | Activo |
| Santiago Toscano | `405b60ad-0000-0000-0000-000000000000` | Activo |
| Mateo Courault | `db304dbc-0000-0000-0000-000000000000` | Activo |
| Mantenimiento (recurso interno) | `77dd95fd-c818-4382-8f4b-5be453dd68f1` | Activo |
| Felipe Duarte | `38c0cb8a-7e91-443c-8fe4-d16761fed135` | Inactivo (ex) |
| Rocío Franco / "Rocio" | `dd852b8f-7f53-497d-a627-edc2cdd90cf2` | Inactivo (ex) |
| Paola Yossen | `9fd99d15-579d-4a7d-a1bd-53a97e431d45` | Inactivo (ex) |
| Sofía Leiva | `3f145bdc-83dc-4631-905d-62802486fd28` | Inactivo (ex) |

- Responsable vacío → `responsable_id = NULL`.
- Nombre no mapeado → `NULL` y **flaggear al usuario**.

---

## 5. Herramientas válidas

`Antigravity`, `N8N`, `Appsheet`, `Power Bi`, `Otros`, `Herramientas No utilizadas`

- Tokens separados por coma. Si **todos** son válidos →
  `ARRAY['Antigravity','N8N']::text[]`.
- Si **algún** token no está en la lista → todo el campo `herramientas = NULL` y
  flaggear.
- Campo vacío → `NULL`.

---

## 6. Fechas y duración

- Parsear con `%d/%m/%Y %H:%M:%S` y, si falla, `%d/%m/%Y %H:%M`. Día/mes/hora sin
  cero a la izquierda son válidos.
- `duracion_horas = round((fin - inicio) en horas, 4)`. Puede ser `0` (se carga)
  o **negativa** (se carga igual — regla §2.4).
- **Corrección conocida** (Mantenimiento): filas placeholder `M{N}-06` con fecha
  `06/01/2026` son un swap día/mes de `01/06/2026` (el resto de las filas de
  Mantenimiento caen siempre en día 01). Corregir y flaggear.

---

## 7. Template del INSERT

Columnas fijas (el resto de la tabla es nullable / default):

```sql
insert into public.apsol_cronograma
  (id, inicio, fin, duracion_horas, descripcion, responsable_id, reunion_cliente,
   link_reunion, comentarios_reunion, prospecto_id, multiplicador,
   notas_multiplicador, herramientas)
values
(gen_random_uuid(),
 '2024-09-25 15:00:00'::timestamptz + interval '3 hours',
 '2024-09-25 17:00:00'::timestamptz + interval '3 hours',
 2.0, 'Reunión Nation', '00000000-0000-0000-0000-000000000004', true,
 NULL, NULL, '<PROSPECTO_ID>', 1, NULL, NULL),
 ...   -- ~60 filas por statement
;
```

- Escapar comillas simples en la descripción duplicándolas (`''`).
- Descripción vacía → `NULL`.

---

## 8. Verificación en el browser (obligatoria)

Dev server: `.claude/launch.json` → `gestion-apsol-dev` (puerto 5173),
`http://localhost:5173/cronograma`. Requiere hard-reload para ver datos frescos.

- **Prospecto ACTIVO ("6A - En producción"):** el panel **"Saldo De Horas — Mes
  Actual"** lista el prospecto. El saldo mostrado tiene que coincidir con el
  calculado:
  `saldo = horas_ponderadas − semanas·(hs_mensuales/4.33)`
  (weeknum estilo AppSheet: semanas empiezan domingo, semana 1 contiene el 1-ene;
  `semanas = weeknum(hoy) + (año(hoy)−año(inicio))·52 − weeknum(inicio)`;
  fecha de referencia 2026-09-05).

- **Prospecto FINALIZADO ("5H"):** NO aparece en el panel de saldo. Verificar así:
  1. Poner **Desde/Hasta** cubriendo todo el rango del prospecto (ej.
     `2023-01-01` → `2026-12-31`).
  2. Tildar **"Ver histórico"** (arriba, al lado de "Agenda externa").
  3. Filtro **Prospectos** → elegir el prospecto.
  4. Leer el recuadro **"Horas Dedicadas — Según Filtros"**: `ACTIVIDADES` y
     `HORAS` deben coincidir con lo insertado (y con el `count`/`sum` de la base).
  - Nota: el fix de paginación (>1000 filas) ya está en `main`; sin él las fechas
    viejas no se ven.

---

## 9. Categorías internas (prospecto_id NULL)

`Consultora`, `Capacitación`, `Investigación`, `Día Libre`, `otros`,
`Acción de venta` NO son clientes. Se guardan con:
- `prospecto_id = NULL`
- `descripcion = '[Categoría] ' || descripcion_original`  (ej. `[Consultora] Varios`)

`Reunión de Venta` y `Reunión Pactada` **no** están en la lista canónica de
categorías — confirmar con Adrian cómo tratarlas antes de cargar.

---

## 10. Parser Python recomendado (evita el infierno del TSV)

Cargar las filas como tuplas literales en el script (una por actividad) y que el
script emita el SQL. Es más robusto que parsear TSV con descripciones
multilínea. Plantilla:

```python
# -*- coding: utf-8 -*-
from datetime import datetime

RESP = {
    'Adrian Patriarca': '00000000-0000-0000-0000-000000000004',
    'Renata Morano':    '00000000-0000-0000-0000-000000000002',
    'Santiago Toscano': '405b60ad-0000-0000-0000-000000000000',
    'Mateo Courault':   'db304dbc-0000-0000-0000-000000000000',
    'Mantenimiento':    '77dd95fd-c818-4382-8f4b-5be453dd68f1',
    'Felipe Duarte':    '38c0cb8a-7e91-443c-8fe4-d16761fed135',
    'Rocío Franco':     'dd852b8f-7f53-497d-a627-edc2cdd90cf2',
    'Rocio Franco':     'dd852b8f-7f53-497d-a627-edc2cdd90cf2',
    'Paola Yossen':     '9fd99d15-579d-4a7d-a1bd-53a97e431d45',
    'Sofía Leiva':      '3f145bdc-83dc-4631-905d-62802486fd28',
}
VALID_H = {'Antigravity','N8N','Appsheet','Power Bi','Otros','Herramientas No utilizadas'}
PROSPECTO_ID = '<PONER_ACA>'

# (inicio, fin, descripcion, responsable, reunion_bool)  -- herramienta/mult raros: agregar cols
ROWS = [
    ('25/08/2023 8:00', '25/08/2023 12:00', 'N', 'Felipe Duarte', False),
    # ...
]

def esc(s): return "'" + s.replace("'", "''") + "'"
def parsedt(s):
    s = s.strip()
    for fmt in ('%d/%m/%Y %H:%M:%S', '%d/%m/%Y %H:%M'):
        try: return datetime.strptime(s, fmt)
        except ValueError: pass
    raise ValueError(s)
def sqlts(dt):
    return "'" + dt.strftime('%Y-%m-%d %H:%M:%S') + "'::timestamptz + interval '3 hours'"

vals, total, negs = [], 0.0, []
for ini_s, fin_s, desc, resp, reunion in ROWS:
    ini, fin = parsedt(ini_s), parsedt(fin_s)
    dur = round((fin - ini).total_seconds() / 3600, 4)
    if dur < 0: negs.append((ini_s, fin_s, dur, desc))   # se cargan igual
    resp_id = "'" + RESP[resp] + "'" if resp.strip() else 'NULL'
    desc_sql = esc(desc) if desc.strip() else 'NULL'
    total += dur
    vals.append(f"(gen_random_uuid(), {sqlts(ini)}, {sqlts(fin)}, {dur}, {desc_sql}, "
                f"{resp_id}, {'true' if reunion else 'false'}, NULL, NULL, "
                f"'{PROSPECTO_ID}', 1, NULL, NULL)")

print('filas:', len(vals), ' horas:', round(total, 4), ' negativas:', negs)
CHUNK = 60
for k in range(0, len(vals), CHUNK):
    sql = ("insert into public.apsol_cronograma\n"
           "  (id, inicio, fin, duracion_horas, descripcion, responsable_id, reunion_cliente,\n"
           "   link_reunion, comentarios_reunion, prospecto_id, multiplicador, notas_multiplicador, herramientas)\n"
           "values\n" + ",\n".join(vals[k:k+CHUNK]) + ";")
    open(f'insert_part{k//CHUNK+1}.sql', 'w', encoding='utf-8').write(sql)
```

Para pastes grandes con descripciones multilínea entre comillas, la alternativa
es guardar el paste crudo a un `.tsv` y parsear con
`csv.reader(f, delimiter='\t', quotechar='"')`, padeando cada fila a 15 columnas.

---

## 11. Coordinación entre sesiones paralelas

1. Adrian le asigna a cada sesión **qué prospecto(s)** cargar (de la tabla de §1).
2. La sesión, antes de arrancar, corre el `select` de §1 para ese nombre:
   - `filas_cargadas > 0` y no lo estás cargando vos → **otra sesión ya lo tomó**,
     pedir otro.
3. Al terminar y verificar en browser, la sesión reporta a Adrian:
   `<Prospecto>: N filas, H horas acumuladas` (finalizado) o
   `<Prospecto>: N filas, saldo S h` (activo), y cualquier flag
   (responsable no mapeado, fila de ajuste, corrección de fecha, herramienta
   inválida, prospecto duplicado).
4. Editar `docs/cronograma-pendientes.md` es opcional y propenso a conflictos con
   varias sesiones; la base + el `select` de §1 son la referencia real.
