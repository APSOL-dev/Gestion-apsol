import { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Calendar, Trash2, X, AlertCircle } from 'lucide-react'
import {
  getPlanById,
  actualizarPlan,
  crearObjetivo,
  actualizarObjetivo,
  eliminarObjetivo,
  crearSubobjetivo,
  actualizarSubobjetivo,
  eliminarSubobjetivo,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  setAsignaciones,
  getColaboradoresActivos
} from '../services/planificacion'

const COLOR_PALETTE = ['#2563EB', '#059669', '#D97706', '#7C3AED', '#DC2626', '#0891B2', '#DB2777', '#4F46E5', '#0D9488', '#92400E']
const PROG_STEPS = [0, 25, 50, 75, 100]

export default function PlanDetalle() {
  const { id } = useParams()
  const [plan, setPlan] = useState(null)
  const [loading, setLoading] = useState(true)
  const [colaboradores, setColaboradores] = useState([])
  const [cellWidth, setCellWidth] = useState(() => {
    const saved = localStorage.getItem('apsol_gantt_cell_width')
    return saved ? Number(saved) : 100
  })
  const [showDatesModal, setShowDatesModal] = useState(false)
  const [tempDates, setTempDates] = useState({ start: '', end: '' })
  const [assigningTask, setAssigningTask] = useState(null)
  const [assignPopupPos, setAssignPopupPos] = useState({ top: 0, left: 0 })
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [dragOverTaskId, setDragOverTaskId] = useState(null)
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('apsol_gantt_sidebar_width')
    return saved ? Number(saved) : 220
  })
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const dragInfo = useRef(null)

  const Z = {
    cell: cellWidth,
    row: 38,
    side: sidebarWidth,
    barH: 24,
    barTop: 7
  }

  useEffect(() => {
    cargarDatos()
  }, [id])

  useEffect(() => {
    function handleOutsideClick() {
      setAssigningTask(null)
    }
    if (assigningTask) {
      document.addEventListener('click', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('click', handleOutsideClick)
    }
  }, [assigningTask])

  async function cargarDatos() {
    setLoading(true)
    try {
      const [planData, colsData] = await Promise.all([
        getPlanById(id),
        getColaboradoresActivos()
      ])
      if (planData) {
        planData.objetivos = planData.objetivos || []
        planData.subobjetivos = planData.subobjetivos || []
        planData.tareas = (planData.tareas || []).map(t => ({
          ...t,
          asignaciones: t.asignaciones || []
        }))
      }
      setPlan(planData)
      setColaboradores(colsData)
    } catch (err) {
      console.error('Error al cargar datos del plan:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="loading-screen" style={{ minHeight: '300px' }}>
        <div className="loading-spinner" />
        <p>Cargando detalles del plan...</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="page">
        <div className="alert alert-error">
          <AlertCircle size={20} />
          No se encontró el plan de trabajo.
        </div>
        <Link to="/planificacion" className="btn btn-secondary" style={{ marginTop: '16px' }}>
          <ArrowLeft size={16} /> Volver a Planificación
        </Link>
      </div>
    )
  }

  // Cálculos de fechas y semanas
  const dateStart = new Date(plan.fecha_inicio + 'T00:00:00')
  const dateEnd = new Date(plan.fecha_fin + 'T00:00:00')
  const totalWeeks = Math.max(1, Math.ceil(((dateEnd - dateStart) / 86400000 + 1) / 7))

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const currentWeek = Math.max(0, Math.floor((today - dateStart) / (7 * 86400000)))
  const dayOffset = Math.floor((today - dateStart) / 86400000)
  const todayPx = (dayOffset * Z.cell) / 7

  // Listar semanas
  const weeks = []
  for (let w = 0; w < totalWeeks; w++) {
    const d = new Date(dateStart)
    d.setDate(d.getDate() + w * 7)
    weeks.push(d)
  }

  // Agrupar semanas por mes para la cabecera
  const monthsGroup = []
  weeks.forEach(d => {
    const key = d.getFullYear() + '-' + d.getMonth()
    const existing = monthsGroup.find(m => m.key === key)
    if (existing) {
      existing.count++
    } else {
      monthsGroup.push({
        key,
        month: d.getMonth(),
        year: d.getFullYear(),
        count: 1
      })
    }
  })

  // ---- CRUD DE OBJETIVOS ----
  async function handleAddObjetivo() {
    const usedColors = plan.objetivos.map(o => o.color)
    const color = COLOR_PALETTE.find(c => !usedColors.includes(c)) || COLOR_PALETTE[plan.objetivos.length % COLOR_PALETTE.length]
    
    try {
      const nuevo = await crearObjetivo({
        plan_id: plan.id,
        titulo: 'Nuevo objetivo',
        descripcion: 'Descripción del objetivo',
        color,
        orden: plan.objetivos.length
      })
      setPlan({
        ...plan,
        objetivos: [...plan.objetivos, { ...nuevo, tareas: [] }]
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleUpdateObjetivo(objId, campos) {
    try {
      await actualizarObjetivo(objId, campos)
      setPlan({
        ...plan,
        objetivos: plan.objetivos.map(o => o.id === objId ? { ...o, ...campos } : o)
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteObjetivo(objId, titulo) {
    const tasksCount = plan.tareas.filter(t => t.objetivo_id === objId).length
    if (!confirm(`¿Eliminar el objetivo "${titulo}" ${tasksCount > 0 ? `y sus ${tasksCount} tarea(s)` : ''}?`)) {
      return
    }

    try {
      await eliminarObjetivo(objId)
      setPlan({
        ...plan,
        objetivos: plan.objetivos.filter(o => o.id !== objId),
        tareas: plan.tareas.filter(t => t.objetivo_id !== objId)
      })
    } catch (err) {
      console.error(err)
    }
  }

  // ---- CRUD DE SUBOBJETIVOS ----
  async function handleAddSubobjetivo() {
    try {
      const nuevo = await crearSubobjetivo({
        plan_id: plan.id,
        texto: 'Nuevo subobjetivo / nota',
        orden: plan.subobjetivos?.length || 0
      })
      setPlan({
        ...plan,
        subobjetivos: [...(plan.subobjetivos || []), nuevo]
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleUpdateSubobjetivo(subId, texto) {
    try {
      await actualizarSubobjetivo(subId, { texto })
      setPlan({
        ...plan,
        subobjetivos: plan.subobjetivos.map(s => s.id === subId ? { ...s, texto } : s)
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteSubobjetivo(subId) {
    try {
      await eliminarSubobjetivo(subId)
      setPlan({
        ...plan,
        subobjetivos: plan.subobjetivos.filter(s => s.id !== subId)
      })
    } catch (err) {
      console.error(err)
    }
  }

  // ---- CRUD DE TAREAS ----
  async function handleAddTask(objId) {
    try {
      const nueva = await crearTarea({
        plan_id: plan.id,
        objetivo_id: objId,
        nombre: 'Nueva tarea',
        semana_inicio: 0,
        duracion_semanas: 2,
        orden: plan.tareas.filter(t => t.objetivo_id === objId).length
      })
      setPlan({
        ...plan,
        tareas: [...plan.tareas, { ...nueva, asignaciones: [] }]
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleUpdateTarea(tareaId, campos) {
    try {
      await actualizarTarea(tareaId, campos)
      setPlan({
        ...plan,
        tareas: plan.tareas.map(t => t.id === tareaId ? { ...t, ...campos } : t)
      })
    } catch (err) {
      console.error(err)
    }
  }

  async function handleDeleteTarea(tareaId) {
    if (!confirm('¿Eliminar esta tarea del Gantt?')) return
    try {
      await eliminarTarea(tareaId)
      setPlan({
        ...plan,
        tareas: plan.tareas.filter(t => t.id !== tareaId)
      })
    } catch (err) {
      console.error(err)
    }
  }

  // ---- CONTROLADOR DE DRAG & RESIZE DE TAREA ----

  function startTaskDrag(e, task, mode) {
    e.preventDefault()
    e.stopPropagation()
    dragInfo.current = {
      taskId: task.id,
      mode,
      startX: e.clientX,
      startSemana: task.semana_inicio,
      startDuracion: task.duracion_semanas,
      hasMoved: false
    }

    document.addEventListener('mousemove', handleTaskDragMove)
    document.addEventListener('mouseup', handleTaskDragEnd)
  }

  function handleTaskDragMove(e) {
    if (!dragInfo.current) return
    const { taskId, mode, startX, startSemana, startDuracion } = dragInfo.current
    const dx = e.clientX - startX

    if (Math.abs(dx) > 3) {
      dragInfo.current.hasMoved = true
    }

    const cellDiff = Math.round(dx / Z.cell)

    if (mode === 'move') {
      let newSemana = startSemana + cellDiff
      newSemana = Math.max(0, Math.min(newSemana, totalWeeks - startDuracion))
      
      // Update visual overlay locally
      const bar = document.querySelector(`.bar[data-id="${taskId}"]`)
      if (bar) {
        bar.style.left = `${newSemana * Z.cell}px`
      }
      dragInfo.current.finalSemana = newSemana
    } else if (mode === 'resize') {
      let newDur = startDuracion + cellDiff
      newDur = Math.max(1, Math.min(newDur, totalWeeks - startSemana))

      // Update visual overlay locally
      const bar = document.querySelector(`.bar[data-id="${taskId}"]`)
      if (bar) {
        bar.style.width = `${newDur * Z.cell - 3}px`
      }
      dragInfo.current.finalDur = newDur
    }
  }

  async function handleTaskDragEnd() {
    document.removeEventListener('mousemove', handleTaskDragMove)
    document.removeEventListener('mouseup', handleTaskDragEnd)

    if (!dragInfo.current) return
    const { taskId, mode, startSemana, startDuracion, hasMoved, finalSemana, finalDur } = dragInfo.current
    dragInfo.current = null

    // Click simple en modo move: ciclar progreso
    if (!hasMoved && mode === 'move') {
      const task = plan.tareas.find(t => t.id === taskId)
      const currentProg = task.progreso || 0
      const nextProg = PROG_STEPS[(PROG_STEPS.indexOf(currentProg) + 1) % PROG_STEPS.length]
      await handleUpdateTarea(taskId, { progreso: nextProg })
      return
    }

    // Guardar cambios si hubo movimiento
    if (mode === 'move' && finalSemana !== undefined && finalSemana !== startSemana) {
      await handleUpdateTarea(taskId, { semana_inicio: finalSemana })
    } else if (mode === 'resize' && finalDur !== undefined && finalDur !== startDuracion) {
      await handleUpdateTarea(taskId, { duracion_semanas: finalDur })
    } else {
      // Revert styling just in case
      cargarDatos()
    }
  }

  // ---- ASIGNACIONES POPUP ----
  function openAssignPopup(e, task) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    
    // Position floating relative to click source
    setAssignPopupPos({
      top: rect.bottom + window.scrollY + 6,
      left: Math.min(rect.left + window.scrollX, window.innerWidth - 180)
    })
    setAssigningTask(task)
  }

  async function toggleAssignee(colaboradorId) {
    if (!assigningTask) return
    const currentAsignaciones = assigningTask.asignaciones || []
    const isAssigned = currentAsignaciones.some(a => a.colaborador_id === colaboradorId)
    
    let newColaboradorIds
    if (isAssigned) {
      newColaboradorIds = currentAsignaciones
        .filter(a => a.colaborador_id !== colaboradorId)
        .map(a => a.colaborador_id)
    } else {
      newColaboradorIds = [...currentAsignaciones.map(a => a.colaborador_id), colaboradorId]
    }

    try {
      await setAsignaciones(assigningTask.id, newColaboradorIds)
      
      // Actualizar el plan localmente
      const updatedTareas = plan.tareas.map(t => {
        if (t.id === assigningTask.id) {
          // Re-construir asignaciones
          const updatedAsignaciones = newColaboradorIds.map(cid => {
            const col = colaboradores.find(c => c.id === cid)
            return {
              colaborador_id: cid,
              colaborador: col
            }
          })
          return { ...t, asignaciones: updatedAsignaciones }
        }
        return t
      })

      setPlan({ ...plan, tareas: updatedTareas })
      
      // Actualizar la tarea en el popup
      setAssigningTask({
        ...assigningTask,
        asignaciones: updatedAsignaciones
      })
    } catch (err) {
      console.error('Error al cambiar asignación:', err)
    }
  }

  async function handleMoveTarea(taskId, direction) {
    const task = plan.tareas.find(t => t.id === taskId)
    if (!task) return
    
    const siblingTasks = plan.tareas
      .filter(t => t.objetivo_id === task.objetivo_id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))
      
    const idx = siblingTasks.findIndex(t => t.id === taskId)
    if (idx === -1) return
    
    let swapIdx = -1
    if (direction === 'up' && idx > 0) {
      swapIdx = idx - 1
    } else if (direction === 'down' && idx < siblingTasks.length - 1) {
      swapIdx = idx + 1
    }
    
    if (swapIdx === -1) return
    
    const otherTask = siblingTasks[swapIdx]
    
    try {
      // Swap in database
      await Promise.all([
        actualizarTarea(task.id, { orden: swapIdx }),
        actualizarTarea(otherTask.id, { orden: idx })
      ])
      
      // Update local state
      setPlan(prev => ({
        ...prev,
        tareas: prev.tareas.map(t => {
          if (t.id === task.id) return { ...t, orden: swapIdx }
          if (t.id === otherTask.id) return { ...t, orden: idx }
          return t
        })
      }))
    } catch (err) {
      console.error('Error al reordenar tareas:', err)
    }
  }

  // ---- ARRASTRE VERTICAL (HTML5 DRAG & DROP) ----
  function handleRowDragStart(e, taskId) {
    if (e.target.tagName.toLowerCase() === 'input') {
      e.preventDefault()
      return
    }
    setDraggedTaskId(taskId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleRowDragOver(e, targetId) {
    e.preventDefault()
    if (draggedTaskId && draggedTaskId !== targetId) {
      const task = plan.tareas.find(t => t.id === draggedTaskId)
      const targetTask = plan.tareas.find(t => t.id === targetId)
      if (task && targetTask && task.objetivo_id === targetTask.objetivo_id) {
        setDragOverTaskId(targetId)
      }
    }
  }

  function handleRowDragLeave() {
    setDragOverTaskId(null)
  }

  async function handleRowDrop(e, targetId) {
    e.preventDefault()
    setDragOverTaskId(null)
    if (!draggedTaskId || draggedTaskId === targetId) return

    const task = plan.tareas.find(t => t.id === draggedTaskId)
    const targetTask = plan.tareas.find(t => t.id === targetId)
    if (!task || !targetTask || task.objetivo_id !== targetTask.objetivo_id) return

    const siblingTasks = plan.tareas
      .filter(t => t.objetivo_id === task.objetivo_id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0))

    const dragIdx = siblingTasks.findIndex(t => t.id === draggedTaskId)
    const targetIdx = siblingTasks.findIndex(t => t.id === targetId)
    if (dragIdx === -1 || targetIdx === -1) return

    const reorderedSiblings = [...siblingTasks]
    const [removed] = reorderedSiblings.splice(dragIdx, 1)
    reorderedSiblings.splice(targetIdx, 0, removed)

    const updates = reorderedSiblings.map((t, idx) => {
      return actualizarTarea(t.id, { orden: idx })
    })

    try {
      await Promise.all(updates)

      setPlan(prev => ({
        ...prev,
        tareas: prev.tareas.map(t => {
          if (t.objetivo_id === task.objetivo_id) {
            const newIndex = reorderedSiblings.findIndex(rt => rt.id === t.id)
            return { ...t, orden: newIndex }
          }
          return t
        })
      }))
    } catch (err) {
      console.error('Error al ordenar tareas por arrastre:', err)
    } finally {
      setDraggedTaskId(null)
    }
  }

  // ---- CAMBIO DE ANCHO DE DESCRIPCIÓN (SIDEBAR RESIZE) ----
  function handleSidebarResizeStart(e) {
    e.preventDefault()
    e.stopPropagation()
    setIsResizingSidebar(true)
    const startX = e.clientX
    const startWidth = sidebarWidth

    function handleMouseMove(moveEvent) {
      const dx = moveEvent.clientX - startX
      const newWidth = Math.max(140, Math.min(startWidth + dx, 500))
      setSidebarWidth(newWidth)
      localStorage.setItem('apsol_gantt_sidebar_width', String(newWidth))
    }

    function handleMouseUp() {
      setIsResizingSidebar(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // ---- FECHAS DEL PLAN MODAL ----
  function openDatesModal() {
    setTempDates({ start: plan.fecha_inicio, end: plan.fecha_fin })
    setShowDatesModal(true)
  }

  async function handleSaveDates(e) {
    e.preventDefault()
    if (!tempDates.start || !tempDates.end) return
    if (new Date(tempDates.end) < new Date(tempDates.start)) {
      alert('La fecha de fin debe ser posterior a la de inicio')
      return
    }

    try {
      await actualizarPlan(plan.id, {
        fecha_inicio: tempDates.start,
        fecha_fin: tempDates.end
      })
      setShowDatesModal(false)
      cargarDatos()
    } catch (err) {
      console.error(err)
    }
  }

  // Modificar estado del plan
  async function handleStatusChange(estado) {
    try {
      await actualizarPlan(plan.id, { estado })
      setPlan({ ...plan, estado })
    } catch (err) {
      console.error(err)
    }
  }

  // Helper para clarificar color
  function lighten(hex, p) {
    const n = parseInt(hex.slice(1), 16)
    const r = Math.min(255, (n >> 16) + Math.round(2.55 * p))
    const g = Math.min(255, ((n >> 8) & 0xff) + Math.round(2.55 * p))
    const b = Math.min(255, (n & 0xff) + Math.round(2.55 * p))
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)
  }

  // Obtener todos los colaboradores asignados en este plan
  const assignedColaboradores = []
  plan.tareas.forEach(t => {
    (t.asignaciones || []).forEach(a => {
      if (a.colaborador && !assignedColaboradores.some(c => c.id === a.colaborador.id)) {
        assignedColaboradores.push(a.colaborador)
      }
    })
  })

  return (
    <div className="page" onClick={() => setAssigningTask(null)}>
      {/* Estilos específicos de Gantt auto-contenidos */}
      <style>{`
        .gantt-wrap { padding: 4px 0 28px; }
        .gantt-box { background: white; border: 1px solid var(--color-border); border-radius: 12px; overflow-x: auto; box-shadow: var(--shadow); position: relative; }
        .sidebar-resizer { position: absolute; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 35; background: transparent; transition: background-color 0.1s; }
        .sidebar-resizer:hover, .sidebar-resizer.resizing { background: rgba(37, 99, 235, 0.15); border-right: 2px solid var(--color-primary); }
        .gh { display: flex; border-bottom: 2px solid var(--color-border); position: sticky; top: 0; background: white; z-index: 20; }
        .gh-side { border-right: 1px solid var(--color-border); padding: 8px 14px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-subtle); display: flex; align-items: flex-end; flex-shrink: 0; }
        .gh-right { display: flex; flex-direction: column; position: relative; }
        .gh-months { display: flex; border-bottom: 1px solid var(--color-border); }
        .gh-month { font-size: 11px; font-weight: 700; text-align: center; padding: 6px 0; background: var(--color-surface2); border-right: 1px solid var(--color-border); text-transform: capitalize; color: var(--color-text-muted); }
        .gh-weeks { display: flex; }
        .gh-week { font-size: 10px; color: var(--color-text-subtle); text-align: center; padding: 4px 0; border-right: 1px solid var(--color-border-light); flex-shrink: 0; }
        .gh-week.now { background: var(--color-primary-light); color: var(--color-primary); font-weight: 800; }
        
        .today-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--color-danger); pointer-events: none; z-index: 10; }
        .today-head-line { position: absolute; top: 0; bottom: 0; width: 2px; background: var(--color-danger); pointer-events: none; z-index: 10; }
        .today-head-line::after { content: 'Hoy'; position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); background: var(--color-danger); color: white; font-size: 8px; font-weight: 800; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
        
        .sec-row { display: flex; background: var(--color-surface2); border-bottom: 1px solid var(--color-border); }
        .sec-label { padding: 6px 10px; font-size: 12px; font-weight: 700; display: flex; align-items: center; gap: 7px; border-right: 1px solid var(--color-border); flex-shrink: 0; }
        .sec-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .sec-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sec-add { margin-left: auto; background: none; border: none; font-size: 16px; line-height: 1; cursor: pointer; color: var(--color-text-subtle); padding: 0 6px; border-radius: 5px; transition: .15s; }
        .sec-add:hover { background: var(--color-primary-light); color: var(--color-primary); }
        .sec-del { background: none; border: none; font-size: 12px; cursor: pointer; color: var(--color-text-subtle); padding: 0 4px; opacity: 0; transition: .15s; }
        .sec-row:hover .sec-del { opacity: 1; }
        .sec-del:hover { color: var(--color-danger); }
        .sec-grid { flex: 1; position: relative; }
        
        .task-row { display: flex; border-bottom: 1px solid var(--color-border-light); position: relative; }
        .task-lbl { padding: 0 6px 0 50px; font-size: 12px; color: var(--color-text-muted); border-right: 1px solid var(--color-border); display: flex; align-items: center; gap: 5px; flex-shrink: 0; overflow: hidden; }
        .task-name-txt { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; outline: none; border: none; background: transparent; color: inherit; font-size: inherit; font-weight: inherit; padding: 2px 4px; }
        .task-name-txt:focus { background: white; border-radius: 4px; outline: 2px solid var(--color-primary); }
        
        .task-actions { position: absolute; left: 4px; top: 50%; transform: translateY(-50%); display: none; align-items: center; gap: 2px; }
        .task-row:hover .task-actions { display: flex; }
        .grab-handle { cursor: grab; font-weight: 800; color: var(--color-text-subtle); padding: 0 1px; font-size: 10px; display: flex; align-items: center; line-height: 1; user-select: none; width: 10px; height: 11px; justify-content: center; }
        .grab-handle:active { cursor: grabbing; }
        .move-task-btn { background: none; border: none; color: var(--color-text-subtle); font-size: 9px; cursor: pointer; padding: 1px; display: flex; align-items: center; justify-content: center; line-height: 1; width: 11px; height: 11px; }
        .move-task-btn:hover { color: var(--color-primary); }
        .del-task { background: none; border: none; color: var(--color-text-subtle); font-size: 11px; cursor: pointer; padding: 1px; display: flex; align-items: center; justify-content: center; line-height: 1; width: 11px; height: 11px; }
        .del-task:hover { color: var(--color-danger); }
        
        .task-row.dragging { opacity: 0.35; background: var(--color-surface2); }
        .task-row.drag-over { border-top: 2px solid var(--color-primary); }
        
        .task-avatar { width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: white; cursor: pointer; flex-shrink: 0; border: 1.5px solid white; box-shadow: 0 1px 3px rgba(0,0,0,0.15); transition: transform .12s; background: var(--color-primary); text-transform: uppercase; }
        .task-avatar:hover { transform: scale(1.15); }
        .task-avatar.unassigned { background: var(--color-surface2); color: var(--color-text-subtle); border: 1.5px dashed var(--color-text-subtle); box-shadow: none; }
        .avatar-group { display: flex; align-items: center; cursor: pointer; flex-shrink: 0; }
        .avatar-group .task-avatar { margin-left: -5px; }
        .avatar-group .task-avatar:first-child { margin-left: 0; }
        
        .task-grid { flex: 1; position: relative; }
        .gl { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--color-border-light); pointer-events: none; }
        .gl.now { background: rgba(224, 98, 0, 0.2); width: 2px; }
        .cw-shade { position: absolute; top: 0; bottom: 0; background: var(--color-primary-light); opacity: 0.4; pointer-events: none; }
        
        .add-task-row { display: flex; border-bottom: 1px solid var(--color-border-light); }
        .add-task-side { border-right: 1px solid var(--color-border); display: flex; align-items: center; padding: 0 10px; flex-shrink: 0; }
        .add-task-btn { background: none; border: none; font-size: 11px; color: var(--color-text-subtle); cursor: pointer; padding: 4px 6px; border-radius: 5px; display: flex; align-items: center; gap: 4px; transition: .15s; font-weight: 600; white-space: nowrap; }
        .add-task-btn:hover { background: var(--color-surface2); color: var(--color-primary); }
        .add-task-grid { flex: 1; }
        
        .bar { position: absolute; border-radius: 6px; cursor: grab; user-select: none; display: flex; align-items: center; padding: 0 20px 0 7px; font-size: 10px; font-weight: 600; color: rgba(255,255,255,.95); white-space: nowrap; overflow: hidden; transition: box-shadow .12s; z-index: 2; box-shadow: var(--shadow); }
        .bar:hover { box-shadow: var(--shadow-md); }
        .bar.dragging { cursor: grabbing; opacity: .88; z-index: 50; }
        .prog-ov { position: absolute; top: 0; bottom: 0; right: 0; background: rgba(0,0,0,.25); pointer-events: none; transition: width .2s; }
        .prog-strip { position: absolute; bottom: 2px; left: 3px; right: 18px; height: 2px; background: rgba(255,255,255,.15); border-radius: 2px; pointer-events: none; }
        .prog-fill { height: 100%; border-radius: 2px; background: rgba(255,255,255,.8); transition: width .2s; }
        .bar-txt { overflow: hidden; text-overflow: ellipsis; pointer-events: none; flex: 1; }
        .prog-badge { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); font-size: 8px; font-weight: 800; color: rgba(255,255,255,.9); pointer-events: none; }
        .rk { position: absolute; right: 2px; top: 50%; transform: translateY(-50%); width: 10px; height: 14px; border-radius: 3px; background: rgba(255,255,255,.2); cursor: ew-resize; display: flex; align-items: center; justify-content: center; gap: 1.5px; }
        .rk::before, .rk::after { content: ''; width: 1.5px; height: 7px; background: rgba(255,255,255,.65); border-radius: 1px; }
        
        .assign-popup { position: absolute; background: white; border: 1px solid var(--color-border); border-radius: 10px; box-shadow: var(--shadow-md); padding: 8px; z-index: 200; min-width: 160px; }
        .assign-popup .ap-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: var(--color-text-subtle); padding: 2px 6px 6px; border-bottom: 1px solid var(--color-border); margin-bottom: 6px; }
        .assign-opt { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; color: var(--color-text); transition: .1s; }
        .assign-opt:hover { background: var(--color-surface2); }
        .assign-opt .dot { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 8px; font-weight: 800; color: white; text-transform: uppercase; }
        .assign-opt.selected { background: var(--color-primary-light); color: var(--color-primary); }
        .assign-opt .ap-check { margin-left: auto; font-size: 10px; color: var(--color-primary); opacity: 0; }
        .assign-opt.selected .ap-check { opacity: 1; }
        
        .zoom-group { display: flex; align-items: center; gap: 8px; background: var(--color-surface2); border: 1px solid var(--color-border); border-radius: 8px; padding: 4px 10px; height: 34px; }
        .zoom-group span { font-size: 11px; color: var(--color-text-subtle); font-weight: 600; text-transform: uppercase; }
        
        .subobj-bar { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding-bottom: 16px; border-bottom: 1px solid var(--color-border); margin-bottom: 16px; }
        .subobj-chip { display: inline-flex; align-items: center; gap: 6px; background: white; border: 1px solid var(--color-border); border-radius: 20px; padding: 4px 10px 4px 12px; font-size: 12px; font-weight: 500; color: var(--color-text-muted); box-shadow: var(--shadow); }
        .subobj-chip input { border: none; outline: none; background: transparent; color: inherit; font-size: inherit; font-weight: inherit; padding: 0; width: auto; }
        .subobj-chip .del-sub { background: none; border: none; color: var(--color-text-subtle); cursor: pointer; padding: 0; font-size: 14px; line-height: 1; }
        .subobj-chip .del-sub:hover { color: var(--color-danger); }
        .add-subobj-btn { background: none; border: 1px dashed var(--color-border); border-radius: 20px; padding: 4px 12px; font-size: 12px; font-weight: 600; color: var(--color-text-subtle); cursor: pointer; transition: .1s; }
        .add-subobj-btn:hover { border-color: var(--color-text-muted); color: var(--color-text); background: white; }
        
        .objectives { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .obj-card { background: white; border: 1px solid var(--color-border); border-radius: 12px; padding: 14px; border-top: 4px solid; box-shadow: var(--shadow); position: relative; display: flex; flex-direction: column; gap: 6px; }
        .obj-card .num { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .obj-card .ttl { font-size: 13px; font-weight: 600; color: var(--color-text); outline: none; border: none; width: 100%; }
        .obj-card .kpi { font-size: 11px; color: var(--color-text-muted); outline: none; border: none; width: 100%; }
        .obj-card .del-obj { position: absolute; top: 8px; right: 8px; width: 20px; height: 20px; border-radius: 50%; background: var(--color-danger-light); border: none; color: var(--color-danger); font-size: 12px; font-weight: 700; cursor: pointer; display: none; align-items: center; justify-content: center; }
        .obj-card:hover .del-obj { display: flex; }
        
        .add-obj-card { background: rgba(255,255,255,.5); border: 2px dashed var(--color-border); border-radius: 12px; padding: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-text-subtle); font-size: 13px; font-weight: 600; gap: 6px; min-height: 100px; transition: .15s; }
        .add-obj-card:hover { background: white; border-color: var(--color-primary); color: var(--color-primary); }
        
        .team-bar { display: flex; align-items: center; gap: 10px; padding: 8px 0; margin-bottom: 20px; flex-wrap: wrap; }
        .team-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--color-text-subtle); }
        .team-chips-wrap { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
        .member-chip { display: flex; align-items: center; gap: 6px; background: white; border: 1px solid var(--color-border); border-radius: 20px; padding: 3px 10px 3px 4px; font-size: 11px; font-weight: 600; box-shadow: var(--shadow); }
        .member-avatar { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: white; flex-shrink: 0; text-transform: uppercase; }
      `}</style>

      {/* HEADER */}
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to="/planificacion" className="btn btn-secondary" style={{ padding: '8px' }} title="Volver a la lista">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text"
                value={plan.nombre}
                onChange={e => setPlan({ ...plan, nombre: e.target.value })}
                onBlur={() => actualizarPlan(plan.id, { nombre: plan.nombre })}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                style={{
                  fontSize: '22px',
                  fontWeight: '700',
                  color: 'var(--color-text)',
                  border: 'none',
                  background: 'transparent',
                  padding: '2px 6px',
                  margin: '-2px -6px',
                  width: 'auto',
                  maxWidth: '400px'
                }}
                className="editable-title-input"
              />
              <span className={`badge ${plan.estado === 'en_curso' ? 'badge-green' : plan.estado === 'finalizado' ? 'badge-gray' : 'badge-orange'}`} style={{ textTransform: 'capitalize' }}>
                {plan.estado === 'en_curso' ? 'En Curso' : plan.estado === 'finalizado' ? 'Finalizado' : 'Borrador'}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-subtle)', fontSize: '13px' }}>
              Período: {dateStart.toLocaleDateString('es-AR')} al {dateEnd.toLocaleDateString('es-AR')} ({totalWeeks} semanas)
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Zoom */}
          <div className="zoom-group">
            <span>Ancho de semanas:</span>
            <input
              type="range"
              min="50"
              max="250"
              value={cellWidth}
              onChange={e => {
                const val = Number(e.target.value)
                setCellWidth(val)
                localStorage.setItem('apsol_gantt_cell_width', String(val))
              }}
              style={{ width: '100px', cursor: 'pointer', height: '6px' }}
            />
            <span style={{ minWidth: '42px', textAlign: 'right', color: 'var(--color-primary)' }}>{cellWidth}px</span>
          </div>

          {/* Cambiar Estado */}
          <select
            value={plan.estado}
            onChange={e => handleStatusChange(e.target.value)}
            style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', height: '34px' }}
          >
            <option value="borrador">Borrador</option>
            <option value="en_curso">En curso</option>
            <option value="finalizado">Finalizado</option>
          </select>

          <button className="btn btn-secondary" style={{ padding: '8px 12px', height: '34px', fontSize: '13px' }} onClick={openDatesModal}>
            📅 Fechas
          </button>
        </div>
      </div>

      {/* OBJETIVOS */}
      <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginBottom: '8px', letterSpacing: '0.5px' }}>
        Objetivos del período
      </div>
      <div className="objectives">
        {plan.objetivos.map((obj, i) => (
          <div className="obj-card" key={obj.id} style={{ borderTopColor: obj.color }}>
            <div className="num" style={{ color: obj.color }}>{(i + 1).toString().padStart(2, '0')}</div>
            <textarea
              className="ttl"
              value={obj.titulo}
              onChange={e => {
                const val = e.target.value
                setPlan(prev => ({
                  ...prev,
                  objetivos: prev.objetivos.map(o => o.id === obj.id ? { ...o, titulo: val } : o)
                }))
              }}
              onBlur={() => actualizarObjetivo(obj.id, { titulo: obj.titulo })}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
              placeholder="Título del objetivo"
              rows={2}
              style={{ border: 'none', resize: 'none', background: 'transparent', fontWeight: 600, fontFamily: 'inherit' }}
            />
            <textarea
              className="kpi"
              value={obj.descripcion || ''}
              onChange={e => {
                const val = e.target.value
                setPlan(prev => ({
                  ...prev,
                  objetivos: prev.objetivos.map(o => o.id === obj.id ? { ...o, descripcion: val } : o)
                }))
              }}
              onBlur={() => actualizarObjetivo(obj.id, { descripcion: obj.descripcion })}
              placeholder="Descripción / Métrica"
              rows={2}
              style={{ border: 'none', resize: 'none', background: 'transparent' }}
            />
            <button className="del-obj" onClick={() => handleDeleteObjetivo(obj.id, obj.titulo)}>×</button>
          </div>
        ))}
        <div className="add-obj-card" onClick={handleAddObjetivo}>
          <Plus size={16} /> Agregar Objetivo
        </div>
      </div>

      {/* SUBOBJETIVOS / NOTAS */}
      <div style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginBottom: '8px', letterSpacing: '0.5px' }}>
        Subobjetivos / Notas de referencia
      </div>
      <div className="subobj-bar">
        {(plan.subobjetivos || []).map(so => (
          <div className="subobj-chip" key={so.id}>
            <input
              type="text"
              value={so.texto}
              onChange={e => {
                const val = e.target.value
                setPlan(prev => ({
                  ...prev,
                  subobjetivos: prev.subobjetivos.map(s => s.id === so.id ? { ...s, texto: val } : s)
                }))
              }}
              onBlur={() => actualizarSubobjetivo(so.id, { texto: so.texto })}
              onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
              style={{ width: `${Math.max(100, so.texto.length * 7)}px` }}
            />
            <button className="del-sub" onClick={() => handleDeleteSubobjetivo(so.id)}>×</button>
          </div>
        ))}
        <button className="add-subobj-btn" onClick={handleAddSubobjetivo}>
          + Agregar Nota
        </button>
      </div>

      {/* EQUIPO ASIGNADO EN ESTE PLAN */}
      <div className="team-bar">
        <span className="team-label">Equipo del Plan:</span>
        <div className="team-chips-wrap">
          {assignedColaboradores.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--color-text-subtle)', fontStyle: 'italic' }}>
              Ningún colaborador asignado a tareas todavía. Asigna una tarea para agregarlo al equipo.
            </span>
          ) : (
            assignedColaboradores.map(m => {
              const nombre = m.usuario?.nombre || 'Colaborador'
              const apellido = m.usuario?.apellido || ''
              const iniciales = (nombre[0] + (apellido[0] || '')).toUpperCase()
              return (
                <div className="member-chip" key={m.id} title={`${nombre} ${apellido}`}>
                  <div className="member-avatar" style={{ background: COLOR_PALETTE[Math.abs(m.id.charCodeAt(0)) % COLOR_PALETTE.length] }}>
                    {iniciales}
                  </div>
                  <span>{nombre}</span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* AYUDAS RAPIDAS */}
      <div style={{ display: 'flex', gap: '16px', fontSize: '11px', color: 'var(--color-text-subtle)', marginBottom: '12px' }}>
        <span>✏️ <b>Doble click/Click</b> en texto para editar</span>
        <span>👆 <b>Click en barra</b> para alternar progreso (0% ➔ 25% ➔ 50% ➔ 75% ➔ 100%)</span>
        <span>↔️ <b>Arrastrar centro de barra</b> para mover, o <b>borde derecho</b> para redimensionar</span>
      </div>

      {/* GANTT CONTAINER */}
      <div className="gantt-wrap">
        <div className="gantt-box">
          {/* Resizer del ancho de descripción (Sidebar) */}
          <div
            className={`sidebar-resizer ${isResizingSidebar ? 'resizing' : ''}`}
            style={{
              left: `${sidebarWidth}px`,
              transform: 'translateX(-4px)'
            }}
            onMouseDown={handleSidebarResizeStart}
          />
          {/* Cabecera */}
          <div className="gh">
            <div className="gh-side" style={{ minWidth: `${Z.side}px`, width: `${Z.side}px` }}>Tarea</div>
            <div className="gh-right" style={{ minWidth: `${totalWeeks * Z.cell}px` }}>
              <div className="gh-months">
                {monthsGroup.map(m => {
                  const label = new Date(m.year, m.month).toLocaleDateString('es-AR', { month: 'long' })
                  return (
                    <div className="gh-month" key={m.key} style={{ width: `${m.count * Z.cell}px` }}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </div>
                  )
                })}
              </div>
              <div className="gh-weeks">
                {weeks.map((w, idx) => {
                  const formatted = w.getDate().toString().padStart(2, '0') + '/' + (w.getMonth() + 1).toString().padStart(2, '0')
                  return (
                    <div className={`gh-week ${idx === currentWeek ? 'now' : ''}`} key={idx} style={{ width: `${Z.cell}px` }}>
                      {formatted}
                    </div>
                  )
                })}
              </div>

              {/* Linea hoy en cabecera */}
              {dayOffset >= 0 && dayOffset <= totalWeeks * 7 && (
                <div className="today-head-line" style={{ left: `${todayPx}px` }} />
              )}
            </div>
          </div>

          {/* Cuerpo */}
          <div id="gb" style={{ position: 'relative' }}>
            {plan.objetivos.map(obj => {
              const tasks = plan.tareas
                .filter(t => t.objetivo_id === obj.id)
                .sort((a, b) => (a.orden || 0) - (b.orden || 0))
              return (
                <div key={obj.id}>
                  {/* Fila de Objetivo */}
                  <div className="sec-row">
                    <div className="sec-label" style={{ minWidth: `${Z.side}px`, width: `${Z.side}px` }}>
                      <div className="sec-dot" style={{ background: obj.color }} />
                      <span className="sec-name" style={{ color: obj.color }}>{obj.titulo}</span>
                      <button className="sec-add" title="Agregar tarea" onClick={() => handleAddTask(obj.id)}>+</button>
                    </div>
                    <div className="sec-grid" style={{ minWidth: `${totalWeeks * Z.cell}px`, height: '30px' }}>
                      {/* Grid lines */}
                      {weeks.map((_, idx) => (
                        <div className={`gl ${idx === currentWeek ? 'now' : ''}`} key={idx} style={{ left: `${idx * Z.cell}px` }} />
                      ))}
                      {/* Linea Hoy */}
                      {dayOffset >= 0 && dayOffset <= totalWeeks * 7 && (
                        <div className="today-line" style={{ left: `${todayPx}px` }} />
                      )}
                    </div>
                  </div>

                  {/* Filas de tareas */}
                  {tasks.map(task => {
                    const memberIds = (task.asignaciones || []).map(a => a.colaborador_id)
                    const assignedMembers = (task.asignaciones || []).map(a => a.colaborador).filter(Boolean)

                    return (
                      <div
                        className={`task-row ${draggedTaskId === task.id ? 'dragging' : ''} ${dragOverTaskId === task.id ? 'drag-over' : ''}`}
                        key={task.id}
                        style={{ minHeight: `${Z.row}px` }}
                        draggable
                        onDragStart={(e) => handleRowDragStart(e, task.id)}
                        onDragOver={(e) => handleRowDragOver(e, task.id)}
                        onDragLeave={handleRowDragLeave}
                        onDrop={(e) => handleRowDrop(e, task.id)}
                      >
                        <div className="task-lbl" style={{ minWidth: `${Z.side}px`, width: `${Z.side}px`, height: `${Z.row}px` }}>
                          <div className="task-actions">
                            <span className="grab-handle" title="Arrastrar para ordenar">⋮⋮</span>
                            <button className="move-task-btn" title="Subir tarea" onClick={(e) => { e.stopPropagation(); handleMoveTarea(task.id, 'up') }}>▲</button>
                            <button className="move-task-btn" title="Bajar tarea" onClick={(e) => { e.stopPropagation(); handleMoveTarea(task.id, 'down') }}>▼</button>
                            <button className="del-task" title="Eliminar tarea" onClick={(e) => { e.stopPropagation(); handleDeleteTarea(task.id) }}>×</button>
                          </div>
                          <input
                            type="text"
                            className="task-name-txt"
                            value={task.nombre}
                            onChange={e => {
                              const val = e.target.value
                              setPlan(prev => ({
                                ...prev,
                                tareas: prev.tareas.map(t => t.id === task.id ? { ...t, nombre: val } : t)
                              }))
                            }}
                            onBlur={() => actualizarTarea(task.id, { nombre: task.nombre })}
                            onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                            placeholder="Nombre de tarea"
                          />
                          
                          {/* Avatars */}
                          <div className="avatar-group" onClick={(e) => openAssignPopup(e, task)}>
                            {assignedMembers.length > 0 ? (
                              assignedMembers.map(m => {
                                const n = m.usuario?.nombre || 'C'
                                const ap = m.usuario?.apellido || ''
                                const init = (n[0] + (ap[0] || '')).toUpperCase()
                                return (
                                  <div
                                    className="task-avatar"
                                    key={m.id}
                                    style={{ background: COLOR_PALETTE[Math.abs(m.id.charCodeAt(0)) % COLOR_PALETTE.length] }}
                                    title={`${n} ${ap}`}
                                  >
                                    {init}
                                  </div>
                                )
                              })
                            ) : (
                              <div className="task-avatar unassigned" title="Asignar">+</div>
                            )}
                          </div>
                        </div>

                        {/* Grid de la tarea */}
                        <div className="task-grid" style={{ minWidth: `${totalWeeks * Z.cell}px`, height: `${Z.row}px` }}>
                          {/* Sombreado semana actual */}
                          {currentWeek >= 0 && currentWeek < totalWeeks && (
                            <div className="cw-shade" style={{ left: `${currentWeek * Z.cell}px`, width: `${Z.cell}px` }} />
                          )}

                          {/* Lineas de division de semana */}
                          {weeks.map((_, idx) => (
                            <div className={`gl ${idx === currentWeek ? 'now' : ''}`} key={idx} style={{ left: `${idx * Z.cell}px` }} />
                          ))}

                          {/* Linea Hoy */}
                          {dayOffset >= 0 && dayOffset <= totalWeeks * 7 && (
                            <div className="today-line" style={{ left: `${todayPx}px` }} />
                          )}

                          {/* BARRA GANTT */}
                          <div
                            className="bar"
                            data-id={task.id}
                            style={{
                              background: `linear-gradient(135deg, ${obj.color}, ${lighten(obj.color, 16)})`,
                              top: `${Z.barTop}px`,
                              height: `${Z.barH}px`,
                              left: `${task.semana_inicio * Z.cell}px`,
                              width: `${task.duracion_semanas * Z.cell - 3}px`
                            }}
                            onMouseDown={e => startTaskDrag(e, task, 'move')}
                          >
                            {/* Progreso overlay */}
                            <div
                              className="prog-ov"
                              style={{
                                width: `${100 - (task.progreso || 0)}%`,
                                borderRadius: (task.progreso || 0) === 0 ? '6px' : '0 6px 6px 0'
                              }}
                            />
                            
                            {/* Barra de progreso visual (línea fina abajo) */}
                            <div className="prog-strip">
                              <div className="prog-fill" style={{ width: `${task.progreso || 0}%` }} />
                            </div>

                            <span className="bar-txt">{task.nombre}</span>

                            <span className="prog-badge">
                              {task.progreso === 100 ? '✓' : (task.progreso > 0 ? `${task.progreso}%` : '')}
                            </span>

                            {/* Handle redimensionar */}
                            <div className="rk" onMouseDown={e => startTaskDrag(e, task, 'resize')} />
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {/* Fila agregar tarea rápida debajo del objetivo */}
                  <div className="add-task-row">
                    <div className="add-task-side" style={{ minWidth: `${Z.side}px`, width: `${Z.side}px`, height: `${Math.round(Z.row * 0.75)}px` }}>
                      <button className="add-task-btn" onClick={() => handleAddTask(obj.id)}>
                        <span>+</span> Agregar tarea
                      </button>
                    </div>
                    <div className="add-task-grid" style={{ minWidth: `${totalWeeks * Z.cell}px`, height: `${Math.round(Z.row * 0.75)}px`, position: 'relative' }}>
                      {/* Lineas de division de semana */}
                      {weeks.map((_, idx) => (
                        <div className={`gl ${idx === currentWeek ? 'now' : ''}`} key={idx} style={{ left: `${idx * Z.cell}px` }} />
                      ))}
                      {/* Linea hoy */}
                      {dayOffset >= 0 && dayOffset <= totalWeeks * 7 && (
                        <div className="today-line" style={{ left: `${todayPx}px` }} />
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* POPUP FLOTANTE DE ASIGNACIÓN */}
      {assigningTask && (
        <div
          className="assign-popup"
          style={{
            top: `${assignPopupPos.top}px`,
            left: `${assignPopupPos.left}px`
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="ap-title">Asignar colaboradores</div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {colaboradores.map(c => {
              const name = c.usuario?.nombre || 'Colaborador'
              const last = c.usuario?.apellido || ''
              const init = (name[0] + (last[0] || '')).toUpperCase()
              const isSelected = (assigningTask.asignaciones || []).some(a => a.colaborador_id === c.id)
              
              return (
                <div
                  key={c.id}
                  className={`assign-opt ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleAssignee(c.id)}
                >
                  <div className="dot" style={{ background: COLOR_PALETTE[Math.abs(c.id.charCodeAt(0)) % COLOR_PALETTE.length] }}>
                    {init}
                  </div>
                  <span>{name} {last}</span>
                  <span className="ap-check">✓</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MODAL FECHAS DEL PLAN */}
      {showDatesModal && (
        <div className="modal-overlay" onClick={() => setShowDatesModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Rango de fechas del Gantt</h2>
              <button 
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }} 
                onClick={() => setShowDatesModal(false)}
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveDates} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label>Arranca</label>
                <input
                  type="date"
                  value={tempDates.start}
                  onChange={e => setTempDates({ ...tempDates, start: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Termina</label>
                <input
                  type="date"
                  value={tempDates.end}
                  onChange={e => setTempDates({ ...tempDates, end: e.target.value })}
                  required
                />
              </div>
              <div className="modal-footer" style={{ marginTop: '16px', padding: 0, border: 'none' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowDatesModal(false)}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar Fechas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )

  async function handleUpdatePlan(campos) {
    try {
      await actualizarPlan(plan.id, campos)
      setPlan({ ...plan, ...campos })
    } catch (err) {
      console.error(err)
    }
  }
}
