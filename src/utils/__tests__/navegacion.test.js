import { describe, it, expect } from 'vitest'
import { construirEnlaceContacto } from '../navegacion'

// construirEnlaceContacto decide si mostrar (y hacia dónde) el acceso
// directo a la ficha de un contacto desde otra pantalla (ej. el detalle
// de un prospecto, donde el contacto solo aparece en un <select>).

describe('construirEnlaceContacto', () => {
  const contactos = [
    { id: 'c1', nombre: 'Adrian', apellido: 'Patriarca' },
    { id: 'c2', nombre: 'Renata', apellido: '' },
    { id: 'c3', nombre: 'Sin', apellido: null }
  ]

  it('devuelve null si no hay contacto seleccionado', () => {
    expect(construirEnlaceContacto('', contactos)).toBeNull()
    expect(construirEnlaceContacto(null, contactos)).toBeNull()
    expect(construirEnlaceContacto(undefined, contactos)).toBeNull()
  })

  it('arma la ruta /contactos/:id del contacto seleccionado', () => {
    expect(construirEnlaceContacto('c1', contactos).href).toBe('/contactos/c1')
  })

  it('incluye nombre y apellido en la etiqueta cuando el contacto está en la lista', () => {
    expect(construirEnlaceContacto('c1', contactos).label).toBe('Ver ficha de Adrian Patriarca')
  })

  it('usa solo el nombre cuando no hay apellido', () => {
    expect(construirEnlaceContacto('c2', contactos).label).toBe('Ver ficha de Renata')
    expect(construirEnlaceContacto('c3', contactos).label).toBe('Ver ficha de Sin')
  })

  it('cae a una etiqueta genérica si el contacto no está en la lista (aún no cargó)', () => {
    const enlace = construirEnlaceContacto('desconocido', contactos)
    expect(enlace.href).toBe('/contactos/desconocido')
    expect(enlace.label).toBe('Ver ficha del contacto')
  })

  it('no rompe si la lista de contactos viene vacía o indefinida', () => {
    expect(construirEnlaceContacto('c1', []).label).toBe('Ver ficha del contacto')
    expect(construirEnlaceContacto('c1').href).toBe('/contactos/c1')
  })
})
