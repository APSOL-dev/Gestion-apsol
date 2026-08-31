import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { MemoryRouter } from 'react-router-dom'

import ProspectoDrawer from '../ProspectoDrawer'
import ContactoDrawer from '../ContactoDrawer'
import EmpresaDrawer from '../EmpresaDrawer'
import FacturacionDrawer from '../FacturacionDrawer'

// Los drawers hacen fetch en un useEffect; devolvemos datos mínimos para que
// el panel se monte sin depender de la red.
vi.mock('../../services/prospectos', () => ({
  getProspectoById: vi.fn(() => Promise.resolve({ id: '1', nombre: 'Prospecto Test', empresas: { nombre: 'Empresa' } })),
  saveProspecto: vi.fn(() => Promise.resolve({})),
  deleteProspecto: vi.fn(() => Promise.resolve()),
  saveObservacion: vi.fn(() => Promise.resolve({})),
}))
vi.mock('../../services/contactos', () => ({
  getContactoById: vi.fn(() => Promise.resolve({ id: '1', nombre: 'Contacto', apellido: 'Test', activo: true, empresas: { nombre: 'Empresa' } })),
  desactivarContacto: vi.fn(() => Promise.resolve()),
  activarContacto: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../services/empresas', () => ({
  getEmpresaById: vi.fn(() => Promise.resolve({ id: '1', nombre: 'Empresa Test' })),
  deleteEmpresa: vi.fn(() => Promise.resolve()),
}))
vi.mock('../../services/facturacion', () => ({
  getFacturaById: vi.fn(() => Promise.resolve({ id: '1', numero_factura: '0001', pagos: [], prospectos: { empresas: { nombre: 'Empresa' } } })),
  savePago: vi.fn(() => Promise.resolve({})),
  deletePago: vi.fn(() => Promise.resolve()),
  deleteFactura: vi.fn(() => Promise.resolve()),
}))

const CASOS = [
  ['ProspectoDrawer', ProspectoDrawer, { id: '1', onClose: () => {}, onChanged: () => {} }],
  ['ContactoDrawer', ContactoDrawer, { id: '1', onClose: () => {}, onChanged: () => {} }],
  ['EmpresaDrawer', EmpresaDrawer, { id: '1', onClose: () => {}, onChanged: () => {} }],
  ['FacturacionDrawer', FacturacionDrawer, { id: '1', onClose: () => {}, onPagoRegistrado: () => {} }],
]

/**
 * Regresión: los overlays con `position: fixed` NO deben quedar anidados dentro
 * de `.page`, porque `.page` tiene un `transform` residual (animación con
 * fill-mode `both`) que lo convierte en containing block y recorta el drawer al
 * tamaño del contenido de la página en vez de al viewport.
 * La defensa es renderizarlos con createPortal a `document.body`.
 */
describe('Drawers laterales: montaje vía portal fuera de .page', () => {
  it.each(CASOS)('%s monta backdrop y panel como hijos directos de <body>, no dentro de .page', async (_nombre, Drawer, props) => {
    const { container } = render(
      <MemoryRouter>
        <div className="page">
          <Drawer {...props} />
        </div>
      </MemoryRouter>
    )

    const panel = await screen.findByTestId('drawer-panel')
    const backdrop = screen.getByTestId('drawer-backdrop')

    const pageHost = container.querySelector('.page')
    expect(pageHost).not.toBeNull()

    // El drawer NO debe estar dentro del contenedor .page (que actúa como
    // containing block por su transform residual).
    expect(pageHost.contains(panel)).toBe(false)
    expect(pageHost.contains(backdrop)).toBe(false)

    // Debe estar portalizado directamente en <body>.
    expect(panel.parentElement).toBe(document.body)
    expect(backdrop.parentElement).toBe(document.body)
  })
})

/**
 * Manejo por teclado (hook useDrawerTeclado): al abrir un drawer el foco entra
 * al panel, Escape lo cierra, y Tab queda atrapado adentro.
 */
describe('Drawers laterales: teclado (Escape cierra, foco atrapado)', () => {
  it.each(CASOS)('%s: Escape dispara onClose y el foco arranca en el panel', async (_nombre, Drawer, props) => {
    const onClose = vi.fn()
    render(
      <MemoryRouter>
        <div className="page">
          <Drawer {...props} onClose={onClose} />
        </div>
      </MemoryRouter>
    )

    const panel = await screen.findByTestId('drawer-panel')
    expect(document.activeElement).toBe(panel)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

/**
 * Defensa complementaria: el keyframe `fadeSlideIn` que usa `.page` no debe
 * dejar un `transform` en su estado final (`to` / `100%`), porque cualquier
 * transform distinto de `none` en un ancestro rompe el `position: fixed` de los
 * hijos (los ancla a `.page` en vez de al viewport). jsdom no calcula layout,
 * así que verificamos la fuente CSS directamente.
 */
describe('index.css: .page no deja transform residual', () => {
  it('el fotograma final de @keyframes fadeSlideIn no define transform', () => {
    const css = readFileSync(resolve(__dirname, '../../index.css'), 'utf8')
    const idx = css.indexOf('@keyframes fadeSlideIn')
    expect(idx, 'no se encontró @keyframes fadeSlideIn').toBeGreaterThan(-1)

    const region = css.slice(idx, idx + 400)
    const frameFinal = region.match(/(?:^|\s)(?:to|100%)\s*\{([^}]*)\}/)
    expect(frameFinal, 'no se encontró el fotograma final (to / 100%)').not.toBeNull()
    expect(frameFinal[1]).not.toMatch(/transform/)
  })
})
