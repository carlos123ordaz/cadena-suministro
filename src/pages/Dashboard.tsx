import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  KPI,
  Card,
  DataTable,
  StatusBadge,
  OCI_STATUS_TONE,
  FACTURA_STATUS_TONE,
  EtaCell,
  Icon,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { getDashboardStats, getRecentOperaciones } from '@/services/operaciones.service'
import { getImportaciones } from '@/services/importaciones.service'
import { getCobranzaPendiente } from '@/services/facturacion.service'
import { money, fmtDate, initials } from '@/lib/utils'
import { OPCI_STATUS_TONE } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import type { DashboardStats, Operacion, Importacion, FacturaVenta } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Alert {
  id: string
  type: 'warn' | 'bad' | 'info'
  icon: string
  title: string
  sub: string
}

// ─── Dynamic alert loader ─────────────────────────────────────────────────────

async function loadDashboardAlerts(): Promise<Alert[]> {
  const today = new Date().toISOString().slice(0, 10)
  const out: Alert[] = []

  const [etasRes, factsRes, ocsRes] = await Promise.all([
    supabase
      .from('importaciones')
      .select('id, grupo_importacion, eta, status')
      .lt('eta', today)
      .not('status', 'in', '("Cerrada","Anulada","Recibida en almacén")')
      .order('eta', { ascending: true })
      .limit(5),
    supabase
      .from('facturas_venta')
      .select('id, num_factura, fecha_prometida_pago, operacion:operaciones(cliente:clientes!cliente_id(razon_social))')
      .lt('fecha_prometida_pago', today)
      .not('status', 'in', '("Pagada total","Anulada")')
      .order('fecha_prometida_pago', { ascending: true })
      .limit(5),
    supabase
      .from('ordenes_compra')
      .select('id, numero_oc, fecha_ofrecida, status')
      .lt('fecha_ofrecida', today)
      .not('status', 'in', '("Recibido completo","Cerrado","Anulado")')
      .order('fecha_ofrecida', { ascending: true })
      .limit(3),
  ])

  for (const i of (etasRes.data ?? []) as Array<{ id: string; grupo_importacion: string; eta: string; status: string }>) {
    const days = Math.round((Date.parse(today) - Date.parse(i.eta)) / 86400000)
    out.push({
      id: `eta-${i.id}`,
      type: 'bad',
      icon: 'ship',
      title: `ETA vencida – ${i.grupo_importacion}`,
      sub: `Llegada estimada hace ${days} día${days !== 1 ? 's' : ''} · ${i.status}`,
    })
  }

  for (const f of (factsRes.data ?? []) as Array<{ id: string; num_factura: string; fecha_prometida_pago: string; operacion: { cliente?: { razon_social?: string } } | null }>) {
    const days = Math.round((Date.parse(today) - Date.parse(f.fecha_prometida_pago)) / 86400000)
    const cliente = f.operacion?.cliente?.razon_social ?? '—'
    out.push({
      id: `fact-${f.id}`,
      type: 'bad',
      icon: 'invoice',
      title: `Factura ${f.num_factura} vencida`,
      sub: `Cliente: ${cliente} · Vencida hace ${days} día${days !== 1 ? 's' : ''}`,
    })
  }

  for (const oc of (ocsRes.data ?? []) as Array<{ id: string; numero_oc: string; fecha_ofrecida: string; status: string }>) {
    const days = Math.round((Date.parse(today) - Date.parse(oc.fecha_ofrecida)) / 86400000)
    out.push({
      id: `oc-${oc.id}`,
      type: 'warn',
      icon: 'truck',
      title: `Proveedor retrasado – ${oc.numero_oc}`,
      sub: `Fecha ofrecida superada en ${days} día${days !== 1 ? 's' : ''} · ${oc.status}`,
    })
  }

  return out
}

// ─── Status bar helper ────────────────────────────────────────────────────────

const OPCI_STATUS_ORDER: string[] = [
  'Recibida',
  'En evaluación',
  'En compra local',
  'En importación',
  'Pendiente de recepción',
  'Pendiente de facturación',
  'Facturada',
  'Pendiente de despacho',
  'Pendiente de cobranza',
  'Cerrada',
  'Observada',
]

