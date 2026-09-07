import { describe, test, expect, beforeEach, vi } from 'vitest'
import { leerFiltrosGuardados, guardarFiltros } from '../cronogramaFiltrosPersistencia'

const CLAVE = 'apsol_cronograma_filtros'

const FILTROS = {
  fechaDesde: '2026-05-01',
  fechaHasta: '2026-08-01',
  selectedColab: ['col-1', 'col-2'],
  selectedProspectos: ['pros-9'],
  verHistorico: true,
  verAgendaExterna: false,
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('cronogramaFiltrosPersistencia', () => {
  test('round-trip: lo que se guarda para un usuario se recupera igual', () => {
    guardarFiltros('user-1', FILTROS)
    expect(leerFiltrosGuardados('user-1')).toEqual(FILTROS)
  })

  test('sin nada guardado devuelve {}', () => {
    expect(leerFiltrosGuardados('user-1')).toEqual({})
  })

  test('guarda por usuario: lo de user-1 no pisa lo de user-2', () => {
    guardarFiltros('user-1', { ...FILTROS, fechaDesde: '2026-01-01' })
    guardarFiltros('user-2', { ...FILTROS, fechaDesde: '2026-12-12' })

    expect(leerFiltrosGuardados('user-1').fechaDesde).toBe('2026-01-01')
    expect(leerFiltrosGuardados('user-2').fechaDesde).toBe('2026-12-12')
  })

  test('guardar es un merge: un guardado parcial no borra las otras claves', () => {
    guardarFiltros('user-1', FILTROS)
    guardarFiltros('user-1', { verHistorico: false })

    expect(leerFiltrosGuardados('user-1')).toEqual({ ...FILTROS, verHistorico: false })
  })

  test('sin userId usa un bucket propio ("_") y no choca con el de un usuario', () => {
    guardarFiltros(null, { verAgendaExterna: false })
    guardarFiltros('user-1', { verAgendaExterna: true })

    expect(leerFiltrosGuardados(null)).toEqual({ verAgendaExterna: false })
    expect(leerFiltrosGuardados('user-1')).toEqual({ verAgendaExterna: true })
  })

  test('descarta claves con forma inválida y conserva las válidas', () => {
    localStorage.setItem(CLAVE, JSON.stringify({
      'user-1': {
        fechaDesde: '01/05/2026',        // formato incorrecto -> se descarta
        fechaHasta: '2026-08-01',        // ok
        selectedColab: 'col-1',          // no es array -> se descarta
        selectedProspectos: ['a', 2],    // array con no-string -> se descarta
        verHistorico: 'si',              // no es booleano -> se descarta
        verAgendaExterna: false,         // ok
      },
    }))

    expect(leerFiltrosGuardados('user-1')).toEqual({
      fechaHasta: '2026-08-01',
      verAgendaExterna: false,
    })
  })

  test('JSON corrupto en localStorage no rompe, devuelve {}', () => {
    localStorage.setItem(CLAVE, '{no es json')
    expect(leerFiltrosGuardados('user-1')).toEqual({})
  })

  test('si localStorage tira excepción, leer devuelve {} y guardar no propaga', () => {
    const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('bloqueado') })
    const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('bloqueado') })

    expect(leerFiltrosGuardados('user-1')).toEqual({})
    expect(() => guardarFiltros('user-1', FILTROS)).not.toThrow()

    getSpy.mockRestore()
    setSpy.mockRestore()
  })
})
