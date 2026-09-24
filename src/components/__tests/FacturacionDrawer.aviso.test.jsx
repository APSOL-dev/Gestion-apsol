import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, test, expect, beforeEach } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import FacturacionDrawer from '../FacturacionDrawer'
import { getFacturaById, savePago } from '../../services/facturacion'

vi.mock('../../services/facturacion', () => ({
  getFacturaById: vi.fn(),
  savePago: vi.fn(),
  deletePago: vi.fn(),
  deleteFactura: vi.fn(),
}))

const factura = {
  id: 'f1', numero_factura: '0001', estado: 'Pendiente', fecha_emision: '2026-09-01',
  monto_neto: 1000, saldo_pendiente: 1000, pagos: [], prospectos: { empresas: { nombre: 'Empresa' } },
}

function abrir() {
  return render(<MemoryRouter><FacturacionDrawer id="f1" onClose={() => {}} onPagoRegistrado={() => {}} /></MemoryRouter>)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(window, 'confirm').mockReturnValue(true)
  getFacturaById.mockResolvedValue(factura)
})

describe('FacturacionDrawer — aviso de pago recibido', () => {
  test('"Pago completo" con aviso enviado muestra que se envió', async () => {
    savePago.mockImplementation(async (_p, { onAviso }) => { onAviso({ ok: true }); return {} })
    abrir()

    fireEvent.click(await screen.findByRole('button', { name: /Pago completo/ }))

    const cartel = await screen.findByTestId('aviso-pago')
    expect(cartel).toHaveTextContent('Se envió el aviso de pago recibido')
  })

  test('"Pago completo" con aviso fallido avisa que NO se pudo enviar', async () => {
    savePago.mockImplementation(async (_p, { onAviso }) => { onAviso({ ok: false, error: 'status 404' }); return {} })
    abrir()

    fireEvent.click(await screen.findByRole('button', { name: /Pago completo/ }))

    const cartel = await screen.findByTestId('aviso-pago')
    expect(cartel).toHaveTextContent('NO se pudo enviar el aviso')
    expect(cartel).toHaveTextContent('status 404')
  })

  test('un pago parcial (sin aviso) no muestra ningún cartel de aviso', async () => {
    savePago.mockResolvedValue({})
    abrir()

    fireEvent.click(await screen.findByRole('button', { name: /Pago completo/ }))

    await waitFor(() => expect(savePago).toHaveBeenCalled())
    expect(screen.queryByTestId('aviso-pago')).not.toBeInTheDocument()
  })
})
