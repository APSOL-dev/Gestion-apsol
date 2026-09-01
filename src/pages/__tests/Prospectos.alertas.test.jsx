import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'

vi.mock('../../components/ProspectoDrawer', () => ({
  default: () => null,
}))

function ayer() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function manana() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function renderConProspectos(prospectos, facturas = []) {
  vi.resetModules()
  vi.doMock('../../context/DataContext', () => ({
    useData: () => ({ prospectos, facturas, loadingProspectos: false, refreshProspectos: vi.fn() }),
  }))
  const { default: Prospectos } = await import('../Prospectos')
  return render(<BrowserRouter><Prospectos /></BrowserRouter>)
}

describe('Prospectos — orden de estados y secciones desplegadas por defecto', () => {
  beforeEach(() => vi.clearAllMocks())

  it('agrupa y ordena los estados como 1A, 3A, 6A (no alfabético ni "1A" al final)', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'Uno', estado: '6A - En producción', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
      { id: 'p2', nombre: 'Dos', estado: '3A - Seguimiento', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
      { id: 'p3', nombre: 'Tres', estado: '1A - Pendiente de contactar', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
    ])

    const headers = Array.from(document.querySelectorAll('.section-header')).map(el => el.textContent)
    const orden = ['1A - Pendiente de contactar', '3A - Seguimiento', '6A - En producción']
      .map(texto => headers.findIndex(h => h.includes(texto)))

    expect(orden).toEqual([0, 1, 2])
  })

  it('las secciones arrancan desplegadas: se ven las filas sin hacer clic', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'Uno', estado: '3A - Seguimiento', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null },
    ])
    expect(screen.getByText('Uno')).toBeInTheDocument()
  })
})

describe('Prospectos — alerta roja de próxima tarea vencida', () => {
  beforeEach(() => vi.clearAllMocks())

  it('remarca en rojo la tarea y la fecha cuando ya venció', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'Vencido', estado: '3A - Seguimiento', empresas: null, contactos: null, proxima_tarea: 'Facturar', fecha_proxima_tarea: ayer() },
    ])

    expect(screen.getByText('Facturar')).toHaveStyle({ color: '#b91c1c' })
  })

  it('NO remarca en rojo una tarea con fecha futura', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'Futuro', estado: '3A - Seguimiento', empresas: null, contactos: null, proxima_tarea: 'Contactar', fecha_proxima_tarea: manana() },
    ])

    expect(screen.getByText('Contactar')).not.toHaveStyle({ color: '#b91c1c' })
  })
})

describe('Prospectos — alerta de "hay que facturarle" (en producción)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('muestra el badge "Facturar" en un prospecto en producción con la próxima factura vencida y sin facturar', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'Cliente Activo', estado: '6A - En producción', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null, proxima_factura: ayer() },
    ])

    expect(screen.getByText('Facturar')).toBeInTheDocument()
  })

  it('NO muestra el badge si ya se facturó desde la próxima_factura', async () => {
    const fechaVieja = ayer()
    await renderConProspectos(
      [{ id: 'p1', nombre: 'Cliente Al Dia', estado: '6A - En producción', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null, proxima_factura: fechaVieja }],
      [{ prospecto_id: 'p1', fecha_emision: fechaVieja }],
    )

    expect(screen.queryByText('Facturar')).not.toBeInTheDocument()
  })

  it('NO muestra el badge en un prospecto que no está en producción, aunque tenga próxima_factura vencida', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'En Seguimiento', estado: '3A - Seguimiento', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null, proxima_factura: ayer() },
    ])

    expect(screen.queryByText('Facturar')).not.toBeInTheDocument()
  })

  it('NO muestra el badge si la próxima_factura todavía es futura', async () => {
    await renderConProspectos([
      { id: 'p1', nombre: 'Cliente Futuro', estado: '6A - En producción', empresas: null, contactos: null, proxima_tarea: null, fecha_proxima_tarea: null, proxima_factura: manana() },
    ])

    expect(screen.queryByText('Facturar')).not.toBeInTheDocument()
  })
})
