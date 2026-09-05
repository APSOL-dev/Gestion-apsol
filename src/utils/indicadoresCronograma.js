import { esActividadOcupada } from './cronogramaVisibilidad'

/**
 * Suma la dedicación de un conjunto de actividades del cronograma, acotada a
 * los filtros de "Personal" y "Prospectos" que el usuario tenga puestos en la
 * pantalla. Misma semántica que el filtro del calendario (Cronograma.jsx):
 *  - Sin colaboradores seleccionados  -> cuenta todo el personal.
 *  - Sin prospectos seleccionados     -> cuenta todos los prospectos.
 *  - Con selección -> la actividad tiene que matchear
 *    (responsable ∈ seleccionados) Y (prospecto ∈ seleccionados).
 *
 * Ignora los bloques "Ocupado" (reuniones ajenas ya redactadas por la RPC:
 * no tienen duración ni prospecto que atribuir) y las filas viejas sin
 * `duracion_horas` numérica.
 *
 * @param {Array} actividades  actividades YA resueltas (con `prospecto_nombre`),
 *   tal como las deja resolverActividades().
 * @param {object} [opts]
 * @param {string[]} [opts.colaboradoresIds]  ids de colaborador seleccionados en el filtro "Personal"
 * @param {string[]} [opts.prospectosIds]     ids de prospecto seleccionados en el filtro "Prospectos"
 * @param {Array<{id: string, nombre: string}>} [opts.prospectos]  para resolver `prospecto_nombre` -> id
 *   en las actividades sin `prospecto_id` (categorías internas).
 * @returns {{ horas: number, horasPonderadas: number, actividades: number }}
 *   `horas` = Σ duracion_horas; `horasPonderadas` = Σ duracion_horas * multiplicador
 *   (lo que efectivamente suma al saldo); `actividades` = cantidad contada.
 *   `horas` y `horasPonderadas` van redondeadas a 2 decimales.
 */
export function calcularIndicadoresDedicacion(actividades, opts = {}) {
  const { colaboradoresIds = [], prospectosIds = [], prospectos = [] } = opts

  const colSet = new Set((colaboradoresIds || []).filter(Boolean))
  const prospSet = new Set((prospectosIds || []).filter(Boolean))
  const idPorNombre = new Map((prospectos || []).map(p => [p.nombre, p.id]))

  let horas = 0
  let horasPonderadas = 0
  let cuenta = 0

  for (const act of actividades || []) {
    if (!act || esActividadOcupada(act)) continue

    if (colSet.size > 0 && (!act.responsable_id || !colSet.has(act.responsable_id))) continue

    if (prospSet.size > 0) {
      const pid = act.prospecto_id || idPorNombre.get(act.prospecto_nombre)
      if (!pid || !prospSet.has(pid)) continue
    }

    if (act.duracion_horas == null || act.duracion_horas === '') continue
    const dur = Number(act.duracion_horas)
    if (!Number.isFinite(dur)) continue

    const mult = Number(act.multiplicador)
    horas += dur
    horasPonderadas += dur * (Number.isFinite(mult) ? mult : 1)
    cuenta += 1
  }

  return {
    horas: Math.round(horas * 100) / 100,
    horasPonderadas: Math.round(horasPonderadas * 100) / 100,
    actividades: cuenta
  }
}
