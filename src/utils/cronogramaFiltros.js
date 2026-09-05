/**
 * Filtros de las listas de la barra del Cronograma ("Personal" y
 * "Prospectos"), gobernados por el tilde "Ver histórico":
 *  - apagado (por defecto): solo lo vigente — colaboradores activos y
 *    prospectos en producción.
 *  - encendido: además, ex-colaboradores de baja y prospectos finalizados.
 *
 * Lógica pura y sin React para poder testearla: Cronograma.jsx solo aporta
 * el estado del tilde y los datos crudos (lista completa de colaboradores y
 * de prospectos del store).
 */

const ESTADO_PRODUCCION = '6A - En producción'
const ESTADO_FINALIZADO = '5H - Finalizados'

// Filas de conciliación de la migración de AppSheet (nombre "(sheet id abc)"):
// no son personas, nunca van como opción del filtro "Personal".
const RE_STUB_CONCILIACION = /^\(sheet id\b/i

export function esColaboradorConciliacion(colaborador) {
  return RE_STUB_CONCILIACION.test(colaborador?.nombre || '')
}

/**
 * Opciones visibles del filtro "Personal".
 * @param {Array<{nombre?: string, activo?: boolean}>} colaboradores  lista
 *   completa, tal como la devuelve getColaboradoresLista({ soloActivos: false })
 * @param {boolean} verHistorico
 * @returns {Array}
 */
export function personalVisible(colaboradores, verHistorico) {
  // `activo` lo setea getColaboradoresLista (activo = estado !== 'Inactivo'):
  // con el tilde apagado se oculta solo a quien está EXPLÍCITAMENTE de baja
  // (`activo === false`), nunca a quien viene sin el dato.
  return (colaboradores || [])
    .filter(c => !esColaboradorConciliacion(c))
    .filter(c => verHistorico || c.activo !== false)
}

/**
 * Opciones visibles del filtro "Prospectos".
 * @param {Array<{estado?: string}>} prospectos  lista completa del store
 * @param {boolean} verHistorico
 * @returns {Array}
 */
export function prospectosFiltrables(prospectos, verHistorico) {
  return (prospectos || []).filter(p =>
    p.estado === ESTADO_PRODUCCION ||
    (verHistorico && p.estado === ESTADO_FINALIZADO)
  )
}

/**
 * Deja en `seleccionIds` solo los ids que siguen estando entre las opciones
 * visibles. Se llama al apagar "Ver histórico" para no dejar un filtro
 * fantasma (un chip "(1)" cuya opción ya no aparece en la lista).
 * @param {string[]} seleccionIds
 * @param {Array<{id: string}>} opcionesVisibles
 * @returns {string[]}  el MISMO array si no hubo que podar nada (evita
 *   re-renderizar de gusto)
 */
export function podarSeleccion(seleccionIds, opcionesVisibles) {
  const ids = seleccionIds || []
  const visibles = new Set((opcionesVisibles || []).map(o => o.id))
  const podada = ids.filter(id => visibles.has(id))
  return podada.length === ids.length ? seleccionIds : podada
}
