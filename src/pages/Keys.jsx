import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, KeyRound, ExternalLink, ShieldAlert, RotateCcw } from 'lucide-react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import {
  filtrarKeys, ordenarKeys, linkDeKey, esAdminKeys, tiposDisponibles,
} from '../utils/keys'
import { BotonCopiar } from '../components/KeysUI'

const FILTROS_INICIALES = { busqueda: '', ambito: 'Todo', tipo: '', verInactivas: false }

export default function Keys() {
  const { credenciales, loadingCredenciales, errorCredenciales, refreshCredenciales } = useData()
  const { perfil } = useAuth()
  const esAdmin = esAdminKeys(perfil?.cargo)
  const navigate = useNavigate()

  const [filtros, setFiltros] = useState(FILTROS_INICIALES)

  useEffect(() => {
    refreshCredenciales?.({ silencioso: (credenciales || []).length > 0 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const keys = useMemo(() => credenciales || [], [credenciales])
  const set = (campo) => (valor) => setFiltros(f => ({ ...f, [campo]: valor }))

  // Los contadores de las pestañas respetan todos los filtros menos el ámbito
  const sinAmbito = useMemo(() => filtrarKeys(keys, { ...filtros, ambito: 'Todo' }), [keys, filtros])
  const conteo = {
    Todo: sinAmbito.length,
    Propio: sinAmbito.filter(k => k.ambito === 'Propio').length,
    Cliente: sinAmbito.filter(k => k.ambito === 'Cliente').length,
  }
  const visibles = useMemo(() => ordenarKeys(filtrarKeys(keys, filtros)), [keys, filtros])
  const hayFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES)
  const tipos = tiposDisponibles(keys)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Keys</h1>
          <p className="page-subtitle">
            {esAdmin
              ? 'Claves y accesos de APSOL y de los clientes'
              : 'Las claves que cargaste y las que te compartieron'}
          </p>
        </div>
        <Link to="/keys/nueva" className="btn btn-primary">
          <Plus size={18} />
          Nueva key
        </Link>
      </div>

      <div className="card keys-filtros">
        <div className="keys-tabs" role="group" aria-label="Ámbito">
          {['Todo', 'Propio', 'Cliente'].map(a => (
            <button
              key={a}
              type="button"
              className={filtros.ambito === a ? 'is-activo' : ''}
              aria-pressed={filtros.ambito === a}
              onClick={() => set('ambito')(a)}
            >
              {a} <span className="keys-tab-count">{conteo[a]}</span>
            </button>
          ))}
        </div>

        <div className="search-bar keys-busqueda">
          <Search size={18} className="search-bar-icon" />
          <input
            type="text"
            placeholder="Buscar por nombre, servicio, usuario, cliente, link o notas..."
            value={filtros.busqueda}
            onChange={e => set('busqueda')(e.target.value)}
          />
        </div>

        <select aria-label="Filtrar por tipo" value={filtros.tipo} onChange={e => set('tipo')(e.target.value)}>
          <option value="">Todos los tipos</option>
          {tipos.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="keys-check">
          <input
            type="checkbox"
            checked={filtros.verInactivas}
            onChange={e => set('verInactivas')(e.target.checked)}
          />
          Ver inactivas
        </label>
      </div>

      {errorCredenciales && keys.length === 0 ? (
        <div className="empty-state">
          <ShieldAlert size={40} />
          <h3>No se pudieron cargar las keys</h3>
          <p>Revisá la conexión y probá de nuevo.</p>
          <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => refreshCredenciales({ forzar: true })}>
            <RotateCcw size={16} /> Reintentar
          </button>
        </div>
      ) : loadingCredenciales && keys.length === 0 ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando keys...</p>
        </div>
      ) : keys.length === 0 ? (
        <div className="empty-state">
          <KeyRound size={40} />
          {esAdmin ? (
            <>
              <h3>Todavía no hay keys cargadas</h3>
              <p>Cargá la primera con el botón "Nueva key".</p>
            </>
          ) : (
            <>
              <h3>Todavía no tenés keys</h3>
              <p>Si creaste una aplicación o un acceso, cargá una con "Nueva key". Las que te comparta un administrador también van a aparecer acá.</p>
            </>
          )}
        </div>
      ) : visibles.length === 0 ? (
        <div className="empty-state">
          <Search size={40} />
          <h3>Ninguna key coincide con los filtros</h3>
          {hayFiltros && (
            <button type="button" className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setFiltros(FILTROS_INICIALES)}>
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="table-container keys-tabla">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Servicio</th>
                <th>Cliente</th>
                <th>Usuario</th>
                <th>Contraseña</th>
                <th aria-label="Link" />
              </tr>
            </thead>
            <tbody>
              {visibles.map(k => {
                const link = linkDeKey(k)
                return (
                  <tr
                    key={k.id}
                    data-testid="fila-key"
                    className={k.estado === 'Inactivo' ? 'is-inactiva' : ''}
                    onClick={() => navigate(`/keys/${k.id}`)}
                  >
                    <td>
                      <div className="keys-nombre">
                        <Link to={`/keys/${k.id}`} data-testid="nombre-key" onClick={e => e.stopPropagation()}>{k.nombre}</Link>
                        {k.estado === 'Inactivo' && <span className="badge badge-gray">Inactiva</span>}
                      </div>
                    </td>
                    <td className="keys-muted" data-label="Tipo">{k.tipo}</td>
                    <td data-label="Servicio">{k.servicio}</td>
                    <td data-label="Cliente">{k.ambito === 'Cliente' ? (k.empresa_nombre || '—') : <span className="keys-muted">Propio</span>}</td>
                    <td data-label="Usuario">
                      {k.usuario ? (
                        <div className="keys-celda-copiable">
                          <span className="keys-mono keys-recortar" title={k.usuario}>{k.usuario}</span>
                          <BotonCopiar texto={k.usuario} etiqueta="Copiar usuario" />
                        </div>
                      ) : <span className="keys-muted">—</span>}
                    </td>
                    <td data-label="Contraseña">
                      <div className="keys-celda-copiable">
                        <span className="keys-mono keys-muted" aria-hidden="true">••••••••</span>
                        <BotonCopiar texto={k.password} etiqueta="Copiar contraseña" />
                      </div>
                    </td>
                    <td>
                      {link && (
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer noopener"
                          aria-label="Abrir link"
                          title={link}
                          className="key-icon-btn"
                          onClick={e => e.stopPropagation()}
                        >
                          <ExternalLink size={15} />
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
