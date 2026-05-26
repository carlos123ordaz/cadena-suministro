import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  Icon, Card, DataTable, StatusBadge, OCI_STATUS_TONE, OPCI_STATUS_TONE,
  RECEPCION_STATUS_TONE, EtaCell, Tabs, Timeline, MetaGrid, Modal, Badge,
  UploadDocumentoModal, ProveedorCombobox,
} from '@/components/ui'
import type { Column, ProveedorOption } from '@/components/ui'

const SECTION_CONF = { border: '1px solid var(--accent)', borderRadius: 8, padding: 14, marginTop: 4, background: 'var(--accent-soft)' }
const SECTION_INV  = { border: '1px solid var(--ok)', borderRadius: 8, padding: 14, marginTop: 4, background: 'var(--ok-soft, rgba(0,200,80,.06))' }
import { supabase } from '@/lib/supabase'
import {
  getImportacion, addCostoImportacion, calcularCostoUnitario,
  getParametrosLista, updateImportacion,
} from '@/services/importaciones.service'
import { getDocumentos } from '@/services/documentos.service'
import { getComentarios, addComentario, registrarEvento, getHistorial } from '@/services/historial.service'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, fmtDateTime, money, initials, daysFrom, fmtDbError } from '@/lib/utils'
import type {
  Importacion, CostoImportacion, TipoCosto, CriterioDistribucion,
  HistorialEvento, Comentario, DocumentoAdjunto, OrdenCompraNota,
  EstadoImportacion, EstadoOCI,
} from '@/types'
import { OciDetailModal } from './OciDetailModal'

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

const OCI_ESTADOS: EstadoOCI[] = [
  'Borrador','OC emitida','Confirmada por proveedor','Pendiente de invoice',
  'Invoice recibida','En preparación de embarque','Embarcada','En tránsito',
  'Arribada','En aduanas','Nacionalizada','En traslado a almacén',
  'Recibida en almacén','Costeada','Cerrada','Observada','Anulada',
]

const ESTADOS_IMP: EstadoImportacion[] = [
  'Borrador','OC emitida','Confirmada por proveedor','Pendiente de invoice',
  'Invoice recibida','En preparación de embarque','Embarcada','En tránsito',
  'Arribada','En aduanas','Nacionalizada','En traslado a almacén',
  'Recibida en almacén','Costeada','Cerrada','Observada','Anulada',
]

const ERR_STYLE = { background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }

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
  tipo_costo: '', descripcion: '', moneda: 'USD', monto: '', tipo_cambio: '1',
  fecha: new Date().toISOString().slice(0, 10), criterio_distribucion: 'valor',
}

