// Los favoritos guardan solo {to, icon, label} — icon es el nombre del ícono
// en ICON_MAP (string), no el componente, para que sea serializable en
// localStorage/jsonb. Filas viejas corruptas (icon como componente) se descartan.
export function normalizarFavoritos(valor) {
  if (!Array.isArray(valor)) return []
  return valor.filter(f =>
    f && typeof f.to === 'string' && typeof f.icon === 'string' && typeof f.label === 'string'
  )
}

export function alternarFavorito(favoritos, item) {
  const lista = normalizarFavoritos(favoritos)
  return lista.some(f => f.to === item.to)
    ? lista.filter(f => f.to !== item.to)
    : [...lista, { to: item.to, icon: item.icon, label: item.label }]
}
