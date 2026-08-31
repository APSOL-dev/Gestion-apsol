import { useEffect, useRef } from 'react'
import { elementosFocusables, focoCiclico } from '../utils/foco'

/**
 * Manejo de teclado y foco para un panel tipo drawer / modal:
 *  - Escape cierra (llama `onClose`).
 *  - Tab / Shift+Tab quedan atrapados dentro del panel (focus trap).
 *  - Al montar, mueve el foco al panel (para que Escape funcione y el
 *    lector de pantalla anuncie el diálogo).
 *  - Al desmontar, devuelve el foco al elemento que lo tenía antes.
 *
 * `onClose` se guarda en un ref: así el efecto no se reengancha en cada
 * render del padre (que normalmente pasa una arrow function nueva) y no
 * roba el foco de vuelta ni pierde el "elemento previo".
 *
 * @param {object} params
 * @param {() => void} params.onClose
 * @param {React.RefObject<HTMLElement>} params.panelRef - ref al contenedor del panel
 * @param {boolean} [params.activo=true] - permite desactivar el comportamiento
 */
export function useDrawerTeclado({ onClose, panelRef, activo = true }) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!activo) return

    const previo = document.activeElement
    const panel = panelRef.current
    if (panel) panel.focus?.()

    function onKeyDown(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (e.key === 'Tab' && panel) {
        const focusables = elementosFocusables(panel)
        if (focusables.length === 0) {
          e.preventDefault()
          panel.focus?.()
          return
        }
        const destino = focoCiclico(focusables, document.activeElement, e.shiftKey)
        if (destino) {
          e.preventDefault()
          destino.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previo && typeof previo.focus === 'function' && document.contains(previo)) {
        previo.focus()
      }
    }
  }, [activo, panelRef])
}
