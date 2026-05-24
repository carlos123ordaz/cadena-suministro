import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Icon,
  Badge,
  StatusBadge,
  DataTable,
  Drawer,
  Modal,
  EtaCell,
  MetaGrid,
  OCL_STATUS_TONE,
  UploadDocumentoModal,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import {
  getOrdenesCompraLocal,
  getOrdenCompraLocal,
  addFechaPrometida,
  updateOrdenCompraLocal,
  createOrdenCompraLocal,
} from '@/services/compras.service'
import { getProveedores } from '@/services/proveedores.service'
import { supabase } from '@/lib/supabase'
import type {
  OrdenCompraLocal,
  OrdenCompraLocalItem,
  ProveedorFechaHistorial,
  OrdenCompraNota,
  EstadoOCL,
  Producto,
} from '@/types'
import { fmtDate, money, truncate } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

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

const UNIDADES_MEDIDA = ['UND', 'KG', 'M', 'M2', 'M3', 'L', 'GLN', 'PAR', 'SET', 'CAJA', 'ROLLO', 'HRS', 'TON', 'PZA']

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

interface OCLDetail extends OrdenCompraLocal {
  items: OrdenCompraLocalItem[]
  fechas_historial: ProveedorFechaHistorial[]
  notas_lista?: OrdenCompraNota[]
}

