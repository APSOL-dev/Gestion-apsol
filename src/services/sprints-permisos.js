// ──────────────────────────────────────────────────────────────
// Visibilidad de proyectos y sprints por asignación de prospectos.
//
// Regla: un Colaborador raso solo ve los proyectos cuyo prospecto está
// entre los que tiene en "Prospectos para trabajar"
// (apsol_colaboradores_prospectos), y por lo tanto solo los sprints de
// esos proyectos. Dueño/Admin y Team Lead ven todo.
//
// OJO: esto es defensa de UI. El candado real (RLS en la base) es un
// paso aparte; hoy la base deja ver todo a cualquier autenticado.
// ──────────────────────────────────────────────────────────────

export function puedeVerTodo({ esDuenio = false, esTeamLead = false } = {}) {
  return Boolean(esDuenio || esTeamLead)
}

// Saca el id del prospecto de un proyecto, sea que venga plano
// (prospecto_id) o anidado (prospecto / prospectos como en las vistas).
function prospectoIdDeProyecto(proyecto) {
  if (!proyecto) return null
  return proyecto.prospecto_id
    || proyecto.prospecto?.id
    || proyecto.prospectos?.id
    || null
}

export function proyectoVisiblePara(proyecto, { verTodo = false, prospectosAsignados = [] } = {}) {
  if (verTodo) return true
  const prId = prospectoIdDeProyecto(proyecto)
  if (!prId) return false
  return prospectosAsignados.includes(prId)
}

export function sprintVisiblePara(sprint, opts) {
  return proyectoVisiblePara(sprint?.proyecto, opts)
}

export function filtrarPorAsignacion(sprints, opts = {}) {
  if (!Array.isArray(sprints)) return []
  if (opts.verTodo) return [...sprints]
  return sprints.filter((s) => sprintVisiblePara(s, opts))
}
