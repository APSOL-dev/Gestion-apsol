import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url)) // src/pages/__tests

// Las listas (prospectos, empresas, contactos) viven cacheadas en
// DataContext con un TTL de 90s. Las pantallas de detalle a página completa
// guardaban directo por la capa de servicios sin avisarle a esa caché, así
// que al volver a la lista dentro de los 90s se veían datos viejos hasta
// apretar F5.
//
// Cada pantalla de detalle tiene que, después de guardar/borrar, forzar el
// refetch del/los módulo(s) de DataContext que toca (refreshX({ forzar:true })).
// Este tripwire de texto fuente evita que esa llamada se pierda en un refactor
// (mismo enfoque que altaEmpresaRapida.test.js: para un patrón así, leer el
// fuente alcanza y no hay que montar el componente entero).

function leer(nombre) {
  return readFileSync(join(AQUI, '..', nombre), 'utf8')
}

const PANTALLAS = {
  'ProspectoDetalle.jsx': ['refreshProspectos'],
  'EmpresaDetalle.jsx': ['refreshEmpresas'],
  'ContactoDetalle.jsx': ['refreshContactos']
}

describe('Detalle: refresca la caché de DataContext al guardar', () => {
  for (const [archivo, refrescadores] of Object.entries(PANTALLAS)) {
    it(`${archivo}: usa useData() y fuerza el refetch de su lista`, () => {
      const src = leer(archivo)
      expect(src).toMatch(/from ['"]\.\.\/context\/DataContext['"]/)
      expect(src).toMatch(/useData\(\)/)
      for (const fn of refrescadores) {
        // p.ej. refreshProspectos?.({ silencioso: true, forzar: true })
        const re = new RegExp(`${fn}\\?\\.\\(\\{[^}]*forzar:\\s*true`)
        expect(src).toMatch(re)
      }
    })
  }
})
