import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Users } from 'lucide-react'
import { useData } from '../context/DataContext'
import { agruparColaboradores } from '../utils/colaboradores'

function formatearFecha(valor) {
  if (!valor) return '—'
  const d = new Date(`${String(valor).split('T')[0]}T12:00:00`)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-AR')
}

function FilaColaborador({ c }) {
  return (
    <tr style={{ opacity: c.activo === false ? 0.6 : 1 }}>
      <td>
        <Link
          to={`/colaboradores/${c.id}`}
          style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}
        >
          <div className="sidebar-avatar" style={{ width: '32px', height: '32px', fontSize: '13px' }}>
            {(c.nombre || c.apellido || 'C').charAt(0)}
          </div>
          <span>{c.nombre} {c.apellido}</span>
        </Link>
      </td>
      <td>{c.puesto || '—'}</td>
      <td style={{ color: 'var(--color-primary)', fontWeight: '500' }}>{formatearFecha(c.proxima_fecha_pago)}</td>
      <td>{formatearFecha(c.fin_contrato)}</td>
    </tr>
  )
}

function GrupoEstado({ titulo, colaboradores }) {
  if (colaboradores.length === 0) return null
  return (
    <>
      <tr>
        <td colSpan={4} style={{ background: 'var(--color-surface2)', fontWeight: '700', color: 'var(--color-success)', fontSize: '13px' }}>
          {titulo}
        </td>
      </tr>
      {colaboradores.map(c => <FilaColaborador key={c.id} c={c} />)}
    </>
  )
}

export default function Colaboradores() {
  const { colaboradores, loadingColaboradores, refreshColaboradores } = useData()
  const [search, setSearch] = useState('')

  useEffect(() => {
    refreshColaboradores(colaboradores.length > 0)
  }, [])

  const q = search.toLowerCase()
  const colaboradoresFiltrados = colaboradores.filter(c =>
    `${c.nombre || ''} ${c.apellido || ''}`.toLowerCase().includes(q) ||
    (c.puesto && c.puesto.toLowerCase().includes(q)) ||
    (c.email && c.email.toLowerCase().includes(q))
  )

  const { activos, inactivos } = agruparColaboradores(colaboradoresFiltrados)
  const hayResultados = activos.length + inactivos.length > 0

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Colaboradores</h1>
          <p className="page-subtitle">Equipo, honorarios y contratos</p>
        </div>
        <Link to="/colaboradores/nuevo" className="btn btn-primary">
          <Plus size={18} />
          Nuevo Colaborador
        </Link>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '16px' }}>
        <div className="search-bar" style={{ maxWidth: '100%' }}>
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, puesto o email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loadingColaboradores ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando colaboradores...</p>
        </div>
      ) : !hayResultados ? (
        <div className="placeholder-card">
          <Users className="placeholder-icon" />
          <h3>No se encontraron colaboradores</h3>
          <p>{search ? 'Intenta con otro término de búsqueda.' : 'Comienza agregando personal a tu equipo.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Nombre y Apellido</th>
                <th>Puesto</th>
                <th>Próxima Fecha de pago</th>
                <th>Fin de contrato</th>
              </tr>
            </thead>
            <tbody>
              <GrupoEstado titulo="Activo" colaboradores={activos} />
              <GrupoEstado titulo="No Activo" colaboradores={inactivos} />
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
