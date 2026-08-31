import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Outlet, Link, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import { useState, useEffect, useRef } from 'react'
import { 
  LayoutDashboard, Building2, Users, FileText, Target, Briefcase, 
  Wrench, Activity, GraduationCap, Calendar as CalendarIcon, 
  ShieldCheck, Receipt, DollarSign, Wallet, Mail, Menu, X, ChevronLeft, ChevronRight, LogOut, Pin, HelpCircle, UserCircle
} from 'lucide-react'
import PageLoader from './components/PageLoader'
import NotificacionesBell from './components/NotificacionesBell'
import { rutaVisibleParaRol, filtrarFavoritosPorRol, claveFavoritos } from './utils/permisos'

// ─── Lazy imports (Code Splitting) ───────────────────────────────────────────
// Cada página se carga solo cuando el usuario la visita por primera vez
const Login            = lazy(() => import('./pages/Login'))
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const MiPerfil         = lazy(() => import('./pages/MiPerfil'))

// Mapa de iconos para persistencia en Favoritos
const ICON_MAP = {
  LayoutDashboard, Building2, Users, FileText, Target, Briefcase, 
  Wrench, Activity, GraduationCap, Calendar: CalendarIcon, 
  ShieldCheck, Receipt, DollarSign, Wallet, Mail, Menu, X, Pin
}

const Empresas         = lazy(() => import('./pages/Empresas'))
const EmpresaDetalle   = lazy(() => import('./pages/EmpresaDetalle'))
const Contactos        = lazy(() => import('./pages/Contactos'))
const ContactoDetalle  = lazy(() => import('./pages/ContactoDetalle'))
const Prospectos       = lazy(() => import('./pages/Prospectos'))
const ProspectoDetalle = lazy(() => import('./pages/ProspectoDetalle'))
const ValoresUVA       = lazy(() => import('./pages/ValoresUVA'))
const CuentasBancarias = lazy(() => import('./pages/CuentasBancarias'))
const Facturacion      = lazy(() => import('./pages/Facturacion'))
const FacturaDetalle   = lazy(() => import('./pages/FacturaDetalle'))

const Colaboradores       = lazy(() => import('./pages/Colaboradores'))
const ColaboradorDetalle  = lazy(() => import('./pages/ColaboradorDetalle'))
const Proyectos           = lazy(() => import('./pages/Proyectos'))
const ProyectoDetalle     = lazy(() => import('./pages/ProyectoDetalle'))

const Tickets          = lazy(() => import('./pages/Tickets'))
const TicketDetalle    = lazy(() => import('./pages/TicketDetalle'))
const Preventivos      = lazy(() => import('./pages/Preventivos'))
const PreventivoDetalle = lazy(() => import('./pages/PreventivoDetalle'))

const Capacitacion        = lazy(() => import('./pages/Capacitacion'))
const CapacitacionDetalle = lazy(() => import('./pages/CapacitacionDetalle'))
const Cronograma          = lazy(() => import('./pages/Cronograma'))
const Credenciales        = lazy(() => import('./pages/Credenciales'))
const CredencialDetalle   = lazy(() => import('./pages/CredencialDetalle'))
const Planificacion       = lazy(() => import('./pages/Planificacion'))
const PlanDetalle         = lazy(() => import('./pages/PlanDetalle'))
const Sprints             = lazy(() => import('./pages/Sprints'))
const SprintDetalle       = lazy(() => import('./pages/SprintDetalle'))
// ─────────────────────────────────────────────────────────────────────────────

