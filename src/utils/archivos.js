/**
 * Valida que un archivo sea un PDF, mirando tanto la extensión del nombre
 * como el MIME type. El atributo `accept` de un `<input type="file">` es
 * solo una sugerencia visual del selector del sistema operativo — no
 * impide realmente subir otro tipo de archivo (el usuario puede elegir
 * "Todos los archivos", o arrastrar y soltar) — por eso hace falta esta
 * validación además del `accept` en el input.
 * @param {File|{name: string, type?: string}} archivo
 * @returns {boolean}
 */
export function esArchivoPDF(archivo) {
  if (!archivo || !archivo.name) return false
  const extensionEsPdf = /\.pdf$/i.test(archivo.name)
  // Si el navegador informó un MIME type, tiene que coincidir; si vino
  // vacío (pasa en algunos navegadores/orígenes), no lo exigimos y
  // confiamos en la extensión.
  const tipoEsPdf = !archivo.type || archivo.type === 'application/pdf'
  return extensionEsPdf && tipoEsPdf
}
