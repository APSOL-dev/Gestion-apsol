# Relevamiento Mobile — correcciones para que la app se vea bien en el celular

Relevamiento hecho en viewport de **375 px** (iPhone), navegando la app pantalla por
pantalla y abriendo modales/drawers. **Nada de esto cambia funcionalidad, datos ni
cálculos** — es todo CSS/layout. Los únicos ítems que tocan JSX están marcados **[JSX]**;
el resto es CSS aditivo dentro de los `@media (max-width: 768px)` que ya existen en
[`src/index.css`](../src/index.css).

---

## 0. Estado general

| | |
|---|---|
| **Ya andan bien en mobile** | Login · Dashboard · **todas las listas** (Empresas, Contactos, Prospectos, Colaboradores, Facturas, Sprints, Tickets…) — gracias al patrón "tabla → tarjetas apiladas" del `@media (max-width:768px)` y al sidebar que se vuelve drawer. |
| **Rotas (foco)** | **Cronograma** (inusable) y **Facturación** (la lista de facturas queda fuera de pantalla). |
| **Problemas transversales** | 4 drawers con ancho fijo · formularios en 2/3 columnas que no colapsan · tablas de detalle de 5-6 columnas que al volverse tarjeta pierden los rótulos. |
| **¿Afecta funcionalidad?** | **No.** Cero impacto en lógica, datos o permisos. Único riesgo real: romper sin querer cómo se ve en escritorio → revisar en las dos pantallas antes de cerrar cada bloque. |

### Orden de ataque sugerido

1. **Global 1.7 + 1.8** (`100dvh` + `overflow-x:hidden`) — red de seguridad, 2 líneas.
2. **Cronograma 5.1** — está roto y es de lo más usado.
3. **Facturación 6.1**.
4. **Drawers 1.3** — 1 línea × 4 archivos.
5. **Formularios 1.1** + grillas de §5/§6/§7 (`2fr 1fr`, `repeat(3,1fr)`, `minmax(350px)`).
6. **Tablas anchas 1.6** (`data-label`) — único ítem con algo de laburo de JSX.
7. Ajustes finos: áreas táctiles, paddings, doble scroll.

---

## 1. Global / transversal

