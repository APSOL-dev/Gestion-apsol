import { describe, it, expect } from 'vitest'
import { siguienteIndice, esCampoDeTexto, esTeclaActivar } from '../teclado'

describe('siguienteIndice', () => {
  it('ArrowDown avanza una fila y clampea en la última', () => {
    expect(siguienteIndice('ArrowDown', 0, 3)).toBe(1)
    expect(siguienteIndice('ArrowDown', 2, 3)).toBe(2)
  })

  it('ArrowUp retrocede una fila y clampea en la primera', () => {
    expect(siguienteIndice('ArrowUp', 2, 3)).toBe(1)
    expect(siguienteIndice('ArrowUp', 0, 3)).toBe(0)
  })

  it('desde "sin selección" (-1): ArrowDown va a la primera, ArrowUp a la última', () => {
    expect(siguienteIndice('ArrowDown', -1, 3)).toBe(0)
    expect(siguienteIndice('ArrowUp', -1, 3)).toBe(2)
  })

  it('Home va a la primera y End a la última', () => {
    expect(siguienteIndice('Home', 2, 3)).toBe(0)
    expect(siguienteIndice('End', 0, 3)).toBe(2)
  })

  it('con wrap:true, pasa de la última a la primera y viceversa', () => {
    expect(siguienteIndice('ArrowDown', 2, 3, { wrap: true })).toBe(0)
    expect(siguienteIndice('ArrowUp', 0, 3, { wrap: true })).toBe(2)
  })

  it('lista vacía devuelve -1', () => {
    expect(siguienteIndice('ArrowDown', -1, 0)).toBe(-1)
  })

  it('una tecla no relacionada deja el índice igual', () => {
    expect(siguienteIndice('a', 1, 3)).toBe(1)
    expect(siguienteIndice('Enter', 1, 3)).toBe(1)
  })
})

describe('esCampoDeTexto', () => {
  it('detecta input, textarea y select', () => {
    expect(esCampoDeTexto({ tagName: 'INPUT' })).toBe(true)
    expect(esCampoDeTexto({ tagName: 'TEXTAREA' })).toBe(true)
    expect(esCampoDeTexto({ tagName: 'SELECT' })).toBe(true)
  })

  it('detecta contentEditable', () => {
    expect(esCampoDeTexto({ tagName: 'DIV', isContentEditable: true })).toBe(true)
  })

  it('un div normal o un botón no son campo de texto', () => {
    expect(esCampoDeTexto({ tagName: 'DIV' })).toBe(false)
    expect(esCampoDeTexto({ tagName: 'BUTTON' })).toBe(false)
  })

  it('null / undefined devuelven false', () => {
    expect(esCampoDeTexto(null)).toBe(false)
    expect(esCampoDeTexto(undefined)).toBe(false)
  })
})

describe('esTeclaActivar', () => {
  it('Enter activa', () => {
    expect(esTeclaActivar('Enter')).toBe(true)
  })
  it('otras teclas no activan', () => {
    expect(esTeclaActivar(' ')).toBe(false)
    expect(esTeclaActivar('ArrowDown')).toBe(false)
  })
})
