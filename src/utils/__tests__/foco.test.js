import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { elementosFocusables, focoCiclico } from '../foco'

describe('elementosFocusables', () => {
  let cont

  beforeEach(() => {
    cont = document.createElement('div')
    cont.innerHTML = `
      <a href="#uno">uno</a>
      <button>dos</button>
      <button disabled>deshabilitado</button>
      <input type="text" />
      <input type="text" disabled />
      <div tabindex="0">div enfocable</div>
      <div tabindex="-1">div no enfocable</div>
      <span>texto plano</span>
    `
    document.body.appendChild(cont)
  })

  afterEach(() => {
    cont.remove()
  })

  it('devuelve solo los elementos enfocables, en orden de documento', () => {
    const els = elementosFocusables(cont)
    expect(els.map(e => e.textContent || e.tagName)).toEqual([
      'uno', 'dos', 'INPUT', 'div enfocable'
    ])
  })

  it('excluye [disabled] y [tabindex="-1"]', () => {
    const els = elementosFocusables(cont)
    expect(els.some(e => e.textContent === 'deshabilitado')).toBe(false)
    expect(els.some(e => e.textContent === 'div no enfocable')).toBe(false)
  })

  it('contenedor nulo devuelve []', () => {
    expect(elementosFocusables(null)).toEqual([])
  })
})

describe('focoCiclico', () => {
  const a = { id: 'a' }
  const b = { id: 'b' }
  const c = { id: 'c' }
  const els = [a, b, c]

  it('Tab desde el último vuelve al primero', () => {
    expect(focoCiclico(els, c, false)).toBe(a)
  })

  it('Shift+Tab desde el primero salta al último', () => {
    expect(focoCiclico(els, a, true)).toBe(c)
  })

  it('Tab en el medio no intercepta (devuelve null)', () => {
    expect(focoCiclico(els, b, false)).toBe(null)
    expect(focoCiclico(els, b, true)).toBe(null)
  })

  it('si el foco está fuera del contenedor, lo trae adentro', () => {
    const fuera = { id: 'fuera' }
    expect(focoCiclico(els, fuera, false)).toBe(a)
    expect(focoCiclico(els, fuera, true)).toBe(c)
  })

  it('lista vacía devuelve null', () => {
    expect(focoCiclico([], a, false)).toBe(null)
  })
})
