import { describe, test, expect } from 'vitest'
import { construirPayloadEmpresa } from '../empresas'

// BUG real: el alta rápida de empresa (desde Prospectos y desde Contactos)
// mandaba `tamaño_personas`, pero esa columna NO existe: en la vista
// public.apsol_empresas y en apsol_private.empresas la columna es `tamanio`
// (integer). PostgREST rechaza el INSERT entero -> "Error al crear la
// empresa. Intente nuevamente." El helper arma el payload con el nombre
// real de la columna.
describe('construirPayloadEmpresa', () => {
  const base = {
    nombre: '  Pagos TIC  ',
    pais: 'Argentina',
    provincia: 'CABA',
    industria: 'Servicios Financieros',
    tamaño_personas: '50',
    dias_espera_facturacion: '4',
  }

  test('mapea el tamaño a la columna real `tamanio` (numérica)', () => {
    const p = construirPayloadEmpresa(base)
    expect(p.tamanio).toBe(50)
    expect(p).not.toHaveProperty('tamaño_personas')
  })

  test('trimea el nombre y conserva pais/provincia/industria', () => {
    const p = construirPayloadEmpresa(base)
    expect(p.nombre).toBe('Pagos TIC')
    expect(p.pais).toBe('Argentina')
    expect(p.provincia).toBe('CABA')
    expect(p.industria).toBe('Servicios Financieros')
  })

  test('dias_espera_facturacion: castea a número y default 4 si viene vacío/0', () => {
    expect(construirPayloadEmpresa({ ...base, dias_espera_facturacion: '10' }).dias_espera_facturacion).toBe(10)
    expect(construirPayloadEmpresa({ ...base, dias_espera_facturacion: '' }).dias_espera_facturacion).toBe(4)
    expect(construirPayloadEmpresa({ ...base, dias_espera_facturacion: undefined }).dias_espera_facturacion).toBe(4)
  })

  test('nunca emite claves fantasma (solo columnas reales de apsol_empresas)', () => {
    const p = construirPayloadEmpresa({ ...base, id: 'x', created_at: 'y', basura: 1 })
    expect(Object.keys(p).sort()).toEqual(
      ['dias_espera_facturacion', 'industria', 'nombre', 'pais', 'provincia', 'tamanio']
    )
  })
})
