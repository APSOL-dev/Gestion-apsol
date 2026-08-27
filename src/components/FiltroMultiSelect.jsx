import { useEffect, useRef, useState } from 'react'
import { ChevronDown, CheckSquare, Square } from 'lucide-react'

/**
 * Filtro de selección múltiple compacto: un botón disparador que muestra la
 * cantidad de elementos elegidos ("Personal (3)") y un desplegable tipo
 * checklist para tildar/destildar opciones sin cerrarse en cada click.
 *
 * Reemplaza el patrón anterior de renderizar un "chip" removible por cada
 * elemento seleccionado, que se volvía inmanejable con listas largas
 * (ej. muchos colaboradores o prospectos seleccionados a la vez).
 *
 * `onChange` debe ser compatible con el setter funcional de `useState`
 * (ej. pasar directamente `setSelectedIds`): internamente togglea opciones
 * con un updater `prev => ...` en vez de un array ya calculado, para que
 * togglear varias opciones seguidas no pierda selecciones por quedarse con
 * un `selectedIds` de un render viejo (React puede batchear los clicks).
 */
export default function FiltroMultiSelect({
  icon,
  label,
  options,
  selectedIds,
  onChange,
  getId = o => o.id,
  getLabel = o => o.nombre,
  emptyMessage = 'Sin opciones'
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClickFuera(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickFuera)
    return () => document.removeEventListener('mousedown', handleClickFuera)
  }, [open])

  function toggleOpcion(id) {
    onChange(prevSelected => (
      prevSelected.includes(id)
        ? prevSelected.filter(sid => sid !== id)
        : [...prevSelected, id]
    ))
  }

  return (
    <div className="filtro-multiselect" ref={rootRef}>
      <button
        type="button"
        className={`filtro-trigger ${selectedIds.length > 0 ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        {icon} {label}{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="picker-dropdown">
          {options.length === 0 ? (
            <div className="picker-empty">{emptyMessage}</div>
          ) : (
            options.map(opt => {
              const id = getId(opt)
              const checked = selectedIds.includes(id)
              return (
                <div
                  key={id}
                  className={`picker-option checklist ${checked ? 'checked' : ''}`}
                  onClick={() => toggleOpcion(id)}
                >
                  {checked ? <CheckSquare size={14} /> : <Square size={14} />}
                  {getLabel(opt)}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
