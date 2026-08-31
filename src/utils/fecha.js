/**
 * Devuelve una fecha en formato 'YYYY-MM-DD' según el calendario LOCAL
 * del navegador (Date#getFullYear/getMonth/getDate), a diferencia de
 * `Date#toISOString().split('T')[0]`, que convierte a UTC y puede
 * mostrar el día siguiente (o anterior) en husos horarios negativos
 * como Argentina (UTC-3) durante la noche.
 * @param {Date} [date]
 * @returns {string}
 */
export function fechaLocalISO(date = new Date()) {
  const anio = date.getFullYear()
  const mes = String(date.getMonth() + 1).padStart(2, '0')
  const dia = String(date.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Verifica que un string sea una fecha 'YYYY-MM-DD' completa y con un año
 * plausible. Se usa para no disparar búsquedas/escrituras (ej. sincronización
 * de UVA) mientras el usuario todavía está tipeando un <input type="date">,
 * ya que algunos navegadores emiten valores parciales con el año a medio
 * escribir (ej. '0002-08-10') antes de completarse.
 * @param {string} fechaStr
 * @returns {boolean}
 */
export function esFechaCompleta(fechaStr) {
  if (!fechaStr || typeof fechaStr !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fechaStr)
  if (!match) return false
  const anio = Number(match[1])
  return anio >= 2000 && anio <= 2100
}

/**
 * Suma (o resta, con un número negativo) una cantidad de meses a una fecha
 * 'YYYY-MM-DD', devolviendo el resultado en el mismo formato. Se usa para
 * calcular fechas derivadas (próxima actualización de tarifa, próxima
 * factura) sin arrastrar el corrimiento de día de toISOString().
 *
 * Clampea el día al último día del mes destino en vez de dejar que
 * `Date` lo desborde al mes siguiente (ej. 31 de enero + 1 mes debe dar
 * 28/29 de febrero, no el 2 o 3 de marzo).
 * @param {string} fechaStr  Formato 'YYYY-MM-DD'
 * @param {number} meses
 * @returns {string}  '' si fechaStr no es válida
 */
export function sumarMeses(fechaStr, meses) {
  if (!esFechaCompleta(fechaStr)) return ''
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  const primerDiaMesDestino = new Date(anio, mes - 1 + meses, 1)
  const ultimoDiaMesDestino = new Date(primerDiaMesDestino.getFullYear(), primerDiaMesDestino.getMonth() + 1, 0).getDate()
  primerDiaMesDestino.setDate(Math.min(dia, ultimoDiaMesDestino))
  return fechaLocalISO(primerDiaMesDestino)
}

/**
 * Suma (o resta, con un número negativo) una cantidad de días a una fecha
 * 'YYYY-MM-DD', devolviendo el resultado en el mismo formato. A diferencia
 * de `new Date(fechaStr)` (que parsea como UTC y puede correr el día en
 * husos horarios negativos), arma la fecha a partir de sus componentes en
 * hora LOCAL antes de sumar.
 * @param {string} fechaStr  Formato 'YYYY-MM-DD'
 * @param {number} dias
 * @returns {string}  '' si fechaStr no es válida
 */
export function sumarDias(fechaStr, dias) {
  if (!esFechaCompleta(fechaStr)) return ''
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  return fechaLocalISO(new Date(anio, mes - 1, dia + dias))
}

/**
 * Suma `n` días HÁBILES a una fecha 'YYYY-MM-DD', salteando únicamente
 * sábados y domingos (no contempla feriados). Se usa para agendar la
 * "próxima notificación" de cobro de una factura: emisión + los días de
 * espera de la empresa, contados en hábiles.
 *
 * Debe quedar SINCRONIZADA con la función SQL `public.apsol_sumar_dias_habiles`
 * (database/migration_recordatorios_pago.sql), que es la que usa el flujo
 * de n8n para reagendar cada recordatorio. Si cambia una, cambiar la otra.
 *
 * `n <= 0` devuelve la misma fecha. Fechas inválidas devuelven ''.
 * @param {string} fechaStr  Formato 'YYYY-MM-DD'
 * @param {number} n  Cantidad de días hábiles a sumar
 * @returns {string}  'YYYY-MM-DD', o '' si fechaStr no es válida
 */
export function sumarDiasHabiles(fechaStr, n) {
  if (!esFechaCompleta(fechaStr)) return ''
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  const d = new Date(anio, mes - 1, dia)
  let restantes = Math.max(Math.trunc(Number(n) || 0), 0)
  while (restantes > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay() // 0 = domingo, 6 = sábado
    if (dow !== 0 && dow !== 6) restantes--
  }
  return fechaLocalISO(d)
}

/**
 * Resta `n` días HÁBILES a una fecha 'YYYY-MM-DD' (espejo de
 * `sumarDiasHabiles`, contando hacia atrás y salteando sábados y domingos).
 * Se usa para calcular desde cuándo un colaborador puede subir su factura:
 * la ventana abre `n` días hábiles antes de la próxima fecha de pago.
 *
 * `n <= 0` devuelve la misma fecha. Fechas inválidas devuelven ''.
 * @param {string} fechaStr  Formato 'YYYY-MM-DD'
 * @param {number} n  Cantidad de días hábiles a restar
 * @returns {string}  'YYYY-MM-DD', o '' si fechaStr no es válida
 */
export function restarDiasHabiles(fechaStr, n) {
  if (!esFechaCompleta(fechaStr)) return ''
  const [anio, mes, dia] = fechaStr.split('-').map(Number)
  const d = new Date(anio, mes - 1, dia)
  let restantes = Math.max(Math.trunc(Number(n) || 0), 0)
  while (restantes > 0) {
    d.setDate(d.getDate() - 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) restantes--
  }
  return fechaLocalISO(d)
}
