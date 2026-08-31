import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Los 3 formularios de alta rápida de empresa (dentro de ProspectoDetalle,
// ContactoDetalle y EmpresaDetalle) preseleccionan `dias_espera_facturacion`
// para la empresa nueva. El estándar de APSOL es 4 días hábiles y coincide
// con el DEFAULT de la columna en la base y con DIAS_ESPERA_FACTURACION_DEFAULT.
//
// Este test es un tripwire barato: evita que ese literal vuelva a "5" (el
// valor viejo) sin que nadie se entere. No monta los componentes: solo lee
// el texto fuente, que para un literal como este alcanza y sobra.

const archivos = [
  'ProspectoDetalle.jsx',
  'ContactoDetalle.jsx',
  'EmpresaDetalle.jsx'
]

function leer(nombre) {
  // vitest corre desde la raíz del proyecto
  return readFileSync(join(process.cwd(), 'src', 'pages', nombre), 'utf8')
}

describe('Alta rápida de empresa — default de dias_espera_facturacion', () => {
  for (const nombre of archivos) {
    it(`${nombre}: usa 4 como default y nunca 5`, () => {
      const src = leer(nombre)
      // Aparece al menos una vez como `dias_espera_facturacion: 4`
      expect(src).toMatch(/dias_espera_facturacion:\s*4\b/)
      // No queda ningún `dias_espera_facturacion: 5` ni `|| 5` / `?? 5` colgado
      expect(src).not.toMatch(/dias_espera_facturacion:\s*5\b/)
      expect(src).not.toMatch(/dias_espera_facturacion[^\n]*(\|\||\?\?)\s*5\b/)
    })
  }
})
