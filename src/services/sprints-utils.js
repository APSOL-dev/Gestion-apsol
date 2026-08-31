// ──────────────────────────────────────────────────────────────
// Lógica pura del módulo de Sprints (sin red / sin DOM).
//
// Reemplazo del cuadernito de OneNote: cada sprint tiene una lista de
// "puntos" y cada punto un semáforo. Los 5 estados son el modelo mental
// que el equipo ya venía usando, más un estado inicial explícito
// (en OneNote "en blanco" = pendiente):
//
//   ⚪ pendiente     · nadie lo empezó
//   🔵 en_progreso   · se está haciendo
//   🟢 verde         · hecho
//   🟡 amarillo      · hecho pero con dudas / a medias
//   🔴 rojo          · no se pudo (bloqueado)
// ──────────────────────────────────────────────────────────────

export const ORDEN_ESTADOS = ['pendiente', 'en_progreso', 'verde', 'amarillo', 'rojo']

export const ESTADOS_ITEM = {
  pendiente:   { label: 'Pendiente',       color: 'var(--color-text-muted)', emoji: '⚪' },
  en_progreso: { label: 'En progreso',     color: 'var(--color-primary)',    emoji: '🔵' },
  verde:       { label: 'Hecho',           color: 'var(--color-success)',    emoji: '🟢' },
  amarillo:    { label: 'Hecho con dudas', color: 'var(--color-orange)',     emoji: '🟡' },
  rojo:        { label: 'No se pudo',      color: 'var(--color-danger)',     emoji: '🔴' },
}

function normalizarEstado(estado) {
  return ORDEN_ESTADOS.includes(estado) ? estado : 'pendiente'
}

// Conteo por estado + total. Base de todos los "semáforos" y dashboards.
export function contarEstados(items) {
  const base = { pendiente: 0, en_progreso: 0, verde: 0, amarillo: 0, rojo: 0, total: 0 }
  if (!Array.isArray(items)) return base
  for (const it of items) {
    base[normalizarEstado(it?.estado)] += 1
    base.total += 1
  }
  return base
}

// Avance = puntos terminados (verde) sobre el total. El amarillo NO suma:
// "hecho con dudas" todavía no está cerrado.
export function porcentajeAvance(items) {
  const { verde, total } = contarEstados(items)
  if (!total) return 0
  return Math.round((verde / total) * 100)
}

export function siguienteOrden(items) {
  const arr = Array.isArray(items) ? items : []
  return arr.reduce((max, it) => Math.max(max, Number(it?.orden) || 0), 0) + 1
}

// Numeración correlativa de sprints POR proyecto (Sprint 1, 2, 3…).
export function siguienteNumeroSprint(sprints) {
  const arr = Array.isArray(sprints) ? sprints : []
  return arr.reduce((max, s) => Math.max(max, Number(s?.numero) || 0), 0) + 1
}

export function ordenarItems(items) {
  return [...(Array.isArray(items) ? items : [])].sort(
    (a, b) => (Number(a?.orden) || 0) - (Number(b?.orden) || 0)
  )
}

export function itemsEnRojo(items) {
  return (Array.isArray(items) ? items : []).filter((it) => it?.estado === 'rojo')
}

// Mueve un punto una posición ↑/↓. Devuelve una lista nueva (no muta).
export function moverItemEnLista(items, id, direccion) {
  const arr = [...(Array.isArray(items) ? items : [])]
  const i = arr.findIndex((it) => it?.id === id)
  if (i === -1) return arr
  const j = direccion === 'arriba' ? i - 1 : i + 1
  if (j < 0 || j >= arr.length) return arr
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  return arr
}

// Tras un movimiento, reasigna orden = índice. Devuelve SOLO los puntos
// que cambiaron de orden, para persistir el mínimo de updates.
export function renumerarOrden(items) {
  const arr = Array.isArray(items) ? items : []
  const cambios = []
  arr.forEach((it, idx) => {
    if ((Number(it?.orden) || 0) !== idx) cambios.push({ id: it.id, orden: idx })
  })
  return cambios
}

// "Foto" que se congela al cerrar el sprint: conteos + % de avance.
// Permite ver la tendencia sprint a sprint sin recalcular sobre datos
// que después se siguen tocando.
export function resumenParaCierre(items) {
  return { ...contarEstados(items), porcentaje_avance: porcentajeAvance(items) }
}

// Click en el semáforo: avanza al siguiente estado y cicla al llegar al final.
export function siguienteEstadoCiclo(estado) {
  const i = ORDEN_ESTADOS.indexOf(normalizarEstado(estado))
  return ORDEN_ESTADOS[(i + 1) % ORDEN_ESTADOS.length]
}

export function puedeEditarSprint(sprint) {
  return sprint?.estado !== 'cerrado'
}

// No hay columna "tipo" en apsol_sprint_item_adjuntos: una imagen subida y
// un link pegado a mano se guardan igual (solo url + nombre). Para pintar
// la fila (miniatura vs. chip de link) se infiere por la extensión.
const EXT_IMAGEN = /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i
export function esImagenUrl(url) {
  return typeof url === 'string' && EXT_IMAGEN.test(url)
}

// Un link adjuntado a mano (a diferencia de una imagen subida) no tiene
// "nombre" propio -> se muestra el dominio como etiqueta del chip.
export function dominioDeUrl(url) {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
