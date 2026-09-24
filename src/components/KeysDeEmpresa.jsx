import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Plus, ChevronRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { ordenarKeys } from '../utils/keys'
import { BadgeCriticidad } from './KeysUI'

/** Bloque "Keys" dentro de la ficha de una empresa (solo admins la ven). */
export default function KeysDeEmpresa({ empresaId }) {
  const { credenciales, refreshCredenciales } = useData()
  const navigate = useNavigate()

  useEffect(() => {
    refreshCredenciales?.({ silencioso: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const keys = ordenarKeys((credenciales || []).filter(k => k.ambito === 'Cliente' && k.empresa_id === empresaId))

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={20} className="text-primary" /> Keys
        </h3>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(`/keys/nueva?empresa=${empresaId}`)} aria-label="Nueva key">
          <Plus size={14} /> Nueva
        </button>
      </div>
      {keys.length === 0 ? (
        <p className="text-muted text-sm">Esta empresa no tiene keys cargadas.</p>
      ) : (
        <div className="list-group">
          {keys.map(k => (
            <div key={k.id} className="list-item" onClick={() => navigate(`/keys/${k.id}`)} style={{ opacity: k.estado === 'Inactivo' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontWeight: 500, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {k.nombre}
                  <BadgeCriticidad criticidad={k.criticidad} />
                  {k.estado === 'Inactivo' && <span className="badge badge-gray">Inactiva</span>}
                </span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>{k.servicio} · {k.tipo}</span>
              </div>
              <ChevronRight size={14} opacity={0.3} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
