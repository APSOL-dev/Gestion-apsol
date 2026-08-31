/**
 * Lógica pura para el manejo por teclado de listas (flechas para moverse
 * entre filas, Enter para abrir). Sin dependencias del DOM salvo leer
 * `tagName` / `isContentEditable` de un elemento ya dado.
 */

/**
 * Índice de la fila a resaltar después de una tecla de navegación.
 *
 * @param {string} tecla   - `event.key` ('ArrowDown' | 'ArrowUp' | 'Home' | 'End' | ...)
 * @param {number} actual  - índice resaltado ahora (-1 = ninguno)
 * @param {number} total   - cantidad de filas visibles
 * @param {{wrap?: boolean}} [opciones] - `wrap` cicla entre la primera y la última
 * @returns {number} el índice nuevo, o `actual` si la tecla no aplica.
 *                    Con `total <= 0` siempre devuelve -1.
 */
export function siguienteIndice(tecla, actual, total, opciones = {}) {
  if (!Number.isFinite(total) || total <= 0) return -1
  const { wrap = false } = opciones
  const clamp = (i) => Math.max(0, Math.min(total - 1, i))
  const cicla = (i) => ((i % total) + total) % total
  const mover = wrap ? cicla : clamp

  switch (tecla) {
    case 'ArrowDown':
      return actual < 0 ? 0 : mover(actual + 1)
    case 'ArrowUp':
      return actual < 0 ? total - 1 : mover(actual - 1)
    case 'Home':
      return 0
    case 'End':
      return total - 1
    default:
      return actual
  }
}

/**
 * ¿El elemento es un campo donde el usuario está tipiando? Sirve para NO
 * secuestrar las flechas mientras se escribe en el buscador o en un form.
 */
export function esCampoDeTexto(el) {
  if (!el) return false
  const tag = String(el.tagName || '').toUpperCase()
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (el.isContentEditable) return true
  return false
}

/** Teclas que "abren" la fila resaltada. */
export function esTeclaActivar(tecla) {
  return tecla === 'Enter'
}
