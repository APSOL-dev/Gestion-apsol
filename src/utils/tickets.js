// Reglas puras del módulo Tickets (sin React), para poder testearlas.

/**
 * Colaboradores a los que se les puede asignar un ticket: activos y con
 * usuario vinculado en la app (sin usuario no pueden recibir la notificación
 * ni entrar a ver el ticket, así que asignárselo es como dejarlo sin dueño).
 *
 * Si el ticket YA tiene un responsable que dejó de ser asignable (ej. una
 * persona dada de baja), se conserva en la lista marcado `noAsignable` para
 * que el desplegable no lo muestre en blanco y el guardado no lo pise sin
 * querer.
 */
export function colaboradoresAsignables(colaboradores, responsableActualId) {
  const lista = Array.isArray(colaboradores) ? colaboradores : []
  const asignables = lista.filter(c => c && c.activo !== false && c.usuario_id)
  if (responsableActualId && !asignables.some(c => c.id === responsableActualId)) {
    const actual = lista.find(c => c?.id === responsableActualId)
    if (actual) return [...asignables, { ...actual, noAsignable: true }]
  }
  return asignables
}

/**
 * Responsable que se propone al elegir un proyecto: su líder, siempre que
 * sea asignable. Devuelve '' (sin asignar) si no hay líder o no se le puede
 * asignar.
 */
export function responsablePorDefecto(proyecto, asignables) {
  const liderId = proyecto?.lider_colaborador_id
  if (!liderId) return ''
  const ok = (asignables || []).some(c => c.id === liderId && !c.noAsignable)
  return ok ? liderId : ''
}

/**
 * Muestra una fecha 'YYYY-MM-DD' (o timestamp ISO) como d/m/yyyy SIN pasar
 * por `new Date()`: una fecha sola se interpreta como UTC y en Argentina
 * (UTC-3) se veía un día antes.
 */
export function formatearFechaTicket(valor) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor || ''))
  if (!m) return '-'
  return `${Number(m[3])}/${Number(m[2])}/${m[1]}`
}

export function colorPrioridadTicket(prioridad) {
  if (prioridad === 'Urgente' || prioridad === 'Alta') return 'var(--color-danger)'
  if (prioridad === 'Media') return 'var(--color-orange)'
  return 'var(--color-text-muted)'
}
