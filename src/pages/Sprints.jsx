import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Activity, RefreshCw, Plus, CalendarClock, X, Filter, Briefcase, Target, Building2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import FiltroMultiSelect from '../components/FiltroMultiSelect'
import ModalPortal from '../components/ModalPortal'
import {
  getSprintsActivos, getSprintsPlanificados, getSprintsDeProyecto, crearSprint,
} from '../services/sprints'
import { getProyectos } from '../services/proyectos'
import { getMiFichaColaborador } from '../services/colaboradores'
import {
  ESTADOS_ITEM, ORDEN_ESTADOS, contarEstados, porcentajeAvance, itemsEnRojo,
  siguienteNumeroSprint,
} from '../services/sprints-utils'
import { opcionesDeFiltro, filtrarSprints } from '../services/sprints-filtros'
import { puedeVerTodo, filtrarPorAsignacion, proyectoVisiblePara } from '../services/sprints-permisos'
import { textoPlano } from '../services/sprint-item-formato'

// Tabla de sprints reutilizada por "Sprints activos" y "Planificados".
function TablaSprints({ sprints, onRowClick }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>Proyecto</th>
            <th>Sprint</th>
            <th>Avance</th>
            <th>Semáforo</th>
          </tr>
        </thead>
        <tbody>
          {sprints.map((s) => {
            const c = contarEstados(s.items || [])
            return (
              <tr key={s.id} onClick={() => onRowClick(s.id)} style={{ cursor: 'pointer' }}>
                <td>{s.proyecto?.nombre || '—'}</td>
                <td>
                  <Link
                    to={`/sprints/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontWeight: 500, color: 'inherit', textDecoration: 'none' }}
                  >
                    Sprint {s.numero}{s.nombre ? ` · ${s.nombre}` : ''}
                  </Link>
                </td>
                <td>{porcentajeAvance(s.items || [])}%</td>
                <td>
                  <span style={{ display: 'inline-flex', gap: 10, fontSize: 13 }}>
                    {ORDEN_ESTADOS.map((e) => (
                      <span key={e} title={ESTADOS_ITEM[e].label}>{ESTADOS_ITEM[e].emoji} {c[e]}</span>
                    ))}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Sprints() {
  const navigate = useNavigate()
  const { user, esDuenio, esTeamLead } = useAuth()
  const verTodo = puedeVerTodo({ esDuenio, esTeamLead })

  const [activos, setActivos] = useState([])
  const [planificados, setPlanificados] = useState([])
  const [prospectosAsignados, setProspectosAsignados] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filtros (no se persisten entre recargas, es a propósito).
  const [proyectoIds, setProyectoIds] = useState([])
  const [prospectoIds, setProspectoIds] = useState([])
  const [empresaIds, setEmpresaIds] = useState([])

  const [modalNuevo, setModalNuevo] = useState(false)
  const [proyectos, setProyectos] = useState([])
  const [proyectoNuevo, setProyectoNuevo] = useState('')
  const [creando, setCreando] = useState(false)

  async function cargar() {
    setLoading(true)
    try {
      const tareas = [getSprintsActivos(), getSprintsPlanificados()]
      if (!verTodo && user?.id) tareas.push(getMiFichaColaborador(user.id))
      const [a, p, ficha] = await Promise.all(tareas)
      const asignados = verTodo ? [] : (ficha?.prospectos_asignados || [])
      setProspectosAsignados(asignados)
      const opts = { verTodo, prospectosAsignados: asignados }
      setActivos(filtrarPorAsignacion(a, opts))
      setPlanificados(filtrarPorAsignacion(p, opts))
      setError('')
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los sprints.')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [verTodo, user?.id])

  const opciones = useMemo(
    () => opcionesDeFiltro([...activos, ...planificados]),
    [activos, planificados],
  )
  const filtros = { proyectoIds, prospectoIds, empresaIds }
  const hayFiltro = proyectoIds.length + prospectoIds.length + empresaIds.length > 0
  const activosFiltrados = useMemo(() => filtrarSprints(activos, filtros), [activos, proyectoIds, prospectoIds, empresaIds])
  const planificadosFiltrados = useMemo(() => filtrarSprints(planificados, filtros), [planificados, proyectoIds, prospectoIds, empresaIds])

  function limpiarFiltros() {
    setProyectoIds([])
    setProspectoIds([])
    setEmpresaIds([])
  }

  async function abrirModalNuevo() {
    setProyectoNuevo('')
    setModalNuevo(true)
    if (proyectos.length === 0) {
      try {
        const p = await getProyectos()
        setProyectos([...p].sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '')))
      } catch (err) {
        console.error(err)
      }
    }
  }

  const proyectosParaElegir = verTodo
    ? proyectos
    : proyectos.filter((p) => proyectoVisiblePara(p, { verTodo, prospectosAsignados }))

  async function confirmarNuevoSprint() {
    if (!proyectoNuevo || creando) return
    setCreando(true)
    try {
      const existentes = await getSprintsDeProyecto(proyectoNuevo)
      const s = await crearSprint({ proyecto_id: proyectoNuevo, numero: siguienteNumeroSprint(existentes), creado_por: user?.id || null })
      navigate(`/sprints/${s.id}`)
    } catch (err) {
      console.error(err)
      setError('No se pudo crear el sprint.')
      setCreando(false)
      setModalNuevo(false)
    }
  }

  const rojos = activosFiltrados.flatMap((s) =>
    itemsEnRojo(s.items || []).map((it) => ({
      ...it,
      sprintId: s.id,
      sprintNombre: `Sprint ${s.numero}${s.nombre ? ` · ${s.nombre}` : ''}`,
      proyecto: s.proyecto?.nombre || 'Proyecto',
    }))
  )

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando sprints...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: 1000 }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Sprints</h1>
          <p className="page-subtitle">Todo lo que el equipo está ejecutando ahora, en una pantalla.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={abrirModalNuevo}><Plus size={16} /> Nuevo Sprint</button>
          <button className="btn btn-secondary" onClick={cargar}><RefreshCw size={16} /> Actualizar</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

      {/* Filtros: proyecto / prospecto / empresa, combinables */}
      <div className="card" style={{ marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-text-muted)' }}>
          <Filter size={15} /> Filtrar
        </span>
        <FiltroMultiSelect
          icon={<Briefcase size={14} />} label="Proyecto"
          options={opciones.proyectos} selectedIds={proyectoIds} onChange={setProyectoIds}
          emptyMessage="Sin proyectos"
        />
        <FiltroMultiSelect
          icon={<Target size={14} />} label="Prospecto"
          options={opciones.prospectos} selectedIds={prospectoIds} onChange={setProspectoIds}
          emptyMessage="Sin prospectos"
        />
        <FiltroMultiSelect
          icon={<Building2 size={14} />} label="Empresa"
          options={opciones.empresas} selectedIds={empresaIds} onChange={setEmpresaIds}
          emptyMessage="Sin empresas"
        />
        {hayFiltro && (
          <button className="btn btn-secondary" style={{ fontSize: 12, padding: '4px 10px' }} onClick={limpiarFiltros}>
            <X size={13} /> Limpiar
          </button>
        )}
      </div>

      {/* Rojo ahora mismo */}
      <div className="card" style={{ marginBottom: 20, borderColor: rojos.length ? 'var(--color-danger)' : 'var(--color-border)' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />
          Rojo ahora mismo ({rojos.length})
        </h3>
        {rojos.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Nada bloqueado. 🎉</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {rojos.map((r) => (
              <Link
                key={r.id}
                to={`/sprints/${r.sprintId}`}
                style={{ display: 'block', padding: 10, borderRadius: 6, background: 'var(--color-danger-light)', color: 'inherit', textDecoration: 'none' }}
              >
                <strong>{r.proyecto}</strong> · {r.sprintNombre} — {textoPlano(r.titulo)}
                {r.comentario && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{r.comentario}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Sprints activos */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={20} className="text-primary" /> Sprints activos ({activosFiltrados.length})
        </h3>
        {activosFiltrados.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            {hayFiltro
              ? 'Ningún sprint activo coincide con los filtros.'
              : 'No hay sprints activos. Creá uno con “Nuevo Sprint” y tocá “Iniciar sprint”.'}
          </p>
        ) : (
          <TablaSprints sprints={activosFiltrados} onRowClick={(id) => navigate(`/sprints/${id}`)} />
        )}
      </div>

      {/* Planificados: creados pero todavía sin iniciar */}
      {planificadosFiltrados.length > 0 && (
        <div className="card">
          <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <CalendarClock size={20} style={{ color: 'var(--color-text-muted)' }} /> Planificados ({planificadosFiltrados.length})
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 12 }}>
            Todavía sin iniciar. Entrá y tocá “Iniciar sprint” para que pase a activo.
          </p>
          <TablaSprints sprints={planificadosFiltrados} onRowClick={(id) => navigate(`/sprints/${id}`)} />
        </div>
      )}

      {/* Modal: nuevo sprint para un proyecto */}
      {modalNuevo && (
        <ModalPortal>
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 440 }}>
              <div className="modal-header">
                <h3>Nuevo Sprint</h3>
                <button className="btn-close" onClick={() => setModalNuevo(false)}><X size={20} /></button>
              </div>
              <div style={{ padding: 20 }}>
                <div className="field">
                  <label htmlFor="sprint-proyecto">Proyecto</label>
                  <select
                    id="sprint-proyecto"
                    value={proyectoNuevo}
                    onChange={(e) => setProyectoNuevo(e.target.value)}
                  >
                    <option value="">-- Elegí un proyecto --</option>
                    {proyectosParaElegir.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 8 }}>
                  Se crea como “planificado”. Lo vas a poder completar y arrancar desde su ficha.
                </p>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 16 }}
                  onClick={confirmarNuevoSprint}
                  disabled={!proyectoNuevo || creando}
                >
                  {creando ? 'Creando…' : 'Crear Sprint'}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  )
}
