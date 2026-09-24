import { describe, test, expect } from 'vitest'
import { mensajeAvisoPago } from '../avisoPago'

describe('mensajeAvisoPago', () => {
  test('sin resultado (pago parcial: no hay aviso) no muestra nada', () => {
    expect(mensajeAvisoPago(null)).toBeNull()
    expect(mensajeAvisoPago(undefined)).toBeNull()
  })

  test('aviso enviado: mensaje de éxito', () => {
    const m = mensajeAvisoPago({ ok: true })
    expect(m.tipo).toBe('success')
    expect(m.texto).toMatch(/Pago registrado/)
    expect(m.texto).toMatch(/se envió el aviso/i)
  })

  test('aviso fallido: mensaje de error que aclara que el pago SÍ quedó guardado y que hay que avisar a mano', () => {
    const m = mensajeAvisoPago({ ok: false, error: 'status 404' })
    expect(m.tipo).toBe('error')
    expect(m.texto).toMatch(/Pago registrado/)
    expect(m.texto).toMatch(/NO se pudo enviar el aviso/)
    expect(m.texto).toMatch(/status 404/)
    expect(m.texto).toMatch(/manualmente/i)
  })

  test('aviso fallido sin detalle no deja un paréntesis vacío', () => {
    const m = mensajeAvisoPago({ ok: false })
    expect(m.texto).not.toMatch(/\(\s*\)/)
  })
})
