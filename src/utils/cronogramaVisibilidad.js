// Regla de visibilidad del Cronograma para un Colaborador.
//
// Un Colaborador ve:
//  - completo: sus propias actividades, las de OTROS colaboradores, y las
//    del Admin en las que él participa (responsable o en participantes_ids).
//  - "Ocupado" (bloque opaco, sin datos): las REUNIONES del Admin en las
//    que él NO participa. Reunión = reunion_cliente, o con link de reunión,
//    o con participantes cargados.
//  - nada: los bloques de trabajo del Admin (no-reunión) en los que no
//    participa -> se filtran, no aparecen.
//
// Un Admin ve todo completo.
//
// Esta lógica debe quedar SINCRONIZADA con la función SQL
// `public.apsol_cronograma_visible` (database/migration_cronograma_visibilidad.sql),
// que es la fuente autoritativa (corre en el servidor). Acá se usa como
// spec testeable y como segundo filtro defensivo en el cliente.

const CARGOS_ADMIN = ['Admin', 'Dueño']

export function esCargoAdmin(cargo) {
  return CARGOS_ADMIN.includes(cargo)
}

/** ¿La actividad es una "reunión" (con quien sea)? */
export function esReunionCronograma(act) {
  if (!act) return false
  if (act.reunion_cliente) return true
  if (typeof act.link_reunion === 'string' && act.link_reunion.trim() !== '') return true
  if (Array.isArray(act.participantes_ids) && act.participantes_ids.length > 0) return true
  return false
}

/**
 * @param {object} actividad  fila de cronograma (responsable_id, participantes_ids, reunion_cliente, link_reunion...)
 * @param {{ miColaboradorId?: string|null, soyAdmin?: boolean, adminColaboradorIds?: Iterable<string> }} ctx
 * @returns {'completa' | 'ocupado' | 'oculta'}
 */
export function clasificarActividadCronograma(actividad, ctx = {}) {
  const { miColaboradorId = null, soyAdmin = false } = ctx
  if (soyAdmin) return 'completa'
  if (!actividad) return 'oculta'

  const adminIds = ctx.adminColaboradorIds instanceof Set
    ? ctx.adminColaboradorIds
    : new Set(ctx.adminColaboradorIds || [])

  const responsableEsAdmin = adminIds.has(actividad.responsable_id)
  if (!responsableEsAdmin) return 'completa' // propia o de otro colaborador

  const participo = (miColaboradorId != null && actividad.responsable_id === miColaboradorId)
    || (Array.isArray(actividad.participantes_ids)
        && miColaboradorId != null
        && actividad.participantes_ids.includes(miColaboradorId))
  if (participo) return 'completa'

  return esReunionCronograma(actividad) ? 'ocupado' : 'oculta'
}

/** Redacta una actividad del Admin a un bloque "Ocupado" sin datos sensibles. */
export function redactarActividadOcupada(act) {
  return {
    id: act.id,
    inicio: act.inicio,
    fin: act.fin,
    responsable_id: act.responsable_id, // se mantiene para agrupar bajo su nombre
    descripcion: 'Ocupado',
    prospecto_id: null,
    duracion_horas: null,
    reunion_cliente: false,
    link_reunion: null,
    comentarios_reunion: null,
    participantes_ids: [],
    ocupado: true
  }
}

export function esActividadOcupada(act) {
  return !!act && (act.ocupado === true || (act.descripcion === 'Ocupado' && !act.prospecto_id))
}

/**
 * Normaliza responsable + invitados de una actividad según quién la guarda:
 *  - Un Colaborador SIEMPRE queda como responsable de lo que agenda, y puede
 *    invitar como mucho a UNA persona (a sí mismo nunca).
 *  - Un Admin puede poner cualquier responsable y varios invitados; se le
 *    saca de la lista al propio responsable y se deduplica.
 *
 * @param {{ responsable_id?: string, participantes_ids?: string[] }} form
 * @param {{ esColaborador?: boolean, miColaboradorId?: string|null }} ctx
 * @returns {{ responsable_id: string, participantes_ids: string[] }}
 */
export function normalizarResponsableEInvitados(form = {}, ctx = {}) {
  const { esColaborador = false, miColaboradorId = null } = ctx
  const responsable_id = esColaborador && miColaboradorId
    ? miColaboradorId
    : (form.responsable_id || '')

  let invitados = Array.isArray(form.participantes_ids) ? form.participantes_ids.slice() : []
  invitados = [...new Set(invitados.filter(Boolean))]
    .filter(id => id !== responsable_id)

  if (esColaborador) invitados = invitados.slice(0, 1)

  return { responsable_id, participantes_ids: invitados }
}

/**
 * Aplica la regla a una lista: descarta las 'oculta' y redacta las 'ocupado'.
 * Las 'completa' pasan tal cual.
 */
export function filtrarCronogramaVisible(actividades, ctx) {
  if (!Array.isArray(actividades)) return []
  const salida = []
  for (const act of actividades) {
    const clase = clasificarActividadCronograma(act, ctx)
    if (clase === 'oculta') continue
    salida.push(clase === 'ocupado' ? redactarActividadOcupada(act) : act)
  }
  return salida
}
