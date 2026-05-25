import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui'

interface NavItem {
  path: string
  label: string
  icon: string
}

interface NavGroup {
  group: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    group: 'General',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { path: '/manual',    label: 'Manual de uso', icon: 'doc' },
    ],
  },
  {
    group: 'Operación',
    items: [
      { path: '/operaciones',     label: 'Operaciones OPCI', icon: 'opci' },
      { path: '/compras-locales', label: 'Compras Locales',   icon: 'cart' },
      { path: '/importaciones',   label: 'Importaciones',     icon: 'ship' },
      { path: '/costos',          label: 'Costos Importación',icon: 'coin' },
    ],
  },
  {
    group: 'Logística',
    items: [
      { path: '/almacen', label: 'Almacén',           icon: 'warehouse' },
      { path: '/guias',   label: 'Guías y Despachos', icon: 'truck' },
    ],
  },
  {
    group: 'Comercial',
    items: [
      { path: '/facturacion', label: 'Facturación', icon: 'invoice' },
      { path: '/clientes',    label: 'Clientes',    icon: 'building' },
      { path: '/proveedores', label: 'Proveedores', icon: 'users' },
      { path: '/productos',   label: 'Productos',   icon: 'box' },
    ],
  },
  {
    group: 'Análisis',
    items: [
      { path: '/reportes',      label: 'Reportes',      icon: 'chart' },
      { path: '/configuracion', label: 'Configuración', icon: 'cog' },
    ],
  },
]

interface SidebarProps {
  counts?: Record<string, number>
}

export function Sidebar({ counts = {} }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <aside className="app-sidebar">
      {/* Brand */}
      <div className="brand">
        <div className="brand-mark" />
        <div className="brand-name">
          CadenaSuministro
          <span>OPCI · Suite</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map(g => (
          <div key={g.group} className="nav-group">
            <div className="nav-group-label">{g.group}</div>
            {g.items.map(item => {
              const active =
                location.pathname === item.path ||
                location.pathname.startsWith(item.path + '/')
              const countKey = item.path.slice(1)
              const count = counts[countKey]
              return (
                <button
                  key={item.path}
                  className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <Icon name={item.icon} size={14} className="nav-icon" />
                  <span>{item.label}</span>
                  {count != null && count > 0 && (
                    <span className="badge-count">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-foot">
        <span className="env-pill">v1.0</span>
        <span>Producción · Lima</span>
      </div>
    </aside>
  )
}
