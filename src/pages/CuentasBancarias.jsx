import { useState, useEffect } from 'react'
import { Plus, Trash2, Landmark, Building2 } from 'lucide-react'
import { getCuentasBancarias, saveCuentaBancaria, deleteCuentaBancaria } from '../services/cuentasBancarias'
import { getEmpresas } from '../services/empresas'

export default function CuentasBancarias() {
  const [cuentas, setCuentas] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [loading, setLoading] = useState(true)
  const [mostrandoForm, setMostrandoForm] = useState(false)
  const [saving, setSaving] = useState(false)
  
  const [nuevaCuenta, setNuevaCuenta] = useState({
    banco: '',
    tipo_cuenta: 'Cuenta Corriente',
    moneda: 'ARS',
    cbu: '',
    alias: '',
    titular: '',
    nombre_interno: '',
    cuit: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  async function cargarDatos() {
    setLoading(true)
    try {
      const data = await getCuentasBancarias()
      setCuentas(data)
    } catch (error) {
      console.error('Error al cargar datos:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const dataToSave = { ...nuevaCuenta }
      // Aseguramos que nombre_interno tenga algo si está vacío
      if (!dataToSave.nombre_interno) dataToSave.nombre_interno = dataToSave.banco

      const saved = await saveCuentaBancaria(dataToSave)
      
      setCuentas([...cuentas, saved])
      setNuevaCuenta({
        banco: '',
        tipo_cuenta: 'Cuenta Corriente',
        moneda: 'ARS',
        cbu: '',
        alias: '',
        titular: '',
        nombre_interno: '',
        cuit: ''
      })
      setMostrandoForm(false)
    } catch (err) {
      console.error(err)
      alert('Error al guardar la cuenta: ' + (err.message || 'Error desconocido'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Seguro de eliminar esta cuenta bancaria?')) return
    
    try {
      await deleteCuentaBancaria(id)
      setCuentas(cuentas.filter(c => c.id !== id))
    } catch (err) {
      console.error(err)
      alert('Error al eliminar')
    }
  }

  return (
    <div className="page" style={{ maxWidth: '900px' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Cuentas Bancarias</h1>
          <p className="page-subtitle">Gestiona las cuentas de destino para cobros o pagos</p>
        </div>
        <button className="btn btn-primary" onClick={() => setMostrandoForm(!mostrandoForm)}>
          <Plus size={18} />
          {mostrandoForm ? 'Cancelar' : 'Nueva Cuenta'}
        </button>
      </div>

      {mostrandoForm && (
        <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--color-primary)' }}>
          <form onSubmit={handleAdd} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="field">
              <label>Nombre Interno / Referencia *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Galicia Principal, MP Personal"
                value={nuevaCuenta.nombre_interno} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, nombre_interno: e.target.value})} 
              />
            </div>
            <div className="field">
              <label>Banco / Billetera *</label>
              <input 
                type="text" 
                required 
                placeholder="Ej. Banco Galicia, MercadoPago"
                value={nuevaCuenta.banco} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, banco: e.target.value})} 
              />
            </div>

            <div className="field">
              <label>Titular de la Cuenta *</label>
              <input 
                type="text" 
                required
                placeholder="Nombre completo"
                value={nuevaCuenta.titular} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, titular: e.target.value})} 
              />
            </div>
            <div className="field">
              <label>CUIT del Titular</label>
              <input 
                type="text" 
                placeholder="20-XXXXXXXX-X"
                value={nuevaCuenta.cuit} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, cuit: e.target.value})} 
              />
            </div>
            
            <div className="field">
              <label>Tipo de Cuenta</label>
              <select 
                value={nuevaCuenta.tipo_cuenta} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, tipo_cuenta: e.target.value})}
              >
                <option value="Cuenta Corriente">Cuenta Corriente</option>
                <option value="Caja de Ahorro">Caja de Ahorro</option>
                <option value="Billetera Virtual">Billetera Virtual</option>
              </select>
            </div>
            <div className="field">
              <label>Moneda</label>
              <select 
                value={nuevaCuenta.moneda} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, moneda: e.target.value})}
              >
                <option value="ARS">ARS - Pesos Argentinos</option>
                <option value="USD">USD - Dólares</option>
              </select>
            </div>

            <div className="field">
              <label>CBU / CVU</label>
              <input 
                type="text" 
                placeholder="22 dígitos"
                value={nuevaCuenta.cbu} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, cbu: e.target.value})} 
              />
            </div>
            <div className="field">
              <label>Alias</label>
              <input 
                type="text" 
                placeholder="Alias de la cuenta"
                value={nuevaCuenta.alias} 
                onChange={e => setNuevaCuenta({...nuevaCuenta, alias: e.target.value})} 
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cuenta Bancaria'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="loading-screen" style={{ minHeight: '300px' }}>
          <div className="loading-spinner" />
          <p>Cargando cuentas...</p>
        </div>
      ) : cuentas.length === 0 ? (
        <div className="placeholder-card">
          <Landmark className="placeholder-icon" />
          <h3>No hay cuentas bancarias registradas</h3>
          <p>Crea cuentas para gestionar los pagos e ingresos.</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Banco</th>
                  <th>Titular</th>
                  <th>Tipo y Moneda</th>
                  <th>CBU / Alias</th>
                  <th>Propiedad</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                 {cuentas.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                        <Landmark size={16} className="text-primary" />
                        <div>
                          <div>{c.banco}</div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.nombre_interno}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '500' }}>{c.titular || '-'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>{c.cuit}</div>
                    </td>
                    <td>
                      {c.tipo_cuenta} ({c.moneda})
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
                        {c.cbu && <span>CBU: <strong style={{ color: 'var(--color-text)' }}>{c.cbu}</strong></span>}
                        {c.alias && <span>Alias: <strong style={{ color: 'var(--color-text)' }}>{c.alias}</strong></span>}
                        {!c.cbu && !c.alias && '-'}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-green">Propia</span>
                    </td>
                    <td>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '6px', color: 'var(--color-danger)', borderColor: 'transparent', background: 'transparent' }}
                        onClick={() => handleDelete(c.id)}
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
