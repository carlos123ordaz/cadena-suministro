import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Icon, Card, DataTable, StatusBadge, Badge, EtaCell, MetaGrid, Modal,
  OCL_STATUS_TONE, UploadDocumentoModal,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import {
  getOrdenCompraLocal,
  addFechaPrometida,
  updateOrdenCompraLocal,
} from '@/services/compras.service'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, money, truncate } from '@/lib/utils'
import type {
  OrdenCompraLocal, OrdenCompraLocalItem, ProveedorFechaHistorial,
  EstadoOCL, Producto, OrdenCompraNota, OperacionItem,
} from '@/types'

const OCL_STATES: EstadoOCL[] = [
  'Pendiente de cotización', 'Cotizado', 'OC emitida', 'Confirmado por proveedor',
  'En espera de entrega', 'Recibido parcial', 'Recibido completo',
  'Facturado por proveedor', 'Cerrado', 'Observado', 'Anulado',
]

const FORMAS_PAGO = [
  'Contado', 'Crédito 15 días', 'Crédito 30 días', 'Crédito 45 días',
  'Crédito 60 días', 'Crédito 90 días', 'Carta de crédito', 'Transferencia anticipada',
]

const UNIDADES_MEDIDA = ['UND', 'KG', 'M', 'M2', 'M3', 'L', 'GLN', 'PAR', 'SET', 'CAJA', 'ROLLO', 'HRS', 'TON', 'PZA']

interface OCLDetail extends OrdenCompraLocal {
  items: OrdenCompraLocalItem[]
  fechas_historial: ProveedorFechaHistorial[]
  notas_lista: OrdenCompraNota[]
}

