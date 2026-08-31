import { describe, it, expect } from 'vitest'
import { sumarDiasHabiles, sumarDias, sumarMeses, diasDesde } from '../fecha'

// sumarDiasHabiles: suma N días hábiles salteando SOLO sábados y domingos.
// Debe quedar sincronizada con la función SQL apsol_sumar_dias_habiles.
describe('sumarDiasHabiles', () => {
  it('reproduce el ejemplo acordado: viernes 2026-08-28 + 4 hábiles = jueves 2026-09-03', () => {
    expect(sumarDiasHabiles('2026-08-28', 4)).toBe('2026-09-03')
  })

  it('reproduce el segundo ejemplo: jueves 2026-09-03 + 4 hábiles = miércoles 2026-09-09', () => {
    expect(sumarDiasHabiles('2026-09-03', 4)).toBe('2026-09-09')
  })

  it('un día hábil desde un lunes cae el martes', () => {
    // 2026-08-24 es lunes
    expect(sumarDiasHabiles('2026-08-24', 1)).toBe('2026-08-25')
  })

  it('un día hábil desde un viernes salta el fin de semana y cae el lunes', () => {
    // 2026-08-28 es viernes -> lunes 2026-08-31
    expect(sumarDiasHabiles('2026-08-28', 1)).toBe('2026-08-31')
  })

  it('desde un sábado, el primer día hábil es el lunes siguiente', () => {
    // 2026-08-29 es sábado
    expect(sumarDiasHabiles('2026-08-29', 1)).toBe('2026-08-31')
  })

  it('desde un domingo, el primer día hábil es el lunes siguiente', () => {
    // 2026-08-30 es domingo
    expect(sumarDiasHabiles('2026-08-30', 1)).toBe('2026-08-31')
  })

  it('5 días hábiles desde un lunes cae el lunes siguiente (una semana exacta)', () => {
    expect(sumarDiasHabiles('2026-08-24', 5)).toBe('2026-08-31')
  })

  it('10 días hábiles desde un lunes cae dos semanas después', () => {
    expect(sumarDiasHabiles('2026-08-24', 10)).toBe('2026-09-07')
  })

  it('n = 0 devuelve la misma fecha', () => {
    expect(sumarDiasHabiles('2026-08-28', 0)).toBe('2026-08-28')
  })

  it('n negativo se trata como 0 (no resta)', () => {
    expect(sumarDiasHabiles('2026-08-28', -3)).toBe('2026-08-28')
  })

  it('cruza fin de mes y fin de año', () => {
    // 2026-12-31 es jueves -> +1 hábil = viernes 2027-01-01
    expect(sumarDiasHabiles('2026-12-31', 1)).toBe('2027-01-01')
    // 2026-02-26 es jueves -> +2 hábiles = lunes 2026-03-02
    expect(sumarDiasHabiles('2026-02-26', 2)).toBe('2026-03-02')
  })

  it('acepta n como string numérico y lo trunca si es decimal', () => {
    expect(sumarDiasHabiles('2026-08-28', '4')).toBe('2026-09-03')
    expect(sumarDiasHabiles('2026-08-28', 4.9)).toBe('2026-09-03')
  })

  it('devuelve "" ante una fecha inválida o incompleta', () => {
    expect(sumarDiasHabiles('', 4)).toBe('')
    expect(sumarDiasHabiles('2026-8-2', 4)).toBe('')
    expect(sumarDiasHabiles('0002-08-10', 4)).toBe('')
    expect(sumarDiasHabiles(null, 4)).toBe('')
  })

  it('no corre el día en zona horaria negativa (mismo criterio local que sumarDias)', () => {
    // Regresión del bug de toISOString(): armar la fecha por componentes locales.
    expect(sumarDiasHabiles('2026-03-01', 0)).toBe('2026-03-01')
  })
})

// diasDesde: días corridos entre una fecha 'YYYY-MM-DD' y HOY (o una fecha
// de referencia), parseando SIEMPRE en hora local. Bug real: con
// `new Date('2026-08-31')` (UTC) en Argentina (UTC-3), una factura emitida
// hoy mostraba "Retraso: 1 Días" el mismo día que se emitía.
describe('diasDesde', () => {
  it('el mismo día devuelve 0 (aunque la referencia tenga hora)', () => {
    expect(diasDesde('2026-08-31', new Date(2026, 7, 31, 9, 30))).toBe(0)
    expect(diasDesde('2026-08-31', new Date(2026, 7, 31, 23, 59))).toBe(0)
  })

  it('un día después devuelve 1', () => {
    expect(diasDesde('2026-08-31', new Date(2026, 8, 1, 0, 1))).toBe(1)
  })

  it('una fecha futura devuelve negativo', () => {
    expect(diasDesde('2026-09-10', new Date(2026, 7, 31))).toBe(-10)
  })

  it('cuenta bien cruzando fin de mes', () => {
    expect(diasDesde('2026-08-28', new Date(2026, 8, 3))).toBe(6)
  })

  it('tolera un string ISO con hora (recorta la parte de fecha)', () => {
    expect(diasDesde('2026-08-31T00:00:00', new Date(2026, 7, 31))).toBe(0)
  })

  it('devuelve null si la fecha no es válida', () => {
    expect(diasDesde('', new Date())).toBeNull()
    expect(diasDesde(null, new Date())).toBeNull()
    expect(diasDesde('31/08/2026', new Date())).toBeNull()
  })
})

// Smoke tests de los helpers vecinos, para no romperlos al tocar el archivo.
describe('fecha.js — helpers vecinos (sin regresión)', () => {
  it('sumarDias sigue sumando días corridos', () => {
    expect(sumarDias('2026-08-28', 15)).toBe('2026-09-12')
  })

  it('sumarMeses sigue clampeando al último día del mes destino', () => {
    expect(sumarMeses('2026-01-31', 1)).toBe('2026-02-28')
  })
})
