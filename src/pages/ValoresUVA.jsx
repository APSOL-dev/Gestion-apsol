import { useState, useEffect } from 'react'
import { Plus, Trash2, CalendarDays } from 'lucide-react'
import { getValoresUVA, saveValorUVA, deleteValorUVA } from '../services/valoresUva'

export default function ValoresUVA() {
  const [valores, setValores] = useState([])
  const [loading, setLoading] = useState(true)
  const [nuevoValor, setNuevoValor] = useState({ fecha: '', valor: '' })
  const [mostrandoForm, setMostrandoForm] = useState(false)

  useEffect(() => {
    cargarValores()
  }, [])

  async function cargarValores() {
    setLoading(true)
    try {
      const data = await getValoresUVA()
      setValores(data)
    } catch (error) {
      console.error('Error al cargar valores UVA:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!nuevoValor.fecha || !nuevoValor.valor) return
    
    try {
      const saved = await saveValorUVA(nuevoValor)
      // Agregarlo a la lista y re-ordenar por fecha descendente
      const nuevos = [...valores, saved].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      setValores(nuevos)
      setNuevoValor({ fecha: '', valor: '' })
      setMostrandoForm(false)
    } catch (err) {
      console.error(err)
      alert('Error al guardar el valor UVA')
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Seguro de eliminar este valor histórico? Podría afectar cálculos pasados si las facturas no guardaron su propio valor.')) return
    
    try {
      await deleteValorUVA(id)
      setValores(valores.filter(v => v.id !== id))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  return (
    <div className="page" style={{ maxWidth: '600px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Valores UVA</h1>
          <p className="page-subtitle">Histórico de cotizaciones para facturación</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrandoForm(!mostrandoForm)}>
          <Plus size={18} />
          Nuevo Valor
        </button>
      </div>

      {mostrandoForm && (
        <div className="card" style={{ marginBottom: '24px' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
            <div className="field">
              <label>Fecha *</label>
              <input 
                type="date" 
                required 
                value={nuevoValor.fecha} 
                onChange={e => setNuevoValor({...nuevoValor, fecha: e.target.value})} 
              />
            </div>
            <div className="field">
              <label>Valor ($) *</label>
              <input 
                type="number" 
                step="0.01" 
                required 
                placeholder="Ej. 1045.50"
                value={nuevoValor.valor} 
                onChange={e => setNuevoValor({...nuevoValor, valor: e.target.value})} 
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginBottom: '4px' }}>Guardar</button>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando histórico...</p>
        </div>
      ) : valores.length === 0 ? (
        <div className="placeholder-card">
          <CalendarDays className="placeholder-icon" />
          <h3>No hay valores registrados</h3>
          <p>Carga el valor UVA del día para comenzar a facturar.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Valor ($)</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {valores.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarDays size={16} className="text-primary" />
                        {new Date(v.fecha).toLocaleDateString('es-AR')}
                      </div>
                    </td>
                    <td style={{ fontWeight: '500' }}>
                      ${Number(v.valor).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }}
                        onClick={() => handleDelete(v.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
