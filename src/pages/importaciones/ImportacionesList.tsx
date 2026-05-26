import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Icon, Card, KPI, DataTable, StatusBadge, OCI_STATUS_TONE, EtaCell, Badge, Modal,
  ProveedorCombobox, ImportacionCombobox, UploadDocumentoModal,
} from '@/components/ui'
import type { Column, ProveedorOption, ImportacionOption } from '@/components/ui'
import { getImportaciones, createImportacion, updateImportacion } from '@/services/importaciones.service'
import { supabase } from '@/lib/supabase'
import { money, fmtDate, truncate } from '@/lib/utils'
import type { Importacion, EstadoImportacion, OrdenCompraImportacion, EstadoOCI } from '@/types'
import { OciDetailModal } from './OciDetailModal'
import { useAuth } from '@/context/AuthContext'

const ESTADOS: EstadoImportacion[] = [
  'Borrador','OC emitida','Confirmada por proveedor','Pendiente de invoice',
  'Invoice recibida','En preparación de embarque','Embarcada','En tránsito',
  'Arribada','En aduanas','Nacionalizada','En traslado a almacén',
  'Recibida en almacén','Costeada','Cerrada','Observada','Anulada',
]

const OCI_ESTADOS: EstadoOCI[] = [
  'Borrador','OC emitida','Confirmada por proveedor','Pendiente de invoice',
  'Invoice recibida','En preparación de embarque','Embarcada','En tránsito',
  'Arribada','En aduanas','Nacionalizada','En traslado a almacén',
  'Recibida en almacén','Costeada','Cerrada','Observada','Anulada',
]

const ERR_STYLE = { background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }
const SECTION_CONF = { border: '1px solid var(--accent)', borderRadius: 8, padding: 14, marginTop: 4, background: 'var(--accent-soft)' }
const SECTION_INV  = { border: '1px solid var(--ok)', borderRadius: 8, padding: 14, marginTop: 4, background: 'var(--ok-soft, rgba(0,200,80,.06))' }

const defaultImpForm = {
  grupo_importacion: '', operador_logistico: '', incoterm: '', tipo_embarque: '',
  pais_origen: '', pais_embarque: '', ciudad_embarque: '', eta: '',
  peso_bruto_kg: '', flete_usd: '', observaciones: '',
}

const defaultOciForm = {
  num_oc: '', fecha_oc: new Date().toISOString().slice(0, 10), moneda: 'USD',
  monto_total: '', notas: '', num_cotizacion_proveedor: '', fecha_ofrecida: '',
}

const defaultEditOciForm = {
  num_oc: '', fecha_oc: '', moneda: 'USD', monto_total: '',
  status: '' as EstadoOCI | '', notas: '',
  num_cotizacion_proveedor: '', fecha_ofrecida: '',
  num_confirmacion_proveedor: '', fecha_invoice: '', num_invoice: '',
}

