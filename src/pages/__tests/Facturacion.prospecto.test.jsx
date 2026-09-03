import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../../components/FacturacionDrawer', () => ({
  default: ({ id }) => <div data-testid="drawer">drawer:{id}</div>,
}))

const mockFacturas = [
  {
    id: 'f1',
    estado: 'Pendiente',
    fecha_emision: '2026-08-01',
    prospectos: { nombre: 'Proyecto Nación Web', empresas: { nombre: 'Natión' } },
    contactos: null,
    pagos: [],
    monto_bruto: 1000,
  },
]

vi.mock('../../context/DataContext', () => ({
  useData: () => ({
    facturas: mockFacturas,
    loadingFacturas: false,
    refreshFacturas: vi.fn(),
  }),
}))

import Facturacion from '../Facturacion'

describe('Facturacion — columna Prospecto', () => {
  it('muestra el prospecto en la columna y no la empresa', () => {
    render(<BrowserRouter><Facturacion /></BrowserRouter>)

    // El encabezado de la columna es "Prospecto", no "Empresa"
    expect(screen.getByRole('columnheader', { name: 'Prospecto' })).toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: 'Empresa' })).not.toBeInTheDocument()

    // La fila muestra el nombre del prospecto y no el de la empresa
    expect(screen.getByText('Proyecto Nación Web')).toBeInTheDocument()
    expect(screen.queryByText('Natión')).not.toBeInTheDocument()
  })
})