export function ImportacionDetail() {
  const { id: importacionId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()

  const [imp, setImp] = useState<FullImportacion | null>(null)
  const [historial, setHistorial] = useState<HistorialEvento[]>([])
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([])
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [distribucion, setDistribucion] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(() => {
    const t = new URLSearchParams(location.search).get('tab') ?? 'resumen'
    return TABS.some(x => x.id === t) ? t : 'resumen'
  })

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab') ?? 'resumen'
    setTab(TABS.some(x => x.id === t) ? t : 'resumen')
  }, [location.search])

  const [showUpload, setShowUpload] = useState(false)

  // ── Costo ──────────────────────────────────────────────────────────────
  const [showCosto, setShowCosto] = useState(false)
  const [costoForm, setCostoForm] = useState<CostoForm>(defaultCostoForm)
  const [savingCosto, setSavingCosto] = useState(false)

  const [nuevoComentario, setNuevoComentario] = useState('')

  // ── Nueva OCI ──────────────────────────────────────────────────────────
  const [showAddOci, setShowAddOci] = useState(false)
  const [savingOci, setSavingOci] = useState(false)
  const [ociError, setOciError] = useState<string | null>(null)
  const [ociProv, setOciProv] = useState<ProveedorOption | null>(null)
  const [categoriasFormaPago, setCategoriasFormaPago] = useState<string[]>([])
  const [formasPago, setFormasPago] = useState<string[]>([])
  const [ociForm, setOciForm] = useState({
    num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10),
    moneda: 'USD', monto_total: '', categoria_forma_pago: '', forma_pago: '',
    num_cotizacion_proveedor: '', fecha_ofrecida: '', notas: '',
  })

  // ── OCI detail (modal) ─────────────────────────────────────────────────
  const [selectedOciId, setSelectedOciId] = useState<string | null>(null)

  // ── Edit grupo ─────────────────────────────────────────────────────────
  const [showEditGrupo, setShowEditGrupo] = useState(false)
  const [editGrupoForm, setEditGrupoForm] = useState({
    grupo_importacion: '', operador_logistico: '', incoterm: '', tipo_embarque: '',
    pais_origen: '', pais_embarque: '', ciudad_embarque: '', eta: '',
    peso_bruto_kg: '', flete_usd: '', observaciones: '', numero_documento_transporte: '',
    status: '' as EstadoImportacion | '',
  })
  const [savingEditGrupo, setSavingEditGrupo] = useState(false)
  const [editGrupoError, setEditGrupoError] = useState<string | null>(null)

  // ── Edit OCI (from items tab) ──────────────────────────────────────────
  const [showEditOci, setShowEditOci] = useState(false)
  const [editOciId, setEditOciId] = useState<string | null>(null)
  const [editOciProv, setEditOciProv] = useState<ProveedorOption | null>(null)
  const [editOciForm, setEditOciForm] = useState({
    num_oc: '', fecha_oc: '', moneda: 'USD', monto_total: '',
    status: '' as EstadoOCI | '', notas: '',
    num_cotizacion_proveedor: '', fecha_ofrecida: '',
    num_confirmacion_proveedor: '', fecha_invoice: '', num_invoice: '',
  })
  const [savingEditOci, setSavingEditOci] = useState(false)
  const [editOciError, setEditOciError] = useState<string | null>(null)
  const [showUploadOci, setShowUploadOci] = useState<'confirmacion' | 'invoice' | null>(null)

  // ── Delete OCI ─────────────────────────────────────────────────────────
  const [confirmDeleteOci, setConfirmDeleteOci] = useState<Record<string, unknown> | null>(null)
  const [deletingOci, setDeletingOci] = useState(false)

  // ── Data load ──────────────────────────────────────────────────────────
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
    getParametrosLista('categoria_forma_pago').then(setCategoriasFormaPago)
    getParametrosLista('forma_pago').then(setFormasPago)
  }, [showAddOci])

  // ── Handlers ───────────────────────────────────────────────────────────
  async function handleAddOci() {
    if (!ociProv || !ociForm.num_oc || !ociForm.fecha_oc) {
      setOciError('Proveedor, N° OC y fecha son obligatorios.')
      return
    }
    setSavingOci(true)
    setOciError(null)
    const { error } = await supabase.from('ordenes_compra').insert({
      proveedor_id: ociProv.id,
      importacion_id: importacionId,
      tipo: 'Importacion',
      num_oc: ociForm.num_oc,
      fecha_oc: ociForm.fecha_oc,
      moneda: ociForm.moneda,
      monto_total: parseFloat(ociForm.monto_total) || 0,
      categoria_forma_pago: ociForm.categoria_forma_pago || null,
      forma_pago: ociForm.forma_pago || null,
      num_cotizacion_proveedor: ociForm.num_cotizacion_proveedor || null,
      fecha_ofrecida: ociForm.fecha_ofrecida || null,
      notas: ociForm.notas || null,
      status: 'Borrador',
    })
    setSavingOci(false)
    if (error) { setOciError(fmtDbError(error, 'Error al crear.')); return }
    setShowAddOci(false)
    setOciProv(null)
    setOciForm({ num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10), moneda: 'USD', monto_total: '', categoria_forma_pago: '', forma_pago: '', num_cotizacion_proveedor: '', fecha_ofrecida: '', notas: '' })
    load()
  }

  function openEditGrupo() {
    if (!imp) return
    setEditGrupoForm({
      grupo_importacion: imp.grupo_importacion ?? '',
      operador_logistico: imp.operador_logistico ?? '',
      incoterm: imp.incoterm ?? '',
      tipo_embarque: imp.tipo_embarque ?? '',
      pais_origen: imp.pais_origen ?? '',
      pais_embarque: imp.pais_embarque ?? '',
      ciudad_embarque: imp.ciudad_embarque ?? '',
      eta: imp.eta ?? '',
      peso_bruto_kg: imp.peso_bruto_kg?.toString() ?? '',
      flete_usd: imp.flete_usd?.toString() ?? '',
      observaciones: imp.observaciones ?? '',
      numero_documento_transporte: imp.numero_documento_transporte ?? '',
      status: imp.status ?? 'Borrador',
    })
    setEditGrupoError(null)
    setShowEditGrupo(true)
  }

  async function handleSaveEditGrupo() {
    if (!editGrupoForm.grupo_importacion.trim()) {
      setEditGrupoError('El nombre del grupo es obligatorio.'); return
    }
    setSavingEditGrupo(true); setEditGrupoError(null)
    const { error } = await updateImportacion(importacionId, {
      grupo_importacion: editGrupoForm.grupo_importacion.trim(),
      operador_logistico: editGrupoForm.operador_logistico || undefined,
      incoterm: editGrupoForm.incoterm || undefined,
      tipo_embarque: editGrupoForm.tipo_embarque || undefined,
      pais_origen: editGrupoForm.pais_origen || undefined,
      pais_embarque: editGrupoForm.pais_embarque || undefined,
      ciudad_embarque: editGrupoForm.ciudad_embarque || undefined,
      eta: editGrupoForm.eta || undefined,
      peso_bruto_kg: editGrupoForm.peso_bruto_kg ? parseFloat(editGrupoForm.peso_bruto_kg) : undefined,
      flete_usd: editGrupoForm.flete_usd ? parseFloat(editGrupoForm.flete_usd) : undefined,
      observaciones: editGrupoForm.observaciones || undefined,
      numero_documento_transporte: editGrupoForm.numero_documento_transporte || undefined,
      status: (editGrupoForm.status as EstadoImportacion) || undefined,
    })
    setSavingEditGrupo(false)
    if (error) { setEditGrupoError(fmtDbError(error, 'Error al actualizar.')); return }
    setShowEditGrupo(false)
    load()
  }

  function openEditOci(oci: Record<string, unknown>) {
    setEditOciId(oci.id as string)
    const prov = oci.proveedor as { razon_social?: string } | undefined
    setEditOciProv(oci.proveedor_id ? { id: oci.proveedor_id as string, razon_social: prov?.razon_social ?? '' } : null)
    setEditOciForm({
      num_oc: oci.num_oc as string ?? '',
      fecha_oc: oci.fecha_oc as string ?? '',
      moneda: oci.moneda as string ?? 'USD',
      monto_total: String(oci.monto_total ?? ''),
      status: oci.status as EstadoOCI ?? 'Borrador',
      notas: oci.notas as string ?? '',
      num_cotizacion_proveedor: oci.num_cotizacion_proveedor as string ?? '',
      fecha_ofrecida: oci.fecha_ofrecida as string ?? '',
      num_confirmacion_proveedor: oci.num_confirmacion_proveedor as string ?? '',
      fecha_invoice: oci.fecha_invoice as string ?? '',
      num_invoice: oci.num_invoice as string ?? '',
    })
    setEditOciError(null)
    setShowEditOci(true)
  }

  async function handleSaveEditOci() {
    if (!editOciId || !editOciProv || !editOciForm.num_oc) {
      setEditOciError('Proveedor y N° OC son obligatorios.'); return
    }
    setSavingEditOci(true); setEditOciError(null)
    const { error } = await supabase.from('ordenes_compra').update({
      proveedor_id: editOciProv.id,
      num_oc: editOciForm.num_oc,
      fecha_oc: editOciForm.fecha_oc || null,
      moneda: editOciForm.moneda,
      monto_total: parseFloat(editOciForm.monto_total) || 0,
      status: editOciForm.status || 'Borrador',
      notas: editOciForm.notas || null,
      num_cotizacion_proveedor: editOciForm.num_cotizacion_proveedor || null,
      fecha_ofrecida: editOciForm.fecha_ofrecida || null,
      num_confirmacion_proveedor: editOciForm.num_confirmacion_proveedor || null,
      fecha_invoice: editOciForm.fecha_invoice || null,
      num_invoice: editOciForm.num_invoice || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editOciId)
    setSavingEditOci(false)
    if (error) { setEditOciError(fmtDbError(error, 'Error al actualizar.')); return }
    setShowEditOci(false)
    load()
  }

  async function handleDeleteOci() {
    if (!confirmDeleteOci) return
    setDeletingOci(true)
    const { error } = await supabase.from('ordenes_compra').delete().eq('id', confirmDeleteOci.id as string)
    setDeletingOci(false)
    if (error) { alert(fmtDbError(error, 'No se pudo eliminar.')); return }
    setConfirmDeleteOci(null)
    load()
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
  void etaTone

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
            <button className="btn sm" onClick={openEditGrupo}>
              <Icon name="edit" size={13} /> Editar grupo
            </button>
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
                <button className="btn ghost xs" onClick={e => { e.stopPropagation(); navigate(`/operaciones/${(r.operacion as {id: string}).id}`) }}>
                  <span className="mono" style={{ color: 'var(--accent-2)' }}>{(r.operacion as {correlativo_opci: string}).correlativo_opci}</span>
                </button>
              ) : <span className="muted">—</span> },
              { key: 'proveedor',     label: 'Proveedor', render: r => <span>{(r.proveedor as {razon_social: string})?.razon_social ?? '—'}</span> },
              { key: 'num_invoice',   label: 'Invoice', render: r => <span className="mono">{r.num_invoice as string ?? '—'}</span> },
              { key: 'monto_total',   label: 'Monto', align: 'right', render: r => <span className="mono">{money(r.monto_total as number, r.moneda as string)}</span> },
              { key: 'eta',           label: 'ETA', render: r => <EtaCell eta={r.eta as string} /> },
              { key: 'status',        label: 'Estado', render: r => <StatusBadge status={r.status as string} mapping={OCI_STATUS_TONE} /> },
              {
                key: '_actions', label: '', width: 76,
                render: r => (
                  <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <button className="btn ghost xs" title="Editar OCI" onClick={() => openEditOci(r)}>
                      <Icon name="edit" size={12} />
                    </button>
                    <button className="btn ghost xs" title="Eliminar OCI" style={{ color: 'var(--bad)' }}
                      onClick={() => setConfirmDeleteOci(r)}>
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ),
              },
            ] as Column<Record<string, unknown>>[]}
            rows={(imp.ordenes ?? []) as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin órdenes de compra asociadas"
            onRowClick={row => setSelectedOciId(row.id as string)}
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

      {/* ── Modals ────────────────────────────────────────────────────── */}
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

      {/* OCI detail */}
      <OciDetailModal
        ociId={selectedOciId}
        onClose={() => setSelectedOciId(null)}
        onChanged={load}
      />

      {/* Nueva OCI */}
      <Modal open={showAddOci} onClose={() => setShowAddOci(false)} title="Nueva OCI para este grupo" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowAddOci(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddOci} disabled={savingOci}>
              {savingOci ? 'Creando…' : 'Crear OCI'}
            </button>
          </>
        }>
        {ociError && <div style={ERR_STYLE}>{ociError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Proveedor *</label>
            <ProveedorCombobox value={ociProv} onChange={setOciProv} tipo="Importacion" placeholder="Buscar proveedor importación…" />
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
          <div className="form-field">
            <label className="form-label">N° Cotización proveedor</label>
            <input className="input" value={ociForm.num_cotizacion_proveedor}
              onChange={e => setOciForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha ofrecida</label>
            <input type="date" className="input" value={ociForm.fecha_ofrecida}
              onChange={e => setOciForm(f => ({ ...f, fecha_ofrecida: e.target.value }))}
              style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Categoría forma de pago</label>
            <select className="select" value={ociForm.categoria_forma_pago}
              onChange={e => setOciForm(f => ({ ...f, categoria_forma_pago: e.target.value, forma_pago: '' }))}
              style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {categoriasFormaPago.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Forma de pago</label>
            <select className="select" value={ociForm.forma_pago}
              onChange={e => setOciForm(f => ({ ...f, forma_pago: e.target.value }))}
              style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {formasPago.map(fp => <option key={fp} value={fp}>{fp}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={ociForm.notas} onChange={e => setOciForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Editar grupo */}
      <Modal open={showEditGrupo} onClose={() => setShowEditGrupo(false)} title="Editar grupo de importación" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowEditGrupo(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEditGrupo} disabled={savingEditGrupo}>
              {savingEditGrupo ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }>
        {editGrupoError && <div style={ERR_STYLE}>{editGrupoError}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nombre del grupo *</label>
            <input className="input" value={editGrupoForm.grupo_importacion} onChange={e => setEditGrupoForm(f => ({ ...f, grupo_importacion: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Operador logístico</label>
            <input className="input" value={editGrupoForm.operador_logistico} onChange={e => setEditGrupoForm(f => ({ ...f, operador_logistico: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Estado</label>
            <select className="select" value={editGrupoForm.status} onChange={e => setEditGrupoForm(f => ({ ...f, status: e.target.value as EstadoImportacion }))} style={{ width: '100%' }}>
              {ESTADOS_IMP.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Incoterm</label>
            <select className="select" value={editGrupoForm.incoterm} onChange={e => setEditGrupoForm(f => ({ ...f, incoterm: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {['FOB','CIF','CFR','FCA','EXW','DAP','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Tipo de embarque</label>
            <select className="select" value={editGrupoForm.tipo_embarque} onChange={e => setEditGrupoForm(f => ({ ...f, tipo_embarque: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {['Marítimo FCL','Marítimo LCL','Aéreo','Terrestre','Courier'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">País de origen</label>
            <input className="input" value={editGrupoForm.pais_origen} onChange={e => setEditGrupoForm(f => ({ ...f, pais_origen: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">País de embarque</label>
            <input className="input" value={editGrupoForm.pais_embarque} onChange={e => setEditGrupoForm(f => ({ ...f, pais_embarque: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Ciudad de embarque</label>
            <input className="input" value={editGrupoForm.ciudad_embarque} onChange={e => setEditGrupoForm(f => ({ ...f, ciudad_embarque: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">N° doc. transporte</label>
            <input className="input" value={editGrupoForm.numero_documento_transporte} onChange={e => setEditGrupoForm(f => ({ ...f, numero_documento_transporte: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">ETA estimada</label>
            <input type="date" className="input" value={editGrupoForm.eta} onChange={e => setEditGrupoForm(f => ({ ...f, eta: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Peso bruto (kg)</label>
            <input type="number" className="input" value={editGrupoForm.peso_bruto_kg} onChange={e => setEditGrupoForm(f => ({ ...f, peso_bruto_kg: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Flete USD</label>
            <input type="number" className="input" value={editGrupoForm.flete_usd} onChange={e => setEditGrupoForm(f => ({ ...f, flete_usd: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observaciones</label>
            <textarea className="input" rows={2} value={editGrupoForm.observaciones} onChange={e => setEditGrupoForm(f => ({ ...f, observaciones: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Editar OCI */}
      <Modal open={showEditOci} onClose={() => setShowEditOci(false)}
        title="Editar OCI" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowEditOci(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEditOci} disabled={savingEditOci}>
              {savingEditOci ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }>
        {editOciError && <div style={ERR_STYLE}>{editOciError}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Proveedor *</label>
              <ProveedorCombobox value={editOciProv} onChange={setEditOciProv} tipo="Importacion" placeholder="Buscar proveedor…" />
            </div>
            <div className="form-field">
              <label className="form-label">N° OC *</label>
              <input className="input" value={editOciForm.num_oc} onChange={e => setEditOciForm(f => ({ ...f, num_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
            </div>
            <div className="form-field">
              <label className="form-label">Fecha OC</label>
              <input type="date" className="input" value={editOciForm.fecha_oc} onChange={e => setEditOciForm(f => ({ ...f, fecha_oc: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div className="form-field">
              <label className="form-label">N° Cotización proveedor</label>
              <input className="input" value={editOciForm.num_cotizacion_proveedor} onChange={e => setEditOciForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
            </div>
            <div className="form-field">
              <label className="form-label">Fecha ofrecida</label>
              <input type="date" className="input" value={editOciForm.fecha_ofrecida} onChange={e => setEditOciForm(f => ({ ...f, fecha_ofrecida: e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div className="form-field">
              <label className="form-label">Moneda</label>
              <select className="select" value={editOciForm.moneda} onChange={e => setEditOciForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
                {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Monto total</label>
              <input type="number" className="input" value={editOciForm.monto_total} onChange={e => setEditOciForm(f => ({ ...f, monto_total: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Estado</label>
              <select className="select" value={editOciForm.status} onChange={e => setEditOciForm(f => ({ ...f, status: e.target.value as EstadoOCI }))} style={{ width: '100%' }}>
                {OCI_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notas</label>
              <textarea className="input" rows={2} value={editOciForm.notas} onChange={e => setEditOciForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
            </div>
          </div>

          {editOciForm.status === 'Confirmada por proveedor' && (
            <div style={SECTION_CONF}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="check" size={12} /> Datos de confirmación proveedor
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
                <div className="form-field" style={{ margin: 0 }}>
                  <label className="form-label">N° Confirmación proveedor</label>
                  <input className="input" value={editOciForm.num_confirmacion_proveedor}
                    onChange={e => setEditOciForm(f => ({ ...f, num_confirmacion_proveedor: e.target.value }))}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="CONF-001" />
                </div>
                {editOciId && profile && (
                  <button className="btn sm" style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setShowUploadOci('confirmacion')}>
                    <Icon name="paperclip" size={12} /> Adjuntar
                  </button>
                )}
              </div>
            </div>
          )}

          {editOciForm.status === 'Invoice recibida' && (
            <div style={SECTION_INV}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="doc" size={12} /> Datos de invoice
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-field" style={{ margin: 0 }}>
                  <label className="form-label">Fecha invoice</label>
                  <input type="date" className="input" value={editOciForm.fecha_invoice}
                    onChange={e => setEditOciForm(f => ({ ...f, fecha_invoice: e.target.value }))}
                    style={{ width: '100%' }} />
                </div>
                <div className="form-field" style={{ margin: 0 }}>
                  <label className="form-label">N° Invoice</label>
                  <input className="input" value={editOciForm.num_invoice}
                    onChange={e => setEditOciForm(f => ({ ...f, num_invoice: e.target.value }))}
                    style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="INV-001" />
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
                El N° ítem de invoice se registra por ítem en el detalle de la OCI.
              </div>
              {editOciId && profile && (
                <button className="btn sm" style={{ marginTop: 10 }}
                  onClick={() => setShowUploadOci('invoice')}>
                  <Icon name="paperclip" size={12} /> Adjuntar invoice
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Upload document for OCI edit */}
      {showUploadOci && editOciId && profile && (
        <UploadDocumentoModal
          open={!!showUploadOci}
          onClose={() => setShowUploadOci(null)}
          entidadTipo="orden_compra_importacion"
          entidadId={editOciId}
          userId={profile.id}
          onUploaded={() => setShowUploadOci(null)}
        />
      )}

      {/* Confirmar eliminar OCI */}
      <Modal open={!!confirmDeleteOci} onClose={() => setConfirmDeleteOci(null)} title="Eliminar OCI" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDeleteOci(null)}>Cancelar</button>
            <button className="btn" style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
              onClick={handleDeleteOci} disabled={deletingOci}>
              {deletingOci ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }>
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          ¿Eliminar la OCI <strong style={{ fontFamily: 'var(--font-mono)' }}>{confirmDeleteOci?.num_oc as string}</strong>?
          Se eliminarán también sus ítems. Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Agregar costo */}
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
