import { describe, it, expect } from 'vitest'
import { MODULOS_PRECARGA_LOGIN } from '../DataContext'

// Adrián pidió explícitamente una precarga al entrar, para que moverse entre
// pantallas se sienta instantáneo. En algún momento se recortó a 5 módulos
// creyendo que el volumen causaba los cuelgues; la causa real era el lock de
// auth roto (ver src/lib/supabase.js), no la cantidad de consultas.
// Este test es el tripwire para que la precarga no se vuelva a recortar.

describe('MODULOS_PRECARGA_LOGIN', () => {
  it('precarga TODOS los módulos de datos al iniciar sesión', () => {
    expect([...MODULOS_PRECARGA_LOGIN].sort()).toEqual([
      'capacitaciones',
      'colaboradores',
      'contactos',
      'credenciales',
      'cuentasBancarias',
      'empresas',
      'facturas',
      'planes',
      'preventivos',
      'prospectos',
      'proyectos',
      'tickets'
    ])
  })

  it('no repite módulos', () => {
    expect(new Set(MODULOS_PRECARGA_LOGIN).size).toBe(MODULOS_PRECARGA_LOGIN.length)
  })
})
