import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutDashboard,
  Receipt,
  Users,
  Building2,
  FolderKanban,
  Target,
  Ticket,
  Wrench,
  BookOpen,
  Calendar,
  KeyRound,
  LogOut,
  UserCog,
  ChevronLeft,
  ChevronRight,
  Mail,
  DollarSign,
  Wallet
} from 'lucide-react'
import { useState, useEffect } from 'react'

const navSections = [
  {
    label: 'Principal',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Inicio', exact: true },
      { to: '/cronograma', icon: Calendar, label: 'Cronograma' },
    ]
  },
  {
    label: 'CRM & Clientes',
    items: [
      { to: '/empresas', icon: Building2, label: 'Empresas' },
      { to: '/contactos', icon: Users, label: 'Contactos' },
      { to: '/prospectos', icon: Target, label: 'Prospectos' },
      { to: '/plantillas', icon: Mail, label: 'Cadena de E-mails' },
    ]
  },
  {
    label: 'Operaciones',
    items: [
      { to: '/proyectos', icon: FolderKanban, label: 'Proyectos' },
      { to: '/tickets', icon: Ticket, label: 'Tickets' },
      { to: '/preventivos', icon: Wrench, label: 'Preventivos' },
    ]
  },
  {
    label: 'Administración',
    items: [
      { to: '/facturacion', icon: Receipt, label: 'Facturación' },
      { to: '/colaboradores', icon: UserCog, label: 'Colaboradores' },
      { to: '/capacitacion', icon: BookOpen, label: 'Capacitación' },
      { to: '/credenciales', icon: KeyRound, label: 'Credenciales' },
    ]
  },
  {
    label: 'Configuración',
    items: [
      { to: '/valores-uva', icon: DollarSign, label: 'Valores UVA' },
      { to: '/cuentas-bancarias', icon: Wallet, label: 'Cuentas Bancarias' },
    ]
  },
]

export default function Sidebar() {
  const { perfil, logout } = useAuth()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (collapsed) return

    if (!isHovered) {
      const timer = setTimeout(() => {
        setCollapsed(true)
      }, 10000)

      return () => clearTimeout(timer)
    }
  }, [collapsed, isHovered])

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <aside 
      className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button 
        className="sidebar-toggle" 
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? "Expandir" : "Colapsar"}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className="sidebar-header">
        <div className="logo-mark">
          <img 
            src="https://cjqziapqtyjsxqxumgbx.supabase.co/storage/v1/object/public/Bucket%20Publico/Logo%20APSOL.png" 
            alt="APSOL Logo" 
            className="logo-img"
          />
        </div>
        {!collapsed && (
          <div className="sidebar-brand">
            <h2>APSOL</h2>
            <p className="sidebar-subtitle">Gestión Interna</p>
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {navSections.map((section) => (
          <div key={section.label}>
            {!collapsed && <div className="nav-group">{section.label}</div>}
            {section.items.map(({ to, icon: Icon, label, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'active' : ''}`
                }
                title={collapsed ? label : ''}
              >
                <Icon size={18} />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            {perfil?.nombre?.charAt(0) ?? 'U'}
          </div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <p className="sidebar-user-name">{perfil?.nombre} {perfil?.apellido}</p>
              <p className="sidebar-user-role">{perfil?.cargo}</p>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="sidebar-logout" title="Cerrar sesión">
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  )
}
