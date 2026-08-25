import { createContext, useContext, useState, useEffect } from 'react'
import { getFacturas } from '../services/facturacion'
import { getProspectos } from '../services/prospectos'
import { getColaboradores } from '../services/colaboradores'
import { getEmpresas } from '../services/empresas'
import { useAuth } from './AuthContext'

const DataContext = createContext({})

export function DataProvider({ children }) {
  const { user } = useAuth()
  const [facturas, setFacturas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [empresas, setEmpresas] = useState([])

  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [loadingProspectos, setLoadingProspectos] = useState(false)
  const [loadingColaboradores, setLoadingColaboradores] = useState(false)
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)

  async function refreshFacturas(silencioso = false) {
    if (!silencioso) setLoadingFacturas(true)
    try {
      const data = await getFacturas()
      setFacturas(data)
    } catch (err) {
      console.error('Error al precargar facturas:', err)
    } finally {
      setLoadingFacturas(false)
    }
  }

  async function refreshProspectos(silencioso = false) {
    if (!silencioso) setLoadingProspectos(true)
    try {
      // Pedimos todos los prospectos de forma predeterminada
      const data = await getProspectos({ soloActivos: false })
      setProspectos(data)
    } catch (err) {
      console.error('Error al precargar prospectos:', err)
    } finally {
      setLoadingProspectos(false)
    }
  }

  async function refreshColaboradores(silencioso = false) {
    if (!silencioso) setLoadingColaboradores(true)
    try {
      const data = await getColaboradores()
      setColaboradores(data)
    } catch (err) {
      console.error('Error al precargar colaboradores:', err)
    } finally {
      setLoadingColaboradores(false)
    }
  }

  async function refreshEmpresas(silencioso = false) {
    if (!silencioso) setLoadingEmpresas(true)
    try {
      const data = await getEmpresas()
      setEmpresas(data)
    } catch (err) {
      console.error('Error al precargar empresas:', err)
    } finally {
      setLoadingEmpresas(false)
    }
  }

  // Precarga global cuando hay usuario logueado
  useEffect(() => {
    if (user) {
      // Disparar precargas silenciosas en paralelo al iniciar sesión
      refreshFacturas(true)
      refreshProspectos(true)
      refreshColaboradores(true)
      refreshEmpresas(true)
    } else {
      // Limpiar datos al cerrar sesión
      setFacturas([])
      setProspectos([])
      setColaboradores([])
      setEmpresas([])
    }
  }, [user])

  return (
    <DataContext.Provider value={{
      facturas,
      loadingFacturas,
      refreshFacturas,

      prospectos,
      loadingProspectos,
      refreshProspectos,

      colaboradores,
      loadingColaboradores,
      refreshColaboradores,

      empresas,
      loadingEmpresas,
      refreshEmpresas
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
