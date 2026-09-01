import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

// Drawer liviano: solo queremos saber con qué id lo abren.
vi.mock('../../components/ProspectoDrawer', () => ({
  default: ({ id, onClose }) => (
    <div data-testid="drawer" onClick={onClose}>drawer:{id}</div>
  ),
}))

const mockProspectos = [
  { id: 'p1', nombre: 'Alfa SA', estado: '3A - Seguimiento', empresas: { nombre: 'Alfa' }, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
  { id: 'p2', nombre: 'Beta SRL', estado: '3A - Seguimiento', empresas: { nombre: 'Beta' }, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
  { id: 'p3', nombre: 'Gamma SA', estado: '3A - Seguimiento', empresas: { nombre: 'Gamma' }, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
]

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    prospectos: mockProspectos,
    loadingProspectos: false,
    refreshProspectos: vi.fn(),
  }),
}))

import Prospectos from '../Prospectos'

function renderProspectos() {
  return render(<BrowserRouter><Prospectos /></BrowserRouter>)
}

function filas() {
  // las <tr> del cuerpo de la tabla (excluye la fila de header). Con la
  // sección colapsada no se renderiza ni la tabla -> puede haber 0 filas.
  return screen.queryAllByRole('row').filter(r => within(r).queryAllByRole('columnheader').length === 0)
}

describe('Prospectos — navegación por teclado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('las flechas resaltan filas dentro de la sección (expandida por defecto) y Enter abre el drawer', () => {
    renderProspectos()

    // Las secciones arrancan desplegadas: no hace falta expandirla.
    expect(filas()).toHaveLength(3)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(filas()[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(filas()[1]).toHaveAttribute('aria-selected', 'true')
    expect(filas()[0]).toHaveAttribute('aria-selected', 'false')

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByTestId('drawer')).toHaveTextContent('drawer:p2')
  })

  it('si colapso la sección, las flechas no hacen nada (no hay filas visibles)', () => {
    renderProspectos()
    // Colapsar la única sección (arranca desplegada). "3A - Seguimiento"
    // aparece varias veces (el header + el badge de cada fila); el header
    // es el primero en el orden del documento.
    fireEvent.click(screen.getAllByText('3A - Seguimiento')[0])
    expect(filas()).toHaveLength(0)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.queryByTestId('drawer')).not.toBeInTheDocument()
  })

  it('cuando el drawer está abierto, el listener global de la lista se desengancha', () => {
    renderProspectos()
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByTestId('drawer')).toHaveTextContent('drawer:p1')

    // Con el drawer abierto, ArrowDown en document no debe mover el resaltado.
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(filas()[0]).toHaveAttribute('aria-selected', 'true')
  })
})
