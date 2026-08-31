/**
 * Valida el cambio de contraseña del propio usuario en "Mi Perfil".
 * Devuelve un mensaje de error, o `null` si la contraseña nueva es válida.
 * @param {string} nueva
 * @param {string} repetir
 * @returns {string|null}
 */
export function validarNuevaPassword(nueva, repetir) {
  if (!nueva) return 'Ingresá una contraseña nueva.'
  if (nueva.length < 8) return 'La contraseña debe tener al menos 8 caracteres.'
  if (nueva !== repetir) return 'Las contraseñas no coinciden.'
  return null
}
