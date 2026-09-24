import { useEffect, useRef, useState } from 'react'
import { Copy, Check } from 'lucide-react'

// Piezas chicas compartidas por la lista y la ficha de Keys.

async function copiarTexto(texto) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(texto)
    return
  }
  // Fallback para navegadores/contextos sin Clipboard API (http plano)
  const ta = document.createElement('textarea')
  ta.value = texto
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
}

/** Botón de copiar con confirmación visual "Copiado". */
export function BotonCopiar({ texto, etiqueta, disabled }) {
  const [estado, setEstado] = useState(null) // null | 'ok' | 'error'
  const timer = useRef()
  useEffect(() => () => clearTimeout(timer.current), [])

  async function copiar(e) {
    e.preventDefault()
    e.stopPropagation()
    try {
      await copiarTexto(texto ?? '')
      setEstado('ok')
    } catch {
      setEstado('error')
    }
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setEstado(null), 1500)
  }

  return (
    <button
      type="button"
      className={`key-icon-btn${estado === 'ok' ? ' is-ok' : ''}`}
      onClick={copiar}
      aria-label={etiqueta}
      title={etiqueta}
      disabled={disabled || !texto}
    >
      {estado === 'ok' ? <Check size={15} /> : <Copy size={15} />}
      {estado && (
        <span className="key-copiado" role="status">
          {estado === 'ok' ? 'Copiado' : 'No se pudo copiar'}
        </span>
      )}
    </button>
  )
}

const CLASE_CRITICIDAD = { Alta: 'badge-red', Media: 'badge-yellow', Baja: 'badge-gray' }

export function BadgeCriticidad({ criticidad }) {
  if (!criticidad) return null
  return <span className={`badge ${CLASE_CRITICIDAD[criticidad] || 'badge-gray'}`}>{criticidad}</span>
}

/** Grupo de botones excluyentes (Propio/Cliente, Baja/Media/Alta...). */
export function Segmentado({ opciones, valor, onChange, etiqueta, disabled }) {
  return (
    <div className="key-segmentado" role="group" aria-label={etiqueta}>
      {opciones.map(op => (
        <button
          key={op}
          type="button"
          aria-pressed={valor === op}
          className={valor === op ? 'is-activo' : ''}
          onClick={() => onChange(op)}
          disabled={disabled}
        >
          {op}
        </button>
      ))}
    </div>
  )
}
