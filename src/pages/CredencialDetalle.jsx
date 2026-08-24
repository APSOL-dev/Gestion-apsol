import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, KeyRound, Eye, EyeOff, Copy } from 'lucide-react'
import { getCredencialById, saveCredencial, deleteCredencial } from '../services/credenciales'
import { getEmpresas } from '../services/empresas'

export default function CredencialDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esNuevo = id === 'nueva'

  const [credencial, setCredencial] = useState({
    sistema_plataforma: '',
    usuario: '',
    contrasena: '',
    link_acceso: '',
    ambito: 'Interno APSOL',
    empresa_id: '',
    tipo_acceso: 'Administrador',
    estado: 'Activo',
    notas_adicionales: ''
  })
  
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(!esNuevo)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  
  const [mostrarPass, setMostrarPass] = useState(false)

  useEffect(() => {
    cargarDependencias()
    if (!esNuevo) cargarCredencial()
  }, [id])

  async function cargarDependencias() {
    try {
      const eData = await getEmpresas()
      setEmpresas(eData)
    } catch (err) {
      console.error(err)
    }
  }

  async function cargarCredencial() {
    setLoading(true)
    try {
      const data = await getCredencialById(id)
      setCredencial(data)
    } catch (err) {
      console.error(err)
      setError('Error al cargar datos de credencial.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const dataToSave = { ...credencial }
      if (dataToSave.ambito === 'Interno APSOL') dataToSave.empresa_id = null
      if (!dataToSave.empresa_id) dataToSave.empresa_id = null

      const saved = await saveCredencial(dataToSave)
      if (esNuevo) {
        navigate(`/credenciales/${saved.id}`, { replace: true })
      }
    } catch (err) {
      console.error(err)
      setError('Error al guardar los datos.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('¿Estás seguro de eliminar esta credencial?')) return
    try {
      await deleteCredencial(id)
      navigate('/credenciales')
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  const copiarAlPortapapeles = (texto) => {
    navigator.clipboard.writeText(texto)
    // Se podría agregar un mini toast de "Copiado!" acá
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Cargando credencial...</p>
      </div>
    )
  }

  return (
    <div className="page" style={{ maxWidth: '800px' }}>
      <div className="page-header" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/credenciales')} style={{ padding: '8px' }}>
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="page-title">{esNuevo ? 'Nueva Credencial' : credencial.sistema_plataforma}</h1>
            <p className="page-subtitle">Información de acceso y seguridad</p>
          </div>
        </div>
        {!esNuevo && (
          <button className="btn btn-danger" onClick={handleDelete}>
            <Trash2 size={18} />
            Eliminar
          </button>
        )}
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '20px' }}>{error}</div>}

      <div className="card">
        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <KeyRound size={20} className="text-primary" />
          Datos de la Cuenta
        </h3>
        
        <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          <div className="field">
            <label>Sistema / Plataforma *</label>
            <input 
              type="text" 
              required 
              placeholder="Ej. Hosting Hostinger, AFIP, AppSheet..."
              value={credencial.sistema_plataforma} 
              onChange={e => setCredencial({...credencial, sistema_plataforma: e.target.value})} 
            />
          </div>

          <div className="field">
            <label>Link de Acceso (URL)</label>
            <input 
              type="url" 
              placeholder="https://..."
              value={credencial.link_acceso || ''} 
              onChange={e => setCredencial({...credencial, link_acceso: e.target.value})} 
            />
          </div>

          <div className="field">
            <label>Ámbito *</label>
            <select required value={credencial.ambito} onChange={e => setCredencial({...credencial, ambito: e.target.value})}>
              <option value="Interno APSOL">Interno APSOL</option>
              <option value="Cliente">Cliente</option>
            </select>
          </div>

          <div className="field">
            <label>Empresa (Si es ámbito Cliente)</label>
            <select 
              value={credencial.empresa_id || ''} 
              onChange={e => setCredencial({...credencial, empresa_id: e.target.value})}
              disabled={credencial.ambito !== 'Cliente'}
            >
              <option value="">-- Seleccionar Empresa --</option>
              {empresas.map(e => (
                <option key={e.id} value={e.id}>{e.nombre}</option>
              ))}
            </select>
          </div>

          {/* CREDENCIALES (User/Pass) */}
          <div className="field" style={{ gridColumn: '1 / -1', background: 'var(--color-surface2)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <h4 style={{ marginBottom: '16px', fontSize: '14px' }}>Datos de Ingreso</h4>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="field">
                <label>Usuario / Email *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    required 
                    value={credencial.usuario} 
                    onChange={e => setCredencial({...credencial, usuario: e.target.value})} 
                    style={{ fontFamily: 'monospace' }}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => copiarAlPortapapeles(credencial.usuario)} title="Copiar usuario">
                    <Copy size={16} />
                  </button>
                </div>
              </div>

              <div className="field">
                <label>Contraseña *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type={mostrarPass ? "text" : "password"} 
                    required 
                    value={credencial.contrasena} 
                    onChange={e => setCredencial({...credencial, contrasena: e.target.value})} 
                    style={{ fontFamily: 'monospace' }}
                  />
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => setMostrarPass(!mostrarPass)}>
                    {mostrarPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button type="button" className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => copiarAlPortapapeles(credencial.contrasena)} title="Copiar contraseña">
                    <Copy size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="field">
            <label>Tipo de Acceso</label>
            <input 
              type="text" 
              placeholder="Ej. Administrador, Solo Lectura, Editor..."
              value={credencial.tipo_acceso || ''} 
              onChange={e => setCredencial({...credencial, tipo_acceso: e.target.value})} 
            />
          </div>

          <div className="field">
            <label>Estado</label>
            <select value={credencial.estado} onChange={e => setCredencial({...credencial, estado: e.target.value})}>
              <option value="Activo">Activo</option>
              <option value="Inactivo">Inactivo</option>
            </select>
          </div>

          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Notas Adicionales (MFA, PIN, etc.)</label>
            <textarea 
              rows="3" 
              placeholder="PIN de seguridad, respuestas secretas..."
              value={credencial.notas_adicionales || ''} 
              onChange={e => setCredencial({...credencial, notas_adicionales: e.target.value})} 
            />
          </div>

          <div style={{ gridColumn: '1 / -1', marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Credencial'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
