import { createPortal } from 'react-dom'

/**
 * Renderiza sus hijos (típicamente un `.modal-overlay` con `position:
 * fixed`) directo en `document.body`, fuera de `.page`.
 *
 * Motivo: `.page` puede actuar como containing block de sus hijos
 * `position: fixed` (transform residual de la animación de entrada,
 * `overflow`, etc.), y ahí el overlay del modal queda recortado al
 * tamaño del contenido en vez de cubrir todo el viewport. Portalizar a
 * `<body>` lo evita. Mismo criterio que los drawers laterales.
 */
export default function ModalPortal({ children }) {
  if (typeof document === 'undefined') return null
  return createPortal(children, document.body)
}
