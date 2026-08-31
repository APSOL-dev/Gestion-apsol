import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../../components/ContactoDrawer', () => ({
  default: ({ id }) => <div data-testid="drawer">drawer:{id}</div>,
}))

const mockContactos = [
  { id: 'c1', nombre: 'Ana', apellido: 'Díaz', activo: true, empresas: null, prospectos: [] },
  { id: 'c2', nombre: 'Bruno', apellido: 'Paz', activo: true, empresas: null, prospectos: [] },
]

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    contactos: mockContactos,
    loadingContactos: false,
    refreshContactos: vi.fn(),
  }),
}))

import Contactos from '../Contactos'

const filas = () =>
  screen.getAllByRole('row').filter(r => within(r).queryAllByRole('columnheader').length === 0)

describe('Contactos — navegación por teclado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ArrowDown resalta la primera fila y Enter abre el drawer', () => {
    render(<BrowserRouter><Contactos /></BrowserRouter>)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(filas()[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByTestId('drawer')).toHaveTextContent('drawer:c2')
  })
})
