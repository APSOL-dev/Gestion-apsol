import { describe, test, expect } from 'vitest'
import {
  autoformatearVineta, parsearItemFormato, insertarVinetaEnLinea,
  insertarSalto, textoPlano,
} from '../sprint-item-formato'

describe('autoformatearVineta', () => {
  test('convierte "- " al principio de una línea en "• "', () => {
    expect(autoformatearVineta('- comprar pan')).toBe('• comprar pan')
  })
  test('respeta la sangría (espacios antes del guión)', () => {
    expect(autoformatearVineta('   - anidado')).toBe('   • anidado')
  })
  test('es idempotente: una línea que ya es viñeta no cambia', () => {
    expect(autoformatearVineta('• ya está')).toBe('• ya está')
  })
  test('no toca un guión sin espacio, ni un "--", ni un guión en el medio', () => {
    expect(autoformatearVineta('-sin espacio')).toBe('-sin espacio')
    expect(autoformatearVineta('-- raya doble')).toBe('-- raya doble')
    expect(autoformatearVineta('texto - con guión')).toBe('texto - con guión')
  })
  test('trabaja línea por línea en un texto multilínea', () => {
    expect(autoformatearVineta('titulo\n- uno\n- dos')).toBe('titulo\n• uno\n• dos')
  })
})

describe('parsearItemFormato', () => {
  test('línea simple: una parte sin negrita', () => {
    expect(parsearItemFormato('hola mundo')).toEqual([
      { vineta: false, sangria: 0, partes: [{ texto: 'hola mundo', negrita: false }] },
    ])
  })
  test('reconoce negrita con **', () => {
    expect(parsearItemFormato('esto es **importante** ok')).toEqual([
      {
        vineta: false, sangria: 0, partes: [
          { texto: 'esto es ', negrita: false },
          { texto: 'importante', negrita: true },
          { texto: ' ok', negrita: false },
        ],
      },
    ])
  })
  test('reconoce viñeta y nivel de sangría (2 espacios = 1 nivel)', () => {
    const out = parsearItemFormato('• raíz\n    • hijo')
    expect(out[0]).toMatchObject({ vineta: true, sangria: 0 })
    expect(out[0].partes).toEqual([{ texto: 'raíz', negrita: false }])
    expect(out[1]).toMatchObject({ vineta: true, sangria: 2 })
    expect(out[1].partes).toEqual([{ texto: 'hijo', negrita: false }])
  })
  test('viñeta + negrita juntas', () => {
    const out = parsearItemFormato('• hacer **esto**')
    expect(out[0]).toMatchObject({ vineta: true })
    expect(out[0].partes).toEqual([
      { texto: 'hacer ', negrita: false },
      { texto: 'esto', negrita: true },
    ])
  })
  test('texto vacío => una línea vacía', () => {
    expect(parsearItemFormato('')).toEqual([{ vineta: false, sangria: 0, partes: [] }])
  })
  test('** sin cerrar se deja literal', () => {
    expect(parsearItemFormato('a ** b')).toEqual([
      { vineta: false, sangria: 0, partes: [{ texto: 'a ** b', negrita: false }] },
    ])
  })
})

describe('insertarVinetaEnLinea (botón/tap)', () => {
  test('agrega "• " al inicio de la línea donde está el cursor', () => {
    const r = insertarVinetaEnLinea('primera\nsegunda', 10) // cursor en "segunda"
    expect(r.texto).toBe('primera\n• segunda')
    expect(r.cursor).toBe(12)
  })
  test('si la línea ya es viñeta, la saca (toggle)', () => {
    const r = insertarVinetaEnLinea('• segunda', 4)
    expect(r.texto).toBe('segunda')
  })
})

describe('insertarSalto (Ctrl+Enter)', () => {
  test('inserta un salto de línea en el cursor', () => {
    const r = insertarSalto('holamundo', 4)
    expect(r.texto).toBe('hola\nmundo')
    expect(r.cursor).toBe(5)
  })
  test('reemplaza la selección', () => {
    const r = insertarSalto('hola XXX mundo', 5, 8)
    expect(r.texto).toBe('hola \n mundo')
  })
  test('continúa la viñeta en la línea nueva', () => {
    const r = insertarSalto('• uno', 5)
    expect(r.texto).toBe('• uno\n• ')
    expect(r.cursor).toBe(8)
  })
  test('continúa la viñeta respetando la sangría', () => {
    const r = insertarSalto('    • hijo', 10)
    expect(r.texto).toBe('    • hijo\n    • ')
  })
  test('una viñeta vacía + Ctrl+Enter corta la lista (no encadena otra vacía)', () => {
    const r = insertarSalto('• ', 2)
    expect(r.texto).toBe('\n')
  })
})

describe('textoPlano (para listas compactas)', () => {
  test('saca ** y viñetas y junta las líneas', () => {
    expect(textoPlano('• hacer **esto**\n• y lo otro')).toBe('hacer esto · y lo otro')
  })
  test('texto sin formato queda igual', () => {
    expect(textoPlano('una cosa simple')).toBe('una cosa simple')
  })
})
