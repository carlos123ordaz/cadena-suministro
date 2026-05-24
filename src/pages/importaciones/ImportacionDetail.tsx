import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Icon, Card, DataTable, StatusBadge, OCI_STATUS_TONE, OPCI_STATUS_TONE,
  RECEPCION_STATUS_TONE, EtaCell, Tabs, Timeline, MetaGrid, Modal, Badge,
  UploadDocumentoModal,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { getImportacion, addCostoImportacion, calcularCostoUnitario } from '@/services/importaciones.service'
import { getDocumentos } from '@/services/documentos.service'
import { getComentarios, addComentario, registrarEvento, getHistorial } from '@/services/historial.service'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, fmtDateTime, money, initials, daysFrom } from '@/lib/utils'
import type { Importacion, CostoImportacion, TipoCosto, CriterioDistribucion, HistorialEvento, Comentario, DocumentoAdjunto, OrdenCompraNota } from '@/types'

const TABS = [
  { id: 'resumen',     label: 'Resumen' },
  { id: 'items',       label: 'Ítems OCI' },
  { id: 'docs',        label: 'Documentos' },
  { id: 'costos',      label: 'Costeo' },
  { id: 'recepcion',   label: 'Recepción' },
  { id: 'timeline',    label: 'Timeline' },
  { id: 'comentarios', label: 'Observaciones' },
]

const TIPOS_COSTO: TipoCosto[] = [
  'Flete internacional','Seguro','Aduanas','Agente de aduana',
  'Transporte local','Gastos portuarios','Almacenaje','IGV','Percepción','Otros gastos',
]

interface FullImportacion extends Importacion {
  ordenes?: Record<string, unknown>[]
  recepciones?: Record<string, unknown>[]
  costos?: CostoImportacion[]
}

interface CostoForm {
  tipo_costo: TipoCosto | ''
  descripcion: string
  moneda: 'USD' | 'PEN'
  monto: string
  tipo_cambio: string
  fecha: string
  criterio_distribucion: CriterioDistribucion
}

const defaultCostoForm: CostoForm = {
  tipo_costo: '', descripcion: '', moneda: 'USD', monto: '', tipo_cambio: '1', fecha: new Date().toISOString().slice(0, 10), criterio_distribucion: 'valor',
}

