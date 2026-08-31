/**
 * Utilidades para atrapar el foco (focus trap) dentro de un contenedor,
 * p.ej. el panel de un drawer. La parte que decide "a dónde va el foco"
 * es pura y testeable; el efecto de mover el foco vive en el hook.
 */

export const SELECTOR_FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

/**
 * Elementos enfocables dentro de `contenedor`, en orden de documento.
 * No filtra por visibilidad: en un drawer abierto todo lo que matchea
 * el selector está a la vista, y jsdom no calcula layout.
 */
export function elementosFocusables(contenedor) {
  if (!contenedor || typeof contenedor.querySelectorAll !== 'function') return []
  return Array.from(contenedor.querySelectorAll(SELECTOR_FOCUSABLE))
}

/**
 * Dado el ciclo de Tab dentro de un contenedor, devuelve el elemento al
 * que hay que forzar el foco, o `null` si el navegador puede seguir solo.
 *
 * - Tab (sin shift) desde el último  -> primero
 * - Shift+Tab desde el primero       -> último
 * - foco fuera del contenedor        -> lo trae adentro (primero / último)
 * - cualquier otro caso              -> null (no interceptar)
 */
export function focoCiclico(elementos, activo, shift = false) {
  if (!elementos || elementos.length === 0) return null
  const primero = elementos[0]
  const ultimo = elementos[elementos.length - 1]
  const dentro = elementos.includes(activo)

  if (shift) {
    if (!dentro || activo === primero) return ultimo
    return null
  }
  if (!dentro || activo === ultimo) return primero
  return null
}
