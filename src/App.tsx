import { useState, Suspense, lazy } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { Login } from '@/pages/Login'
import { Icon } from '@/components/ui'
import { CreateOperacion } from '@/pages/operaciones/CreateOperacion'

// Lazy-loaded pages
const Dashboard = lazy(() => import('@/pages/Dashboard').then(m => ({ default: m.Dashboard })))
const OperacionesList = lazy(() => import('@/pages/operaciones/OperacionesList').then(m => ({ default: m.OperacionesList })))
const OperacionDetail = lazy(() => import('@/pages/operaciones/OperacionDetail').then(m => ({ default: m.OperacionDetail })))
const ComprasLocalesList = lazy(() => import('@/pages/compras-locales/ComprasLocalesList').then(m => ({ default: m.ComprasLocalesList })))
const ComprasLocalesDetail = lazy(() => import('@/pages/compras-locales/ComprasLocalesDetail').then(m => ({ default: m.ComprasLocalesDetail })))
const ImportacionesList = lazy(() => import('@/pages/importaciones/ImportacionesList').then(m => ({ default: m.ImportacionesList })))
const ImportacionDetail = lazy(() => import('@/pages/importaciones/ImportacionDetail').then(m => ({ default: m.ImportacionDetail })))
const CostosImportacion = lazy(() => import('@/pages/costos/CostosImportacion').then(m => ({ default: m.CostosImportacion })))
const Facturacion = lazy(() => import('@/pages/facturacion/Facturacion').then(m => ({ default: m.Facturacion })))
const Almacen = lazy(() => import('@/pages/almacen/Almacen').then(m => ({ default: m.Almacen })))
const GuiasDespachos = lazy(() => import('@/pages/guias/GuiasDespachos').then(m => ({ default: m.GuiasDespachos })))
const Clientes = lazy(() => import('@/pages/clientes/Clientes').then(m => ({ default: m.Clientes })))
const Proveedores = lazy(() => import('@/pages/proveedores/Proveedores').then(m => ({ default: m.Proveedores })))
const Productos = lazy(() => import('@/pages/productos/Productos').then(m => ({ default: m.Productos })))
const Reportes = lazy(() => import('@/pages/reportes/Reportes').then(m => ({ default: m.Reportes })))
const Configuracion = lazy(() => import('@/pages/Configuracion').then(m => ({ default: m.Configuracion })))
const Manual = lazy(() => import('@/pages/manual/Manual').then(m => ({ default: m.Manual })))

function PageLoader() {
  return (
    <div className="loading-row" style={{ padding: 60 }}>
      <Icon name="spinner" size={16} style={{ animation: 'spin 1s linear infinite' }} />
      <span>Cargando módulo…</span>
    </div>
  )
}

function AppShell() {
  const { loading, user } = useAuth()
  const [createOPCI, setCreateOPCI] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)', gap: 12, color: 'var(--text-3)' }}>
        <Icon name="spinner" size={18} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 14 }}>Iniciando sesión…</span>
      </div>
    )
  }

  if (!user) return <Login />

  const showCreateBtn = location.pathname === '/operaciones' || location.pathname === '/dashboard'

  return (
    <div className="app-grid">
      <Sidebar />
      <Topbar
        onCreate={showCreateBtn ? () => setCreateOPCI(true) : undefined}
      />
      <main className="app-main">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/operaciones" element={<OperacionesList onCreateNew={() => setCreateOPCI(true)} />} />
            <Route path="/operaciones/:id" element={<OperacionDetail />} />
            <Route path="/compras-locales" element={<ComprasLocalesList />} />
            <Route path="/compras-locales/:id" element={<ComprasLocalesDetail />} />
            <Route path="/importaciones" element={<ImportacionesList />} />
            <Route path="/importaciones/:id" element={<ImportacionDetail />} />
            <Route path="/costos" element={<CostosImportacion />} />
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/almacen" element={<Almacen />} />
            <Route path="/guias" element={<GuiasDespachos />} />
            <Route path="/clientes" element={<Clientes />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/productos" element={<Productos />} />
            <Route path="/reportes" element={<Reportes />} />
            <Route path="/configuracion" element={<Configuracion />} />
            <Route path="/manual" element={<Manual />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </main>
      <CreateOperacion
        open={createOPCI}
        onClose={() => setCreateOPCI(false)}
        onCreated={(id, _correlativo) => { setCreateOPCI(false); navigate(`/operaciones/${id}`) }}
      />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
