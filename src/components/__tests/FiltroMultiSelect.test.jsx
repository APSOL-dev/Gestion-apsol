import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import FiltroMultiSelect from '../FiltroMultiSelect'

const OPCIONES = [
  { id: 'a', nombre: 'Ana López' },
  { id: 'b', nombre: 'Carlos Gómez' },
  { id: 'c', nombre: 'Renata Morano' }
]

function renderFiltro(props = {}) {
  const onChange = vi.fn()
  const utils = render(
    <FiltroMultiSelect
      icon={null}
      label="Personal"
      options={OPCIONES}
      selectedIds={[]}
      onChange={onChange}
      {...props}
    />
  )
  return { onChange, ...utils }
}

describe('FiltroMultiSelect', () => {
  test('muestra el label sin contador cuando no hay nada seleccionado', () => {
    renderFiltro()
    expect(screen.getByRole('button', { name: /Personal/ })).toHaveTextContent('Personal')
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
  })

  test('muestra la cantidad seleccionada junto al label, no un chip por cada elemento', () => {
    const { container } = renderFiltro({ selectedIds: ['a', 'b'] })
    expect(screen.getByRole('button', { name: /Personal/ })).toHaveTextContent('Personal (2)')
    // Regresión del bug reportado: no debe renderizar un "chip" removible por c/u
    expect(container.querySelectorAll('.tag').length).toBe(0)
  })

  test('el desplegable está cerrado por defecto', () => {
    renderFiltro()
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
  })

  test('clickear el botón abre el desplegable con todas las opciones', () => {
    renderFiltro()
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.getByText('Renata Morano')).toBeInTheDocument()
  })

  test('clickear el botón de nuevo cierra el desplegable', () => {
    renderFiltro()
    const boton = screen.getByRole('button', { name: /Personal/ })
    fireEvent.click(boton)
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    fireEvent.click(boton)
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
  })

  test('clickear una opción no seleccionada la agrega sin cerrar el desplegable', () => {
    // onChange recibe un updater funcional (compatible con setState), no un
    // array ya calculado, para no perder selecciones si se togglea rápido
    // más de una opción antes de que React re-renderice entre medio.
    const { onChange } = renderFiltro({ selectedIds: ['a'] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.click(screen.getByText('Carlos Gómez'))

    expect(onChange).toHaveBeenCalledTimes(1)
    const updater = onChange.mock.calls[0][0]
    expect(updater(['a'])).toEqual(['a', 'b'])
    // El desplegable sigue abierto (permite seguir tildando)
    expect(screen.getByText('Ana López')).toBeInTheDocument()
  })

  test('clickear una opción ya seleccionada la saca de la selección', () => {
    const { onChange } = renderFiltro({ selectedIds: ['a', 'b'] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.click(screen.getByText('Ana López'))

    const updater = onChange.mock.calls[0][0]
    expect(updater(['a', 'b'])).toEqual(['b'])
  })

  test('togglear dos opciones seguidas no pierde la primera selección aunque React batchee los renders', () => {
    // Reproduce el bug: togglear "a" y luego "b" en el mismo tick, sin dejar
    // que React re-renderice entre medio, no debe pisar la selección previa.
    const { onChange } = renderFiltro({ selectedIds: [] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.click(screen.getByText('Ana López'))
    fireEvent.click(screen.getByText('Carlos Gómez'))

    expect(onChange).toHaveBeenCalledTimes(2)
    let estado = []
    for (const [updater] of onChange.mock.calls) {
      estado = updater(estado)
    }
    expect(estado).toEqual(['a', 'b'])
  })

  // ─── "Seleccionar todos" ────────────────────────────────────────────────

  test('muestra la opción "Seleccionar todos" arriba de la lista', () => {
    renderFiltro({ selectedIds: [] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.getByText('Seleccionar todos')).toBeInTheDocument()
  })

  test('clickear "Seleccionar todos" selecciona todas las opciones de una', () => {
    const { onChange } = renderFiltro({ selectedIds: ['a'] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.click(screen.getByText('Seleccionar todos'))

    const updater = onChange.mock.calls[0][0]
    expect(updater(['a'])).toEqual(['a', 'b', 'c'])
  })

  test('con todo seleccionado, la opción pasa a "Deseleccionar todos" y limpia la selección', () => {
    const { onChange } = renderFiltro({ selectedIds: ['a', 'b', 'c'] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.getByText('Deseleccionar todos')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Deseleccionar todos'))
    const updater = onChange.mock.calls[0][0]
    expect(updater(['a', 'b', 'c'])).toEqual([])
  })

  test('no muestra "Seleccionar todos" cuando no hay opciones', () => {
    renderFiltro({ options: [] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.queryByText('Seleccionar todos')).not.toBeInTheDocument()
  })

  test('muestra el mensaje vacío cuando no hay opciones', () => {
    renderFiltro({ options: [] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.getByText('Sin opciones')).toBeInTheDocument()
  })

  // ─── Buscador (lupita) ─────────────────────────────────────────────────

  test('el desplegable trae un buscador que filtra las opciones por texto', () => {
    renderFiltro()
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'car' } })
    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument()
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
    expect(screen.queryByText('Renata Morano')).not.toBeInTheDocument()
  })

  test('el buscador ignora mayúsculas y acentos', () => {
    renderFiltro()
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'LOPEZ' } })
    expect(screen.getByText('Ana López')).toBeInTheDocument()
    expect(screen.queryByText('Carlos Gómez')).not.toBeInTheDocument()
  })

  test('"Seleccionar todos" opera solo sobre lo que el buscador deja visible', () => {
    const { onChange } = renderFiltro({ selectedIds: [] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'ren' } })
    fireEvent.click(screen.getByText('Seleccionar todos'))
    const updater = onChange.mock.calls[0][0]
    expect(updater([])).toEqual(['c'])
  })

  test('avisa cuando el buscador no encuentra coincidencias', () => {
    renderFiltro()
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'zzz' } })
    expect(screen.getByText(/Sin resultados/)).toBeInTheDocument()
  })

  test('reabrir el desplegable limpia lo que había en el buscador', () => {
    renderFiltro()
    const boton = screen.getByRole('button', { name: /Personal/ })
    fireEvent.click(boton)
    fireEvent.change(screen.getByPlaceholderText('Buscar…'), { target: { value: 'car' } })
    fireEvent.click(boton) // cierra
    fireEvent.click(boton) // reabre
    expect(screen.getByPlaceholderText('Buscar…')).toHaveValue('')
    expect(screen.getByText('Ana López')).toBeInTheDocument()
  })

  test('sin opciones no muestra el buscador', () => {
    renderFiltro({ options: [] })
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.queryByPlaceholderText('Buscar…')).not.toBeInTheDocument()
  })

  test('cierra el desplegable al clickear afuera del componente', () => {
    render(
      <div>
        <FiltroMultiSelect icon={null} label="Personal" options={OPCIONES} selectedIds={[]} onChange={vi.fn()} />
        <div data-testid="afuera">Afuera</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /Personal/ }))
    expect(screen.getByText('Ana López')).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByTestId('afuera'))
    expect(screen.queryByText('Ana López')).not.toBeInTheDocument()
  })
})
