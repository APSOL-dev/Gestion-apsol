/**
 * Lógica pura del feature "Sumar mantenimiento" del Cronograma.
 *
 * Cada cliente de la lista fija genera UNA actividad, idéntica a las que se
 * venían cargando a mano: día 1 del mes a las 00:00, duración = sus horas,
 * todas arrancan a la misma hora y se superponen (no importa). El nombre del
 * cliente sale de `prospecto_id`; la descripción es siempre el texto fijo.
 *
 * Sin lógica de día hábil: si el 1 cae domingo, va igual el domingo.
 */
import moment from 'moment'

/** "Mantenimiento (recurso interno)" — el responsable de estas filas. */
export const RESPONSABLE_MANTENIMIENTO_ID = '77dd95fd-c818-4382-8f4b-5be453dd68f1'

/** Texto fijo de la descripción (como se venía cargando a mano). */
export const DESCRIPCION_MANTENIMIENTO = 'Mantenimiento Activos'

/** Marca en apsol_cronograma.origen de las filas que crea el botón. */
export const ORIGEN_MANTENIMIENTO = 'mantenimiento_mensual'

const RE_MES = /^(\d{4})-(0[1-9]|1[0-2])$/

/** 'YYYY-MM' del mes de la fecha dada (por defecto, hoy). */
export function mesActual(date = new Date()) {
  return moment(date).format('YYYY-MM')
}

/**
 * Rango [desde, hasta) del mes, como horas de pared locales:
 *   { desde: 'YYYY-MM-01T00:00', hasta: '<día 1 del mes siguiente>T00:00' }
 * Se usa para consultar / borrar las actividades de mantenimiento de ese mes.
 * @param {string} mes  'YYYY-MM'
 * @returns {{desde: string, hasta: string} | null}
 */
export function rangoDelMes(mes) {
  if (!RE_MES.test(String(mes || ''))) return null
  const inicio = moment(`${mes}-01`, 'YYYY-MM-DD', true)
  if (!inicio.isValid()) return null
  return {
    desde: inicio.format('YYYY-MM-DDT00:00'),
    hasta: inicio.clone().add(1, 'month').format('YYYY-MM-DDT00:00'),
  }
}

/**
 * Arma las filas de mantenimiento del mes.
 * @param {{mes?: string, items?: Array<{prospecto_id: string, horas: number}>}} args
 * @returns {Array<{prospecto_id: string, inicio: string, fin: string, duracion_horas: number, descripcion: string}>}
 *          `inicio`/`fin` son horas de pared locales ('YYYY-MM-DDTHH:mm'); el
 *          servicio las pasa a UTC igual que el modal de "Nueva Actividad".
 */
export function planificarMantenimientoMes({ mes, items } = {}) {
  if (!RE_MES.test(String(mes || '')) || !Array.isArray(items) || items.length === 0) return []

  const inicio = `${mes}-01T00:00`
  return items
    .map(it => {
      const horas = Number(it?.horas)
      if (!it?.prospecto_id || !Number.isFinite(horas) || horas <= 0) return null
      return {
        prospecto_id: it.prospecto_id,
        inicio,
        fin: moment(inicio, 'YYYY-MM-DDTHH:mm', true).add(horas, 'hours').format('YYYY-MM-DDTHH:mm'),
        duracion_horas: horas,
        descripcion: DESCRIPCION_MANTENIMIENTO,
      }
    })
    .filter(Boolean)
}
