import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../../components/FacturacionDrawer', () => ({
  default: ({ id }) => <div data-testid="drawer">drawer:{id}</div>,
}))

const mockFacturas = [
  { id: 'f1', estado: 'Pendiente', fecha_emision: '2026-08-01', prospectos: null, contactos: null, pagos: [], monto_bruto: 1000 },
  { id: 'f2', estado: 'Pendiente', fecha_emision: '2026-08-02', prospectos: null, contactos: null, pagos: [], monto_bruto: 2000 },
]

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    facturas: mockFacturas,
    loadingFacturas: false,
    refreshFacturas: vi.fn(),
  }),
}))

import Facturacion from '../Facturacion'

const filasFactura = () =>
  screen
    .getAllByRole('row')
    .filter(r => within(r).queryAllByRole('columnheader').length === 0)
    .filter(r => within(r).queryAllByRole('cell').length > 1) // descarta la fila-encabezado de grupo (colSpan)

describe('Facturacion — navegación por teclado', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ArrowDown resalta la fila de factura (salteando el header de grupo) y Enter abre el drawer', () => {
    render(<BrowserRouter><Facturacion /></BrowserRouter>)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(filasFactura()[0]).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByTestId('drawer')).toHaveTextContent('drawer:f2')
  })
})
