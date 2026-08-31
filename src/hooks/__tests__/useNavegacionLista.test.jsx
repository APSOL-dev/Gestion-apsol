import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { useNavegacionLista } from '../useNavegacionLista'

function Lista({ inicial = 3, onActivar, global = false }) {
  const [total, setTotal] = useState(inicial)
  const { activo, onKeyDown } = useNavegacionLista({ total, onActivar, global })
  return (
    <div>
      <div data-testid="cont" tabIndex={0} onKeyDown={onKeyDown}>
        <span data-testid="activo">{activo}</span>
        <input data-testid="campo" />
      </div>
      <button data-testid="achicar" onClick={() => setTotal(1)}>achicar</button>
    </div>
  )
}

describe('useNavegacionLista', () => {
  it('las flechas mueven el índice resaltado', () => {
    render(<Lista onActivar={() => {}} />)
    const cont = screen.getByTestId('cont')
    expect(screen.getByTestId('activo')).toHaveTextContent('-1')

    fireEvent.keyDown(cont, { key: 'ArrowDown' })
    expect(screen.getByTestId('activo')).toHaveTextContent('0')

    fireEvent.keyDown(cont, { key: 'ArrowDown' })
    expect(screen.getByTestId('activo')).toHaveTextContent('1')

    fireEvent.keyDown(cont, { key: 'ArrowUp' })
    expect(screen.getByTestId('activo')).toHaveTextContent('0')
  })

  it('Enter abre la fila resaltada', () => {
    const onActivar = vi.fn()
    render(<Lista onActivar={onActivar} />)
    const cont = screen.getByTestId('cont')

    fireEvent.keyDown(cont, { key: 'Enter' })
    expect(onActivar).not.toHaveBeenCalled() // nada resaltado todavía

    fireEvent.keyDown(cont, { key: 'ArrowDown' })
    fireEvent.keyDown(cont, { key: 'ArrowDown' })
    fireEvent.keyDown(cont, { key: 'Enter' })
    expect(onActivar).toHaveBeenCalledWith(1)
  })

  it('ignora las flechas cuando el foco está en un campo de texto', () => {
    render(<Lista onActivar={() => {}} />)
    const campo = screen.getByTestId('campo')

    fireEvent.keyDown(campo, { key: 'ArrowDown' })
    expect(screen.getByTestId('activo')).toHaveTextContent('-1')
  })

  it('con global:true, las flechas andan escuchando en document (sin enfocar la lista)', () => {
    render(<Lista onActivar={() => {}} global />)
    expect(screen.getByTestId('activo')).toHaveTextContent('-1')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByTestId('activo')).toHaveTextContent('0')

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByTestId('activo')).toHaveTextContent('1')
  })

  it('con global:false, un keydown en document no mueve nada', () => {
    render(<Lista onActivar={() => {}} />)
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    expect(screen.getByTestId('activo')).toHaveTextContent('-1')
  })

  it('si la lista se achica, el índice se clampea al último válido', () => {
    render(<Lista onActivar={() => {}} />)
    const cont = screen.getByTestId('cont')

    fireEvent.keyDown(cont, { key: 'End' }) // -> 2
    expect(screen.getByTestId('activo')).toHaveTextContent('2')

    fireEvent.click(screen.getByTestId('achicar')) // total 3 -> 1
    expect(screen.getByTestId('activo')).toHaveTextContent('0')
  })
})
