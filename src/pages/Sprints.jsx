import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, Activity, RefreshCw } from 'lucide-react'
import { getSprintsActivos } from '../services/sprints'
import {
  ESTADOS_ITEM, ORDEN_ESTADOS, contarEstados, porcentajeAvance, itemsEnRojo,
} from '../services/sprints-utils'

export default function Sprints() {
  const navigate = useNavigate()
  const [sprints, setSprints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function cargar() {
    setLoading(true)
    try {
      setSprints(await getSprintsActivos())
      setError('')
    } catch (err) {
      console.error(err)
      setError('No se pudieron cargar los sprints.')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { cargar() }, [])

  const rojos = sprints.flatMap((s) =>
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
        <button className="btn btn-secondary" onClick={cargar}><RefreshCw size={16} /> Actualizar</button>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 20 }}>{error}</div>}

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
                <strong>{r.proyecto}</strong> · {r.sprintNombre} — {r.titulo}
                {r.comentario && (
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 2 }}>{r.comentario}</div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Sprints activos */}
      <div className="card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Activity size={20} className="text-primary" /> Sprints activos ({sprints.length})
        </h3>
        {sprints.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            No hay sprints activos. Entrá a un proyecto y creá uno.
          </p>
        ) : (
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
                    <tr key={s.id} onClick={() => navigate(`/sprints/${s.id}`)} style={{ cursor: 'pointer' }}>
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
        )}
      </div>
    </div>
  )
}
