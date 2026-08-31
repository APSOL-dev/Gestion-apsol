import { describe, it, expect } from 'vitest'
import { validarNuevaPassword } from '../perfil'

describe('validarNuevaPassword', () => {
  it('rechaza vacía', () => {
    expect(validarNuevaPassword('', '')).toMatch(/ingres/i)
  })

  it('rechaza contraseñas de menos de 8 caracteres', () => {
    expect(validarNuevaPassword('abc123', 'abc123')).toMatch(/8/)
  })

  it('rechaza cuando no coinciden', () => {
    expect(validarNuevaPassword('claveSegura1', 'claveSegura2')).toMatch(/coinciden/i)
  })

  it('devuelve null cuando es válida y coincide', () => {
    expect(validarNuevaPassword('claveSegura1', 'claveSegura1')).toBeNull()
  })
})
