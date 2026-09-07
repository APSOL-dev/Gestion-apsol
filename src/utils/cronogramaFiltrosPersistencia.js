/**
 * Persistencia de los filtros de la barra del Cronograma: rango Desde/Hasta,
 * "Personal", "Prospectos", el tilde "Ver histórico" y "Agenda externa".
 * Así cada usuario los reencuentra como los dejó al refrescar la página o
 * volver a iniciar sesión.
 *
 * Se guarda POR USUARIO (varios colaboradores pueden compartir el mismo
 * navegador). Lógica pura y sin React: Cronograma.jsx aporta el userId y el
 * estado, y decide qué hacer con lo que devuelve.
 */

const CLAVE = 'apsol_cronograma_filtros'
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/

function claveUsuario(userId) {
  return userId ? String(userId) : '_'
}

function leerTodo() {
  try {
    const crudo = localStorage.getItem(CLAVE)
    if (!crudo) return {}
    const obj = JSON.parse(crudo)
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {}
  } catch {
    return {}
  }
}

function esArrayDeStrings(v) {
  return Array.isArray(v) && v.every(x => typeof x === 'string')
}

/**
 * Filtros guardados para ese usuario, ya validados. Solo incluye las claves
 * cuyo valor guardado tiene la forma esperada; el resto se omite para que el
 * caller use su default.
 * @param {string|null|undefined} userId
 * @returns {{fechaDesde?: string, fechaHasta?: string, selectedColab?: string[], selectedProspectos?: string[], verHistorico?: boolean, verAgendaExterna?: boolean}}
 */
export function leerFiltrosGuardados(userId) {
  const guardado = leerTodo()[claveUsuario(userId)]
  if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return {}

  const out = {}
  if (RE_FECHA.test(guardado.fechaDesde)) out.fechaDesde = guardado.fechaDesde
  if (RE_FECHA.test(guardado.fechaHasta)) out.fechaHasta = guardado.fechaHasta
  if (esArrayDeStrings(guardado.selectedColab)) out.selectedColab = guardado.selectedColab
  if (esArrayDeStrings(guardado.selectedProspectos)) out.selectedProspectos = guardado.selectedProspectos
  if (typeof guardado.verHistorico === 'boolean') out.verHistorico = guardado.verHistorico
  if (typeof guardado.verAgendaExterna === 'boolean') out.verAgendaExterna = guardado.verAgendaExterna
  return out
}

/**
 * Guarda (mergeando) los filtros de ese usuario. No pisa los de otros
 * usuarios del mismo navegador. Silencioso si localStorage no está.
 * @param {string|null|undefined} userId
 * @param {object} filtros  subconjunto de las claves de leerFiltrosGuardados
 */
export function guardarFiltros(userId, filtros) {
  try {
    const todo = leerTodo()
    const k = claveUsuario(userId)
    const previo = todo[k] && typeof todo[k] === 'object' && !Array.isArray(todo[k]) ? todo[k] : {}
    todo[k] = { ...previo, ...filtros }
    localStorage.setItem(CLAVE, JSON.stringify(todo))
  } catch {
    // localStorage no disponible: los filtros solo duran esta sesión.
  }
}
