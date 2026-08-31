import { useCallback, useEffect, useState } from 'react'
import { siguienteIndice, esCampoDeTexto, esTeclaActivar } from '../utils/teclado'

/**
 * Navegación por teclado de una lista/tabla: flechas ↑↓ (y Home/End) mueven
 * una fila "resaltada", Enter la abre. No hace nada mientras el foco está en
 * el buscador o en un campo de un formulario.
 *
 * Uso típico en una página de listado:
 *   const { activo, onKeyDown } = useNavegacionLista({
 *     total: filasVisibles.length,
 *     onActivar: (i) => abrirDetalle(filasVisibles[i].id),
 *     global: !hayDrawerAbierto,   // escucha en document mientras no haya drawer
 *   })
 *
 * @param {object}   params
 * @param {number}   params.total     - cantidad de filas visibles
 * @param {(i:number)=>void} params.onActivar - se llama con el índice al presionar Enter
 * @param {boolean}  [params.wrap=false]   - ciclar entre la primera y la última
 * @param {boolean}  [params.global=false] - engancha el listener a `document`
 *                    (para que las flechas anden sin tener que enfocar la lista)
 * @returns {{activo:number, setActivo:Function, onKeyDown:Function}}
 */
export function useNavegacionLista({ total, onActivar, wrap = false, global = false }) {
  const [activoRaw, setActivo] = useState(-1)

  // Clampeo derivado (sin efecto): si la lista se achica —cambió un filtro,
  // una búsqueda— el índice no debe apuntar a una fila que ya no existe.
  const activo = activoRaw >= total ? total - 1 : activoRaw

  const onKeyDown = useCallback(
    (e) => {
      if (esCampoDeTexto(e.target)) return

      if (esTeclaActivar(e.key)) {
        if (activo >= 0 && activo < total) {
          e.preventDefault()
          onActivar?.(activo)
        }
        return
      }

      const siguiente = siguienteIndice(e.key, activo, total, { wrap })
      if (siguiente !== activo) {
        e.preventDefault()
        setActivo(siguiente)
      }
    },
    [activo, total, onActivar, wrap]
  )

  useEffect(() => {
    if (!global) return
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [global, onKeyDown])

  return { activo, setActivo, onKeyDown }
}
