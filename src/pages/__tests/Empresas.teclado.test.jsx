import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../../components/EmpresaDrawer', () => ({
  default: ({ id }) => <div data-testid="drawer">drawer:{id}</div>,
}))
vi.mock('../../services/empresas', () => ({ deleteEmpresa: vi.fn() }))

// e1 tiene prospecto activo (va a la tabla de arriba); e2 no (tabla de abajo).
const mockEmpresas = [
  { id: 'e1', nombre: 'Alfa', industria: null, prospectos: [{ estado: '3A - Seguimiento' }] },
  { id: 'e2', nombre: 'Beta', industria: null, prospectos: [] },
]

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    empresas: mockEmpresas,
    loadingEmpresas: false,
    refreshEmpresas: vi.fn(),
  }),
}))

import Empresas from '../Empresas'

const filas = () =>
  screen.getAllByRole('row').filter(r => within(r).queryAllByRole('columnheader').length === 0)

describe('Empresas — navegación por teclado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('el índice recorre las dos tablas y Enter abre el drawer de la fila resaltada', () => {
    render(<BrowserRouter><Empresas /></BrowserRouter>)
    expect(filas()).toHaveLength(2)

    fireEvent.keyDown(document, { key: 'ArrowDown' }) // -> e1 (tabla de arriba)
    expect(filas()[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document, { key: 'ArrowDown' }) // -> e2 (tabla de abajo)
    expect(filas()[1]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByTestId('drawer')).toHaveTextContent('drawer:e2')
  })
})
