import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Card, DataTable, StatusBadge, OPCI_STATUS_TONE, EtaCell, Badge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getOperaciones } from '@/services/operaciones.service'
import { getClientes } from '@/services/clientes.service'
import { money, fmtDate, initials } from '@/lib/utils'
import type { Operacion, Cliente, EstadoOPCI } from '@/types'

const ESTADOS: EstadoOPCI[] = [
  'Borrador','Recibida','En evaluación','En compra local','En importación',
  'Pendiente de recepción','Pendiente de facturación','Facturada',
  'Pendiente de despacho','Despachada','Pendiente de cobranza',
  'Cerrada','Observada','Anulada',
]

interface Props {
  onCreateNew: () => void
}

export function OperacionesList({ onCreateNew }: Props) {
  const navigate = useNavigate()
  const [operaciones, setOperaciones] = useState<Operacion[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, count } = await getOperaciones(
      { search: q || undefined, estado: (estado as EstadoOPCI) || undefined, cliente_id: clienteId || undefined, fecha_desde: fechaDesde || undefined, fecha_hasta: fechaHasta || undefined },
      { page, pageSize: 25 },
      { field: 'fecha_recepcion', direction: 'desc' },
    )
    setOperaciones(data ?? [])
    setTotal(count)
    setLoading(false)
  }, [q, estado, clienteId, fechaDesde, fechaHasta, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { getClientes().then(r => setClientes(r.data ?? [])) }, [])

  const columns: Column<Operacion>[] = [
    {
      key: 'correlativo_opci', label: 'Correlativo', sortable: true,
      render: r => (
        <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => navigate(`/operaciones/${r.id}`)}>
          {r.correlativo_opci}
        </span>
      ),
    },
    {
      key: 'fecha_recepcion', label: 'Recepción', sortable: true,
      render: r => <span className="mono">{fmtDate(r.fecha_recepcion)}</span>,
    },
    {
      key: 'cliente', label: 'Cliente',
      render: r => (
        <div style={{ maxWidth: 260 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.cliente?.razon_social ?? '—'}
          </div>
          {r.numero_referencia_cliente && (
            <div className="tiny">{r.numero_referencia_cliente}</div>
          )}
        </div>
      ),
    },
    {
      key: 'numero_op', label: 'N° OP cliente',
      render: r => <span className="mono">{r.numero_op ?? '—'}</span>,
    },
    {
      key: 'monto_total_sin_igv', label: 'Monto', align: 'right', sortable: true,
      render: r => <span className="mono">{money(r.monto_total_sin_igv, r.moneda)}</span>,
    },
    {
      key: 'vendedor1', label: 'Vendedor',
      render: r => r.vendedor1 ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="avatar" style={{ width: 20, height: 20, fontSize: 8, flexShrink: 0 }}>
            {initials(r.vendedor1.nombre_completo)}
          </span>
          <span style={{ fontSize: 12 }}>{r.vendedor1.nombre_completo}</span>
        </span>
      ) : <span className="muted">—</span>,
    },
    {
      key: 'forma_pago', label: 'Forma de pago',
      render: r => <span className="muted">{r.forma_pago ?? '—'}</span>,
    },
    {
      key: 'estado', label: 'Estado', sortable: true,
      render: r => <StatusBadge status={r.estado} mapping={OPCI_STATUS_TONE} />,
    },
    {
      key: '_act', label: '', width: 40,
      render: r => (
        <button className="btn ghost xs" onClick={() => navigate(`/operaciones/${r.id}`)} title="Ver detalle">
          <Icon name="chevron" size={12} />
        </button>
      ),
    },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Operaciones OPCI
            <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{total} operaciones</span>
          </h1>
          <div className="page-sub">Gestión centralizada del ciclo comercial por operación</div>
        </div>
        <div className="page-actions">
          <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
          <button className="btn primary sm" onClick={onCreateNew}>
            <Icon name="plus" size={13} /> Nueva OPCI
          </button>
        </div>
      </div>

      <Card padding={false}>
        <div className="table-toolbar">
          <div className="input-wrap">
            <Icon name="search" size={13} className="ico" />
            <input
              className="input with-ico"
              placeholder="Correlativo, N° OP, cliente, referencia…"
              value={q}
              onChange={e => { setQ(e.target.value); setPage(1) }}
              style={{ width: 280 }}
            />
          </div>
          <select className="select" value={estado} onChange={e => { setEstado(e.target.value); setPage(1) }}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" value={clienteId} onChange={e => { setClienteId(e.target.value); setPage(1) }}>
            <option value="">Todos los clientes</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="tiny">Desde</span>
            <input type="date" className="input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ width: 130 }} />
            <span className="tiny">hasta</span>
            <input type="date" className="input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ width: 130 }} />
          </div>
          <div className="spacer" />
          <button className="btn ghost xs" onClick={() => { setQ(''); setEstado(''); setClienteId(''); setFechaDesde(''); setFechaHasta('') }}>
            <Icon name="x" size={11} /> Limpiar
          </button>
        </div>

        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          rows={operaciones as unknown as Record<string, unknown>[]}
          idKey="id"
          loading={loading}
          onRowClick={r => navigate(`/operaciones/${(r as unknown as Operacion).id}`)}
          emptyMessage="No hay operaciones que coincidan con los filtros"
        />

        <div className="table-footer">
          <span>{total} registros totales</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn ghost xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <Icon name="arrowLeft" size={11} />
            </button>
            <span style={{ fontSize: 11, padding: '0 6px' }}>Página {page} de {Math.max(1, Math.ceil(total / 25))}</span>
            <button className="btn ghost xs" disabled={page >= Math.ceil(total / 25)} onClick={() => setPage(p => p + 1)}>
              <Icon name="chevron" size={11} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  )
}