export function ImportacionDetail() {
  const { id: importacionId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [imp, setImp] = useState<FullImportacion | null>(null)
  const [historial, setHistorial] = useState<HistorialEvento[]>([])
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([])
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [distribucion, setDistribucion] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')

  const [showUpload, setShowUpload] = useState(false)

  const [showCosto, setShowCosto] = useState(false)
  const [costoForm, setCostoForm] = useState<CostoForm>(defaultCostoForm)
  const [savingCosto, setSavingCosto] = useState(false)

  const [nuevoComentario, setNuevoComentario] = useState('')

  const [showAddOci, setShowAddOci] = useState(false)
  const [savingOci, setSavingOci] = useState(false)
  const [ociError, setOciError] = useState<string | null>(null)
  const [opciList, setOpciList] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [proveedoresList, setProveedoresList] = useState<{ id: string; razon_social: string }[]>([])
  const [ociForm, setOciForm] = useState({ operacion_id: '', proveedor_id: '', num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10), moneda: 'USD', monto_total: '', notas: '' })

  const [selectedOci, setSelectedOci] = useState<Record<string, unknown> | null>(null)
  const [showOciDetail, setShowOciDetail] = useState(false)
  const [showOciAddItem, setShowOciAddItem] = useState(false)
  const [savingOciItem, setSavingOciItem] = useState(false)
  const [ociItemError, setOciItemError] = useState<string | null>(null)
  const [ociItemForm, setOciItemForm] = useState({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD', pcu1: '' })

  const [productosSearch, setProductosSearch] = useState('')
  const [productosSugeridos, setProductosSugeridos] = useState<{ id: string; codigo_comercial: string; descripcion: string; unidad_medida: string }[]>([])
  const [showProductosDrop, setShowProductosDrop] = useState(false)
  const productoDropRef = useRef<HTMLDivElement>(null)

  const [newOciNota, setNewOciNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [impRes, histRes, docRes, comRes] = await Promise.all([
      getImportacion(importacionId),
      getHistorial('importacion', importacionId),
      getDocumentos('importacion', importacionId),
      getComentarios('importacion', importacionId),
    ])
    setImp(impRes.data as FullImportacion | null)
    setHistorial(histRes.data ?? [])
    setDocumentos(docRes.data ?? [])
    setComentarios(comRes.data ?? [])
    setLoading(false)
  }, [importacionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!showAddOci) return
    supabase.from('operaciones').select('id, correlativo_opci').not('estado', 'in', '("Cerrada","Anulada")').order('correlativo_opci')
      .then(({ data }) => setOpciList((data ?? []) as { id: string; correlativo_opci: string }[]))
    supabase.from('proveedores').select('id, razon_social').eq('activo', true).order('razon_social')
      .then(({ data }) => setProveedoresList((data ?? []) as { id: string; razon_social: string }[]))
  }, [showAddOci])

  useEffect(() => {
    if (productosSearch.length < 2) { setProductosSugeridos([]); setShowProductosDrop(false); return }
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('productos').select('id, codigo_comercial, descripcion, unidad_medida')
        .ilike('codigo_comercial', `%${productosSearch}%`).eq('activo', true).limit(8)
      setProductosSugeridos((data ?? []) as { id: string; codigo_comercial: string; descripcion: string; unidad_medida: string }[])
      setShowProductosDrop(true)
    }, 250)
    return () => clearTimeout(timer)
  }, [productosSearch])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (productoDropRef.current && !productoDropRef.current.contains(e.target as Node)) {
        setShowProductosDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function selectProducto(p: { id: string; codigo_comercial: string; descripcion: string; unidad_medida: string }) {
    setOciItemForm(f => ({ ...f, producto_id: p.id, codigo_comercial: p.codigo_comercial, descripcion: p.descripcion, unidad_medida: p.unidad_medida }))
    setProductosSearch(p.codigo_comercial)
    setShowProductosDrop(false)
  }

  async function handleAddOci() {
    if (!ociForm.operacion_id || !ociForm.proveedor_id || !ociForm.num_oc || !ociForm.fecha_oc) {
      setOciError('OPCI, proveedor, N° OC y fecha son obligatorios.')
      return
    }
    setSavingOci(true)
    setOciError(null)
    const { error } = await supabase.from('ordenes_compra').insert({
      operacion_id: ociForm.operacion_id,
      proveedor_id: ociForm.proveedor_id,
      importacion_id: importacionId,
      tipo: 'Importacion',
      num_oc: ociForm.num_oc,
      fecha_oc: ociForm.fecha_oc,
      moneda: ociForm.moneda,
      monto_total: parseFloat(ociForm.monto_total) || 0,
      notas: ociForm.notas || null,
      status: 'Borrador',
    })
    setSavingOci(false)
    if (error) { setOciError((error as Error).message ?? 'Error al crear.'); return }
    setShowAddOci(false)
    setOciForm({ operacion_id: '', proveedor_id: '', num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10), moneda: 'USD', monto_total: '', notas: '' })
    load()
  }

  async function handleAddOciItem() {
    if (!selectedOci || !ociItemForm.descripcion.trim() || !ociItemForm.cantidad || !ociItemForm.pcu1) {
      setOciItemError('Descripción, cantidad y precio unitario son obligatorios.')
      return
    }
    setSavingOciItem(true)
    setOciItemError(null)
    const cantidad = parseFloat(ociItemForm.cantidad)
    const pcu1 = parseFloat(ociItemForm.pcu1)
    const { error } = await supabase.from('orden_compra_items').insert({
      orden_compra_id: selectedOci.id as string,
      producto_id: ociItemForm.producto_id || null,
      item_oc: ociItemForm.item_oc || null,
      codigo_comercial: ociItemForm.codigo_comercial || null,
      descripcion: ociItemForm.descripcion.trim(),
      cantidad,
      unidad_medida: ociItemForm.unidad_medida || null,
      moneda: ociItemForm.moneda || 'USD',
      pcu1,
      monto_total: cantidad * pcu1,
    })
    setSavingOciItem(false)
    if (error) { setOciItemError((error as Error).message ?? 'Error al guardar.'); return }
    setShowOciAddItem(false)
    setOciItemForm({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD', pcu1: '' })
    setProductosSearch('')
    // Reload full import to get updated items, then refresh selectedOci
    const impRes = await getImportacion(importacionId)
    if (impRes.data) {
      setImp(impRes.data as unknown as FullImportacion)
      const refreshed = (impRes.data.ordenes ?? []).find(o => (o as unknown as Record<string, unknown>).id === selectedOci?.id)
      if (refreshed) setSelectedOci(refreshed as unknown as Record<string, unknown>)
    }
  }

  async function handleAddOciNota() {
    if (!newOciNota.trim() || !selectedOci || !profile) return
    setSavingNota(true)
    const { data, error } = await supabase.from('ordenes_compra_notas').insert({
      orden_compra_id: selectedOci.id as string,
      nota: newOciNota.trim(),
      usuario_id: profile.id,
    }).select('*, usuario:profiles(nombre_completo)').single()
    setSavingNota(false)
    if (!error && data) {
      setSelectedOci(prev => prev ? {
        ...prev,
        notas_lista: [...((prev.notas_lista as unknown[]) ?? []), data as unknown],
      } : prev)
      setNewOciNota('')
    }
  }

  async function handleAddCosto() {
    if (!costoForm.tipo_costo || !costoForm.monto || !profile) return
    setSavingCosto(true)
    const monto = parseFloat(costoForm.monto)
    const tc = parseFloat(costoForm.tipo_cambio) || 1
    const montoUsd = costoForm.moneda === 'USD' ? monto : monto / tc
    await addCostoImportacion({
      importacion_id: importacionId,
      tipo_costo: costoForm.tipo_costo,
      descripcion: costoForm.descripcion || undefined,
      moneda: costoForm.moneda,
      monto,
      tipo_cambio: tc,
      monto_usd: montoUsd,
      criterio_distribucion: costoForm.criterio_distribucion,
      fecha: costoForm.fecha,
    } as Omit<CostoImportacion, 'id' | 'created_at' | 'updated_at'>)
    setSavingCosto(false)
    setShowCosto(false)
    setCostoForm(defaultCostoForm)
    load()
  }

  async function handleCalcDistribucion() {
    const res = await calcularCostoUnitario(importacionId)
    setDistribucion((res.data ?? []) as unknown as Record<string, unknown>[])
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-row" style={{ padding: 80 }}>
          <Icon name="spinner" size={18} style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      </div>
    )
  }

  if (!imp) {
    return (
      <div className="page">
        <button className="btn ghost xs" onClick={() => navigate('/importaciones')} style={{ marginBottom: 16 }}>← Importaciones</button>
        <div className="empty-state"><div className="empty-title">Importación no encontrada</div></div>
      </div>
    )
  }

  const costos = imp.costos ?? []
  const totalCostos = costos.reduce((a, c) => a + (c.monto_usd ?? 0), 0)

  const tabsWithCounts = TABS.map(t => {
    const m: Record<string, number> = { items: imp.ordenes?.length ?? 0, docs: documentos.length, costos: costos.length, comentarios: comentarios.length }
    return m[t.id] != null ? { ...t, count: m[t.id] } : t
  })

  const days = daysFrom(imp.eta)
  const etaTone = days < 0 ? 'bad' : days <= 3 ? 'warn' : 'info'

  return (
    <div className="page">
      <button className="btn ghost xs" onClick={() => navigate('/importaciones')} style={{ marginBottom: 12 }}>
        <Icon name="arrowLeft" size={12} /> Importaciones
      </button>

      <div className="detail-head">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <h1 className="detail-title">
              <span className="corr">{imp.grupo_importacion}</span>
              <span>{imp.operador_logistico}</span>
            </h1>
            <div className="detail-meta">
              <StatusBadge status={imp.status} mapping={OCI_STATUS_TONE} />
              {imp.incoterm && <Badge tone="muted">{imp.incoterm}</Badge>}
              {imp.tipo_embarque && <span className="detail-meta-item"><span className="muted">{imp.tipo_embarque}</span></span>}
              {imp.pais_origen && (
                <span className="detail-meta-item">
                  <Icon name="globe" size={12} style={{ color: 'var(--text-3)' }} />
                  {imp.pais_origen}
                </span>
              )}
              {imp.eta && (
                <span className="detail-meta-item">
                  <Icon name="clock" size={12} style={{ color: 'var(--text-3)' }} />
                  ETA: <EtaCell eta={imp.eta} />
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm" onClick={() => setShowCosto(true)}>
              <Icon name="plus" size={13} /> Agregar costo
            </button>
            <button className="btn sm" onClick={() => setShowUpload(true)}><Icon name="paperclip" size={13} /> Adjuntar</button>
          </div>
        </div>
      </div>

      <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

      {tab === 'resumen' && (
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
          <Card title="Datos del embarque" icon="ship">
            <MetaGrid cols={2} fields={[
              { label: 'Grupo importación',       value: imp.grupo_importacion, mono: true },
              { label: 'Operador logístico',       value: imp.operador_logistico },
              { label: 'Incoterm',                 value: imp.incoterm },
              { label: 'Tipo de embarque',         value: imp.tipo_embarque },
              { label: 'País de embarque',         value: imp.pais_embarque },
              { label: 'Ciudad de embarque',       value: imp.ciudad_embarque },
              { label: 'País de origen',           value: imp.pais_origen },
              { label: 'N° doc. transporte',       value: imp.numero_documento_transporte, mono: true },
              { label: 'ETA',                      value: fmtDate(imp.eta), mono: true },
              { label: 'Fecha arribo',             value: fmtDate(imp.fecha_arribo), mono: true },
              { label: 'Fecha nacionalización',    value: fmtDate(imp.fecha_nacionalizacion), mono: true },
              { label: 'Fecha recep. almacén',     value: fmtDate(imp.fecha_recepcion_almacen), mono: true },
              { label: 'Peso bruto (kg)',          value: imp.peso_bruto_kg?.toLocaleString('es-PE'), mono: true },
              { label: 'Flete (USD)',              value: imp.flete_usd ? money(imp.flete_usd, 'USD') : null, mono: true },
            ]} />
          </Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Card title="Resumen financiero" icon="coin">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12.5 }}>
                  <span style={{ color: 'var(--text-2)' }}>Costos registrados</span>
                  <span className="mono" style={{ fontWeight: 700, fontSize: 16 }}>{money(totalCostos, 'USD')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>Flete incluido</span>
                  <span className="mono">{money(imp.flete_usd ?? 0, 'USD')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>N° ítems OCI</span>
                  <span className="mono">{imp.ordenes?.length ?? 0}</span>
                </div>
              </div>
            </Card>
            {imp.observaciones && (
              <Card title="Observaciones" icon="warning">
                <p style={{ fontSize: 12.5, color: 'var(--text-2)', margin: 0 }}>{imp.observaciones}</p>
              </Card>
            )}
          </div>
        </div>
      )}

      {tab === 'items' && (
        <Card title="Ítems OCI asociados" icon="box" padding={false}
          actions={<button className="btn primary xs" onClick={() => { setOciError(null); setShowAddOci(true) }}><Icon name="plus" size={11} /> Nueva OCI</button>}>
          <DataTable
            columns={[
              { key: 'num_oc',        label: 'N° OC',  render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.num_oc as string}</span> },
              { key: 'operacion',     label: 'OPCI',   render: r => r.operacion ? (
                <button className="btn ghost xs" onClick={() => navigate(`/operaciones/${(r.operacion as {id: string}).id}`)}>
                  <span className="mono" style={{ color: 'var(--accent-2)' }}>{(r.operacion as {correlativo_opci: string}).correlativo_opci}</span>
                </button>
              ) : <span className="muted">—</span> },
              { key: 'proveedor',     label: 'Proveedor', render: r => <span>{(r.proveedor as {razon_social: string})?.razon_social ?? '—'}</span> },
              { key: 'num_invoice',   label: 'Invoice', render: r => <span className="mono">{r.num_invoice as string ?? '—'}</span> },
              { key: 'monto_total',   label: 'Monto', align: 'right', render: r => <span className="mono">{money(r.monto_total as number, r.moneda as string)}</span> },
              { key: 'eta',           label: 'ETA', render: r => <EtaCell eta={r.eta as string} /> },
              { key: 'status',        label: 'Estado', render: r => <StatusBadge status={r.status as string} mapping={OCI_STATUS_TONE} /> },
            ] as Column<Record<string, unknown>>[]}
            rows={(imp.ordenes ?? []) as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin órdenes de compra asociadas"
            onRowClick={row => { setSelectedOci(row); setOciItemError(null); setShowOciDetail(true) }}
          />
        </Card>
      )}

      {tab === 'docs' && (
        <Card title="Documentos adjuntos" icon="paperclip"
          actions={<button className="btn primary xs" onClick={() => setShowUpload(true)}><Icon name="upload" size={11} /> Subir</button>}>
          {documentos.length === 0 ? (
            <div className="empty-state">
              <Icon name="paperclip" size={28} className="empty-icon" />
              <div className="empty-title">Sin documentos</div>
              <div className="empty-sub">Sube Commercial Invoice, BL, AWB, Packing List u otros.</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {documentos.map(doc => (
                <div key={doc.id} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', background: 'var(--panel-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon name="doc" size={15} style={{ color: 'var(--info)' }} />
                    <Badge tone="muted">{doc.tipo_documento}</Badge>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{doc.nombre_archivo}</div>
                  <div className="tiny" style={{ marginTop: 4 }}>{fmtDate(doc.created_at)}</div>
                  <a href={doc.url_storage} target="_blank" rel="noopener noreferrer"
                    className="btn ghost xs" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                    <Icon name="download" size={11} /> Descargar
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === 'costos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div className="kpi">
              <div className="kpi-label">Total costos registrados</div>
              <div className="kpi-value">{money(totalCostos, 'USD')}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">N° ítems de costo</div>
              <div className="kpi-value">{costos.length}</div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Flete internacional</div>
              <div className="kpi-value">{money(costos.filter(c => c.tipo_costo === 'Flete internacional').reduce((a, c) => a + c.monto_usd, 0), 'USD')}</div>
            </div>
          </div>

          <Card title="Costos registrados" icon="coin" padding={false}
            actions={<button className="btn primary xs" onClick={() => setShowCosto(true)}><Icon name="plus" size={11} /> Agregar costo</button>}>
            <DataTable
              columns={[
                { key: 'tipo_costo',             label: 'Tipo', render: r => <Badge tone="info">{r.tipo_costo as string}</Badge> },
                { key: 'descripcion',            label: 'Descripción', render: r => <span className="muted">{r.descripcion as string ?? '—'}</span> },
                { key: 'moneda',                 label: 'Moneda', width: 60 },
                { key: 'monto',                  label: 'Monto', align: 'right', render: r => <span className="mono">{money(r.monto as number, r.moneda as string)}</span> },
                { key: 'tipo_cambio',            label: 'T/C', align: 'right', render: r => <span className="mono">{r.tipo_cambio as number ?? 1}</span> },
                { key: 'monto_usd',              label: 'USD', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{money(r.monto_usd as number, 'USD')}</span> },
                { key: 'criterio_distribucion',  label: 'Criterio', render: r => <Badge tone="muted">{r.criterio_distribucion as string}</Badge> },
                { key: 'fecha',                  label: 'Fecha', render: r => <span className="mono">{fmtDate(r.fecha as string)}</span> },
              ] as Column<Record<string, unknown>>[]}
              rows={costos as unknown as Record<string, unknown>[]}
              idKey="id"
              emptyMessage="Sin costos registrados"
            />
          </Card>

          {distribucion.length > 0 && (
            <Card title="Distribución por ítem" icon="layers" padding={false}>
              <DataTable
                columns={[
                  { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
                  { key: 'descripcion',      label: 'Descripción' },
                  { key: 'costo_producto',   label: 'Costo producto', align: 'right', render: r => <span className="mono">{money(r.costo_producto as number, 'USD')}</span> },
                  { key: 'costo_flete',      label: 'Flete asignado', align: 'right', render: r => <span className="mono">{money(r.costo_flete as number, 'USD')}</span> },
                  { key: 'otros_costos',     label: 'Otros costos', align: 'right', render: r => <span className="mono">{money(r.otros_costos as number, 'USD')}</span> },
                  { key: 'costo_total',      label: 'Total importado', align: 'right', render: r => <span className="mono" style={{ fontWeight: 700 }}>{money(r.costo_total as number, 'USD')}</span> },
                  { key: 'costo_unitario',   label: 'Costo unit.', align: 'right', render: r => <span className="mono" style={{ color: 'var(--accent)' }}>{money(r.costo_unitario as number, 'USD')}</span> },
                ]}
                rows={distribucion}
                idKey="codigo_comercial"
              />
            </Card>
          )}

          <div>
            <button className="btn sm" onClick={handleCalcDistribucion}>
              <Icon name="refresh" size={13} /> Calcular distribución de costos
            </button>
          </div>
        </div>
      )}

      {tab === 'recepcion' && (
        <Card title="Recepciones en almacén" icon="warehouse" padding={false}>
          <DataTable
            columns={[
              { key: 'codigo_comercial',  label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',       label: 'Descripción' },
              { key: 'cantidad_esperada', label: 'Esperada', align: 'right', render: r => <span className="mono">{r.cantidad_esperada as number}</span> },
              { key: 'cantidad_recibida', label: 'Recibida', align: 'right', render: r => <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{r.cantidad_recibida as number}</span> },
              { key: 'fecha_recepcion',   label: 'Fecha', render: r => <span className="mono">{fmtDate(r.fecha_recepcion as string)}</span> },
              { key: 'conf_almacen',      label: 'Conf. Almacén', render: r => r.conf_almacen ? <Badge tone={r.conf_almacen === 'Conforme' ? 'ok' : 'warn'}>{r.conf_almacen as string}</Badge> : <span className="muted">—</span> },
              { key: 'estado',            label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={RECEPCION_STATUS_TONE} /> },
            ] as Column<Record<string, unknown>>[]}
            rows={(imp.recepciones ?? []) as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin recepciones registradas"
          />
        </Card>
      )}

      {tab === 'timeline' && (
        <Card title="Timeline del embarque" icon="history">
          <Timeline eventos={historial} />
        </Card>
      )}

      {tab === 'comentarios' && (
        <Card title="Observaciones y comentarios" icon="comment">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comentarios.map(c => (
              <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 9, flexShrink: 0 }}>
                  {initials(c.usuario?.nombre_completo)}
                </span>
                <div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.usuario?.nombre_completo ?? 'Usuario'}</span>
                    <span className="tiny">{fmtDateTime(c.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-2)', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
                    {c.texto}
                  </div>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <label className="form-label">Agregar observación</label>
                <textarea className="input" rows={3} value={nuevoComentario}
                  onChange={e => setNuevoComentario(e.target.value)} style={{ width: '100%' }}
                  placeholder="Observación sobre la importación…" />
              </div>
              <button className="btn primary sm" onClick={async () => {
                if (!nuevoComentario.trim() || !profile) return
                await addComentario('importacion', importacionId, profile.id, nuevoComentario.trim())
                setNuevoComentario('')
                const r = await getComentarios('importacion', importacionId)
                setComentarios(r.data ?? [])
              }}>Agregar</button>
            </div>
          </div>
        </Card>
      )}

      {profile && (
        <UploadDocumentoModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          entidadTipo="importacion"
          entidadId={importacionId}
          userId={profile.id}
          onUploaded={() => {
            getDocumentos('importacion', importacionId).then(r => setDocumentos(r.data ?? []))
          }}
        />
      )}

      {/* Modal detalle OCI + ítems */}
      <Modal open={showOciDetail} onClose={() => setShowOciDetail(false)}
        title={`OCI ${selectedOci?.num_oc as string ?? ''}`}
        subtitle={(selectedOci?.proveedor as { razon_social: string })?.razon_social}
        size="lg"
        footer={<button className="btn" onClick={() => setShowOciDetail(false)}>Cerrar</button>}>
        {selectedOci && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12.5 }}>
              {[
                { label: 'N° OC', value: selectedOci.num_oc as string },
                { label: 'Moneda', value: selectedOci.moneda as string },
                { label: 'Monto total', value: `${(selectedOci.monto_total as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ${selectedOci.moneda as string}` },
                { label: 'Estado', value: selectedOci.status as string },
                { label: 'N° Invoice', value: (selectedOci.num_invoice as string) ?? '—' },
                { label: 'ETA', value: (selectedOci.eta as string) ?? '—' },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>{f.label}</div>
                  <div className="mono" style={{ fontWeight: 600 }}>{f.value ?? '—'}</div>
                </div>
              ))}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                  Ítems ({((selectedOci.items as unknown[]) ?? []).length})
                </span>
                <button className="btn primary xs" onClick={() => { setOciItemError(null); setOciItemForm({ item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: (selectedOci.moneda as string) ?? 'USD', pcu1: '' }); setProductosSearch(''); setShowOciAddItem(true) }}>
                  <Icon name="plus" size={11} /> Agregar ítem
                </button>
              </div>
              <DataTable
                columns={[
                  { key: 'item_oc',         label: 'Ítem', width: 60 },
                  { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string ?? '—'}</span> },
                  { key: 'descripcion',      label: 'Descripción' },
                  { key: 'cantidad',         label: 'Cant.', align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
                  { key: 'unidad_medida',    label: 'UM', width: 60 },
                  { key: 'pcu1',             label: 'Precio U.', align: 'right', render: r => <span className="mono">{(r.pcu1 as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} {r.moneda as string}</span> },
                  { key: 'monto_total',      label: 'Total', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{(r.monto_total as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} {r.moneda as string}</span> },
                ] as Column<Record<string, unknown>>[]}
                rows={((selectedOci.items as Record<string, unknown>[]) ?? [])}
                idKey="id"
                density="compact"
                emptyMessage="Sin ítems. Usa 'Agregar ítem' para añadir productos."
              />
            </div>

            {/* Notes section */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Notas ({((selectedOci.notas_lista as unknown[]) ?? []).length})
              </div>
              {selectedOci.notas && (
                <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, marginBottom: 8, color: 'var(--text-2)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 6 }}>Nota original:</span>
                  {selectedOci.notas as string}
                </div>
              )}
              {((selectedOci.notas_lista as OrdenCompraNota[]) ?? []).map((n, i) => (
                <div key={n.id ?? i} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)' }}>
                      {(n.usuario as { nombre_completo?: string } | undefined)?.nombre_completo ?? 'Usuario'}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{n.created_at ? new Date(n.created_at).toLocaleDateString('es-PE') : ''}</span>
                  </div>
                  <div style={{ color: 'var(--text-1)' }}>{n.nota}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  className="input"
                  value={newOciNota}
                  onChange={e => setNewOciNota(e.target.value)}
                  placeholder="Agregar nota…"
                  style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddOciNota() } }}
                />
                <button className="btn primary sm" onClick={handleAddOciNota} disabled={savingNota || !newOciNota.trim()}>
                  {savingNota ? '…' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal agregar ítem a OCI */}
      <Modal open={showOciAddItem} onClose={() => setShowOciAddItem(false)} title="Agregar ítem a la OCI" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowOciAddItem(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddOciItem} disabled={savingOciItem || !ociItemForm.descripcion.trim()}>
              {savingOciItem ? 'Guardando…' : 'Agregar ítem'}
            </button>
          </>
        }>
        {ociItemError && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{ociItemError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }} ref={productoDropRef}>
            <label className="form-label">Buscar producto (código comercial)</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                value={productosSearch}
                onChange={e => {
                  setProductosSearch(e.target.value)
                  if (!e.target.value) setOciItemForm(f => ({ ...f, producto_id: '', codigo_comercial: '', descripcion: '', unidad_medida: '' }))
                }}
                style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                placeholder="Escriba código comercial…"
              />
              {showProductosDrop && productosSugeridos.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 220, overflowY: 'auto' }}>
                  {productosSugeridos.map(p => (
                    <div key={p.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
                      onMouseDown={() => selectProducto(p)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, marginRight: 8 }}>{p.codigo_comercial}</span>
                      <span style={{ color: 'var(--text-2)' }}>{p.descripcion}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Descripción *</label>
            <input className="input" value={ociItemForm.descripcion} onChange={e => setOciItemForm(f => ({ ...f, descripcion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Ítem OC</label>
            <input className="input" value={ociItemForm.item_oc} onChange={e => setOciItemForm(f => ({ ...f, item_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="1, 2, 3…" />
          </div>
          <div className="form-field">
            <label className="form-label">Cantidad *</label>
            <input type="number" className="input" value={ociItemForm.cantidad} onChange={e => setOciItemForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Unidad de medida</label>
            <select className="select" value={ociItemForm.unidad_medida} onChange={e => setOciItemForm(f => ({ ...f, unidad_medida: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {['UN','UND','KG','M','M2','M3','L','GLN','PAR','SET','CAJA','ROLLO','HRS'].map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={ociItemForm.moneda} onChange={e => setOciItemForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Precio unitario *</label>
            <input type="number" className="input" value={ociItemForm.pcu1} onChange={e => setOciItemForm(f => ({ ...f, pcu1: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          {ociItemForm.cantidad && ociItemForm.pcu1 && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
              <span className="muted">Total: </span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {(parseFloat(ociItemForm.cantidad || '0') * parseFloat(ociItemForm.pcu1 || '0')).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {ociItemForm.moneda}
              </span>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal nueva OCI */}
      <Modal open={showAddOci} onClose={() => setShowAddOci(false)} title="Nueva OCI para este grupo" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowAddOci(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddOci} disabled={savingOci || !ociForm.operacion_id || !ociForm.proveedor_id || !ociForm.num_oc}>
              {savingOci ? 'Creando…' : 'Crear OCI'}
            </button>
          </>
        }>
        {ociError && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{ociError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Operación OPCI *</label>
            <select className="select" value={ociForm.operacion_id} onChange={e => setOciForm(f => ({ ...f, operacion_id: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Seleccionar OPCI —</option>
              {opciList.map(o => <option key={o.id} value={o.id}>{o.correlativo_opci}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Proveedor *</label>
            <select className="select" value={ociForm.proveedor_id} onChange={e => setOciForm(f => ({ ...f, proveedor_id: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Seleccionar proveedor —</option>
              {proveedoresList.map(p => <option key={p.id} value={p.id}>{p.razon_social}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">N° OC *</label>
            <input className="input" value={ociForm.num_oc} onChange={e => setOciForm(f => ({ ...f, num_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="OCI-2026-001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha OC *</label>
            <input type="date" className="input" value={ociForm.fecha_oc} onChange={e => setOciForm(f => ({ ...f, fecha_oc: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={ociForm.moneda} onChange={e => setOciForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto total</label>
            <input type="number" className="input" value={ociForm.monto_total} onChange={e => setOciForm(f => ({ ...f, monto_total: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={ociForm.notas} onChange={e => setOciForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Modal agregar costo */}
      <Modal open={showCosto} onClose={() => { setShowCosto(false); setCostoForm(defaultCostoForm) }}
        title="Agregar costo de importación" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowCosto(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddCosto} disabled={savingCosto || !costoForm.tipo_costo || !costoForm.monto}>
              {savingCosto ? 'Guardando…' : 'Guardar costo'}
            </button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tipo de costo *</label>
            <select className="select" value={costoForm.tipo_costo} onChange={e => setCostoForm(f => ({ ...f, tipo_costo: e.target.value as TipoCosto }))} style={{ width: '100%' }}>
              <option value="">— Selecciona —</option>
              {TIPOS_COSTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Descripción</label>
            <input className="input" value={costoForm.descripcion} onChange={e => setCostoForm(f => ({ ...f, descripcion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={costoForm.moneda} onChange={e => setCostoForm(f => ({ ...f, moneda: e.target.value as 'USD' | 'PEN', tipo_cambio: e.target.value === 'USD' ? '1' : f.tipo_cambio }))} style={{ width: '100%' }}>
              <option value="USD">USD</option><option value="PEN">PEN</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto *</label>
            <input type="number" className="input" value={costoForm.monto} onChange={e => setCostoForm(f => ({ ...f, monto: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          {costoForm.moneda !== 'USD' && (
            <div className="form-field">
              <label className="form-label">Tipo de cambio (PEN/USD)</label>
              <input type="number" className="input" value={costoForm.tipo_cambio} onChange={e => setCostoForm(f => ({ ...f, tipo_cambio: e.target.value }))} style={{ width: '100%' }} step="0.001" />
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Fecha</label>
            <input type="date" className="input" value={costoForm.fecha} onChange={e => setCostoForm(f => ({ ...f, fecha: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Criterio de distribución</label>
            <select className="select" value={costoForm.criterio_distribucion} onChange={e => setCostoForm(f => ({ ...f, criterio_distribucion: e.target.value as CriterioDistribucion }))} style={{ width: '100%' }}>
              <option value="valor">Por valor</option>
              <option value="peso">Por peso</option>
              <option value="cantidad">Por cantidad</option>
              <option value="manual">Manual</option>
            </select>
          </div>
          {costoForm.monto && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
              Monto USD estimado: <strong className="mono">{money(parseFloat(costoForm.monto) / (parseFloat(costoForm.tipo_cambio) || 1), 'USD')}</strong>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