function Layout() {
  const { user, loading, perfil, signOut } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const mainContentRef = useRef(null)

  // '.main-content' es un contenedor con scroll propio (no la ventana), y
  // React Router no reinicia su scrollTop al cambiar de ruta. Sin esto, al
  // navegar desde un listado largo (ej. Facturación) a una página de detalle,
  // el contenido nuevo se renderiza "arriba" mientras la vista sigue con el
  // scroll heredado del listado, y aparece en blanco hasta scrollear manualmente.
  useEffect(() => {
    mainContentRef.current?.scrollTo(0, 0)
  }, [location.pathname])

  // Favoritos: AISLADOS POR USUARIO. Antes se guardaban en una sola clave
  // global del navegador ('apsol_favorites'), así que los pins del Admin le
  // aparecían al Colaborador que entraba en la misma máquina. Ahora la clave
  // lleva el id del usuario. Se cargan/persisten en efectos porque `user`
  // todavía no está disponible en el primer render.
  const [favorites, setFavorites] = useState([])
  const favoritosCargadosRef = useRef(false)

  useEffect(() => {
    favoritosCargadosRef.current = false
    // Limpieza del esquema viejo global (dejaba pins de un usuario a otro)
    try { localStorage.removeItem('apsol_favorites') } catch (e) { /* noop */ }

    if (!user?.id) { setFavorites([]); return }
    try {
      const saved = localStorage.getItem(claveFavoritos(user.id))
      const parsed = saved ? JSON.parse(saved) : []
      // Iconos que no son texto = datos corruptos de una versión anterior
      const corrupto = !Array.isArray(parsed) || parsed.some(f => typeof f?.icon !== 'string')
      setFavorites(corrupto ? [] : parsed)
    } catch (e) {
      setFavorites([])
    }
    favoritosCargadosRef.current = true
  }, [user?.id])

  const [openSections, setOpenSections] = useState({
    CRM: true,
    Operaciones: false,
    Administración: false,
    Configuración: false
  })

  useEffect(() => {
    // No persistir hasta haber cargado los del usuario (evita pisar con [])
    if (!user?.id || !favoritosCargadosRef.current) return
    try {
      localStorage.setItem(claveFavoritos(user.id), JSON.stringify(favorites))
    } catch (e) { /* noop */ }
  }, [favorites, user?.id])

  const isActive = (path) => location.pathname.startsWith(path)
  const closeSidebar = () => setSidebarOpen(false)

  const toggleFavorite = (e, item) => {
    e.preventDefault()
    e.stopPropagation()
    setFavorites(prev => 
      prev.find(f => f.to === item.to) 
        ? prev.filter(f => f.to !== item.to)
        : [...prev, item]
    )
  }

  const toggleSection = (section) => {
    setOpenSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  // Permisos por rol: única fuente de verdad en utils/permisos.js
  const esRutaPermitida = () => rutaVisibleParaRol(location.pathname, perfil?.cargo)

  if (loading) {
    return <PageLoader />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // "Mi Perfil" es solo para colaboradores. El administrador gestiona todo
  // (incluida su propia cuenta) desde la sección Colaboradores. Va ANTES del
  // guard genérico para mandarlo a /colaboradores y no a "/".
  const esColaborador = perfil?.cargo === 'Colaborador'
  if (user && perfil && !esColaborador && location.pathname.startsWith('/mi-perfil')) {
    return <Navigate to="/colaboradores" replace />
  }

  if (user && perfil && !esRutaPermitida()) {
    return <Navigate to="/" replace />
  }

  const navConfig = [
    {
      group: 'CRM & Clientes',
      id: 'CRM',
      icon: 'Users',
      items: [
        { to: '/empresas', icon: 'Building2', label: 'Empresas' },
        { to: '/contactos', icon: 'Users', label: 'Contactos' },
        { to: '/prospectos', icon: 'Target', label: 'Prospectos' },
      ]
    },
    {
      group: 'Operaciones',
      id: 'Operaciones',
      icon: 'Briefcase',
      items: [
        { to: '/cronograma', icon: 'Calendar', label: 'Cronograma' },
        { to: '/planificacion', icon: 'Calendar', label: 'Planificación' },
        { to: '/proyectos', icon: 'FileText', label: 'Proyectos' },
        { to: '/sprints', icon: 'Activity', label: 'Sprints' },
        { to: '/tickets', icon: 'Activity', label: 'Tickets' },
        { to: '/preventivos', icon: 'Wrench', label: 'Preventivos' },
      ]
    },
    {
      group: 'Administración',
      id: 'Administración',
      icon: 'Receipt',
      items: [
        { to: '/facturacion', icon: 'Receipt', label: 'Facturación' },
        { to: '/colaboradores', icon: 'Users', label: 'Colaboradores' },
        { to: '/capacitacion', icon: 'GraduationCap', label: 'Capacitación' },
      ]
    },
    {
      group: 'Sistema',
      id: 'Configuración',
      icon: 'ShieldCheck',
      items: [
        { to: '/credenciales', icon: 'ShieldCheck', label: 'Credenciales' },
        { to: '/valores-uva', icon: 'DollarSign', label: 'Valores UVA' },
        { to: '/cuentas-bancarias', icon: 'Wallet', label: 'Cuentas Bancarias' },
      ]
    }
  ]

  // Deja en cada sección solo los ítems que el rol puede ver, y descarta las
  // secciones que quedan vacías. Misma regla que el guard de rutas y los
  // favoritos (utils/permisos.js), así no se desincronizan.
  const filteredNavConfig = navConfig
    .map(section => ({
      ...section,
      items: section.items.filter(item => rutaVisibleParaRol(item.to, perfil?.cargo))
    }))
    .filter(section => section.items.length > 0)

  const favoritosVisibles = filtrarFavoritosPorRol(favorites, perfil?.cargo)

  const NavLink = ({ to, icon, label, exact, sub, item }) => {
    const active = exact ? location.pathname === to : isActive(to)
    const isFav = favorites.find(f => f.to === to)
    
    // Recuperar el componente de icono del mapa si viene como string (desde favorites)
    const Icon = typeof icon === 'string' ? ICON_MAP[icon] : icon
    const FallbackIcon = sub ? null : (Icon || HelpCircle)

    return (
      <Link
        to={to}
        className={`${sub ? 'nav-sub-item' : 'nav-item'} ${active ? 'active' : ''}`}
        onClick={closeSidebar}
        title={isCollapsed ? label : ''}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          {sub ? <div className="dot" /> : <FallbackIcon size={18} />}
          {(!isCollapsed || sub) && <span>{label}</span>}
        </div>
        
        {item && !isCollapsed && (
          <button 
            className={`pin-btn ${isFav ? 'pinned' : ''}`}
            onClick={(e) => toggleFavorite(e, item)}
            title={isFav ? "Quitar de favoritos" : "Fijar al inicio"}
          >
            <Pin size={12} />
          </button>
        )}
      </Link>
    )
  }

  return (
    <div className="app-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={closeSidebar} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar--open' : ''} ${isCollapsed ? 'sidebar--collapsed' : ''}`} style={{ overflow: 'visible' }}>
        <button 
          className="sidebar-toggle-btn desktop-only" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            position: 'absolute',
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '24px',
            height: '24px',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 101,
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
          }}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          <div className="sidebar-header">
            <div className="logo-mark">
              <img 
                src="https://cjqziapqtyjsxqxumgbx.supabase.co/storage/v1/object/public/Bucket%20Publico/Logo%20APSOL.png" 
                alt="APSOL Logo" 
                className="logo-img"
              />
            </div>
            {!isCollapsed && <h2>APSOL</h2>}
            <button className="sidebar-close-btn mobile-only" onClick={closeSidebar}>
              <X size={18} />
            </button>
          </div>
          
          <nav className="sidebar-nav">
            <NavLink to="/" icon={LayoutDashboard} label="Inicio" exact />
            {esColaborador && <NavLink to="/mi-perfil" icon={UserCircle} label="Mi Perfil" />}

            {favoritosVisibles.length > 0 && (
              <div className="nav-section favorites-section">
                {!isCollapsed && <div className="nav-group" style={{ fontSize: '0.75rem', padding: '10px 12px', color: 'var(--color-text-subtle)' }}>Favoritos</div>}
                {favoritosVisibles.map(item => (
                  <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} item={item} />
                ))}
              </div>
            )}
            
            {filteredNavConfig.map(section => (
              <div key={section.id} className={`nav-section ${openSections[section.id] ? 'open' : ''}`}>
                <div 
                  className="nav-section-title" 
                  onClick={() => !isCollapsed && toggleSection(section.id)}
                  title={isCollapsed ? section.group : ''}
                >
                  <div className="section-info">
                    {(() => {
                      const SectionIcon = ICON_MAP[section.icon] || HelpCircle
                      return <SectionIcon size={18} />
                    })()}
                    {!isCollapsed && <span>{section.group}</span>}
                  </div>
                  {!isCollapsed && <ChevronRight size={14} className="chevron-icon" />}
                </div>
                
                {!isCollapsed && openSections[section.id] && (
                  <div className="nav-sub-items">
                    {section.items.map(item => (
                      <NavLink key={item.to} to={item.to} label={item.label} sub item={item} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
          
          <div className="sidebar-footer">
            {!isCollapsed && perfil && (() => {
              const contenido = (
                <>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-text)' }}>
                    {perfil.nombre || user?.email?.split('@')[0] || 'Usuario'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-subtle)' }}>
                    {perfil.cargo || 'Sin cargo'}{esColaborador ? ' · Ver mi perfil' : ''}
                  </div>
                </>
              )
              const estilo = { display: 'block', textDecoration: 'none', padding: '10px 12px', borderBottom: '1px solid var(--color-border)', marginBottom: '4px' }
              return esColaborador
                ? <Link to="/mi-perfil" onClick={closeSidebar} style={estilo}>{contenido}</Link>
                : <div style={estilo}>{contenido}</div>
            })()}
            <NotificacionesBell collapsed={isCollapsed} />
            <button onClick={signOut} className="sidebar-logout" style={{ background: 'none', border: 'none', display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '10px 12px', cursor: 'pointer', color: 'var(--color-text-subtle)' }}>
              <LogOut size={16} /> {!isCollapsed && <span>Cerrar Sesión</span>}
            </button>
          </div>
        </div>
      </aside>

      <div className="main-wrapper">
        {/* Header mobile con botón hamburguesa */}
        <header className="mobile-header">
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={20} />
          </button>
          <span className="mobile-title">Gestión APSOL</span>
        </header>

        <main className="main-content" ref={mainContentRef}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <DataProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="mi-perfil" element={<MiPerfil />} />

                <Route path="facturacion">
                  <Route index element={<Facturacion />} />
                  <Route path=":id" element={<FacturaDetalle />} />
                </Route>
                

                <Route path="valores-uva" element={<ValoresUVA />} />
                <Route path="cuentas-bancarias" element={<CuentasBancarias />} />
                
                <Route path="prospectos">
                  <Route index element={<Prospectos />} />
                  <Route path=":id" element={<ProspectoDetalle />} />
                </Route>
                
                <Route path="empresas">
                  <Route index element={<Empresas />} />
                  <Route path=":id" element={<EmpresaDetalle />} />
                </Route>

                <Route path="contactos">
                  <Route index element={<Contactos />} />
                  <Route path=":id" element={<ContactoDetalle />} />
                </Route>

                <Route path="colaboradores">
                  <Route index element={<Colaboradores />} />
                  <Route path=":id" element={<ColaboradorDetalle />} />
                </Route>

                <Route path="proyectos">
                  <Route index element={<Proyectos />} />
                  <Route path=":id" element={<ProyectoDetalle />} />
                </Route>
                <Route path="sprints">
                  <Route index element={<Sprints />} />
                  <Route path=":id" element={<SprintDetalle />} />
                </Route>
                <Route path="tickets">
                  <Route index element={<Tickets />} />
                  <Route path=":id" element={<TicketDetalle />} />
                </Route>
                <Route path="preventivos">
                  <Route index element={<Preventivos />} />
                  <Route path=":id" element={<PreventivoDetalle />} />
                </Route>
                <Route path="capacitacion">
                  <Route index element={<Capacitacion />} />
                  <Route path=":id" element={<CapacitacionDetalle />} />
                </Route>
                <Route path="planificacion">
                  <Route index element={<Planificacion />} />
                  <Route path=":id" element={<PlanDetalle />} />
                </Route>
                <Route path="cronograma" element={<Cronograma />} />
                <Route path="credenciales">
                  <Route index element={<Credenciales />} />
                  <Route path=":id" element={<CredencialDetalle />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </DataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
