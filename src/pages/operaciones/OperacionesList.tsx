import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Card, DataTable, StatusBadge, OPCI_STATUS_TONE, EtaCell, Badge, Modal } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getOperaciones } from '@/services/operaciones.service'
import { getClientes } from '@/services/clientes.service'
import { supabase } from '@/lib/supabase'
import { money, fmtDate, initials, fmtDbError } from '@/lib/utils'
import { downloadCsv } from '@/lib/export'
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

  const [editRow, setEditRow] = useState<Operacion | null>(null)
  const [editForm, setEditForm] = useState({ estado: '' as EstadoOPCI | '', fecha_recepcion: '', numero_op: '', forma_pago: '' })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deleteRow, setDeleteRow] = useState<Operacion | null>(null)
  const [deletingRow, setDeletingRow] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

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

  function openEdit(r: Operacion) {
    setEditForm({ estado: r.estado, fecha_recepcion: r.fecha_recepcion ?? '', numero_op: r.numero_op ?? '', forma_pago: r.forma_pago ?? '' })
    setEditRow(r)
  }

  async function handleSaveEdit() {
    if (!editRow) return
    setSavingEdit(true)
    await supabase.from('operaciones').update({
      estado: editForm.estado || undefined,
      fecha_recepcion: editForm.fecha_recepcion || undefined,
      numero_op: editForm.numero_op || undefined,
      forma_pago: editForm.forma_pago || undefined,
    }).eq('id', editRow.id)
    setSavingEdit(false)
    setEditRow(null)
    load()
  }

  async function handleDelete() {
    if (!deleteRow) return
    setDeletingRow(true)
    setDeleteError(null)
    const { error } = await supabase.from('operaciones').delete().eq('id', deleteRow.id)
    setDeletingRow(false)
    if (error) {
      setDeleteError(
        error.code === '23503'
          ? 'No se puede eliminar: la operación tiene registros relacionados (importaciones, cotizaciones u otros).'
          : `Error al eliminar: ${error.message}`
      )
      return
    }
    setDeleteRow(null)
    load()
  }

  async function handleExport() {
    setExporting(true)
    let query = supabase
      .from('operaciones')
      .select('correlativo_opci, numero_op, estado, fecha_recepcion, nombre_proyecto, forma_pago, cliente:clientes(razon_social), items:operacion_items(item_op, codigo_comercial, descripcion, cantidad, unidad_medida, estado)')
      .order('fecha_recepcion', { ascending: false })
    if (q) query = (query as typeof query).or(`correlativo_opci.ilike.%${q}%,nombre_proyecto.ilike.%${q}%`)
    if (estado) query = (query as typeof query).eq('estado', estado)
    if (clienteId) query = (query as typeof query).eq('cliente_id', clienteId)
    if (fechaDesde) query = (query as typeof query).gte('fecha_recepcion', fechaDesde)
    if (fechaHasta) query = (query as typeof query).lte('fecha_recepcion', fechaHasta)
    const { data } = await query
    type Item = { item_op?: string; codigo_comercial?: string; descripcion?: string; cantidad?: number; unidad_medida?: string; estado?: string }
    type Op = { correlativo_opci: string; numero_op?: string; estado: string; fecha_recepcion?: string; nombre_proyecto?: string; forma_pago?: string; cliente?: { razon_social: string }; items?: Item[] }
    const rows = (data as unknown as Op[] ?? []).flatMap(op => {
      const base = {
        'Correlativo OPCI': op.correlativo_opci, 'N° OP': op.numero_op ?? '',
        'Estado': op.estado, 'Fecha Recepción': op.fecha_recepcion ?? '',
        'Proyecto': op.nombre_proyecto ?? '', 'Forma de Pago': op.forma_pago ?? '',
        'Cliente': op.cliente?.razon_social ?? '',
      }
      const items = op.items ?? []
      if (!items.length) return [{ ...base, 'Ítem OP': '', 'Código': '', 'Descripción': '', 'Cantidad': '', 'UM': '', 'Estado Ítem': '' }]
      return items.map(i => ({ ...base, 'Ítem OP': i.item_op ?? '', 'Código': i.codigo_comercial ?? '', 'Descripción': i.descripcion ?? '', 'Cantidad': i.cantidad ?? '', 'UM': i.unidad_medida ?? '', 'Estado Ítem': i.estado ?? '' }))
    })
    downloadCsv(`operaciones_${new Date().toISOString().slice(0, 10)}`, rows)
    setExporting(false)
  }

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
      key: '_act', label: '', width: 88,
      render: r => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEdit(r) }} title="Editar">
            <Icon name="edit" size={12} />
          </button>
          <button className="btn ghost xs" style={{ color: 'var(--bad)' }} onClick={e => { e.stopPropagation(); setDeleteRow(r) }} title="Eliminar">
            <Icon name="trash" size={12} />
          </button>
          <button className="btn ghost xs" onClick={e => { e.stopPropagation(); navigate(`/operaciones/${r.id}`) }} title="Ver detalle">
            <Icon name="chevron" size={12} />
          </button>
        </div>
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
          <button className="btn sm" onClick={handleExport} disabled={exporting}><Icon name="download" size={13} /> {exporting ? 'Exportando…' : 'Exportar'}</button>
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

      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title="Editar Operación"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setEditRow(null)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEdit} disabled={savingEdit}>
              {savingEdit ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Estado</label>
            <select className="select" value={editForm.estado} onChange={e => setEditForm(f => ({ ...f, estado: e.target.value as EstadoOPCI }))} style={{ width: '100%' }}>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Fecha recepción</label>
            <input type="date" className="input" value={editForm.fecha_recepcion} onChange={e => setEditForm(f => ({ ...f, fecha_recepcion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">N° OP cliente</label>
            <input className="input" value={editForm.numero_op} onChange={e => setEditForm(f => ({ ...f, numero_op: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Forma de pago</label>
            <input className="input" value={editForm.forma_pago} onChange={e => setEditForm(f => ({ ...f, forma_pago: e.target.value }))} style={{ width: '100%' }} />
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteRow}
        onClose={() => { setDeleteRow(null); setDeleteError(null) }}
        title="Eliminar Operación"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => { setDeleteRow(null); setDeleteError(null) }}>Cancelar</button>
            <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={handleDelete} disabled={deletingRow}>
              {deletingRow ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5 }}>
          ¿Eliminar la operación <strong>{deleteRow?.correlativo_opci}</strong>? Esta acción no se puede deshacer.
        </p>
        {deleteError && (
          <p style={{ fontSize: 13, color: 'var(--bad)', marginTop: 8, marginBottom: 0 }}>{deleteError}</p>
        )}
      </Modal>

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
