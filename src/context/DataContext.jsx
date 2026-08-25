import { createContext, useContext, useState, useEffect } from 'react'
import { getFacturas } from '../services/facturacion'
import { getProspectos } from '../services/prospectos'
import { getColaboradores } from '../services/colaboradores'
import { getEmpresas } from '../services/empresas'
import { getContactos } from '../services/contactos'
import { getProyectos } from '../services/proyectos'
import { getTickets, getPreventivos } from '../services/operaciones'
import { getCapacitaciones } from '../services/capacitacion'
import { getPlanes } from '../services/planificacion'
import { getActividades } from '../services/cronograma'
import { getCredenciales } from '../services/credenciales'
import { getValoresUVA } from '../services/valoresUva'
import { getCuentasBancarias } from '../services/cuentasBancarias'
import { useAuth } from './AuthContext'

const DataContext = createContext({})

export function DataProvider({ children }) {
  const { user } = useAuth()

  // 14 Módulos de datos
  const [facturas, setFacturas] = useState([])
  const [prospectos, setProspectos] = useState([])
  const [colaboradores, setColaboradores] = useState([])
  const [empresas, setEmpresas] = useState([])
  const [contactos, setContactos] = useState([])
  const [proyectos, setProyectos] = useState([])
  const [tickets, setTickets] = useState([])
  const [preventivos, setPreventivos] = useState([])
  const [capacitaciones, setCapacitaciones] = useState([])
  const [planes, setPlanes] = useState([])
  const [actividades, setActividades] = useState([])
  const [credenciales, setCredenciales] = useState([])
  const [valoresUVA, setValoresUVA] = useState([])
  const [cuentasBancarias, setCuentasBancarias] = useState([])

  // Estados de carga individual
  const [loadingFacturas, setLoadingFacturas] = useState(false)
  const [loadingProspectos, setLoadingProspectos] = useState(false)
  const [loadingColaboradores, setLoadingColaboradores] = useState(false)
  const [loadingEmpresas, setLoadingEmpresas] = useState(false)
  const [loadingContactos, setLoadingContactos] = useState(false)
  const [loadingProyectos, setLoadingProyectos] = useState(false)
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [loadingPreventivos, setLoadingPreventivos] = useState(false)
  const [loadingCapacitaciones, setLoadingCapacitaciones] = useState(false)
  const [loadingPlanes, setLoadingPlanes] = useState(false)
  const [loadingActividades, setLoadingActividades] = useState(false)
  const [loadingCredenciales, setLoadingCredenciales] = useState(false)
  const [loadingValoresUVA, setLoadingValoresUVA] = useState(false)
  const [loadingCuentasBancarias, setLoadingCuentasBancarias] = useState(false)

  // Métodos de refresco individual
  async function refreshFacturas(silencioso = false) {
    if (!silencioso) setLoadingFacturas(true)
    try {
      const data = await getFacturas()
      setFacturas(data || [])
    } catch (err) {
      console.error('Error al precargar facturas:', err)
    } finally {
      setLoadingFacturas(false)
    }
  }

  async function refreshProspectos(silencioso = false) {
    if (!silencioso) setLoadingProspectos(true)
    try {
      const data = await getProspectos({ soloActivos: false })
      setProspectos(data || [])
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
      setColaboradores(data || [])
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
      setEmpresas(data || [])
    } catch (err) {
      console.error('Error al precargar empresas:', err)
    } finally {
      setLoadingEmpresas(false)
    }
  }

  async function refreshContactos(silencioso = false) {
    if (!silencioso) setLoadingContactos(true)
    try {
      const data = await getContactos()
      setContactos(data || [])
    } catch (err) {
      console.error('Error al precargar contactos:', err)
    } finally {
      setLoadingContactos(false)
    }
  }

  async function refreshProyectos(silencioso = false) {
    if (!silencioso) setLoadingProyectos(true)
    try {
      const data = await getProyectos()
      setProyectos(data || [])
    } catch (err) {
      console.error('Error al precargar proyectos:', err)
    } finally {
      setLoadingProyectos(false)
    }
  }

  async function refreshTickets(silencioso = false) {
    if (!silencioso) setLoadingTickets(true)
    try {
      const data = await getTickets()
      setTickets(data || [])
    } catch (err) {
      console.error('Error al precargar tickets:', err)
    } finally {
      setLoadingTickets(false)
    }
  }

  async function refreshPreventivos(silencioso = false) {
    if (!silencioso) setLoadingPreventivos(true)
    try {
      const data = await getPreventivos()
      setPreventivos(data || [])
    } catch (err) {
      console.error('Error al precargar preventivos:', err)
    } finally {
      setLoadingPreventivos(false)
    }
  }

  async function refreshCapacitaciones(silencioso = false) {
    if (!silencioso) setLoadingCapacitaciones(true)
    try {
      const data = await getCapacitaciones()
      setCapacitaciones(data || [])
    } catch (err) {
      console.error('Error al precargar capacitaciones:', err)
    } finally {
      setLoadingCapacitaciones(false)
    }
  }

  async function refreshPlanes(silencioso = false) {
    if (!silencioso) setLoadingPlanes(true)
    try {
      const data = await getPlanes()
      setPlanes(data || [])
    } catch (err) {
      console.error('Error al precargar planes:', err)
    } finally {
      setLoadingPlanes(false)
    }
  }

  async function refreshActividades(silencioso = false) {
    if (!silencioso) setLoadingActividades(true)
    try {
      const data = await getActividades()
      setActividades(data || [])
    } catch (err) {
      console.error('Error al precargar actividades:', err)
    } finally {
      setLoadingActividades(false)
    }
  }

  async function refreshCredenciales(silencioso = false) {
    if (!silencioso) setLoadingCredenciales(true)
    try {
      const data = await getCredenciales()
      setCredenciales(data || [])
    } catch (err) {
      console.error('Error al precargar credenciales:', err)
    } finally {
      setLoadingCredenciales(false)
    }
  }

  async function refreshValoresUVA(silencioso = false) {
    if (!silencioso) setLoadingValoresUVA(true)
    try {
      const data = await getValoresUVA()
      setValoresUVA(data || [])
    } catch (err) {
      console.error('Error al precargar valores UVA:', err)
    } finally {
      setLoadingValoresUVA(false)
    }
  }

  async function refreshCuentasBancarias(silencioso = false) {
    if (!silencioso) setLoadingCuentasBancarias(true)
    try {
      const data = await getCuentasBancarias()
      setCuentasBancarias(data || [])
    } catch (err) {
      console.error('Error al precargar cuentas bancarias:', err)
    } finally {
      setLoadingCuentasBancarias(false)
    }
  }

  // Precarga global de todo al iniciar sesión
  useEffect(() => {
    if (user) {
      // Disparar precargas silenciosas en paralelo al iniciar sesión
      refreshFacturas(true)
      refreshProspectos(true)
      refreshColaboradores(true)
      refreshEmpresas(true)
      refreshContactos(true)
      refreshProyectos(true)
      refreshTickets(true)
      refreshPreventivos(true)
      refreshCapacitaciones(true)
      refreshPlanes(true)
      refreshActividades(true)
      refreshCredenciales(true)
      refreshValoresUVA(true)
      refreshCuentasBancarias(true)
    } else {
      // Limpiar datos al cerrar sesión
      setFacturas([])
      setProspectos([])
      setColaboradores([])
      setEmpresas([])
      setContactos([])
      setProyectos([])
      setTickets([])
      setPreventivos([])
      setCapacitaciones([])
      setPlanes([])
      setActividades([])
      setCredenciales([])
      setValoresUVA([])
      setCuentasBancarias([])
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
      refreshEmpresas,

      contactos,
      loadingContactos,
      refreshContactos,

      proyectos,
      loadingProyectos,
      refreshProyectos,

      tickets,
      loadingTickets,
      refreshTickets,

      preventivos,
      loadingPreventivos,
      refreshPreventivos,

      capacitaciones,
      loadingCapacitaciones,
      refreshCapacitaciones,

      planes,
      loadingPlanes,
      refreshPlanes,

      actividades,
      loadingActividades,
      refreshActividades,

      credenciales,
      loadingCredenciales,
      refreshCredenciales,

      valoresUVA,
      loadingValoresUVA,
      refreshValoresUVA,

      cuentasBancarias,
      loadingCuentasBancarias,
      refreshCuentasBancarias
    }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}
