# Carga histórica de Cronograma — prospectos migrados

Registros históricos de actividad cargados en `apsol_private.cronograma`
(vía la vista `public.apsol_cronograma`) a partir de los pastes de la planilla origen.

- **Fecha de referencia del saldo:** 2026-09-05
- **`duracion_horas`:** siempre calculada como `Fin − Inicio` (la columna "Rango" se ignora).
- **Timezone:** los literales se insertan con `+ interval '3 hours'` para que la app
  los muestre en hora Argentina (UTC−3).
- **Saldo:** `horas_dedicadas_ponderadas − horas_teoricas`, donde
  `horas_teoricas = semanas × (hs_mensuales / 4.33)` (weeknum estilo AppSheet).

## Prospectos cargados

| # | Prospecto | `prospecto_id` | hs/mes | Inicio servicio | Filas | Horas pond. | Rango de fechas | Saldo (2026-09-05) |
|---|-----------|----------------|-------:|-----------------|------:|------------:|-----------------|-------------------:|
| 1 | APSOL - Proyectos Internos | `9fc904bd-d4c5-4f5d-bd2a-5b07a863aa96` | 24 | 2025-02-03 | 121 | 368.70 | 21/02/2025 → 12/09/2026 | −85.80 h |
| 2 | Norte 2025 | `980643f2-e66d-43a0-a641-1e1682a030a7` | 30 | 2025-05-06 | 136 | 464.73 | 13/05/2025 → 07/09/2026 | −13.33 h |
| 3 | ATC 2025 | `ac9177bb-4b92-44a5-a904-a505fc087ca1` | 32 | 2025-07-01 | 186 | 492.83 | 01/07/2025 → 03/09/2026 | +42.02 h |
| 4 | Escobar | `4f51f15d-be53-4b75-b84f-edceade80a99` | 40 | 2025-07-08 | 232 | 572.92 | 08/07/2025 → 03/09/2026 | +18.64 h |
| 5 | Insuga 2025 | `bd011eb2-5bd5-40dd-9613-915e9b0295b5` | 30 | 2025-08-28 | 182 | 373.43 | 02/09/2025 → 04/09/2026 | +6.23 h |
| 6 | Amipack 2025 | `559adcf6-0000-0000-0000-000000000000` | 36 | 2025-09-11 | 203 | 439.64 | 15/09/2025 → 03/09/2026 | +15.62 h |
| 7 | DG 2026 | `5fc29c97-d8a7-4f94-be84-ff825f380b2e` | 44 | 2026-01-04 | 135 | 357.32 | 01/01/2026 → 07/09/2026 | +11.82 h |
| 8 | Mantenimiento | `c95d278d-3fa3-4dcc-bf1f-394bb9eb3449` | 16 | 2026-01-07 | 62 | 92.70 | 07/01/2026 → 21/08/2026 | −32.94 h |
| 9 | Insuga Chaco | `e63ab243-d940-427a-bd76-92a2460d5307` | 20 | 2026-02-11 | 61 | 127.87 | 28/01/2026 → 11/09/2026 | −6.08 h |
| 10 | Estudio Gustavo Echarte | `e974ee7d-e790-462d-90bf-2486ffa0c99e` | 32 | 2026-04-10 | 68 | 164.07 | 04/04/2026 → 04/09/2026 | +8.87 h |
| 11 | Marketing APSOL | `816dc40f-38bb-48dd-bcfc-b0ddbd929abe` | 16 | 2026-06-01 | 20 | 46.00 | 08/06/2026 → 28/07/2026 | −2.04 h |
| 12 | Open Pack Estabilización | `361c3e6a-c923-4916-8c96-93f2cb16023b` | 16 | 2026-07-22 | 5 | 16.50 | 24/07/2026 → 10/08/2026 | −5.67 h |

**Total: 12 prospectos · 1.411 filas · 3.516,71 horas ponderadas.**

Cada carga fue verificada en el browser (`localhost:5173/cronograma`, panel
"Saldo De Horas — Mes Actual"): el saldo mostrado coincide con el valor calculado.

## Notas por prospecto

- **APSOL - Proyectos Internos:** al inicio se cargó como categoría de texto
  (`prospecto_id = NULL`); se corrigió reasignando al prospecto real y limpiando
  el prefijo `[APSOL - Proyectos Internos]` de la descripción.
- **Amipack 2025:** existen dos prospectos con ese nombre. Se usó
  `559adcf6-…` ("6A - En producción"); el otro (`c1d59cb3-…`, "3H - Caído luego
  del presupuesto") quedó sin tocar. Incluye una fila de **ajuste intencional**
  con `duracion_horas = −9` ("No borrar es un ajuste").
- **DG 2026 / Insuga Chaco:** filas placeholder de Mantenimiento (`M{N}-06`) con
  fecha `06/01/2026` → corregidas a `01/06/2026` (swap día/mes; el resto de las
  filas de Mantenimiento caen siempre en día 01).
- **Mantenimiento:** prospecto real (no categoría de texto). 62 filas, todas
  `multiplicador = 1`.
- **Marketing APSOL:** prospecto sin registros previos; sin duplicados.
  Responsables: Santiago Toscano (16) y Renata Morano (4).
- **Open Pack Estabilización:** existen tres prospectos "Open Pack" (`Open Pack`,
  `Open Pack Final`, `Open Pack Estabilización`). Se usó
  `361c3e6a-…` ("6A - En producción"). Sin registros previos; sin duplicados.
  5 filas, responsables Mateo Courault (3) y Adrian Patriarca (2).

## Pipeline aplicado a cada batch

1. Guardar el paste crudo preservando la estructura de tabs.
2. Parseo + validación en Python (fechas, duraciones negativas, responsables no
   mapeados, herramientas inválidas).
3. Generar los `INSERT` en chunks y ejecutarlos vía `execute_sql`.
4. Verificar `count(*)` y `sum(duracion_horas * multiplicador)` en la DB.
5. Hard-reload del browser y confirmar que el saldo del panel coincide con el
   valor calculado independientemente.
