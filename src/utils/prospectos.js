// Semántica de estados de prospecto que no es puro formateo: "¿este
// prospecto ya es un cliente al que se le puede abrir un proyecto?".
//
// La taxonomía real vive en ESTADOS_PROSPECTO (utils/formateo.js) y usa
// prefijos '<n><A|H> - ...'. Un prospecto está "en cartera" (ganado)
// cuando llegó a producción (6A) o quedó finalizado (5H). El resto sigue
// en pipeline de venta (1A..5A, Nuevo) o está caído / no califica (xH).

const PREFIJOS_EN_CARTERA = ['6a', '5h']
const LEGACY_GANADO = ['ganado', 'vendido/ganado', 'activo']

export function prospectoElegibleParaProyecto(prospecto) {
  const e = (prospecto?.estado || '').trim().toLowerCase()
  if (!e) return false
  if (LEGACY_GANADO.includes(e)) return true
  return PREFIJOS_EN_CARTERA.some((p) => e.startsWith(p))
}

/**
 * Lista de prospectos vinculables a un proyecto. Deja los elegibles y,
 * si se pasa `idVinculado` (proyecto en edición), lo incluye aunque su
 * estado ya no califique, para que el <select> pueda mostrar el valor
 * actual sin romperse.
 */
export function filtrarProspectosParaProyecto(prospectos, idVinculado = null) {
  if (!Array.isArray(prospectos)) return []
  return prospectos.filter(
    (p) => prospectoElegibleParaProyecto(p) || (idVinculado && p?.id === idVinculado)
  )
}
