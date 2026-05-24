import { useLocation, useNavigate } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { useAuth } from '@/context/AuthContext'
import { initials } from '@/lib/utils'

interface TopbarProps {
  onCreate?: () => void
  onSearch?: (q: string) => void
}

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard':       'Dashboard',
  '/operaciones':     'Operaciones OPCI',
  '/compras-locales': 'Compras Locales',
  '/importaciones':   'Importaciones',
  '/costos':          'Costos Importación',
  '/facturacion':     'Facturación',
  '/almacen':         'Almacén',
  '/guias':           'Guías y Despachos',
  '/clientes':        'Clientes',
  '/proveedores':     'Proveedores',
  '/productos':       'Productos',
  '/reportes':        'Reportes',
  '/configuracion':   'Configuración',
}

function buildCrumbs(pathname: string, navigate: (path: string) => void) {
  const base = [{ label: 'CadenaSuministro', onClick: undefined as (() => void) | undefined }]
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return base

  const sectionPath = '/' + segments[0]
  const sectionLabel = ROUTE_LABELS[sectionPath]
  if (!sectionLabel) return base

  if (segments.length === 1) {
    return [...base, { label: sectionLabel, onClick: undefined }]
  }

  return [
    ...base,
    { label: sectionLabel, onClick: () => navigate(sectionPath) },
    { label: 'Detalle', onClick: undefined },
  ]
}

export function Topbar({ onCreate, onSearch }: TopbarProps) {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const crumbs = buildCrumbs(location.pathname, navigate)

  return (
    <header className="app-topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {i > 0 && (
              <span className="sep" style={{ color: 'var(--text-3)', display: 'flex', margin: '0 2px' }}>
                <Icon name="chevron" size={11} />
              </span>
            )}
            {c.onClick ? (
              <button onClick={c.onClick}>{c.label}</button>
            ) : (
              <span className={i === crumbs.length - 1 ? 'now' : ''}>{c.label}</span>
            )}
          </span>
        ))}
      </div>

      <div className="topbar-search">
        <Icon name="search" size={13} className="ico" />
        <input
          placeholder="Buscar OPCI, OC, factura, cliente, producto…"
          onChange={e => onSearch?.(e.target.value)}
        />
        <span className="kbd">⌘K</span>
      </div>

      <div className="spacer" />

      <div className="topbar-actions">
        {onCreate && (
          <button className="btn primary sm" onClick={onCreate}>
            <Icon name="plus" size={13} />
            Nueva OPCI
          </button>
        )}
        <button className="icon-btn" title="Notificaciones">
          <Icon name="bell" size={15} />
          <span className="dot" />
        </button>
        <div className="profile" onClick={signOut} title="Cerrar sesión">
          <div className="avatar">
            {profile ? initials(profile.nombre_completo) : '??'}
          </div>
          <div style={{ lineHeight: 1.1 }}>
            <div className="profile-name">{profile?.nombre_completo ?? 'Usuario'}</div>
            <div className="profile-role">{profile?.rol ?? 'Cargando…'}</div>
          </div>
        </div>
      </div>
    </header>
  )
}
