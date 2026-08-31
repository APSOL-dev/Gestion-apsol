import { describe, it, expect, vi } from 'vitest'
import { useRef, useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useDrawerTeclado } from '../useDrawerTeclado'

function Panel({ onClose }) {
  const panelRef = useRef(null)
  useDrawerTeclado({ onClose, panelRef })
  return (
    <div data-testid="panel" ref={panelRef} tabIndex={-1}>
      <button data-testid="b1">uno</button>
      <button data-testid="b2">dos</button>
      <button data-testid="b3">tres</button>
    </div>
  )
}

function Host() {
  const [abierto, setAbierto] = useState(false)
  return (
    <div>
      <button data-testid="disparador" onClick={() => setAbierto(true)}>abrir</button>
      {abierto && <Panel onClose={() => setAbierto(false)} />}
    </div>
  )
}

describe('useDrawerTeclado', () => {
  it('Escape dispara onClose', () => {
    const onClose = vi.fn()
    render(<Panel onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('al abrir mueve el foco al panel', () => {
    render(<Panel onClose={() => {}} />)
    expect(document.activeElement).toBe(screen.getByTestId('panel'))
  })

  it('Tab desde el último elemento vuelve al primero', () => {
    render(<Panel onClose={() => {}} />)
    screen.getByTestId('b3').focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).toBe(screen.getByTestId('b1'))
  })

  it('Shift+Tab desde el primero salta al último', () => {
    render(<Panel onClose={() => {}} />)
    screen.getByTestId('b1').focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(screen.getByTestId('b3'))
  })

  it('al cerrar devuelve el foco al elemento que lo tenía antes de abrir', () => {
    render(<Host />)
    const disparador = screen.getByTestId('disparador')
    disparador.focus()
    fireEvent.click(disparador)

    expect(document.activeElement).toBe(screen.getByTestId('panel'))

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.activeElement).toBe(disparador)
  })
})
