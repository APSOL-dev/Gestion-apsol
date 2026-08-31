// Única fuente de verdad de "qué ve cada rol". Antes esta lógica estaba
// copiada 3 veces en App.jsx (guard de rutas, filtro del nav, y faltaba en
// favoritos), lo que la hacía fácil de desincronizar.

/**
 * Rutas que un Colaborador puede ver/visitar. El resto de los roles
 * (Admin, Dueño) ve todo, salvo "Mi Perfil" que es exclusivo de Colaborador
 * (el Admin gestiona su cuenta desde Colaboradores).
 */
export const RUTAS_COLABORADOR = ['/', '/mi-perfil', '/cronograma', '/proyectos', '/sprints', '/tickets', '/preventivos']

export function esColaboradorCargo(cargo) {
  return cargo === 'Colaborador'
}

/**
 * ¿El rol `cargo` puede ver la ruta `ruta`?
 * - Colaborador: solo las de RUTAS_COLABORADOR ('/' exacta, el resto por prefijo).
 * - Admin / Dueño / otro: todo, menos '/mi-perfil'.
 * Sin ruta -> false.
 */
export function rutaVisibleParaRol(ruta, cargo) {
  if (!ruta || typeof ruta !== 'string') return false

  if (esColaboradorCargo(cargo)) {
    return RUTAS_COLABORADOR.some(r => (r === '/' ? ruta === '/' : ruta.startsWith(r)))
  }
  return !ruta.startsWith('/mi-perfil')
}

/**
 * Deja solo los favoritos que el rol puede ver. `favoritos` es la lista
 * guardada en localStorage: [{ to, icon, label }, ...].
 */
export function filtrarFavoritosPorRol(favoritos, cargo) {
  if (!Array.isArray(favoritos)) return []
  return favoritos.filter(f => f && rutaVisibleParaRol(f.to, cargo))
}

/** Clave de localStorage de favoritos, aislada por usuario. */
export function claveFavoritos(userId) {
  return userId ? `apsol_favorites_${userId}` : 'apsol_favorites'
}
