import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import BotonCopiar from '../BotonCopiar'

const writeText = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  writeText.mockClear()
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  })
})

describe('BotonCopiar', () => {
  it('al hacer click copia el texto al portapapeles', () => {
    render(<BotonCopiar texto="Período: 01/08/2026 al 31/08/2026">Copiar</BotonCopiar>)
    fireEvent.click(screen.getByRole('button'))
    expect(writeText).toHaveBeenCalledWith('Período: 01/08/2026 al 31/08/2026')
  })

  it('muestra feedback "Copiado" después de copiar', async () => {
    render(<BotonCopiar texto="algo">Copiar</BotonCopiar>)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Copiado'))
  })

  it('queda deshabilitado cuando no hay texto', () => {
    render(<BotonCopiar texto="">Copiar</BotonCopiar>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('no rompe si el navegador no tiene clipboard API', () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<BotonCopiar texto="x">Copiar</BotonCopiar>)
    expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow()
    errSpy.mockRestore()
  })
})
