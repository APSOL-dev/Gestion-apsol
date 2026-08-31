/**
 * Borrador de "Nueva Factura" en el navegador (localStorage), para no perder
 * lo que se estaba cargando si se sale de la pantalla. NO toca Supabase: no
 * hay fila, ni webhook, ni número de invoice consumido. Es best-effort — si
 * localStorage falla (modo privado, cuota, deshabilitado) simplemente no hay
 * borrador, sin romper nada.
 *
 * Un solo borrador a la vez (el último). Por navegador y por máquina.
 */

export const CLAVE_BORRADOR_FACTURA = 'apsol_borrador_factura'

// Campos que no tiene sentido persistir: se recalculan solos al abrir la
// pantalla (montos) o vienen de joins de la API (no existen en una factura nueva).
const CAMPOS_VOLATILES = [
  'monto_bruto', 'descuento', 'monto_neto', 'saldo_pendiente',
  'valor_uva_referencia', 'prospectos', 'contactos', 'contacto2', 'pagos',
]

/**
 * Persiste el formulario de factura como borrador.
 * @returns {boolean} true si se guardó, false si localStorage no está disponible.
 */
export function guardarBorrador(factura) {
  try {
    const limpio = { ...(factura || {}) }
    for (const campo of CAMPOS_VOLATILES) delete limpio[campo]
    window.localStorage.setItem(CLAVE_BORRADOR_FACTURA, JSON.stringify(limpio))
    return true
  } catch (e) {
    // localStorage no disponible / lleno / bloqueado por política: el borrador
    // es opcional, pero avisamos por consola para poder diagnosticarlo.
    console.warn('[borrador] no se pudo guardar en localStorage:', e)
    return false
  }
}

/** Devuelve el borrador guardado, o null si no hay o está corrupto. */
export function leerBorrador() {
  try {
    const crudo = window.localStorage.getItem(CLAVE_BORRADOR_FACTURA)
    if (!crudo) return null
    const dato = JSON.parse(crudo)
    return dato && typeof dato === 'object' && !Array.isArray(dato) ? dato : null
  } catch {
    return null
  }
}

/** Elimina el borrador (al descartarlo o al guardar la factura de verdad). */
export function limpiarBorrador() {
  try {
    window.localStorage.removeItem(CLAVE_BORRADOR_FACTURA)
  } catch {
    // no-op
  }
}
