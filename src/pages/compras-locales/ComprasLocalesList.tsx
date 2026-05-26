import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Icon,
  Badge,
  StatusBadge,
  DataTable,
  Modal,
  EtaCell,
  OCL_STATUS_TONE,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import {
  getOrdenesCompraLocal,
  createOrdenCompraLocal,
} from '@/services/compras.service'
import { ProveedorCombobox } from '@/components/ui'
import type { ProveedorOption } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import type { OrdenCompraLocal, EstadoOCL } from '@/types'
import { money, truncate, fmtDbError } from '@/lib/utils'
import { downloadCsv } from '@/lib/export'

const FORMAS_PAGO_COMBO = [
  'Contado',
  'Crédito 15 días',
  'Crédito 30 días',
  'Crédito 45 días',
  'Crédito 60 días',
  'Crédito 90 días',
  'Carta de crédito',
  'Transferencia anticipada',
]

const OCL_STATES: EstadoOCL[] = [
  'Pendiente de cotización',
  'Cotizado',
  'OC emitida',
  'Confirmado por proveedor',
  'En espera de entrega',
  'Recibido parcial',
  'Recibido completo',
  'Facturado por proveedor',
  'Cerrado',
  'Observado',
  'Anulado',
]

export function ComprasLocalesList() {
  const navigate = useNavigate()

  // ── List state ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<OrdenCompraLocal[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoOCL | ''>('')
  const [filterProveedor, setFilterProveedor] = useState('')

  // ── Modal: Editar OC ──────────────────────────────────────────────────
  const [editRow, setEditRow] = useState<OrdenCompraLocal | null>(null)
  const [editFormProv, setEditFormProv] = useState<ProveedorOption | null>(null)
  const [editForm, setEditForm] = useState({
    num_oc: '', fecha_oc: '', moneda: 'USD', monto_total: '', status: '' as EstadoOCL | '',
    num_cotizacion_proveedor: '', fecha_ofrecida: '', forma_pago: '', notas: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)

  function openEdit(row: OrdenCompraLocal) {
    setEditFormProv(row.proveedor ? { id: row.proveedor_id, razon_social: row.proveedor.razon_social } : null)
    setEditForm({
      num_oc: row.num_oc ?? '',
      fecha_oc: row.fecha_oc ?? '',
      moneda: row.moneda ?? 'USD',
      monto_total: row.monto_total?.toString() ?? '',
      status: row.status,
      num_cotizacion_proveedor: row.num_cotizacion_proveedor ?? '',
      fecha_ofrecida: row.fecha_ofrecida ?? '',
      forma_pago: row.forma_pago ?? '',
      notas: row.notas ?? '',
    })
    setEditRow(row)
  }

  async function handleSaveEdit() {
    if (!editRow) return
    setSavingEdit(true)
    await supabase.from('ordenes_compra').update({
      proveedor_id: editFormProv?.id ?? editRow.proveedor_id,
      num_oc: editForm.num_oc || undefined,
      fecha_oc: editForm.fecha_oc || undefined,
      moneda: editForm.moneda,
      monto_total: parseFloat(editForm.monto_total) || 0,
      status: editForm.status || undefined,
      num_cotizacion_proveedor: editForm.num_cotizacion_proveedor || null,
      fecha_ofrecida: editForm.fecha_ofrecida || null,
      forma_pago: editForm.forma_pago || null,
      notas: editForm.notas || null,
    }).eq('id', editRow.id)
    setSavingEdit(false)
    setEditRow(null)
    loadList()
  }

  // ── Modal: Eliminar OC ────────────────────────────────────────────────
  const [deleteRow, setDeleteRow] = useState<OrdenCompraLocal | null>(null)
  const [deletingRow, setDeletingRow] = useState(false)

  async function handleDelete() {
    if (!deleteRow) return
    setDeletingRow(true)
    await supabase.from('ordenes_compra').delete().eq('id', deleteRow.id)
    setDeletingRow(false)
    setDeleteRow(null)
    loadList()
  }

  // ── Modal: Crear OC ───────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [createFormProv, setCreateFormProv] = useState<ProveedorOption | null>(null)
  const [createForm, setCreateForm] = useState({
    num_oc: '',
    fecha_oc: new Date().toISOString().slice(0, 10),
    moneda: 'USD',
    monto_total: '',
    forma_pago: '',
    num_cotizacion_proveedor: '',
    notas: '',
  })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // ── Create OC ─────────────────────────────────────────────────────────
  async function handleCreateOCL() {
    if (!createFormProv || !createForm.num_oc || !createForm.fecha_oc) {
      setCreateError('Proveedor, N° OC y fecha son obligatorios.')
      return
    }
    setCreateSaving(true)
    setCreateError(null)
    const { data, error } = await createOrdenCompraLocal(
      {
        proveedor_id: createFormProv.id,
        num_oc: createForm.num_oc,
        fecha_oc: createForm.fecha_oc,
        moneda: createForm.moneda as 'USD' | 'PEN' | 'EUR',
        monto_total: parseFloat(createForm.monto_total) || 0,
        forma_pago: createForm.forma_pago || undefined,
        num_cotizacion_proveedor: createForm.num_cotizacion_proveedor || undefined,
        notas: createForm.notas || undefined,
        status: 'Pendiente de cotización',
      },
      [],
    )
    setCreateSaving(false)
    if (error) {
      setCreateError(fmtDbError(error, 'Error al crear la OC.'))
      return
    }
    setShowCreate(false)
    setCreateFormProv(null)
    setCreateForm({
      num_oc: '',
      fecha_oc: new Date().toISOString().slice(0, 10),
      moneda: 'USD',
      monto_total: '',
      forma_pago: '',
      num_cotizacion_proveedor: '',
      notas: '',
    })
    if (data?.id) {
      navigate(`/compras-locales/${data.id}`)
    } else {
      loadList()
    }
  }

  async function handleExport() {
    setExporting(true)
    let query = supabase
      .from('ordenes_compra')
      .select('num_oc, status, fecha_oc, forma_pago, moneda, proveedor:proveedores(razon_social), items:orden_compra_items(item_oc, item_op, codigo_comercial, descripcion, cantidad, unidad_medida, pcu1, monto_total, operacion:operaciones(correlativo_opci))')
      .eq('tipo', 'Local')
      .order('created_at', { ascending: false })
    if (search) query = (query as typeof query).ilike('num_oc', `%${search}%`)
    if (filterEstado) query = (query as typeof query).eq('status', filterEstado)
    const { data } = await query
    type Item = { item_oc?: string; item_op?: string; codigo_comercial?: string; descripcion?: string; cantidad?: number; unidad_medida?: string; pcu1?: number; monto_total?: number; operacion?: { correlativo_opci: string } }
    type OC = { num_oc: string; status: string; fecha_oc?: string; forma_pago?: string; moneda?: string; proveedor?: { razon_social: string }; items?: Item[] }
    const rows = (data as unknown as OC[] ?? []).flatMap(oc => {
      const base = {
        'N° OC': oc.num_oc, 'Proveedor': oc.proveedor?.razon_social ?? '',
        'Estado': oc.status, 'Fecha OC': oc.fecha_oc ?? '',
        'Forma de Pago': oc.forma_pago ?? '', 'Moneda': oc.moneda ?? '',
      }
      const items = oc.items ?? []
      if (!items.length) return [{ ...base, 'OPCI': '', 'Ítem OC': '', 'Ítem OP': '', 'Código': '', 'Descripción': '', 'Cantidad': '', 'UM': '', 'P.U.': '', 'Total': '' }]
      return items.map(i => ({ ...base, 'OPCI': i.operacion?.correlativo_opci ?? '', 'Ítem OC': i.item_oc ?? '', 'Ítem OP': i.item_op ?? '', 'Código': i.codigo_comercial ?? '', 'Descripción': i.descripcion ?? '', 'Cantidad': i.cantidad ?? '', 'UM': i.unidad_medida ?? '', 'P.U.': i.pcu1 ?? '', 'Total': i.monto_total ?? '' }))
    })
    downloadCsv(`compras_locales_${new Date().toISOString().slice(0, 10)}`, rows)
    setExporting(false)
  }

  // ── Load list ─────────────────────────────────────────────────────────
  async function loadList() {
    setLoading(true)
    const { data, count } = await getOrdenesCompraLocal(
      { status: filterEstado || undefined, search: search || undefined },
      { page: 1, pageSize: 100 },
    )
    setRows(data ?? [])
    setTotal(count)
    setLoading(false)
  }

  useEffect(() => {
    loadList()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filterEstado])

  useEffect(() => {
    if (!showCreate) return
    supabase.from('ordenes_compra')
      .select('num_oc').eq('tipo', 'Local')
      .order('created_at', { ascending: false }).limit(1)
      .then(({ data }) => {
        if (data?.[0]?.num_oc) setCreateForm(f => ({ ...f, num_oc: data[0].num_oc }))
      })
  }, [showCreate])

  // ── Filtered rows (proveedor filter is client-side) ──────────────────
  const filtered = useMemo(() => {
    if (!filterProveedor) return rows
    const q = filterProveedor.toLowerCase()
    return rows.filter(r => (r.proveedor?.razon_social ?? '').toLowerCase().includes(q))
  }, [rows, filterProveedor])

  // ── Unique proveedores for select ─────────────────────────────────────
  const proveedores = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const r of rows) {
      const name = r.proveedor?.razon_social ?? ''
      if (name && !seen.has(name)) { seen.add(name); list.push(name) }
    }
    return list.sort()
  }, [rows])

  // ── Table columns ─────────────────────────────────────────────────────
  const columns: Column<OrdenCompraLocal>[] = [
    {
      key: 'num_oc',
      label: 'N° OC',
      sortable: true,
      width: 130,
      render: row => (
        <span
          className="mono"
          style={{ color: 'var(--accent)', fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); navigate(`/compras-locales/${row.id}`) }}
        >
          {row.num_oc}
        </span>
      ),
    },
    {
      key: 'fecha_oc',
      label: 'Fecha emisión',
      sortable: true,
      render: row => <span className="mono">{row.fecha_oc ?? '—'}</span>,
    },
    {
      key: 'proveedor',
      label: 'Proveedor',
      render: row => (
        <span title={row.proveedor?.razon_social}>
          {truncate(row.proveedor?.razon_social ?? '—', 28)}
        </span>
      ),
    },
    {
      key: 'operacion',
      label: 'OPCI',
      render: row => {
        const opId = row.operacion?.id
        const corr = row.operacion?.correlativo_opci
        if (!corr || !opId) return <span className="muted">—</span>
        return (
          <button
            className="btn ghost xs"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-2)', padding: '0 4px' }}
            onClick={e => { e.stopPropagation(); navigate(`/operaciones/${opId}`) }}
          >
            {corr}
          </button>
        )
      },
    },
    {
      key: 'monto_total',
      label: 'Monto',
      align: 'right',
      sortable: true,
      render: row => <span className="mono">{money(row.monto_total, row.moneda)}</span>,
    },
    {
      key: 't_e_semanas',
      label: 'T/E',
      align: 'right',
      width: 70,
      render: row =>
        row.t_e_semanas != null ? (
          <span className="mono muted">{row.t_e_semanas}s</span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'fecha_ofrecida',
      label: 'Fecha ofrecida',
      render: row => <EtaCell eta={row.fecha_ofrecida} pastBad />,
    },
    {
      key: 'num_confirmacion_proveedor',
      label: 'N° Confirmación prov.',
      render: row =>
        row.num_confirmacion_proveedor ? (
          <span className="mono">{row.num_confirmacion_proveedor}</span>
        ) : (
          <Badge tone="warn">Pendiente</Badge>
        ),
    },
    {
      key: 'numero_factura_proveedor',
      label: 'Factura prov.',
      render: row =>
        row.numero_factura_proveedor ? (
          <span className="mono">{row.numero_factura_proveedor}</span>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      key: 'status',
      label: 'Estado',
      render: row => <StatusBadge status={row.status} mapping={OCL_STATUS_TONE} />,
    },
    {
      key: '_actions', label: '', width: 64,
      render: row => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEdit(row) }} title="Editar">
            <Icon name="edit" size={12} />
          </button>
          <button className="btn ghost xs" style={{ color: 'var(--bad)' }} onClick={e => { e.stopPropagation(); setDeleteRow(row) }} title="Eliminar">
            <Icon name="trash" size={12} />
          </button>
        </div>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="page">
      {/* Header */}
      <div className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="page-title">Compras Locales</h1>
          <Badge tone="muted">{total}</Badge>
        </div>
        <div className="page-actions">
          <button className="btn sm" onClick={handleExport} disabled={exporting}><Icon name="download" size={13} /> {exporting ? 'Exportando…' : 'Exportar'}</button>
          <button className="btn primary sm" onClick={() => setShowCreate(true)}>
            <Icon name="plus" size={13} />
            Nueva OC
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="table-toolbar">
        <div className="input-wrap" style={{ flex: '1 1 260px', maxWidth: 320 }}>
          <Icon name="search" size={13} style={{ color: 'var(--text-3)' }} />
          <input
            className="input with-ico"
            placeholder="N° OC, proveedor, OPCI…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="select"
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as EstadoOCL | '')}
          style={{ flex: '0 0 200px' }}
        >
          <option value="">Todos los estados</option>
          {OCL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          className="select"
          value={filterProveedor}
          onChange={e => setFilterProveedor(e.target.value)}
          style={{ flex: '0 0 200px' }}
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="card-body no-pad">
          <DataTable
            columns={columns as unknown as Column<Record<string, unknown>>[]}
            rows={filtered as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            onRowClick={row => navigate(`/compras-locales/${row.id as string}`)}
            emptyMessage="No se encontraron órdenes de compra"
          />
        </div>
      </div>

      {/* Modal: Editar OC */}
      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title="Editar Orden de Compra"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setEditRow(null)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEdit} disabled={savingEdit || !editFormProv || !editForm.num_oc}>
              {savingEdit ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Proveedor *</label>
            <ProveedorCombobox value={editFormProv} onChange={setEditFormProv} tipo="Local" placeholder="Buscar proveedor local…" />
          </div>
          <div className="form-field">
            <label className="form-label">N° OC *</label>
            <input className="input" value={editForm.num_oc} onChange={e => setEditForm(f => ({ ...f, num_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha OC</label>
            <input type="date" className="input" value={editForm.fecha_oc} onChange={e => setEditForm(f => ({ ...f, fecha_oc: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={editForm.moneda} onChange={e => setEditForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              <option value="USD">USD</option>
              <option value="PEN">PEN</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto total</label>
            <input type="number" className="input" value={editForm.monto_total} onChange={e => setEditForm(f => ({ ...f, monto_total: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Estado</label>
            <select className="select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as EstadoOCL }))} style={{ width: '100%' }}>
              {OCL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Forma de pago</label>
            <select className="select" value={editForm.forma_pago} onChange={e => setEditForm(f => ({ ...f, forma_pago: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {FORMAS_PAGO_COMBO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">N° Cotización proveedor</label>
            <input className="input" value={editForm.num_cotizacion_proveedor} onChange={e => setEditForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha ofrecida</label>
            <input type="date" className="input" value={editForm.fecha_ofrecida} onChange={e => setEditForm(f => ({ ...f, fecha_ofrecida: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={editForm.notas} onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar eliminación OC */}
      <Modal
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Eliminar Orden de Compra"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setDeleteRow(null)}>Cancelar</button>
            <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={handleDelete} disabled={deletingRow}>
              {deletingRow ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5 }}>
          ¿Eliminar la OC <strong>{deleteRow?.num_oc}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Modal: Crear OC */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); setCreateError(null) }}
        title="Nueva Orden de Compra Local"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button
              className="btn primary"
              onClick={handleCreateOCL}
              disabled={createSaving || !createFormProv || !createForm.num_oc}
            >
              {createSaving ? 'Creando…' : 'Crear OC'}
            </button>
          </>
        }
      >
        {createError && (
          <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>
            {createError}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Proveedor *</label>
            <ProveedorCombobox value={createFormProv} onChange={setCreateFormProv} tipo="Local" placeholder="Buscar proveedor local…" />
          </div>
          <div className="form-field">
            <label className="form-label">N° OC *</label>
            <input className="input" value={createForm.num_oc} onChange={e => setCreateForm(f => ({ ...f, num_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="OC-2026-001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha OC *</label>
            <input type="date" className="input" value={createForm.fecha_oc} onChange={e => setCreateForm(f => ({ ...f, fecha_oc: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={createForm.moneda} onChange={e => setCreateForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              <option value="USD">USD</option>
              <option value="PEN">PEN</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto total</label>
            <input type="number" className="input" value={createForm.monto_total} onChange={e => setCreateForm(f => ({ ...f, monto_total: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Forma de pago</label>
            <select className="select" value={createForm.forma_pago} onChange={e => setCreateForm(f => ({ ...f, forma_pago: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {FORMAS_PAGO_COMBO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">N° Cotización proveedor</label>
            <input className="input" value={createForm.num_cotizacion_proveedor} onChange={e => setCreateForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={createForm.notas} onChange={e => setCreateForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