const STATUS_COLOR: Record<string, string> = {
  'Recibida': 'var(--info)',
  'En evaluación': 'var(--info)',
  'En compra local': 'var(--violet)',
  'En importación': 'var(--violet)',
  'Pendiente de recepción': 'var(--warn)',
  'Pendiente de facturación': 'var(--warn)',
  'Facturada': 'var(--teal)',
  'Pendiente de despacho': 'var(--warn)',
  'Pendiente de cobranza': 'var(--warn)',
  'Cerrada': 'var(--ok)',
  'Observada': 'var(--bad)',
}

function buildStatusDist(operaciones: Operacion[]): { estado: string; count: number; pct: number }[] {
  const map: Record<string, number> = {}
  for (const op of operaciones) {
    map[op.estado] = (map[op.estado] ?? 0) + 1
  }
  const total = operaciones.length || 1
  return OPCI_STATUS_ORDER
    .filter(s => map[s])
    .map(s => ({ estado: s, count: map[s], pct: (map[s] / total) * 100 }))
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        height: 240,
        color: 'var(--text-3)',
        fontSize: 13,
      }}
    >
      <Icon name="spinner" size={18} style={{ animation: 'spin 1s linear infinite' }} />
      Cargando datos…
    </div>
  )
}

// ─── StatusBar ────────────────────────────────────────────────────────────────