| # | Qué pasa | Cambio sugerido |
|---|---|---|
| 1.1 | `.form-grid` ([index.css:1445](../src/index.css#L1445)) queda en **2 columnas** en mobile salvo dentro de modales `.premium`. Los drawers y modales genéricos con formularios quedan con inputs de ~150 px. | En el `@media (max-width:768px)`: `.form-grid{grid-template-columns:1fr}`. |
| 1.2 | El `.modal-content` genérico ([index.css:2466](../src/index.css#L2466), `max-width:650px`) **no tiene breakpoint mobile**: header/body/footer con `padding:24px` quedan apretados, el contenido roza los bordes. | Replicar el bloque `@media (max-width:640px)` que ya existe para `.modal-content.premium` ([index.css:2388](../src/index.css#L2388)): full-width, radius 16, padding lateral 18. |
| 1.3 **[JSX]** | Los 4 **drawers** (`EmpresaDrawer`, `ContactoDrawer`, `ProspectoDrawer`, `FacturacionDrawer`) tienen `width:'460px'` fijo **sin `maxWidth`** ([EmpresaDrawer.jsx:84](../src/components/EmpresaDrawer.jsx#L84) y equivalentes). En pantallas < 460 px se cortan por la derecha (incluido el botón de cerrar). | `width:'min(460px, 100vw)'` (o `width:'460px', maxWidth:'100vw'`). Una línea por drawer. |
| 1.4 | El selector `[style*="grid-template-columns: 1fr 1fr"]` ([index.css:1142](../src/index.css#L1142)) matchea por substring y también pega en `1fr 1fr auto`, colapsando la 3ª columna `auto` (botón "Agregar" de Valores UVA). | Acotar el selector, o arreglar ese form puntual (ver 6.2). |
| 1.5 | Grillas **inline** que no colapsan en mobile (no las alcanza ningún media query): `repeat(3,1fr)`, `2fr 1fr`, `minmax(350px,1fr)`. Detalle por pantalla más abajo. | Envolver cada una con su `@media (max-width:768px){ … : 1fr }`, o agregar una clase utilitaria común. |
| 1.6 **[JSX]** | Tablas de detalle de 5-6 columnas (Contratos, Facturas dentro de fichas): el `@media` oculta el `<thead>` y muestra los valores **sin rótulo** (`1/1/2027`, `Colaborador`, `1,25`, `$1.051.000`). | Agregar `data-label` a cada `<td>` y en el `@media` mostrarlo con `td::before{content:attr(data-label)}`. Solo para las tablas "anchas"; las de 2-3 columnas están bien así. |
| 1.7 | `100vh` en `.app-layout` ([index.css:87](../src/index.css#L87)): con la barra de direcciones de Safari/Chrome mobile recorta ~60-100 px del fondo. | Usar `100dvh` (con fallback `100vh`). |
| 1.8 | No hay `overflow-x:hidden` en `body`. Cualquier overflow puntual (ver Cronograma/Facturación) genera scroll horizontal de toda la página. | `html,body{overflow-x:hidden}` o `max-width:100vw` como red de seguridad. |
| 1.9 | Botones-ícono chicos (pin de favoritos, cerrar, papelera en filas) rondan 24-28 px de área táctil, por debajo de los ~44 px recomendados. | Subir `padding` / `min-width/min-height` a 40-44 px solo en `@media (max-width:768px)`. |

---

## 2. Login

Sin cambios. `.login-card` ya reduce padding en mobile ([index.css:1155](../src/index.css#L1155)) y el form es de 1 columna.

---

## 3. Dashboard / Inicio

Funciona. `.dashboard-grid` pasa a 2 columnas a 768 px y a 1 columna a 480 px.

- **Menor**: los montos (`$246.055.952`) con `font-size:17px` en tarjeta de 1 columna entran justo; si se quiere aire, bajar a 15-16 px en `@media (max-width:480px)`.
- **Menor**: tarjetas "Eventos de hoy" / "Preventivos" / "CRM" con `padding:18px 20px` fijo; en mobile se puede bajar a 14-16.

---

## 4. CRM

### 4.1 Listas (Empresas, Contactos, Prospectos)
OK. El patrón tabla→tarjeta anda bien (verificado en Prospectos: cards apiladas, agrupadas por estado, buscador y filtros a ancho completo).

### 4.2 Drawers (Empresa, Contacto, Prospecto)
- Ver **1.3** (ancho fijo 460 px).
- Dentro del drawer, varias secciones usan filas `display:flex` con `<span>`/botones que no envuelven (ej. [ProspectoDrawer.jsx:417](../src/components/ProspectoDrawer.jsx#L417), [EmpresaDrawer.jsx:217](../src/components/EmpresaDrawer.jsx#L217)): revisar `flex-wrap:wrap` una vez arreglado el ancho.
- El header del drawer (`padding:20px`, título 18 px + subtítulo + botón cerrar) queda ajustado a 375 px; reducir padding a 16 en mobile.

### 4.3 EmpresaDetalle — overflow real
[EmpresaDetalle.jsx:259](../src/pages/EmpresaDetalle.jsx#L259): grid `repeat(auto-fit, minmax(350px, 1fr))`. En 375 px el ancho disponible es ~343 px < 350 → **fuerza scroll horizontal**. Bajar el `minmax` a `minmax(280px,1fr)` o envolver con media query a `1fr`.

### 4.4 ProspectoDetalle
- [ProspectoDetalle.jsx:1166](../src/pages/ProspectoDetalle.jsx#L1166): `repeat(auto-fit, minmax(200px,1fr))` → OK.
- [ProspectoDetalle.jsx:1309](../src/pages/ProspectoDetalle.jsx#L1309): mini-modal `.card` con `width:400px; maxWidth:90%` → OK (el 90% lo salva).
- Grid principal ya es `1fr` ([:611](../src/pages/ProspectoDetalle.jsx#L611)) → OK.

### 4.5 ContactoDetalle
Revisar el grid de datos (mismo patrón que EmpresaDetalle); si usa `minmax(≥344px)`, mismo fix que 4.3.

---

## 5. Operaciones

### 5.1 Cronograma — CRÍTICO (hoy inusable en mobile)

Lo que se ve hoy en el celular: el calendario queda aplastado en una franja de ~4 cm y solo se ve el panel de "Saldo de Horas" de la derecha. Los filtros de fecha se cortan.

| # | Qué pasa | Cambio |
|---|---|---|
| 5.1.a | `.cronograma-layout` ([index.css:1483](../src/index.css#L1483)) es `grid-template-columns: 1fr var(--ancho-panel-saldo,320px)` y **nunca colapsa**. | `@media (max-width:768px){ .cronograma-layout{ grid-template-columns:1fr; height:auto } }` y apilar el panel de saldo debajo del calendario. |
| 5.1.b | `.panel-resize-handle` / `.col-resize-handle` (divisores arrastrables) no tienen sentido en mobile y quedan como zonas muertas. | Ocultarlos en el mismo media query (`display:none`). |
| 5.1.c | `.cronograma-filtros-bar` ([index.css:1733](../src/index.css#L1733)): `padding:20px 32px`, `gap:32px`, con Desde/Hasta + Personal + Prospectos + "Ver histórico" + "Agenda externa". En 375 px se desborda (los `input[type=date]` se cortan). | En mobile: `flex-direction:column; align-items:stretch; gap:12px; padding:16px`. Los dos date pasan a 1 por fila. |
| 5.1.d | `.calendar-toolbar` ([index.css:1822](../src/index.css#L1822)): `justify-content:space-between` con view-switcher (Día/Semana/Mes) + `.current-range{min-width:180px}` + botones Teams/＋. Se desborda. | En mobile: `flex-wrap:wrap` + `.current-range{min-width:0; flex-basis:100%; order:-1}`. |
| 5.1.e **[JSX opc.]** | `.rbc-wrapper{height:800px}` fijo y la vista **Semana** tiene 7 columnas de día → ancho intrínseco > 375 px. | Envolver `.rbc-time-view`/`.rbc-month-view` en contenedor con `overflow-x:auto`, **o** forzar vista "Día" por defecto en mobile. |
| 5.1.f | Panel "Saldo de Horas": el grid interno (~230 px) entra bien una vez que el panel es full-width. Los 3 stat boxes de "Horas Dedicadas — Según Filtros" sí se pueden cortar. | Los 3 stat boxes: `flex-wrap:wrap` o 1 columna en mobile. |
| 5.1.g **[JSX opc.]** | Modal "Nueva Actividad" (`.modal-content.premium`): **ya** está contemplado a 640 px. Verificar en dispositivo real los `react-select` (Prospecto/Responsable/Invitados) y la fila de fecha/hora (`.gcal-date-row`) — el dropdown de react-select a veces se corta contra el borde. | Posible `menuPlacement="auto"` / `menuPosition="fixed"`. |
| 5.1.h | `.filtro-multiselect .picker-dropdown{min-width:300px; max-width:380px}` ([index.css:1790](../src/index.css#L1790)): en 375 px un dropdown de 380 px se sale. | `max-width:min(380px, calc(100vw - 32px))`. |

### 5.2 Planificación / Gantt (PlanDetalle)
- `.gantt-box` ya tiene `overflow-x:auto` ([PlanDetalle.jsx:626](../src/pages/PlanDetalle.jsx#L626)) → el Gantt scrollea horizontal. Aceptable; opcionalmente mostrar aviso "girá el teléfono".
- [Planificacion.jsx:149](../src/pages/Planificacion.jsx#L149): grid `minmax(300px,1fr)` → entra en 343 px, OK.

### 5.3 Preventivos / PreventivoDetalle
- Lista: usa `.table-container` → OK.
- Detalle: revisar el input de "días" ([PreventivoDetalle.jsx:181](../src/pages/PreventivoDetalle.jsx#L181)) y grids `repeat(auto-fit, minmax(...))` — si el `minmax` es ≥ 344, aplicar fix 4.3.

---

## 6. Administración

### 6.1 Facturación — CRÍTICO
La pantalla tiene una columna de filtros/estados a la izquierda y la lista de facturas a la derecha, lado a lado. En el celular la lista queda aplastada contra el borde derecho y casi no se ve.

| # | Qué pasa | Cambio |
|---|---|---|
| 6.1.a | `.facturacion-layout` ([Facturacion.jsx:247](../src/pages/Facturacion.jsx#L247)) es `display:flex` inline con `.facturacion-sidebar{width:240px; flexShrink:0}` + `.facturacion-main{flex:1}`. **No colapsa**: la lista de facturas queda en una columna de ~63 px. | `@media (max-width:768px)`: `.facturacion-layout{flex-direction:column}` y `.facturacion-sidebar{width:100%}`. Una vez apilado, la tabla interna (ya está en `.table-container`) se vuelve tarjetas sola. |
| 6.1.b | Card de filtros ([Facturacion.jsx:182](../src/pages/Facturacion.jsx#L182)): "Fecha de emisión" y "Fecha de pago" son dos `<input type=date>` en fila `display:flex` sin `flex-wrap` → el segundo se corta. | `flex-wrap:wrap` en el contenedor de cada par, y `width:100%` a los date en mobile. |
| 6.1.c | `.page-header` sobreescrito inline con `display:flex; justifyContent:space-between` ([Facturacion.jsx:170](../src/pages/Facturacion.jsx#L170)): en mobile el título "Facturación" aparece centrado (inconsistente con el resto de las pantallas). | Quitar el override inline y dejar que actúe `.page-header` global, o replicar `flex-direction:column; align-items:flex-start`. |
| 6.1.d | Fila de paginación ([Facturacion.jsx:432](../src/pages/Facturacion.jsx#L432)): `justify-content:space-between` con "Mostrando 1–20 de 365" + botones. Revisar que no se desborde. | `flex-wrap:wrap` + centrar. |

### 6.2 Valores UVA
- [ValoresUVA.jsx:58](../src/pages/ValoresUVA.jsx#L58): form `grid-template-columns: 1fr 1fr auto`. Lo pega parcialmente el selector de 1.4 y colapsa la columna `auto` (botón "Agregar" queda estirado/deforme). Definir un `@media` propio a `1fr` para ese form. **[JSX/CSS]**
- Tabla de valores: usa `.table-container` → OK.

### 6.3 Colaboradores (lista)
OK en mobile (verificado).

### 6.4 ColaboradorDetalle

| # | Qué pasa | Cambio |
|---|---|---|
| 6.4.a | Grid principal `.colaborador-detalle-grid` **sí** colapsa a 1 columna a 980 px ([index.css:1049](../src/index.css#L1049)) → OK. | — |
| 6.4.b | Encabezado (botón ←, nombre, "Guardar", papelera) no usa `.page-header`: el nombre parte en 2 líneas y los botones quedan apretados. | Envolver en `.page-header` o darle `flex-wrap:wrap; gap:12px` en mobile. |
| 6.4.c | [ColaboradorDetalle.jsx:555](../src/pages/ColaboradorDetalle.jsx#L555): "Días de descanso" en `repeat(3,1fr)` → 3 columnas de ~100 px, los rótulos "Acumulados"/"Disponibles" al límite. | `@media`: `repeat(3,1fr)` → `1fr` (apilado) o `repeat(2,1fr)`. |
| 6.4.d | Tarjetas "Facturas" y "Contratos colaborador" con altura fija y scroll interno → **doble scroll** en mobile (scroll dentro de un scroll). | En `@media (max-width:768px)`: `max-height:none; overflow:visible` en esos contenedores. |
| 6.4.e | Tabla de Contratos (6 campos) → al volverse tarjeta pierde rótulos. | Ver 1.6 (`data-label`). |

### 6.5 Cuentas Bancarias / Credenciales
Listas con `.table-container` → OK. En Credenciales, agregar `word-break:break-all` en mobile para que el valor "secreto" largo no desborde.

---

## 7. Sprints / Tickets / Proyectos / Capacitación

| # | Pantalla | Qué pasa | Cambio |
|---|---|---|---|
| 7.1 | Listas (Sprints, Tickets, Proyectos, Capacitación) | Usan `.table-container` → OK. | — |
| 7.2 | [ProyectoDetalle.jsx:193](../src/pages/ProyectoDetalle.jsx#L193) | Grid `2fr 1fr` (contenido + aside) no colapsa → el aside queda en ~120 px. | `@media (max-width:768px){ … : 1fr }`. |
| 7.3 | [TicketDetalle.jsx:152](../src/pages/TicketDetalle.jsx#L152) | Igual `2fr 1fr`. | Mismo fix. |
| 7.4 | [CapacitacionDetalle.jsx:320](../src/pages/CapacitacionDetalle.jsx#L320) | Igual `2fr 1fr`. | Mismo fix. |
| 7.5 | Sprints (tablero) | Si el tablero es de columnas horizontales tipo kanban, definir `overflow-x:auto` en el contenedor de columnas. **Verificar en dispositivo.** | |
| 7.6 | CapacitacionChat | Revisar que el input de chat quede fijo abajo (`position:sticky; bottom:0`) y no tapado por el teclado. | |

---

## 8. Mi Perfil

| # | Qué pasa | Cambio |
|---|---|---|
| 8.1 | [MiPerfil.jsx:292](../src/pages/MiPerfil.jsx#L292) y [:401](../src/pages/MiPerfil.jsx#L401): dos grids `repeat(3,1fr)` (Días de descanso + otro bloque de stats) → 3 columnas muy chicas. | `@media`: `1fr` o `repeat(2,1fr)`. |
| 8.2 | Tabla de contratos del perfil → mismo tema de rótulos que 1.6 / 6.4.e. | Ver 1.6. |
| 8.3 | Bloque de subida de factura + form de cambio de contraseña: verificar que los inputs vayan a `width:100%` (los alcanza el reset global de `input`, pero confirmar que no haya un `.form-grid` 2-col encima). | |
| 8.4 | Tarjeta "Facturas" con scroll interno → doble scroll, igual que 6.4.d. | |

---

## Resumen para decidir

| | |
|---|---|
| **¿Rompe algo?** | No. Cero impacto en funcionalidad, datos o cálculos. |
| **¿Cuánto es?** | Grande en volumen (muchas pantallas), pero simple: casi todo es acomodar cosas que hoy están lado a lado para que se apilen. |
| **Único laburo de JSX** | 1.3 (ancho de drawers, 1 línea × 4), 1.6 (`data-label` en 2 tablas) y, opcional, 5.1.e (vista "Día" por defecto en Cronograma). |
| **Riesgo** | Romper sin querer el escritorio. Mitigación: revisar en celular y escritorio antes de cerrar cada bloque. |