export function ComprasLocalesList() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // ── List state ──────────────────────────────────────────────────────
  const [rows, setRows] = useState<OrdenCompraLocal[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoOCL | ''>('')
  const [filterProveedor, setFilterProveedor] = useState('')

  // ── Drawer state ─────────────────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<OCLDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // ── Modal: Registrar fecha prometida ─────────────────────────────────
  const [modalFechaOpen, setModalFechaOpen] = useState(false)
  const [fechaForm, setFechaForm] = useState({
    fecha_prometida: '',
    tipo: 'inicial' as 'inicial' | 'actualizacion',
    motivo: '',
  })
  const [fechaSaving, setFechaSaving] = useState(false)
  const [fechaError, setFechaError] = useState<string | null>(null)

  // ── Modal: Actualizar estado ──────────────────────────────────────────
  const [modalEstadoOpen, setModalEstadoOpen] = useState(false)
  const [estadoForm, setEstadoForm] = useState<{ status: EstadoOCL; comentario: string }>({
    status: 'OC emitida',
    comentario: '',
  })
  const [estadoSaving, setEstadoSaving] = useState(false)
  const [estadoError, setEstadoError] = useState<string | null>(null)

  // ── Modal: Crear OC ───────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false)
  const [opciList, setOpciList] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [proveedoresList, setProveedoresList] = useState<{ id: string; razon_social: string }[]>([])
  const [createForm, setCreateForm] = useState({ operacion_id: '', proveedor_id: '', num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10), moneda: 'USD', monto_total: '', forma_pago: '', notas: '' })
  const [showUpload, setShowUpload] = useState(false)
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  // ── Modal: Agregar ítem a OC ──────────────────────────────────────────
  const [showAddItem, setShowAddItem] = useState(false)
  const [addItemSaving, setAddItemSaving] = useState(false)
  const [addItemError, setAddItemError] = useState<string | null>(null)
  const [addItemForm, setAddItemForm] = useState({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD', pcu1: '' })
  const [productosSearch, setProductosSearch] = useState('')
  const [productosSugeridos, setProductosSugeridos] = useState<Producto[]>([])
  const [showProductosDrop, setShowProductosDrop] = useState(false)
  const productoDropRef = useRef<HTMLDivElement>(null)

  // ── Load OPCI + Proveedores for create form ───────────────────────────
  useEffect(() => {
    supabase.from('operaciones').select('id, correlativo_opci').not('estado', 'in', '("Cerrada","Anulada")').order('correlativo_opci')
      .then(({ data }) => setOpciList((data ?? []) as { id: string; correlativo_opci: string }[]))
    getProveedores().then(r => setProveedoresList((r.data ?? []).map(p => ({ id: p.id, razon_social: p.razon_social }))))
  }, [])

  // ── Búsqueda de productos para agregar ítem ────────────────────────────
  useEffect(() => {
    if (productosSearch.length < 2) { setProductosSugeridos([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('productos')
        .select('id, codigo_comercial, descripcion, unidad_medida')
        .or(`codigo_comercial.ilike.%${productosSearch}%,descripcion.ilike.%${productosSearch}%`)
        .eq('activo', true)
        .limit(20)
      setProductosSugeridos((data ?? []) as Producto[])
    }, 250)
    return () => clearTimeout(t)
  }, [productosSearch])

  function selectProducto(p: Producto) {
    setAddItemForm(f => ({
      ...f,
      producto_id: p.id,
      codigo_comercial: p.codigo_comercial,
      descripcion: p.descripcion,
      unidad_medida: p.unidad_medida ?? f.unidad_medida,
    }))
    setProductosSearch(p.codigo_comercial)
    setShowProductosDrop(false)
  }

  // ── Create OC ─────────────────────────────────────────────────────────
  async function handleCreateOCL() {
    if (!createForm.operacion_id || !createForm.proveedor_id || !createForm.num_oc || !createForm.fecha_oc) {
      setCreateError('OPCI, proveedor, N° OC y fecha son obligatorios.')
      return
    }
    setCreateSaving(true)
    setCreateError(null)
    const { error } = await createOrdenCompraLocal({
      operacion_id: createForm.operacion_id,
      proveedor_id: createForm.proveedor_id,
      num_oc: createForm.num_oc,
      fecha_oc: createForm.fecha_oc,
      moneda: createForm.moneda as 'USD' | 'PEN' | 'EUR',
      monto_total: parseFloat(createForm.monto_total) || 0,
      forma_pago: createForm.forma_pago || undefined,
      notas: createForm.notas || undefined,
      status: 'Pendiente de cotización',
    }, [])
    setCreateSaving(false)
    if (error) { setCreateError((error as Error)?.message ?? 'Error al crear la OC.'); return }
    setShowCreate(false)
    setCreateForm({ operacion_id: '', proveedor_id: '', num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10), moneda: 'USD', monto_total: '', forma_pago: '', notas: '' })
    loadList()
  }

  // ── Add item to OC ────────────────────────────────────────────────────
  async function handleAddItem() {
    if (!selectedId || !addItemForm.cantidad || !addItemForm.pcu1) {
      setAddItemError('Cantidad y precio unitario son obligatorios.')
      return
    }
    setAddItemSaving(true)
    setAddItemError(null)
    const cantidad = parseFloat(addItemForm.cantidad)
    const pcu1 = parseFloat(addItemForm.pcu1)
    const { error } = await supabase.from('orden_compra_items').insert({
      orden_compra_id: selectedId,
      producto_id: addItemForm.producto_id || null,
      item_oc: addItemForm.item_oc || null,
      codigo_comercial: addItemForm.codigo_comercial || null,
      descripcion: addItemForm.descripcion.trim() || null,
      cantidad,
      unidad_medida: addItemForm.unidad_medida || null,
      moneda: addItemForm.moneda || 'USD',
      pcu1,
      monto_total: cantidad * pcu1,
    })
    setAddItemSaving(false)
    if (error) { setAddItemError((error as Error).message ?? 'Error al guardar.'); return }
    setShowAddItem(false)
    setAddItemForm({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD', pcu1: '' })
    setProductosSearch('')
    const { data } = await getOrdenCompraLocal(selectedId)
    setDetail(data as OCLDetail | null)
  }

  // ── Load list ─────────────────────────────────────────────────────────
  async function loadList() {
    setLoading(true)
    const { data, count } = await getOrdenesCompraLocal(
      {
        status: filterEstado || undefined,
        search: search || undefined,
      },
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

  // ── Filtered rows (proveedor filter is client-side) ──────────────────
  const filtered = useMemo(() => {
    if (!filterProveedor) return rows
    const q = filterProveedor.toLowerCase()
    return rows.filter(r =>
      (r.proveedor?.razon_social ?? '').toLowerCase().includes(q),
    )
  }, [rows, filterProveedor])

  // ── Unique proveedores for select ─────────────────────────────────────
  const proveedores = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const r of rows) {
      const name = r.proveedor?.razon_social ?? ''
      if (name && !seen.has(name)) {
        seen.add(name)
        list.push(name)
      }
    }
    return list.sort()
  }, [rows])

  // ── Open drawer ───────────────────────────────────────────────────────
  async function openDrawer(row: OrdenCompraLocal) {
    setSelectedId(row.id)
    setDrawerOpen(true)
    setDetail(null)
    setDetailLoading(true)
    const { data } = await getOrdenCompraLocal(row.id)
    setDetail(data as OCLDetail | null)
    setDetailLoading(false)
  }

  function closeDrawer() {
    setDrawerOpen(false)
    setSelectedId(null)
    setDetail(null)
  }

  // ── Save fecha prometida ──────────────────────────────────────────────
  async function saveFecha() {
    if (!selectedId || !profile) return
    if (!fechaForm.fecha_prometida) {
      setFechaError('La fecha es requerida.')
      return
    }
    setFechaSaving(true)
    setFechaError(null)
    const { error } = await addFechaPrometida(
      selectedId,
      fechaForm.fecha_prometida,
      fechaForm.tipo,
      fechaForm.motivo || undefined,
      profile.id,
    )
    setFechaSaving(false)
    if (error) {
      setFechaError('No se pudo guardar. Intente nuevamente.')
      return
    }
    setModalFechaOpen(false)
    setFechaForm({ fecha_prometida: '', tipo: 'inicial', motivo: '' })
    // Refresh detail
    const { data } = await getOrdenCompraLocal(selectedId)
    setDetail(data as OCLDetail | null)
  }

  // ── Save estado ───────────────────────────────────────────────────────
  async function saveEstado() {
    if (!selectedId) return
    setEstadoSaving(true)
    setEstadoError(null)
    const { error } = await updateOrdenCompraLocal(selectedId, { status: estadoForm.status })
    setEstadoSaving(false)
    if (error) {
      setEstadoError('No se pudo actualizar. Intente nuevamente.')
      return
    }
    setModalEstadoOpen(false)
    await loadList()
    const { data } = await getOrdenCompraLocal(selectedId)
    setDetail(data as OCLDetail | null)
  }

  // ── Table columns ─────────────────────────────────────────────────────
  const columns: Column<OrdenCompraLocal>[] = [
    {
      key: 'num_oc',
      label: 'N° OC',
      sortable: true,
      width: 130,
      render: row => (
        <button
          className="btn ghost xs"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', padding: '0 4px' }}
          onClick={e => { e.stopPropagation(); openDrawer(row) }}
        >
          {row.num_oc}
        </button>
      ),
    },
    {
      key: 'fecha_oc',
      label: 'Fecha emisión',
      sortable: true,
      render: row => <span className="mono">{fmtDate(row.fecha_oc)}</span>,
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
  ]

  // ── Items columns (detail drawer) ─────────────────────────────────────
  const itemColumns: Column<OrdenCompraLocalItem>[] = [
    { key: 'item_oc', label: 'Item OC', width: 70 },
    { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono">{r.codigo_comercial}</span> },
    { key: 'descripcion', label: 'Descripción', render: r => <span title={r.descripcion}>{truncate(r.descripcion, 40)}</span> },
    {
      key: 'cantidad',
      label: 'Cant / UM',
      render: r => <span className="mono">{r.cantidad} {r.unidad_medida}</span>,
    },
    {
      key: 'pcu1',
      label: 'PU',
      align: 'right',
      render: r => <span className="mono">{money(r.pcu1, r.moneda)}</span>,
    },
    {
      key: 'monto_total',
      label: 'Total',
      align: 'right',
      render: r => <span className="mono">{money(r.monto_total, r.moneda)}</span>,
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
          {OCL_STATES.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          className="select"
          value={filterProveedor}
          onChange={e => setFilterProveedor(e.target.value)}
          style={{ flex: '0 0 200px' }}
        >
          <option value="">Todos los proveedores</option>
          {proveedores.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
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
            onRowClick={row => openDrawer(row as unknown as OrdenCompraLocal)}
            emptyMessage="No se encontraron órdenes de compra"
          />
        </div>
      </div>

      {/* Detail Drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={detail?.num_oc ?? 'Orden de Compra'}
        sub={detail?.proveedor?.razon_social}
        width={560}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => setShowUpload(true)}>
              <Icon name="paperclip" size={12} />
              Adjuntar
            </button>
            {selectedId && (
              <button className="btn sm" onClick={() => navigate(`/compras-locales/${selectedId}`)}>
                <Icon name="link" size={12} />
                Ver detalle completo
              </button>
            )}
            <button
              className="btn primary sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => {
                if (detail) setEstadoForm({ status: detail.status, comentario: '' })
                setModalEstadoOpen(true)
              }}
            >
              <Icon name="refresh" size={12} />
              Actualizar estado
            </button>
          </div>
        }
      >
        {detailLoading ? (
          <div className="loading-row" style={{ padding: 40 }}>
            <Icon name="spinner" size={14} style={{ animation: 'spin 1s linear infinite' }} />
            <span style={{ marginLeft: 8 }}>Cargando…</span>
          </div>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* 1. Status + OPCI reference */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <StatusBadge status={detail.status} mapping={OCL_STATUS_TONE} />
              {detail.operacion?.correlativo_opci && (
                <button
                  className="btn ghost xs"
                  style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-2)' }}
                  onClick={() => navigate(`/operaciones/${detail.operacion!.id}`)}
                >
                  <Icon name="link" size={11} />
                  {detail.operacion.correlativo_opci}
                </button>
              )}
            </div>

            {/* 2. MetaGrid */}
            <MetaGrid
              cols={2}
              fields={[
                { label: 'Proveedor', value: detail.proveedor?.razon_social },
                { label: 'Forma de pago', value: detail.forma_pago },
                { label: 'Fecha emisión', value: fmtDate(detail.fecha_oc), mono: true },
                { label: 'T/E semanas', value: detail.t_e_semanas != null ? `${detail.t_e_semanas} sem` : null },
                { label: 'Cotización prov.', value: detail.num_cotizacion_proveedor, mono: true },
                { label: 'Confirmación prov.', value: detail.num_confirmacion_proveedor, mono: true },
                { label: 'Factura prov.', value: detail.numero_factura_proveedor, mono: true },
                { label: 'Fecha factura', value: fmtDate(detail.fecha_factura_prov), mono: true },
              ]}
            />

            {/* 3. Items */}
            <div>
              <div className="card-head" style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                  Ítems
                </span>
                <Badge tone="muted">{detail.items.length}</Badge>
                <button className="btn xs" style={{ marginLeft: 'auto' }}
                  onClick={() => { setAddItemError(null); setShowAddItem(true) }}>
                  <Icon name="plus" size={11} /> Agregar
                </button>
              </div>
              <DataTable
                columns={itemColumns as unknown as Column<Record<string, unknown>>[]}
                rows={detail.items as unknown as Record<string, unknown>[]}
                idKey="id"
                density="compact"
                emptyMessage="Sin ítems"
              />
            </div>

            {/* 4. Historial de fechas prometidas */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                  Historial de fechas prometidas
                </span>
                <button
                  className="btn sm"
                  onClick={() => {
                    setFechaForm({ fecha_prometida: '', tipo: 'inicial', motivo: '' })
                    setFechaError(null)
                    setModalFechaOpen(true)
                  }}
                >
                  <Icon name="plus" size={11} />
                  Registrar
                </button>
              </div>
              {detail.fechas_historial.length === 0 ? (
                <div className="empty-state" style={{ padding: '16px 0' }}>
                  <span className="muted tiny">Sin fechas registradas</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {detail.fechas_historial.map(fh => (
                    <div
                      key={fh.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        padding: '8px 10px',
                        background: 'var(--surface-2)',
                        borderRadius: 6,
                        borderLeft: '3px solid var(--border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Badge tone={fh.tipo === 'inicial' ? 'info' : 'warn'}>
                          {fh.tipo === 'inicial' ? 'Inicial' : 'Actualización'}
                        </Badge>
                        <span className="mono" style={{ fontSize: 12.5 }}>
                          {fmtDate(fh.fecha_prometida)}
                        </span>
                      </div>
                      {fh.motivo && (
                        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fh.motivo}</span>
                      )}
                      <span className="tiny muted">
                        {fh.usuario?.nombre_completo ?? '—'} · {fmtDate(fh.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Notas */}
            {detail.notas && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
                  Notas
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                  {detail.notas}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 40 }}>
            <div className="empty-title">No se pudo cargar el detalle</div>
          </div>
        )}
      </Drawer>

      {/* Modal: Registrar fecha prometida */}
      <Modal
        open={modalFechaOpen}
        onClose={() => setModalFechaOpen(false)}
        title="Registrar fecha prometida"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={() => setModalFechaOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn primary sm"
              onClick={saveFecha}
              disabled={fechaSaving}
            >
              {fechaSaving ? (
                <>
                  <Icon name="spinner" size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Guardando…
                </>
              ) : 'Guardar'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Fecha prometida</label>
            <input
              className="input"
              type="date"
              value={fechaForm.fecha_prometida}
              onChange={e => setFechaForm(f => ({ ...f, fecha_prometida: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Tipo</label>
            <select
              className="select"
              value={fechaForm.tipo}
              onChange={e => setFechaForm(f => ({ ...f, tipo: e.target.value as 'inicial' | 'actualizacion' }))}
              style={{ width: '100%' }}
            >
              <option value="inicial">Inicial</option>
              <option value="actualizacion">Actualización</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Motivo / observación</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Opcional…"
              value={fechaForm.motivo}
              onChange={e => setFechaForm(f => ({ ...f, motivo: e.target.value }))}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          {fechaError && (
            <div style={{ padding: '7px 10px', background: 'var(--bad-soft)', borderRadius: 6, fontSize: 12 }}>
              {fechaError}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Crear OC */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Nueva Orden de Compra Local" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowCreate(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCreateOCL} disabled={createSaving || !createForm.operacion_id || !createForm.proveedor_id || !createForm.num_oc}>
              {createSaving ? 'Creando…' : 'Crear OC'}
            </button>
          </>
        }>
        {createError && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{createError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Operación OPCI *</label>
            <select className="select" value={createForm.operacion_id} onChange={e => setCreateForm(f => ({ ...f, operacion_id: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Seleccionar OPCI —</option>
              {opciList.map(o => <option key={o.id} value={o.id}>{o.correlativo_opci}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Proveedor *</label>
            <select className="select" value={createForm.proveedor_id} onChange={e => setCreateForm(f => ({ ...f, proveedor_id: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Seleccionar proveedor —</option>
              {proveedoresList.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
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
              <option value="USD">USD</option><option value="PEN">PEN</option><option value="EUR">EUR</option>
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
            <input className="input" value={(createForm as typeof createForm & { num_cotizacion_proveedor?: string }).num_cotizacion_proveedor ?? ''} onChange={e => setCreateForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={createForm.notas} onChange={e => setCreateForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {profile && selectedId && (
        <UploadDocumentoModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          entidadTipo="orden_compra_local"
          entidadId={selectedId}
          userId={profile.id}
          onUploaded={() => {
            if (selectedId) getOrdenCompraLocal(selectedId).then(r => setDetail(r.data as OCLDetail | null))
          }}
        />
      )}

      {/* Modal: Agregar ítem */}
      <Modal open={showAddItem} onClose={() => setShowAddItem(false)} title="Agregar ítem a la OC" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowAddItem(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddItem} disabled={addItemSaving || !addItemForm.descripcion.trim()}>
              {addItemSaving ? 'Guardando…' : 'Agregar ítem'}
            </button>
          </>
        }>
        {addItemError && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{addItemError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Búsqueda de producto */}
          <div className="form-field" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={productoDropRef}>
            <label className="form-label">Buscar producto por código comercial *</label>
            <input
              className="input"
              value={productosSearch}
              onChange={e => { setProductosSearch(e.target.value); setShowProductosDrop(true) }}
              onFocus={() => setShowProductosDrop(true)}
              placeholder="Escribe código comercial…"
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
            {showProductosDrop && productosSugeridos.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-md)', maxHeight: 200, overflowY: 'auto' }}>
                {productosSugeridos.map(p => (
                  <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }} onMouseDown={() => selectProducto(p)}>
                    <span className="mono" style={{ color: 'var(--accent-2)', marginRight: 8 }}>{p.codigo_comercial}</span>
                    <span style={{ fontSize: 12 }}>{truncate(p.descripcion, 40)}</span>
                    <Badge tone="muted" style={{ marginLeft: 8, fontSize: 10 }}>{p.unidad_medida}</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {addItemForm.descripcion && (
            <div style={{ gridColumn: '1 / -1', padding: '6px 10px', background: 'var(--accent-soft)', borderRadius: 6, fontSize: 12 }}>
              <span className="muted">Descripción: </span><strong>{addItemForm.descripcion}</strong>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Ítem OC</label>
            <input className="input" value={addItemForm.item_oc} onChange={e => setAddItemForm(f => ({ ...f, item_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="1, 2, 3…" />
          </div>
          <div className="form-field">
            <label className="form-label">Unidad de medida <span className="tiny muted">(autocomplete al seleccionar prod.)</span></label>
            <select className="select" value={addItemForm.unidad_medida} onChange={e => setAddItemForm(f => ({ ...f, unidad_medida: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Cantidad *</label>
            <input type="number" className="input" value={addItemForm.cantidad} onChange={e => setAddItemForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={addItemForm.moneda} onChange={e => setAddItemForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Precio unitario *</label>
            <input type="number" className="input" value={addItemForm.pcu1} onChange={e => setAddItemForm(f => ({ ...f, pcu1: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          {addItemForm.cantidad && addItemForm.pcu1 && (
            <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, display: 'flex', alignItems: 'center' }}>
              <span className="muted">Total: </span>
              <span className="mono" style={{ fontWeight: 600, marginLeft: 6 }}>
                {(parseFloat(addItemForm.cantidad || '0') * parseFloat(addItemForm.pcu1 || '0')).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {addItemForm.moneda}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Actualizar estado */}
      <Modal
        open={modalEstadoOpen}
        onClose={() => setModalEstadoOpen(false)}
        title="Actualizar estado"
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={() => setModalEstadoOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn primary sm"
              onClick={saveEstado}
              disabled={estadoSaving}
            >
              {estadoSaving ? (
                <>
                  <Icon name="spinner" size={12} style={{ animation: 'spin 1s linear infinite' }} />
                  Guardando…
                </>
              ) : 'Actualizar'}
            </button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Nuevo estado</label>
            <select
              className="select"
              value={estadoForm.status}
              onChange={e => setEstadoForm(f => ({ ...f, status: e.target.value as EstadoOCL }))}
              style={{ width: '100%' }}
            >
              {OCL_STATES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Comentario (opcional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Agregar comentario…"
              value={estadoForm.comentario}
              onChange={e => setEstadoForm(f => ({ ...f, comentario: e.target.value }))}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
          {estadoError && (
            <div style={{ padding: '7px 10px', background: 'var(--bad-soft)', borderRadius: 6, fontSize: 12 }}>
              {estadoError}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