function StatusBar({ items }: { items: { estado: string; count: number; pct: number }[] }) {
  if (items.length === 0) {
    return <div style={{ color: 'var(--text-3)', fontSize: 12, textAlign: 'center', padding: 24 }}>Sin datos</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => (
        <div key={item.estado} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-2)',
              width: 180,
              flexShrink: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.estado}
          </div>
          <div
            style={{
              flex: 1,
              height: 6,
              background: 'var(--border)',
              borderRadius: 4,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${item.pct}%`,
                background: STATUS_COLOR[item.estado] ?? 'var(--accent)',
                borderRadius: 4,
                transition: 'width 0.4s',
              }}
            />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', width: 24, textAlign: 'right', flexShrink: 0 }}>
            {item.count}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── AlertRow ─────────────────────────────────────────────────────────────────

function AlertRow({ alert }: { alert: Alert }) {
  const bg = alert.type === 'bad' ? 'var(--bad-soft)' : alert.type === 'warn' ? 'var(--warn-soft)' : 'var(--info-soft)'
  const color = alert.type === 'bad' ? 'var(--bad)' : alert.type === 'warn' ? 'var(--warn)' : 'var(--info)'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: 8,
          background: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color,
        }}
      >
        <Icon name={alert.icon} size={14} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>{alert.title}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>{alert.sub}</div>
      </div>
    </div>
  )
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name }: { name?: string | null }) {
  const ini = initials(name)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: '50%',
        background: 'var(--accent-soft)',
        color: 'var(--accent)',
        fontSize: 9,
        fontWeight: 700,
        marginRight: 6,
        flexShrink: 0,
      }}
    >
      {ini}
    </span>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentOps, setRecentOps] = useState<Operacion[]>([])
  const [transito, setTransito] = useState<Importacion[]>([])
  const [cobranza, setCobranza] = useState<FacturaVenta[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [
          statsRes,
          recentRes,
          transitoRes,
          cobranzaRes,
          alertsData,
        ] = await Promise.all([
          getDashboardStats(),
          getRecentOperaciones(15),
          getImportaciones({ status: 'En tránsito' }, { page: 1, pageSize: 10 }),
          getCobranzaPendiente(),
          loadDashboardAlerts(),
        ])

        if (cancelled) return

        if (statsRes.error) throw statsRes.error
        if (recentRes.error) throw recentRes.error

        setStats(statsRes.data)
        setRecentOps(recentRes.data ?? [])
        setTransito(transitoRes.data ?? [])
        setCobranza((cobranzaRes.data ?? []).slice(0, 8))
        setAlerts(alertsData)
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error)?.message ?? 'Error al cargar el dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  // ─── Table columns ──────────────────────────────────────────────────────────

  const transitoCols: Column<Importacion>[] = [
    {
      key: 'grupo_importacion',
      label: 'Grupo',
      render: row => (
        <span
          className="mono"
          style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => navigate(`/importaciones/${row.id}`)}
        >
          {row.grupo_importacion}
        </span>
      ),
    },
    {
      key: 'numero_documento_transporte',
      label: 'Embarque',
      render: row => (
        <span className="mono" style={{ fontSize: 11.5 }}>
          {row.numero_documento_transporte ?? '—'}
        </span>
      ),
    },
    {
      key: 'pais_origen',
      label: 'Origen',
      render: row => row.pais_origen ?? '—',
    },
    {
      key: 'eta',
      label: 'ETA',
      render: row => <EtaCell eta={row.eta} />,
    },
    {
      key: 'status',
      label: 'Estado',
      render: row => <StatusBadge status={row.status} mapping={OCI_STATUS_TONE} />,
    },
  ]

  type FacturaWithOp = FacturaVenta & { operacion?: { correlativo_opci?: string; cliente?: { razon_social?: string } } }

  const cobranzaCols: Column<FacturaWithOp>[] = [
    {
      key: 'num_factura',
      label: 'Factura',
      render: row => (
        <span className="mono" style={{ fontSize: 11.5 }}>
          {row.num_factura}
        </span>
      ),
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: row => (
        <span style={{ fontSize: 12 }}>
          {row.operacion?.cliente?.razon_social ?? '—'}
        </span>
      ),
    },
    {
      key: 'monto_total_sin_igv',
      label: 'Monto',
      align: 'right',
      render: row => (
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {money(row.monto_total_sin_igv, row.moneda)}
        </span>
      ),
    },
    {
      key: 'fecha_prometida_pago',
      label: 'Vence',
      render: row => <EtaCell eta={row.fecha_prometida_pago} pastBad />,
    },
    {
      key: 'status',
      label: 'Estado',
      render: row => <StatusBadge status={row.status} mapping={FACTURA_STATUS_TONE} />,
    },
  ]

  type OpWithCliente = Operacion & { cliente?: { razon_social?: string } }

  const opciCols: Column<OpWithCliente>[] = [
    {
      key: 'correlativo_opci',
      label: 'Correlativo',
      render: row => (
        <span
          className="mono"
          style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
          onClick={() => navigate(`/operaciones/${row.id}`)}
        >
          {row.correlativo_opci}
        </span>
      ),
    },
    {
      key: 'fecha_recepcion',
      label: 'Fecha recepción',
      render: row => <span className="mono" style={{ fontSize: 11.5 }}>{fmtDate(row.fecha_recepcion)}</span>,
    },
    {
      key: 'cliente',
      label: 'Cliente',
      render: row => (
        <span style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.cliente?.razon_social ?? '—'}
        </span>
      ),
    },
    {
      key: 'numero_op',
      label: 'N° OP',
      render: row => <span className="mono" style={{ fontSize: 11.5 }}>{row.numero_op ?? '—'}</span>,
    },
    {
      key: 'monto_total_sin_igv',
      label: 'Monto',
      align: 'right',
      render: row => (
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {money(row.monto_total_sin_igv, row.moneda)}
        </span>
      ),
    },
    {
      key: 'vendedor1',
      label: 'Vendedor',
      render: row => {
        const v = row.vendedor1 as { nombre_completo?: string } | undefined
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Avatar name={v?.nombre_completo} />
            <span style={{ fontSize: 12 }}>{v?.nombre_completo ?? '—'}</span>
          </span>
        )
      },
    },
    {
      key: 'forma_pago',
      label: 'Forma pago',
      render: row => <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{row.forma_pago ?? '—'}</span>,
    },
    {
      key: 'estado',
      label: 'Estado',
      render: row => <StatusBadge status={row.estado} mapping={OPCI_STATUS_TONE} />,
    },
  ]

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <Spinner />

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          height: 240,
          color: 'var(--bad)',
        }}
      >
        <Icon name="warning" size={28} />
        <div style={{ fontSize: 13 }}>{error}</div>
        <button className="btn sm" onClick={() => window.location.reload()}>
          Reintentar
        </button>
      </div>
    )
  }

  const s = stats!
  const statusDist = buildStatusDist(recentOps)

  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Resumen ejecutivo de operaciones</div>
        </div>
        <div className="page-actions">
          <button className="btn sm ghost" onClick={() => navigate('/operaciones')}>
            <Icon name="opci" size={13} />
            Ver operaciones
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <KPI
          label="Operaciones activas"
          value={s.operaciones_activas}
          icon="opci"
          onClick={() => navigate('/operaciones')}
        />
        <KPI
          label="Importaciones en tránsito"
          value={s.importaciones_en_transito}
          icon="ship"
          onClick={() => navigate('/importaciones')}
        />
        <KPI
          label="Pendientes de recepción"
          value={s.productos_pendientes_recepcion}
          icon="warning"
          onClick={() => navigate('/almacen')}
        />
        <KPI
          label="Pendientes de despacho"
          value={s.pedidos_pendientes_despacho}
          icon="truck"
          onClick={() => navigate('/almacen')}
        />
        <KPI
          label="Facturas vencidas"
          value={s.facturas_vencidas}
          icon="invoice"
          deltaTone={s.facturas_vencidas > 0 ? 'down' : ''}
          delta={s.facturas_vencidas > 0 ? 'Requiere atención' : undefined}
          onClick={() => navigate('/facturacion')}
        />
        <KPI
          label="Alertas ETA próxima"
          value={s.alertas_eta_proxima}
          icon="dollar"
          deltaTone={s.alertas_eta_proxima > 0 ? 'down' : ''}
          delta={s.alertas_eta_proxima > 0 ? `${s.alertas_eta_proxima} próximas` : undefined}
          onClick={() => navigate('/importaciones')}
        />
      </div>

      {/* Middle row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Card title="OPCI por estado" icon="chart">
          {recentOps.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 12, padding: 8 }}>Sin operaciones recientes</div>
          ) : (
            <StatusBar items={statusDist} />
          )}
        </Card>

        <Card title="Alertas activas" icon="bell">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {alerts.length === 0 ? (
              <div style={{ color: 'var(--ok)', fontSize: 12, textAlign: 'center', padding: '16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="check" size={13} />
                Sin alertas pendientes
              </div>
            ) : (
              alerts.map(a => <AlertRow key={a.id} alert={a} />)
            )}
          </div>
        </Card>
      </div>

      {/* Bottom row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <Card title="Importaciones en tránsito" icon="ship" padding={false}>
          <DataTable
            columns={transitoCols as unknown as Column<Record<string, unknown>>[]}
            rows={transito as unknown as Record<string, unknown>[]}
            idKey="id"
            density="compact"
            emptyMessage="Sin importaciones en tránsito"
            onRowClick={row => navigate(`/importaciones/${(row as unknown as Importacion).id}`)}
          />
        </Card>

        <Card title="Cobranza – facturas próximas a vencer" icon="invoice" padding={false}>
          <DataTable
            columns={cobranzaCols as unknown as Column<Record<string, unknown>>[]}
            rows={cobranza as unknown as Record<string, unknown>[]}
            idKey="id"
            density="compact"
            emptyMessage="Sin facturas pendientes"
          />
        </Card>
      </div>

      {/* OPCI recientes */}
      <Card title="OPCI recientes" icon="opci" padding={false}>
        <DataTable
          columns={opciCols as unknown as Column<Record<string, unknown>>[]}
          rows={recentOps as unknown as Record<string, unknown>[]}
          idKey="id"
          density="compact"
          emptyMessage="Sin operaciones recientes"
          onRowClick={row => navigate(`/operaciones/${(row as unknown as OpWithCliente).id}`)}
        />
      </Card>
    </div>
  )
}
