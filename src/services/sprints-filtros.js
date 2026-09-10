// ──────────────────────────────────────────────────────────────
// Filtros de la pantalla /sprints: por proyecto, por prospecto y por
// empresa. Puros y testeados; la pantalla solo arma la UI y guarda la
// selección (no se persiste entre recargas, es a propósito).
//
// Forma esperada de cada sprint:
//   { proyecto: { id, nombre, prospecto: { id, nombre, empresa: { id, nombre } } } }
// prospecto/empresa pueden venir en null (proyecto interno o dato incompleto).
// ──────────────────────────────────────────────────────────────

function ordenarPorNombre(lista) {
  return [...lista].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
}

// Junta las opciones únicas para poblar los tres selectores.
export function opcionesDeFiltro(sprints) {
  if (!Array.isArray(sprints)) return { proyectos: [], prospectos: [], empresas: [] }

  const proyectos = new Map()
  const prospectos = new Map()
  const empresas = new Map()

  for (const s of sprints) {
    const py = s?.proyecto
    if (py?.id && !proyectos.has(py.id)) proyectos.set(py.id, { id: py.id, nombre: py.nombre || '—' })
    const pr = py?.prospecto
    if (pr?.id && !prospectos.has(pr.id)) prospectos.set(pr.id, { id: pr.id, nombre: pr.nombre || '—' })
    const em = pr?.empresa
    if (em?.id && !empresas.has(em.id)) empresas.set(em.id, { id: em.id, nombre: em.nombre || '—' })
  }

  return {
    proyectos: ordenarPorNombre([...proyectos.values()]),
    prospectos: ordenarPorNombre([...prospectos.values()]),
    empresas: ordenarPorNombre([...empresas.values()]),
  }
}

// `filtros`: { proyectoIds?, prospectoIds?, empresaIds? }. Cada lista vacía =
// ese eje no filtra. Los ejes activos se combinan con AND.
export function filtrarSprints(sprints, filtros = {}) {
  if (!Array.isArray(sprints)) return []
  const proyectoIds = new Set(filtros.proyectoIds || [])
  const prospectoIds = new Set(filtros.prospectoIds || [])
  const empresaIds = new Set(filtros.empresaIds || [])

  if (!proyectoIds.size && !prospectoIds.size && !empresaIds.size) return [...sprints]

  return sprints.filter((s) => {
    const py = s?.proyecto
    const pr = py?.prospecto
    const em = pr?.empresa
    if (proyectoIds.size && !proyectoIds.has(py?.id)) return false
    if (prospectoIds.size && !prospectoIds.has(pr?.id)) return false
    if (empresaIds.size && !empresaIds.has(em?.id)) return false
    return true
  })
}
