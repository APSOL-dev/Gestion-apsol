import { describe, it, expect } from 'vitest'
import {
  rutaVisibleParaRol, filtrarFavoritosPorRol, claveFavoritos, esColaboradorCargo
} from '../permisos'

describe('rutaVisibleParaRol', () => {
  it('Colaborador solo ve inicio, su perfil y operaciones', () => {
    for (const r of ['/', '/mi-perfil', '/cronograma', '/proyectos', '/sprints', '/tickets', '/preventivos']) {
      expect(rutaVisibleParaRol(r, 'Colaborador')).toBe(true)
    }
  })

  it('Colaborador ve también las rutas de detalle de lo permitido (por prefijo)', () => {
    expect(rutaVisibleParaRol('/proyectos/abc-123', 'Colaborador')).toBe(true)
    expect(rutaVisibleParaRol('/sprints/abc-123', 'Colaborador')).toBe(true)
    expect(rutaVisibleParaRol('/cronograma', 'Colaborador')).toBe(true)
  })

  it('Colaborador NO ve facturación, CRM, capacitación ni sistema', () => {
    for (const r of ['/facturacion', '/facturacion/nuevo', '/prospectos', '/empresas',
                     '/contactos', '/capacitacion', '/colaboradores', '/credenciales',
                     '/valores-uva', '/cuentas-bancarias', '/planificacion']) {
      expect(rutaVisibleParaRol(r, 'Colaborador')).toBe(false)
    }
  })

  it('Admin y Dueño ven todo, salvo "Mi Perfil"', () => {
    for (const cargo of ['Admin', 'Dueño']) {
      expect(rutaVisibleParaRol('/facturacion', cargo)).toBe(true)
      expect(rutaVisibleParaRol('/prospectos', cargo)).toBe(true)
      expect(rutaVisibleParaRol('/', cargo)).toBe(true)
      expect(rutaVisibleParaRol('/mi-perfil', cargo)).toBe(false)
    }
  })

  it('sin ruta -> false; cargo desconocido/ausente se trata como no-colaborador', () => {
    expect(rutaVisibleParaRol('', 'Colaborador')).toBe(false)
    expect(rutaVisibleParaRol(null, 'Admin')).toBe(false)
    expect(rutaVisibleParaRol('/facturacion', undefined)).toBe(true) // perfil aún cargando
  })
})

describe('esColaboradorCargo', () => {
  it('true solo para el string exacto "Colaborador"', () => {
    expect(esColaboradorCargo('Colaborador')).toBe(true)
    expect(esColaboradorCargo('Admin')).toBe(false)
    expect(esColaboradorCargo('colaborador')).toBe(false)
    expect(esColaboradorCargo(undefined)).toBe(false)
  })
})

describe('filtrarFavoritosPorRol', () => {
  const favs = [
    { to: '/facturacion', label: 'Facturación' },
    { to: '/cronograma', label: 'Cronograma' },
    { to: '/capacitacion', label: 'Capacitación' },
    { to: '/proyectos', label: 'Proyectos' }
  ]

  it('a un Colaborador le deja solo lo que puede ver', () => {
    expect(filtrarFavoritosPorRol(favs, 'Colaborador').map(f => f.to))
      .toEqual(['/cronograma', '/proyectos'])
  })

  it('a un Admin le deja todo', () => {
    expect(filtrarFavoritosPorRol(favs, 'Admin')).toHaveLength(4)
  })

  it('tolera entradas basura y no-arrays', () => {
    expect(filtrarFavoritosPorRol(null, 'Admin')).toEqual([])
    expect(filtrarFavoritosPorRol([null, { to: '/cronograma' }, {}], 'Colaborador').map(f => f.to))
      .toEqual(['/cronograma'])
  })
})

describe('claveFavoritos', () => {
  it('aísla por usuario', () => {
    expect(claveFavoritos('u-123')).toBe('apsol_favorites_u-123')
    expect(claveFavoritos('u-999')).toBe('apsol_favorites_u-999')
  })

  it('sin userId cae a la clave legacy (no rompe si todavía no cargó la sesión)', () => {
    expect(claveFavoritos(null)).toBe('apsol_favorites')
    expect(claveFavoritos(undefined)).toBe('apsol_favorites')
  })
})