export function ImportacionesList() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  // ── View mode ──────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<'grupos' | 'ocis'>('grupos')

  // ── Grupos state ───────────────────────────────────────────────────────
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [incoterm, setIncoterm] = useState('')
  const [tipoEmbarque, setTipoEmbarque] = useState('')

  // ── OCIs state ─────────────────────────────────────────────────────────
  const [ociRows, setOciRows] = useState<OrdenCompraImportacion[]>([])
  const [ociLoading, setOciLoading] = useState(false)
  const [ociSearch, setOciSearch] = useState('')
  const [ociFilterEstado, setOciFilterEstado] = useState<EstadoOCI | ''>('')
  const [selectedOciId, setSelectedOciId] = useState<string | null>(null)

  // ── Nueva OCI (standalone) ─────────────────────────────────────────────
  const [showNuevaOci, setShowNuevaOci] = useState(false)
  const [ociNuevoProv, setOciNuevoProv] = useState<ProveedorOption | null>(null)
  const [ociNuevoImportacion, setOciNuevoImportacion] = useState<ImportacionOption | null>(null)
  const [ociNuevoForm, setOciNuevoForm] = useState(defaultOciForm)
  const [savingNuevaOci, setSavingNuevaOci] = useState(false)
  const [errorNuevaOci, setErrorNuevaOci] = useState<string | null>(null)

  // ── Edit OCI ───────────────────────────────────────────────────────────
  const [showEditOci, setShowEditOci] = useState(false)
  const [editOciData, setEditOciData] = useState<OrdenCompraImportacion | null>(null)
  const [editOciProv, setEditOciProv] = useState<ProveedorOption | null>(null)
  const [editOciImportacion, setEditOciImportacion] = useState<ImportacionOption | null>(null)
  const [editOciForm, setEditOciForm] = useState(defaultEditOciForm)
  const [savingEditOci, setSavingEditOci] = useState(false)
  const [errorEditOci, setErrorEditOci] = useState<string | null>(null)
  const [showUploadEditOci, setShowUploadEditOci] = useState<'confirmacion' | 'invoice' | null>(null)

  // ── Delete OCI ─────────────────────────────────────────────────────────
  const [confirmDeleteOci, setConfirmDeleteOci] = useState<OrdenCompraImportacion | null>(null)
  const [deletingOci, setDeletingOci] = useState(false)

  // ── Nuevo grupo ────────────────────────────────────────────────────────
  const [showNueva, setShowNueva] = useState(false)
  const [impForm, setImpForm] = useState(defaultImpForm)
  const [savingNueva, setSavingNueva] = useState(false)
  const [errorNueva, setErrorNueva] = useState<string | null>(null)

  // ── Edit grupo ─────────────────────────────────────────────────────────
  const [showEditGrupo, setShowEditGrupo] = useState(false)
  const [editGrupoId, setEditGrupoId] = useState<string | null>(null)
  const [editGrupoForm, setEditGrupoForm] = useState(defaultImpForm)
  const [savingEditGrupo, setSavingEditGrupo] = useState(false)
  const [errorEditGrupo, setErrorEditGrupo] = useState<string | null>(null)

  // ── Delete grupo ───────────────────────────────────────────────────────
  const [confirmDeleteGrupo, setConfirmDeleteGrupo] = useState<Importacion | null>(null)
  const [deletingGrupo, setDeletingGrupo] = useState(false)
  const [deleteGrupoError, setDeleteGrupoError] = useState<string | null>(null)

  // ── Data loaders ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await getImportaciones({
      search: q || undefined,
      status: (estado as EstadoImportacion) || undefined,
      incoterm: incoterm || undefined,
      tipo_embarque: tipoEmbarque || undefined,
    })
    setImportaciones(data ?? [])
    setLoading(false)
  }, [q, estado, incoterm, tipoEmbarque])

  useEffect(() => { load() }, [load])

  const loadOcis = useCallback(async () => {
    setOciLoading(true)
    const { data } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        proveedor:proveedores(id, razon_social),
        importacion:importaciones(id, grupo_importacion),
        operacion:operaciones(id, correlativo_opci)
      `)
      .eq('tipo', 'Importacion')
      .order('created_at', { ascending: false })
      .limit(200)
    setOciRows((data ?? []) as unknown as OrdenCompraImportacion[])
    setOciLoading(false)
  }, [])

  useEffect(() => {
    if (viewMode === 'ocis') loadOcis()
  }, [viewMode, loadOcis])

  const filteredOcis = useMemo(() => {
    let rows = ociRows
    if (ociFilterEstado) rows = rows.filter(r => r.status === ociFilterEstado)
    if (ociSearch) {
      const sq = ociSearch.toLowerCase()
      rows = rows.filter(r =>
        r.num_oc?.toLowerCase().includes(sq) ||
        (r.proveedor as { razon_social?: string } | undefined)?.razon_social?.toLowerCase().includes(sq) ||
        (r.operacion as { correlativo_opci?: string } | undefined)?.correlativo_opci?.toLowerCase().includes(sq) ||
        (r.importacion as { grupo_importacion?: string } | undefined)?.grupo_importacion?.toLowerCase().includes(sq),
      )
    }
    return rows
  }, [ociRows, ociSearch, ociFilterEstado])

  // ── KPIs ───────────────────────────────────────────────────────────────
  const enTransito  = importaciones.filter(i => i.status === 'En tránsito').length
  const enAduanas   = importaciones.filter(i => i.status === 'En aduanas').length
  const etaSemana   = importaciones.filter(i => { const d = i.eta ? Math.ceil((new Date(i.eta).getTime() - Date.now()) / 86400000) : 999; return d >= 0 && d <= 7 }).length
  const pendCosteo  = importaciones.filter(i => ['Recibida en almacén','Nacionalizada'].includes(i.status)).length

  // ── Handlers: grupo ────────────────────────────────────────────────────
  async function handleCrearImportacion() {
    if (!impForm.grupo_importacion.trim()) { setErrorNueva('El nombre del grupo es obligatorio.'); return }
    setSavingNueva(true); setErrorNueva(null)
    const { data, error } = await createImportacion({
      grupo_importacion: impForm.grupo_importacion.trim(),
      operador_logistico: impForm.operador_logistico || undefined,
      incoterm: impForm.incoterm || undefined,
      tipo_embarque: impForm.tipo_embarque || undefined,
      pais_origen: impForm.pais_origen || undefined,
      pais_embarque: impForm.pais_embarque || undefined,
      ciudad_embarque: impForm.ciudad_embarque || undefined,
      eta: impForm.eta || undefined,
      peso_bruto_kg: impForm.peso_bruto_kg ? parseFloat(impForm.peso_bruto_kg) : undefined,
      flete_usd: impForm.flete_usd ? parseFloat(impForm.flete_usd) : undefined,
      observaciones: impForm.observaciones || undefined,
      status: 'Borrador',
    })
    setSavingNueva(false)
    if (error || !data) { setErrorNueva((error as Error)?.message ?? 'Error al crear.'); return }
    setShowNueva(false)
    setImpForm(defaultImpForm)
    load()
  }

  function openEditGrupo(imp: Importacion) {
    setEditGrupoId(imp.id)
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
    })
    setErrorEditGrupo(null)
    setShowEditGrupo(true)
  }

  async function handleEditGrupo() {
    if (!editGrupoId || !editGrupoForm.grupo_importacion.trim()) {
      setErrorEditGrupo('El nombre del grupo es obligatorio.'); return
    }
    setSavingEditGrupo(true); setErrorEditGrupo(null)
    const { error } = await updateImportacion(editGrupoId, {
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
    })
    setSavingEditGrupo(false)
    if (error) { setErrorEditGrupo((error as Error)?.message ?? 'Error al actualizar.'); return }
    setShowEditGrupo(false)
    load()
  }

  async function handleDeleteGrupo() {
    if (!confirmDeleteGrupo) return
    setDeletingGrupo(true); setDeleteGrupoError(null)
    const { error } = await supabase.from('importaciones').delete().eq('id', confirmDeleteGrupo.id)
    setDeletingGrupo(false)
    if (error) { setDeleteGrupoError((error as Error)?.message ?? 'No se pudo eliminar.'); return }
    setConfirmDeleteGrupo(null)
    load()
  }

  // ── Handlers: OCI ──────────────────────────────────────────────────────
  async function handleCrearOciStandalone() {
    if (!ociNuevoProv || !ociNuevoForm.num_oc || !ociNuevoForm.fecha_oc) {
      setErrorNuevaOci('Proveedor, N° OC y fecha son obligatorios.'); return
    }
    setSavingNuevaOci(true); setErrorNuevaOci(null)
    const { error } = await supabase.from('ordenes_compra').insert({
      proveedor_id: ociNuevoProv.id,
      importacion_id: ociNuevoImportacion?.id ?? null,
      tipo: 'Importacion',
      num_oc: ociNuevoForm.num_oc,
      fecha_oc: ociNuevoForm.fecha_oc,
      moneda: ociNuevoForm.moneda,
      monto_total: parseFloat(ociNuevoForm.monto_total) || 0,
      notas: ociNuevoForm.notas || null,
      num_cotizacion_proveedor: ociNuevoForm.num_cotizacion_proveedor || null,
      fecha_ofrecida: ociNuevoForm.fecha_ofrecida || null,
      status: 'Borrador',
    })
    setSavingNuevaOci(false)
    if (error) { setErrorNuevaOci((error as Error)?.message ?? 'Error al crear.'); return }
    setShowNuevaOci(false)
    setOciNuevoProv(null)
    setOciNuevoImportacion(null)
    setOciNuevoForm(defaultOciForm)
    loadOcis()
  }

  function openEditOci(oci: OrdenCompraImportacion) {
    setEditOciData(oci)
    const prov = (oci as unknown as { proveedor?: { razon_social?: string } }).proveedor
    const imp = (oci as unknown as { importacion?: { id?: string; grupo_importacion?: string } }).importacion
    setEditOciProv(oci.proveedor_id ? { id: oci.proveedor_id, razon_social: prov?.razon_social ?? '' } : null)
    setEditOciImportacion(imp?.id ? { id: imp.id, grupo_importacion: imp.grupo_importacion ?? '' } : null)
    setEditOciForm({
      num_oc: oci.num_oc ?? '',
      fecha_oc: oci.fecha_oc ?? '',
      moneda: oci.moneda ?? 'USD',
      monto_total: oci.monto_total?.toString() ?? '',
      status: oci.status ?? 'Borrador',
      notas: (oci as unknown as { notas?: string }).notas ?? '',
      num_cotizacion_proveedor: oci.num_cotizacion_proveedor ?? '',
      fecha_ofrecida: oci.fecha_ofrecida ?? '',
      num_confirmacion_proveedor: oci.num_confirmacion_proveedor ?? '',
      fecha_invoice: oci.fecha_invoice ?? '',
      num_invoice: oci.num_invoice ?? '',
    })
    setErrorEditOci(null)
    setShowEditOci(true)
  }

  async function handleEditOci() {
    if (!editOciData || !editOciProv || !editOciForm.num_oc) {
      setErrorEditOci('Proveedor y N° OC son obligatorios.'); return
    }
    setSavingEditOci(true); setErrorEditOci(null)
    const { error } = await supabase.from('ordenes_compra').update({
      proveedor_id: editOciProv.id,
      importacion_id: editOciImportacion?.id ?? null,
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
    }).eq('id', editOciData.id)
    setSavingEditOci(false)
    if (error) { setErrorEditOci((error as Error)?.message ?? 'Error al actualizar.'); return }
    setShowEditOci(false)
    setEditOciData(null)
    loadOcis()
  }

  async function handleDeleteOci() {
    if (!confirmDeleteOci) return
    setDeletingOci(true)
    const { error } = await supabase.from('ordenes_compra').delete().eq('id', confirmDeleteOci.id)
    setDeletingOci(false)
    if (error) { alert((error as Error)?.message ?? 'No se pudo eliminar.'); return }
    setConfirmDeleteOci(null)
    loadOcis()
  }

  // ── Table columns ──────────────────────────────────────────────────────
  const columns: Column<Importacion>[] = [
    {
      key: 'grupo_importacion', label: 'Grupo', sortable: true,
      render: r => (
        <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, cursor: 'pointer' }}
          onClick={() => navigate(`/importaciones/${r.id}`)}>
          {r.grupo_importacion}
        </span>
      ),
    },
    { key: 'operador_logistico', label: 'Operador', render: r => <span>{r.operador_logistico ?? '—'}</span> },
    { key: 'incoterm', label: 'Incoterm', render: r => r.incoterm ? <Badge tone="muted">{r.incoterm}</Badge> : <span className="muted">—</span> },
    { key: 'tipo_embarque', label: 'Embarque', render: r => <span className="muted">{r.tipo_embarque ?? '—'}</span> },
    {
      key: 'pais_origen', label: 'Origen',
      render: r => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Icon name="globe" size={11} style={{ color: 'var(--text-3)' }} />
          {r.pais_origen ?? '—'}
        </span>
      ),
    },
    { key: 'eta', label: 'ETA', render: r => <EtaCell eta={r.eta} /> },
    {
      key: 'peso_bruto_kg', label: 'Peso', align: 'right',
      render: r => r.peso_bruto_kg ? <span className="mono">{r.peso_bruto_kg.toLocaleString('es-PE')} kg</span> : <span className="muted">—</span>,
    },
    {
      key: 'flete_usd', label: 'Flete', align: 'right',
      render: r => r.flete_usd ? <span className="mono">{money(r.flete_usd, 'USD')}</span> : <span className="muted">—</span>,
    },
    { key: 'status', label: 'Estado', render: r => <StatusBadge status={r.status} mapping={OCI_STATUS_TONE} /> },
    {
      key: '_actions', label: '', width: 76,
      render: r => (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <button className="btn ghost xs" title="Editar grupo"
            onClick={() => openEditGrupo(r as unknown as Importacion)}>
            <Icon name="edit" size={12} />
          </button>
          <button className="btn ghost xs" title="Eliminar grupo" style={{ color: 'var(--bad)' }}
            onClick={() => { setDeleteGrupoError(null); setConfirmDeleteGrupo(r as unknown as Importacion) }}>
            <Icon name="trash" size={12} />
          </button>
        </div>
      ),
    },
  ]

  const ociColumns: Column<OrdenCompraImportacion>[] = [
    {
      key: 'num_oc', label: 'N° OCI', sortable: true, width: 140,
      render: r => (
        <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, cursor: 'pointer' }}
          onClick={e => { e.stopPropagation(); navigate(`/importaciones/${(r.importacion as { id?: string } | undefined)?.id}?tab=items`) }}>
          {r.num_oc}
        </span>
      ),
    },
    {
      key: 'fecha_oc', label: 'Fecha emisión', sortable: true,
      render: r => <span className="mono">{fmtDate(r.fecha_oc) ?? '—'}</span>,
    },
    {
      key: 'proveedor', label: 'Proveedor',
      render: r => <span title={(r.proveedor as { razon_social?: string } | undefined)?.razon_social}>{truncate((r.proveedor as { razon_social?: string } | undefined)?.razon_social ?? '—', 28)}</span>,
    },
    {
      key: 'operacion', label: 'OPCI',
      render: r => {
        const op = r.operacion as { id?: string; correlativo_opci?: string } | undefined
        if (!op?.correlativo_opci) return <span className="muted">—</span>
        return (
          <button className="btn ghost xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-2)', padding: '0 4px' }}
            onClick={e => { e.stopPropagation(); navigate(`/operaciones/${op.id}`) }}>
            {op.correlativo_opci}
          </button>
        )
      },
    },
    {
      key: 'importacion', label: 'Grupo importación',
      render: r => {
        const imp = r.importacion as { id?: string; grupo_importacion?: string } | undefined
        if (!imp?.grupo_importacion) return <span className="muted">—</span>
        return (
          <button className="btn ghost xs" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-2)', padding: '0 4px' }}
            onClick={e => { e.stopPropagation(); navigate(`/importaciones/${imp.id}`) }}>
            {imp.grupo_importacion}
          </button>
        )
      },
    },
    {
      key: 'monto_total', label: 'Monto', align: 'right', sortable: true,
      render: r => <span className="mono">{money(r.monto_total, r.moneda)}</span>,
    },
    { key: 'eta', label: 'ETA', render: r => <EtaCell eta={r.eta} /> },
    { key: 'status', label: 'Estado', render: r => <StatusBadge status={r.status} mapping={OCI_STATUS_TONE} /> },
    {
      key: '_actions', label: '', width: 76,
      render: r => (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <button className="btn ghost xs" title="Editar OCI"
            onClick={() => openEditOci(r as unknown as OrdenCompraImportacion)}>
            <Icon name="edit" size={12} />
          </button>
          <button className="btn ghost xs" title="Eliminar OCI" style={{ color: 'var(--bad)' }}
            onClick={() => setConfirmDeleteOci(r as unknown as OrdenCompraImportacion)}>
            <Icon name="trash" size={12} />
          </button>
        </div>
      ),
    },
  ]

  // ── OCI base form fields (shared between nueva y edit) ────────────────
  function renderOciBaseFields(
    prov: ProveedorOption | null,
    setProv: (v: ProveedorOption | null) => void,
    imp: ImportacionOption | null,
    setImp: (v: ImportacionOption | null) => void,
    form: typeof defaultOciForm,
    setForm: (f: (prev: typeof form) => typeof form) => void,
  ) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Proveedor *</label>
          <ProveedorCombobox value={prov} onChange={setProv} tipo="Importacion" placeholder="Buscar proveedor importación…" />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Grupo de importación</label>
          <ImportacionCombobox value={imp} onChange={setImp} placeholder="Buscar grupo de importación…" />
        </div>
        <div className="form-field">
          <label className="form-label">N° OC *</label>
          <input className="input" value={form.num_oc} onChange={e => setForm(f => ({ ...f, num_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="OCI-2026-001" />
        </div>
        <div className="form-field">
          <label className="form-label">Fecha OC *</label>
          <input type="date" className="input" value={form.fecha_oc} onChange={e => setForm(f => ({ ...f, fecha_oc: e.target.value }))} style={{ width: '100%' }} />
        </div>
        <div className="form-field">
          <label className="form-label">N° Cotización proveedor</label>
          <input className="input" value={form.num_cotizacion_proveedor} onChange={e => setForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
        </div>
        <div className="form-field">
          <label className="form-label">Fecha ofrecida</label>
          <input type="date" className="input" value={form.fecha_ofrecida} onChange={e => setForm(f => ({ ...f, fecha_ofrecida: e.target.value }))} style={{ width: '100%' }} />
        </div>
        <div className="form-field">
          <label className="form-label">Moneda</label>
          <select className="select" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
            {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Monto total</label>
          <input type="number" className="input" value={form.monto_total} onChange={e => setForm(f => ({ ...f, monto_total: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Notas</label>
          <textarea className="input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      </div>
    )
  }

  // ── Grupo form fields ─────────────────────────────────────────────────
  function renderGrupoFormFields(form: typeof impForm, setForm: (f: (prev: typeof impForm) => typeof impForm) => void) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Nombre del grupo *</label>
          <input className="input" value={form.grupo_importacion} onChange={e => setForm(f => ({ ...f, grupo_importacion: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="IMP-2026-012" />
        </div>
        <div className="form-field">
          <label className="form-label">Operador logístico</label>
          <input className="input" value={form.operador_logistico} onChange={e => setForm(f => ({ ...f, operador_logistico: e.target.value }))} style={{ width: '100%' }} placeholder="DHL, Kuehne+Nagel…" />
        </div>
        <div className="form-field">
          <label className="form-label">Incoterm</label>
          <select className="select" value={form.incoterm} onChange={e => setForm(f => ({ ...f, incoterm: e.target.value }))} style={{ width: '100%' }}>
            <option value="">— Sin especificar —</option>
            {['FOB','CIF','CFR','FCA','EXW','DAP','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Tipo de embarque</label>
          <select className="select" value={form.tipo_embarque} onChange={e => setForm(f => ({ ...f, tipo_embarque: e.target.value }))} style={{ width: '100%' }}>
            <option value="">— Sin especificar —</option>
            {['Marítimo FCL','Marítimo LCL','Aéreo','Terrestre','Courier'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">País de origen</label>
          <input className="input" value={form.pais_origen} onChange={e => setForm(f => ({ ...f, pais_origen: e.target.value }))} style={{ width: '100%' }} placeholder="China, Alemania…" />
        </div>
        <div className="form-field">
          <label className="form-label">País de embarque</label>
          <input className="input" value={form.pais_embarque} onChange={e => setForm(f => ({ ...f, pais_embarque: e.target.value }))} style={{ width: '100%' }} />
        </div>
        <div className="form-field">
          <label className="form-label">Ciudad de embarque</label>
          <input className="input" value={form.ciudad_embarque} onChange={e => setForm(f => ({ ...f, ciudad_embarque: e.target.value }))} style={{ width: '100%' }} placeholder="Shanghái, Hamburgo…" />
        </div>
        <div className="form-field">
          <label className="form-label">ETA estimada</label>
          <input type="date" className="input" value={form.eta} onChange={e => setForm(f => ({ ...f, eta: e.target.value }))} style={{ width: '100%' }} />
        </div>
        <div className="form-field">
          <label className="form-label">Peso bruto (kg)</label>
          <input type="number" className="input" value={form.peso_bruto_kg} onChange={e => setForm(f => ({ ...f, peso_bruto_kg: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
        </div>
        <div className="form-field">
          <label className="form-label">Flete USD</label>
          <input type="number" className="input" value={form.flete_usd} onChange={e => setForm(f => ({ ...f, flete_usd: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
        </div>
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Observaciones</label>
          <textarea className="input" rows={2} value={form.observaciones} onChange={e => setForm(f => ({ ...f, observaciones: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
        </div>
      </div>
    )
  }

  const isEditConfirmada = editOciForm.status === 'Confirmada por proveedor'
  const isEditInvoice    = editOciForm.status === 'Invoice recibida'

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Importaciones
            <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>
              {viewMode === 'grupos' ? `${importaciones.length} grupos` : `${filteredOcis.length} órdenes`}
            </span>
          </h1>
          <div className="page-sub">
            {viewMode === 'grupos'
              ? 'Grupos de importación · cada grupo agrupa varias OCI bajo un mismo trámite aduanal'
              : 'Órdenes de compra de importación (OCI) — vista plana'}
          </div>
        </div>
        <div className="page-actions">
          <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)', gap: 2 }}>
            {(['grupos', 'ocis'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 7, border: 'none', cursor: 'pointer',
                  fontSize: 12.5, fontWeight: 500,
                  background: viewMode === mode ? 'var(--surface-1)' : 'transparent',
                  color: viewMode === mode ? 'var(--text-1)' : 'var(--text-3)',
                  boxShadow: viewMode === mode ? '0 1px 3px rgba(0,0,0,.12), 0 0 0 1px var(--border)' : 'none',
                  transition: 'background .15s, color .15s, box-shadow .15s',
                }}
              >
                <Icon name={mode === 'grupos' ? 'layers' : 'opci'} size={12} />
                {mode === 'grupos' ? 'Grupos' : 'Órdenes OCI'}
              </button>
            ))}
          </div>
          {viewMode === 'grupos'
            ? <button className="btn primary sm" onClick={() => setShowNueva(true)}><Icon name="plus" size={13} /> Nuevo grupo</button>
            : <button className="btn primary sm" onClick={() => { setErrorNuevaOci(null); setShowNuevaOci(true) }}><Icon name="plus" size={13} /> Nueva OCI</button>
          }
        </div>
      </div>

      {/* ── Grupos view ───────────────────────────────────────────────── */}
      {viewMode === 'grupos' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <KPI label="En tránsito"          value={enTransito}  delta="embarques activos" icon="ship" />
            <KPI label="En aduanas"           value={enAduanas}   delta={enAduanas > 0 ? '¡Requiere atención!' : 'Sin pendientes'} deltaTone={enAduanas > 0 ? 'down' : ''} icon="warning" />
            <KPI label="ETA esta semana"      value={etaSemana}   delta="próximos 7 días" icon="clock" />
            <KPI label="Pendientes de costeo" value={pendCosteo}  delta="sin costo asignado" deltaTone={pendCosteo > 0 ? 'down' : ''} icon="coin" />
          </div>

          <Card padding={false}>
            <div className="table-toolbar">
              <div className="input-wrap">
                <Icon name="search" size={13} className="ico" />
                <input className="input with-ico" placeholder="Grupo, operador, país…" value={q}
                  onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
              </div>
              <select className="select" value={estado} onChange={e => setEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className="select" value={incoterm} onChange={e => setIncoterm(e.target.value)}>
                <option value="">Todos los Incoterms</option>
                {['FOB','CIF','CFR','FCA','EXW','DAP','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select className="select" value={tipoEmbarque} onChange={e => setTipoEmbarque(e.target.value)}>
                <option value="">Todos los embarques</option>
                {['Marítimo FCL','Marítimo LCL','Aéreo','Terrestre','Courier'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div className="spacer" />
              <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
            </div>
            <DataTable
              columns={columns as unknown as Column<Record<string, unknown>>[]}
              rows={importaciones as unknown as Record<string, unknown>[]}
              idKey="id"
              loading={loading}
              onRowClick={r => navigate(`/importaciones/${(r as unknown as Importacion).id}`)}
              emptyMessage="No hay importaciones que coincidan"
            />
          </Card>
        </>
      )}

      {/* ── OCIs view ─────────────────────────────────────────────────── */}
      {viewMode === 'ocis' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-toolbar">
            <div className="input-wrap" style={{ flex: '1 1 260px', maxWidth: 340 }}>
              <Icon name="search" size={13} style={{ color: 'var(--text-3)' }} />
              <input
                className="input with-ico"
                placeholder="N° OCI, proveedor, OPCI, grupo…"
                value={ociSearch}
                onChange={e => setOciSearch(e.target.value)}
              />
            </div>
            <select
              className="select"
              value={ociFilterEstado}
              onChange={e => setOciFilterEstado(e.target.value as EstadoOCI | '')}
              style={{ flex: '0 0 200px' }}
            >
              <option value="">Todos los estados</option>
              {OCI_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="card-body no-pad">
            <DataTable
              columns={ociColumns as unknown as Column<Record<string, unknown>>[]}
              rows={filteredOcis as unknown as Record<string, unknown>[]}
              idKey="id"
              loading={ociLoading}
              onRowClick={r => setSelectedOciId((r as unknown as OrdenCompraImportacion).id)}
              emptyMessage="No se encontraron órdenes OCI"
            />
          </div>
        </div>
      )}

      <OciDetailModal
        ociId={selectedOciId}
        onClose={() => setSelectedOciId(null)}
        onChanged={loadOcis}
      />

      {/* ── Modal: Nuevo grupo ─────────────────────────────────────────── */}
      <Modal open={showNueva} onClose={() => setShowNueva(false)} title="Nuevo grupo de importación" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowNueva(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCrearImportacion} disabled={savingNueva || !impForm.grupo_importacion}>
              {savingNueva ? 'Creando…' : 'Crear grupo'}
            </button>
          </>
        }>
        {errorNueva && <div style={ERR_STYLE}>{errorNueva}</div>}
        {renderGrupoFormFields(impForm, setImpForm)}
      </Modal>

      {/* ── Modal: Editar grupo ────────────────────────────────────────── */}
      <Modal open={showEditGrupo} onClose={() => setShowEditGrupo(false)} title="Editar grupo de importación" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowEditGrupo(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleEditGrupo} disabled={savingEditGrupo || !editGrupoForm.grupo_importacion}>
              {savingEditGrupo ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }>
        {errorEditGrupo && <div style={ERR_STYLE}>{errorEditGrupo}</div>}
        {renderGrupoFormFields(editGrupoForm, setEditGrupoForm)}
      </Modal>

      {/* ── Modal: Confirmar eliminación grupo ────────────────────────── */}
      <Modal open={!!confirmDeleteGrupo} onClose={() => setConfirmDeleteGrupo(null)} title="Eliminar grupo de importación" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setConfirmDeleteGrupo(null)}>Cancelar</button>
            <button className="btn" style={{ background: 'var(--bad)', color: '#fff', border: 'none' }}
              onClick={handleDeleteGrupo} disabled={deletingGrupo}>
              {deletingGrupo ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }>
        {deleteGrupoError && <div style={ERR_STYLE}>{deleteGrupoError}</div>}
        <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0 }}>
          ¿Eliminar el grupo <strong style={{ fontFamily: 'var(--font-mono)' }}>{confirmDeleteGrupo?.grupo_importacion}</strong>?
          Las OCI asociadas quedarán sin grupo de importación.
        </p>
      </Modal>

      {/* ── Modal: Nueva OCI standalone ───────────────────────────────── */}
      <Modal open={showNuevaOci} onClose={() => setShowNuevaOci(false)} title="Nueva OCI" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowNuevaOci(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCrearOciStandalone}
              disabled={savingNuevaOci || !ociNuevoProv || !ociNuevoForm.num_oc || !ociNuevoForm.fecha_oc}>
              {savingNuevaOci ? 'Creando…' : 'Crear OCI'}
            </button>
          </>
        }>
        {errorNuevaOci && <div style={ERR_STYLE}>{errorNuevaOci}</div>}
        {renderOciBaseFields(
          ociNuevoProv, setOciNuevoProv,
          ociNuevoImportacion, setOciNuevoImportacion,
          ociNuevoForm, setOciNuevoForm as Parameters<typeof renderOciBaseFields>[5],
        )}
      </Modal>

      {/* ── Modal: Editar OCI ──────────────────────────────────────────── */}
      <Modal open={showEditOci} onClose={() => setShowEditOci(false)}
        title={`Editar OCI ${editOciData?.num_oc ?? ''}`} size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowEditOci(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleEditOci}
              disabled={savingEditOci || !editOciProv || !editOciForm.num_oc}>
              {savingEditOci ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }>
        {errorEditOci && <div style={ERR_STYLE}>{errorEditOci}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {renderOciBaseFields(
            editOciProv, setEditOciProv,
            editOciImportacion, setEditOciImportacion,
            editOciForm,
            upd => setEditOciForm(prev => ({ ...prev, ...upd(prev) })),
          )}
          <div className="form-field" style={{ marginTop: 6 }}>
            <label className="form-label">Estado</label>
            <select className="select" value={editOciForm.status as string}
              onChange={e => setEditOciForm(f => ({ ...f, status: e.target.value as EstadoOCI }))}
              style={{ width: '100%' }}>
              {OCI_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {isEditConfirmada && (
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
                {editOciData?.id && profile && (
                  <button className="btn sm" style={{ whiteSpace: 'nowrap' }}
                    onClick={() => setShowUploadEditOci('confirmacion')}>
                    <Icon name="paperclip" size={12} /> Adjuntar
                  </button>
                )}
              </div>
            </div>
          )}

          {isEditInvoice && (
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
              {editOciData?.id && profile && (
                <button className="btn sm" style={{ marginTop: 10 }}
                  onClick={() => setShowUploadEditOci('invoice')}>
                  <Icon name="paperclip" size={12} /> Adjuntar invoice
                </button>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Confirmar eliminación OCI ──────────────────────────── */}
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
          ¿Eliminar la OCI <strong style={{ fontFamily: 'var(--font-mono)' }}>{confirmDeleteOci?.num_oc}</strong>?
          Se eliminarán también sus ítems. Esta acción no se puede deshacer.
        </p>
      </Modal>

      {/* Upload document for OCI edit */}
      {showUploadEditOci && editOciData?.id && profile && (
        <UploadDocumentoModal
          open={!!showUploadEditOci}
          onClose={() => setShowUploadEditOci(null)}
          entidadTipo="orden_compra_importacion"
          entidadId={editOciData.id}
          userId={profile.id}
          onUploaded={() => setShowUploadEditOci(null)}
        />
      )}
    </div>
  )
}
