import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, CheckSquare, Square, Search } from 'lucide-react'

const normalizar = s =>
  (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/**
 * Filtro de selección múltiple compacto: un botón disparador que muestra la
 * cantidad de elementos elegidos ("Personal (3)") y un desplegable tipo
 * checklist para tildar/destildar opciones sin cerrarse en cada click.
 *
 * El desplegable trae un buscador (lupita) que filtra la lista por texto,
 * insensible a mayúsculas y acentos. "Seleccionar todos" opera SOLO sobre
 * lo que el buscador deja visible, así se puede seleccionar en tandas
 * ("todos los de mantenimiento", etc.).
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
  const [query, setQuery] = useState('')
  const rootRef = useRef(null)
  const searchRef = useRef(null)

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

  // Reabrir el desplegable arranca siempre con el buscador en blanco.
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const opcionesFiltradas = useMemo(() => {
    const q = normalizar(query).trim()
    if (!q) return options
    return options.filter(o => normalizar(getLabel(o)).includes(q))
  }, [options, query, getLabel])

  function toggleOpcion(id) {
    onChange(prevSelected => (
      prevSelected.includes(id)
        ? prevSelected.filter(sid => sid !== id)
        : [...prevSelected, id]
    ))
  }

  // "Seleccionar/Deseleccionar todos" acota su acción a las opciones que el
  // buscador está mostrando en este momento (no a la lista completa).
  const idsVisibles = opcionesFiltradas.map(getId)
  const todosVisiblesSeleccionados =
    idsVisibles.length > 0 && idsVisibles.every(id => selectedIds.includes(id))

  function toggleTodos() {
    if (todosVisiblesSeleccionados) {
      onChange(prev => prev.filter(id => !idsVisibles.includes(id)))
    } else {
      onChange(prev => [...new Set([...prev, ...idsVisibles])])
    }
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
            <>
              <div className="picker-search">
                <Search size={14} />
                <input
                  ref={searchRef}
                  type="text"
                  placeholder="Buscar…"
                  aria-label={`Buscar en ${label}`}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  autoFocus
                />
              </div>

              {opcionesFiltradas.length === 0 ? (
                <div className="picker-no-results">Sin resultados para “{query}”</div>
              ) : (
                <>
                  <div
                    className="picker-option checklist picker-option-todos"
                    onClick={toggleTodos}
                  >
                    {todosVisiblesSeleccionados ? <CheckSquare size={14} /> : <Square size={14} />}
                    {todosVisiblesSeleccionados ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </div>
                  {opcionesFiltradas.map(opt => {
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
                  })}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
