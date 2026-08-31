import { useState, useRef, useEffect } from 'react'
import { Copy, Check } from 'lucide-react'

/**
 * Botón "Copiar" reutilizable: copia `texto` al portapapeles y muestra un
 * "Copiado" efímero. Queda deshabilitado si no hay texto. Tolera navegadores
 * sin `navigator.clipboard` (contextos no seguros) sin romper.
 */
export default function BotonCopiar({
  texto,
  children,
  className = 'btn btn-secondary',
  title = 'Copiar al portapapeles',
  style,
}) {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef(null)

  useEffect(() => () => clearTimeout(timer.current), [])

  async function copiar() {
    const valor = String(texto ?? '')
    try {
      await navigator.clipboard.writeText(valor)
      setCopiado(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopiado(false), 1500)
    } catch (err) {
      console.error('No se pudo copiar al portapapeles:', err)
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className={className}
      title={title}
      style={style}
      disabled={!texto}
    >
      {copiado ? <Check size={14} /> : <Copy size={14} />}
      {children != null && <span>{copiado ? 'Copiado' : children}</span>}
    </button>
  )
}
