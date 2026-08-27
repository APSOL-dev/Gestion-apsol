/**
 * Arma el acceso directo a la ficha de un contacto para pantallas donde
 * el contacto solo aparece elegido en un <select> (ej. el detalle de un
 * prospecto). Devuelve { href, label } o null si todavía no hay un
 * contacto seleccionado.
 *
 * La etiqueta usa nombre + apellido si el contacto ya está en la lista
 * cargada; si no (la lista aún no llegó, o el contacto es de otra
 * empresa), cae a un texto genérico pero igual arma el href.
 */
export function construirEnlaceContacto(contactoId, contactos = []) {
  if (!contactoId) return null

  const contacto = (contactos || []).find(c => c.id === contactoId)
  const nombreCompleto = contacto
    ? [contacto.nombre, contacto.apellido].filter(Boolean).join(' ').trim()
    : ''

  return {
    href: `/contactos/${contactoId}`,
    label: nombreCompleto ? `Ver ficha de ${nombreCompleto}` : 'Ver ficha del contacto'
  }
}