export function ComprasLocalesDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [detail, setDetail] = useState<OCLDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [showUpload, setShowUpload] = useState(false)

  // Modal agregar ítem
  const [showAddItem, setShowAddItem] = useState(false)
  const [addItemSaving, setAddItemSaving] = useState(false)
  const [addItemError, setAddItemError] = useState<string | null>(null)
  const [addItemForm, setAddItemForm] = useState({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD', pcu1: '', operacion_item_id: '', opci_id: '' })
  const [productosSearch, setProductosSearch] = useState('')
  const [productosSugeridos, setProductosSugeridos] = useState<Producto[]>([])
  const [showProductosDrop, setShowProductosDrop] = useState(false)
  const productoDropRef = useRef<HTMLDivElement>(null)
  const [opciItems, setOpciItems] = useState<OperacionItem[]>([])
  const [opciSearch, setOpciSearch] = useState('')
  const [opciSugeridas, setOpciSugeridas] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [showOpciDrop, setShowOpciDrop] = useState(false)
  const opciDropRef = useRef<HTMLDivElement>(null)

  // Modal fecha prometida
  const [showFecha, setShowFecha] = useState(false)
  const [fechaForm, setFechaForm] = useState({ fecha_prometida: '', tipo: 'inicial' as 'inicial' | 'actualizacion', motivo: '' })
  const [fechaSaving, setFechaSaving] = useState(false)
  const [fechaError, setFechaError] = useState<string | null>(null)

  // Modal estado
  const [showEstado, setShowEstado] = useState(false)
  const [estadoForm, setEstadoForm] = useState<{ status: EstadoOCL; comentario: string }>({ status: 'OC emitida', comentario: '' })
  const [estadoSaving, setEstadoSaving] = useState(false)
  const [estadoError, setEstadoError] = useState<string | null>(null)

  // Modal agregar nota
  const [showNota, setShowNota] = useState(false)
  const [notaText, setNotaText] = useState('')
  const [notaSaving, setNotaSaving] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const { data } = await getOrdenCompraLocal(id)
    setDetail(data as OCLDetail | null)
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (productosSearch.length > 0 && productosSearch.length < 2) { setProductosSugeridos([]); return }
    if (productosSearch.length === 0) return
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from('productos')
        .select('id, codigo_comercial, descripcion, unidad_medida')
        .or(`codigo_comercial.ilike.%${productosSearch}%,descripcion.ilike.%${productosSearch}%`)
        .eq('activo', true)
        .eq('tipo', 'Producto')
        .limit(20)
      setProductosSugeridos((data ?? []) as Producto[])
    }, 250)
    return () => clearTimeout(t)
  }, [productosSearch])

  async function handleProductoFocus() {
    setShowProductosDrop(true)
    if (!productosSearch) {
      const { data } = await supabase
        .from('productos')
        .select('id, codigo_comercial, descripcion, unidad_medida')
        .eq('activo', true)
        .eq('tipo', 'Producto')
        .order('codigo_comercial')
        .limit(20)
      setProductosSugeridos((data ?? []) as Producto[])
    }
  }

  useEffect(() => {
    if (opciSearch.length > 0 && opciSearch.length < 2) { setOpciSugeridas([]); return }
    if (opciSearch.length === 0) return
    const t = setTimeout(async () => {
      const { data } = await supabase.from('operaciones')
        .select('id, correlativo_opci')
        .ilike('correlativo_opci', `%${opciSearch}%`)
        .not('estado', 'in', '("Cerrada","Anulada")')
        .order('correlativo_opci')
        .limit(20)
      setOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
      setShowOpciDrop(true)
    }, 250)
    return () => clearTimeout(t)
  }, [opciSearch])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (productoDropRef.current && !productoDropRef.current.contains(e.target as Node)) setShowProductosDrop(false)
      if (opciDropRef.current && !opciDropRef.current.contains(e.target as Node)) setShowOpciDrop(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleOpciFocus() {
    setShowOpciDrop(true)
    if (!opciSearch) {
      const { data } = await supabase.from('operaciones')
        .select('id, correlativo_opci')
        .not('estado', 'in', '("Cerrada","Anulada")')
        .order('correlativo_opci')
        .limit(20)
      setOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
    }
  }

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

  async function handleAddItem() {
    if (!id || !addItemForm.cantidad || !addItemForm.pcu1) {
      setAddItemError('Cantidad y precio unitario son obligatorios.')
      return
    }
    setAddItemSaving(true)
    setAddItemError(null)
    const cantidad = parseFloat(addItemForm.cantidad)
    const pcu1 = parseFloat(addItemForm.pcu1)
    const linkedItem = opciItems.find(i => i.id === addItemForm.operacion_item_id)
    const { error } = await supabase.from('orden_compra_items').insert({
      orden_compra_id: id,
      producto_id: addItemForm.producto_id || null,
      operacion_id: addItemForm.opci_id || null,
      operacion_item_id: addItemForm.operacion_item_id || null,
      item_oc: addItemForm.item_oc || null,
      item_op: linkedItem?.item_op || null,
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
    setAddItemForm({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD', pcu1: '', operacion_item_id: '', opci_id: '' })
    setProductosSearch('')
    load()
  }

  async function saveFecha() {
    if (!id || !profile) return
    if (!fechaForm.fecha_prometida) { setFechaError('La fecha es requerida.'); return }
    setFechaSaving(true)
    setFechaError(null)
    const { error } = await addFechaPrometida(id, fechaForm.fecha_prometida, fechaForm.tipo, fechaForm.motivo || undefined, profile.id)
    setFechaSaving(false)
    if (error) { setFechaError('No se pudo guardar.'); return }
    setShowFecha(false)
    setFechaForm({ fecha_prometida: '', tipo: 'inicial', motivo: '' })
    load()
  }

  async function saveEstado() {
    if (!id) return
    setEstadoSaving(true)
    setEstadoError(null)
    const { error } = await updateOrdenCompraLocal(id, { status: estadoForm.status })
    setEstadoSaving(false)
    if (error) { setEstadoError('No se pudo actualizar.'); return }
    setShowEstado(false)
    load()
  }

  async function saveNota() {
    if (!id || !profile || !notaText.trim()) return
    setNotaSaving(true)
    await supabase.from('ordenes_compra_notas').insert({
      orden_compra_id: id,
      nota: notaText.trim(),
      usuario_id: profile.id,
    })
    setNotaSaving(false)
    setShowNota(false)
    setNotaText('')
    load()
  }

  const itemColumns: Column<OrdenCompraLocalItem>[] = [
    { key: 'item_oc', label: 'Item OC', width: 60 },
    { key: 'item_op', label: 'Ítem OP', width: 70, render: r => r.item_op
      ? <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, fontSize: 11 }}>{r.item_op}</span>
      : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span> },
    { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono">{r.codigo_comercial}</span> },
    { key: 'descripcion', label: 'Descripción', render: r => <span title={r.descripcion}>{r.descripcion}</span> },
    { key: 'cantidad', label: 'Cant / UM', render: r => <span className="mono">{r.cantidad} {r.unidad_medida}</span> },
    { key: 'pcu1', label: 'P.U.', align: 'right', render: r => <span className="mono">{money(r.pcu1, r.moneda)}</span> },
    { key: 'monto_total', label: 'Total', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{money(r.monto_total, r.moneda)}</span> },
  ]

  if (loading) {
    return (
      <div className="page">
        <div className="loading-row" style={{ padding: 80 }}>
          <Icon name="spinner" size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Cargando…</span>
        </div>
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="page">
        <button className="btn ghost xs" onClick={() => navigate('/compras-locales')} style={{ marginBottom: 16 }}>
          <Icon name="arrowLeft" size={12} /> Compras locales
        </button>
        <div className="empty-state"><Icon name="warning" size={28} className="empty-icon" /><div className="empty-title">OC no encontrada</div></div>
      </div>
    )
  }

  return (
    <div className="page">
      <button className="btn ghost xs" onClick={() => navigate('/compras-locales')} style={{ marginBottom: 12 }}>
        <Icon name="arrowLeft" size={12} /> Compras locales
      </button>

      {/* Header */}
      <div className="detail-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="detail-title">
              <span className="corr">{detail.num_oc}</span>
              <span>{detail.proveedor?.razon_social}</span>
            </h1>
            <div className="detail-meta">
              <StatusBadge status={detail.status} mapping={OCL_STATUS_TONE} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn sm" onClick={() => { setShowEstado(true); setEstadoForm({ status: detail.status, comentario: '' }) }}>
              <Icon name="refresh" size={13} /> Cambiar estado
            </button>
            <button className="btn sm" onClick={() => setShowUpload(true)}>
              <Icon name="paperclip" size={13} /> Adjuntar
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Datos generales */}
        <Card title="Datos de la OC" icon="cart">
          <MetaGrid cols={3} fields={[
            { label: 'N° OC', value: detail.num_oc, mono: true },
            { label: 'Proveedor', value: detail.proveedor?.razon_social },
            { label: 'Estado', value: <StatusBadge status={detail.status} mapping={OCL_STATUS_TONE} /> },
            { label: 'Fecha emisión', value: fmtDate(detail.fecha_oc), mono: true },
            { label: 'Forma de pago', value: detail.forma_pago },
            { label: 'T/E semanas', value: detail.t_e_semanas != null ? `${detail.t_e_semanas} sem` : null },
            { label: 'N° Cotización prov.', value: detail.num_cotizacion_proveedor, mono: true },
            { label: 'N° Confirmación prov.', value: detail.num_confirmacion_proveedor, mono: true },
            { label: 'Fecha ofrecida', value: detail.fecha_ofrecida ? <EtaCell eta={detail.fecha_ofrecida} pastBad /> : null },
            { label: 'N° Factura prov.', value: detail.numero_factura_proveedor, mono: true },
            { label: 'Fecha factura', value: fmtDate(detail.fecha_factura_prov), mono: true },
            { label: 'Monto total', value: money(detail.monto_total, detail.moneda), mono: true },
          ]} />
        </Card>

        {/* Ítems */}
        <Card title={`Ítems (${detail.items?.length ?? 0})`} icon="box" padding={false}
          actions={<button className="btn primary xs" onClick={() => {
            setAddItemError(null)
            setOpciItems([])
            setOpciSearch('')
            setOpciSugeridas([])
            setShowAddItem(true)
          }}><Icon name="plus" size={11} /> Agregar ítem</button>}>
          <DataTable
            columns={itemColumns as unknown as Column<Record<string, unknown>>[]}
            rows={(detail.items ?? []) as unknown as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin ítems registrados"
          />
        </Card>

        {/* Historial de fechas prometidas */}
        <Card title="Historial de fechas prometidas" icon="clock"
          actions={<button className="btn xs" onClick={() => { setFechaForm({ fecha_prometida: '', tipo: 'inicial', motivo: '' }); setFechaError(null); setShowFecha(true) }}><Icon name="plus" size={11} /> Registrar</button>}>
          {(detail.fechas_historial ?? []).length === 0 ? (
            <div className="empty-state" style={{ padding: '16px 0' }}><span className="muted tiny">Sin fechas registradas</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {detail.fechas_historial.map(fh => (
                <div key={fh.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 6, borderLeft: '3px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Badge tone={fh.tipo === 'inicial' ? 'info' : 'warn'}>{fh.tipo === 'inicial' ? 'Inicial' : 'Actualización'}</Badge>
                    <span className="mono" style={{ fontSize: 12.5 }}>{fmtDate(fh.fecha_prometida)}</span>
                  </div>
                  {fh.motivo && <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{fh.motivo}</span>}
                  <span className="tiny muted">{fh.usuario?.nombre_completo ?? '—'} · {fmtDate(fh.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Notas */}
        <Card title={`Notas (${detail.notas_lista?.length ?? 0})`} icon="comment"
          actions={<button className="btn xs" onClick={() => { setNotaText(''); setShowNota(true) }}><Icon name="plus" size={11} /> Agregar nota</button>}>
          {detail.notas && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>
              <span className="tiny muted" style={{ display: 'block', marginBottom: 4 }}>Nota original:</span>
              {detail.notas}
            </div>
          )}
          {(detail.notas_lista ?? []).length === 0 && !detail.notas ? (
            <div className="empty-state" style={{ padding: '16px 0' }}><span className="muted tiny">Sin notas registradas</span></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(detail.notas_lista ?? []).map(n => (
                <div key={n.id} style={{ padding: '8px 12px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>{n.nota}</div>
                  <div className="tiny muted" style={{ marginTop: 4 }}>{(n.usuario as { nombre_completo?: string } | undefined)?.nombre_completo ?? '—'} · {fmtDate(n.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal: Agregar ítem */}
      <Modal open={showAddItem} onClose={() => { setShowAddItem(false); setProductosSearch(''); setProductosSugeridos([]); setOpciSearch(''); setOpciSugeridas([]) }}
        title="Agregar ítem a la OC" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowAddItem(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddItem} disabled={addItemSaving || !addItemForm.cantidad || !addItemForm.pcu1}>
              {addItemSaving ? 'Guardando…' : 'Agregar ítem'}
            </button>
          </>
        }>
        {addItemError && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{addItemError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* OPCI search → ítem de esa OPCI */}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Ítem OPCI que origina esta compra</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: '0 0 200px', position: 'relative' }} ref={opciDropRef}>
                <input
                  className="input"
                  value={opciSearch}
                  onChange={e => {
                    setOpciSearch(e.target.value)
                    if (!e.target.value) {
                      setAddItemForm(f => ({ ...f, opci_id: '', operacion_item_id: '' }))
                      setOpciItems([])
                    }
                  }}
                  onFocus={handleOpciFocus}
                  placeholder="Buscar OPCI…"
                  style={{ width: '100%' }}
                />
                {showOpciDrop && opciSugeridas.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 200, overflowY: 'auto' }}>
                    {opciSugeridas.map(o => (
                      <div key={o.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
                        onMouseDown={() => {
                          setOpciSearch(o.correlativo_opci)
                          setAddItemForm(f => ({ ...f, opci_id: o.id, operacion_item_id: '' }))
                          setOpciItems([])
                          setShowOpciDrop(false)
                          supabase.from('operacion_items')
                            .select('id, item_op, codigo_comercial, descripcion, cantidad, unidad_medida, producto_id')
                            .eq('operacion_id', o.id).order('item_op')
                            .then(({ data }) => setOpciItems((data ?? []) as unknown as OperacionItem[]))
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{o.correlativo_opci}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {opciItems.length > 0 && (
                <select
                  className="select"
                  value={addItemForm.operacion_item_id}
                  onChange={e => {
                    const sel = opciItems.find(i => i.id === e.target.value)
                    setAddItemForm(f => ({
                      ...f,
                      operacion_item_id: e.target.value,
                      ...(sel ? {
                        descripcion: sel.descripcion,
                        codigo_comercial: sel.codigo_comercial,
                        unidad_medida: sel.unidad_medida,
                        producto_id: sel.producto_id ?? '',
                      } : {}),
                    }))
                    if (sel?.codigo_comercial) setProductosSearch(sel.codigo_comercial)
                  }}
                  style={{ flex: 1 }}
                >
                  <option value="">— Seleccionar ítem —</option>
                  {opciItems.map(i => (
                    <option key={i.id} value={i.id}>{i.item_op} · {i.codigo_comercial} ({i.cantidad} {i.unidad_medida})</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          {/* Búsqueda de producto */}
          <div className="form-field" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={productoDropRef}>
            <label className="form-label">Buscar producto por código comercial *</label>
            <input
              className="input"
              value={productosSearch}
              onChange={e => { setProductosSearch(e.target.value); setShowProductosDrop(true) }}
              onFocus={handleProductoFocus}
              placeholder="Escribe código comercial o descripción…"
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
            <label className="form-label">Unidad de medida</label>
            <input
              list="umd-ocl"
              className="input"
              value={addItemForm.unidad_medida}
              onChange={e => setAddItemForm(f => ({ ...f, unidad_medida: e.target.value }))}
              placeholder="UND, KG, M…"
              style={{ width: '100%' }}
            />
            <datalist id="umd-ocl">
              {UNIDADES_MEDIDA.map(u => <option key={u} value={u} />)}
            </datalist>
          </div>
          <div className="form-field">
            <label className="form-label">Cantidad *</label>
            <input type="number" className="input" value={addItemForm.cantidad} onChange={e => setAddItemForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={addItemForm.moneda} onChange={e => setAddItemForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              {['USD', 'PEN', 'EUR'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Precio unitario *</label>
            <input type="number" className="input" value={addItemForm.pcu1} onChange={e => setAddItemForm(f => ({ ...f, pcu1: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          {addItemForm.cantidad && addItemForm.pcu1 && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
              <span className="muted">Total: </span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {(parseFloat(addItemForm.cantidad || '0') * parseFloat(addItemForm.pcu1 || '0')).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {addItemForm.moneda}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal: Fecha prometida */}
      <Modal open={showFecha} onClose={() => setShowFecha(false)} title="Registrar fecha prometida" size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={() => setShowFecha(false)}>Cancelar</button>
            <button className="btn primary sm" onClick={saveFecha} disabled={fechaSaving}>{fechaSaving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Fecha prometida</label>
            <input className="input" type="date" value={fechaForm.fecha_prometida} onChange={e => setFechaForm(f => ({ ...f, fecha_prometida: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Tipo</label>
            <select className="select" value={fechaForm.tipo} onChange={e => setFechaForm(f => ({ ...f, tipo: e.target.value as 'inicial' | 'actualizacion' }))} style={{ width: '100%' }}>
              <option value="inicial">Inicial</option>
              <option value="actualizacion">Actualización</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Motivo / observación</label>
            <textarea className="input" rows={3} placeholder="Opcional…" value={fechaForm.motivo} onChange={e => setFechaForm(f => ({ ...f, motivo: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          {fechaError && <div style={{ padding: '7px 10px', background: 'var(--bad-soft)', borderRadius: 6, fontSize: 12 }}>{fechaError}</div>}
        </div>
      </Modal>

      {/* Modal: Cambiar estado */}
      <Modal open={showEstado} onClose={() => setShowEstado(false)} title="Actualizar estado" size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={() => setShowEstado(false)}>Cancelar</button>
            <button className="btn primary sm" onClick={saveEstado} disabled={estadoSaving}>{estadoSaving ? 'Guardando…' : 'Actualizar'}</button>
          </div>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Nuevo estado</label>
            <select className="select" value={estadoForm.status} onChange={e => setEstadoForm(f => ({ ...f, status: e.target.value as EstadoOCL }))} style={{ width: '100%' }}>
              {OCL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {estadoError && <div style={{ padding: '7px 10px', background: 'var(--bad-soft)', borderRadius: 6, fontSize: 12 }}>{estadoError}</div>}
        </div>
      </Modal>

      {/* Modal: Agregar nota */}
      <Modal open={showNota} onClose={() => setShowNota(false)} title="Agregar nota" size="sm"
        footer={
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn sm" onClick={() => setShowNota(false)}>Cancelar</button>
            <button className="btn primary sm" onClick={saveNota} disabled={notaSaving || !notaText.trim()}>{notaSaving ? 'Guardando…' : 'Guardar nota'}</button>
          </div>
        }>
        <div className="form-field">
          <label className="form-label">Nota</label>
          <textarea className="input" rows={4} value={notaText} onChange={e => setNotaText(e.target.value)} style={{ width: '100%', resize: 'vertical' }} placeholder="Escribe la nota…" />
        </div>
      </Modal>

      {profile && id && (
        <UploadDocumentoModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          entidadTipo="orden_compra_local"
          entidadId={id}
          userId={profile.id}
          onUploaded={load}
        />
      )}
    </div>
  )
}
