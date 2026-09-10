import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ModalPortal from '../ModalPortal'

/**
 * El overlay del modal NO debe quedar anidado dentro de `.page` (que
 * puede actuar como containing block y recortar un `position: fixed`).
 * ModalPortal lo saca a `document.body`.
 */
describe('ModalPortal', () => {
  it('monta el contenido como hijo directo de <body>, no dentro de .page', () => {
    const { container } = render(
      <div className="page">
        <ModalPortal>
          <div className="modal-overlay" data-testid="ov">
            <div className="modal-content">hola</div>
          </div>
        </ModalPortal>
      </div>
    )

    const overlay = screen.getByTestId('ov')
    const page = container.querySelector('.page')

    expect(page).not.toBeNull()
    expect(page.contains(overlay)).toBe(false)
    expect(overlay.parentElement).toBe(document.body)
  })

  it('sin hijos no rompe', () => {
    expect(() => render(<ModalPortal>{null}</ModalPortal>)).not.toThrow()
  })
})
