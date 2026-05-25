import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Icon, Card, KPI, DataTable, StatusBadge,
  RECEPCION_STATUS_TONE, DESPACHO_STATUS_TONE, Tabs, Modal, Badge,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import {
  getRecepciones, registrarRecepcion,
  getDespachos, registrarDespacho,
  getKardex, getStock, getAlmacenes,
} from '@/services/almacen.service'
import { supabase } from '@/lib/supabase'
import { fmtDate, fmtDateTime } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { Recepcion, Despacho, AlmacenMovimiento, ConformidadRecepcion } from '@/types'

const TABS = [
  { id: 'recepciones', label: 'Recepciones' },
  { id: 'despachos',   label: 'Despachos' },
  { id: 'kardex',      label: 'Kardex' },
  { id: 'stock',       label: 'Stock' },
]

const today = new Date().toISOString().slice(0, 10)

interface RecItemRow {
  id: string
  item_oc: string
  codigo_comercial: string
  descripcion: string
  unidad_medida: string
  cantidad_oc: number
  cantidad_recibida: string
}

interface OCListItem {
  id: string
  num_oc: string
  operacion_id: string | null
  proveedor?: { razon_social: string }
  operacion?: { correlativo_opci: string }
}

interface DespachoForm {
  almacen_id: string; operacion_id: string; codigo_comercial: string; descripcion: string
  cantidad: string; unidad_medida: string; distrito_despacho: string
  fecha_despacho: string; erp_inta_salida: string; notas: string
}
const defaultDesp: DespachoForm = {
  almacen_id: '', operacion_id: '', codigo_comercial: '', descripcion: '', cantidad: '',
  unidad_medida: 'UND', distrito_despacho: '', fecha_despacho: today,
  erp_inta_salida: '', notas: '',
}

export function Almacen() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('recepciones')

  const [recepciones, setRecepciones] = useState<Recepcion[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [kardex, setKardex] = useState<AlmacenMovimiento[]>([])
  const [stock, setStock] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)

  // ── Recepción ─────────────────────────────────────────────────────────
  const [showRec, setShowRec] = useState(false)
  const [savingRec, setSavingRec] = useState(false)
  const [recError, setRecError] = useState<string | null>(null)
  const [almacenesList, setAlmacenesList] = useState<{ id: string; nombre: string; codigo: string }[]>([])
  const [ocList, setOcList] = useState<OCListItem[]>([])
  const [recHeader, setRecHeader] = useState({
    almacen_id: '',
    orden_compra_id: '',
    fecha_recepcion: today,
    conf_almacen: 'Conforme' as ConformidadRecepcion,
    motivo_conf_almacen: '',
    erp_inta_entrada: '',
    notas: '',
  })
  const [recItems, setRecItems] = useState<RecItemRow[]>([])
  const [loadingOcItems, setLoadingOcItems] = useState(false)

  // ── Despacho ──────────────────────────────────────────────────────────
  const [showDesp, setShowDesp] = useState(false)
  const [despForm, setDespForm] = useState<DespachoForm>(defaultDesp)
  const [savingDesp, setSavingDesp] = useState(false)

  // Despacho — product search
  const [despProdSearch, setDespProdSearch] = useState('')
  const [despProdSugeridos, setDespProdSugeridos] = useState<{ id: string; codigo_comercial: string; descripcion: string; unidad_medida: string }[]>([])
  const [showDespProdDrop, setShowDespProdDrop] = useState(false)
  const despProdDropRef = useRef<HTMLDivElement>(null)

  // Despacho — OPCI search
  const [despOpciSearch, setDespOpciSearch] = useState('')
  const [despOpciSugeridas, setDespOpciSugeridas] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [showDespOpciDrop, setShowDespOpciDrop] = useState(false)
  const despOpciDropRef = useRef<HTMLDivElement>(null)

  // Post-despacho: guía rápida
  const [showGuiaRapida, setShowGuiaRapida] = useState(false)
  const [guiaRapidaDespachoId, setGuiaRapidaDespachoId] = useState('')
  const [guiaRapidaOpciId, setGuiaRapidaOpciId] = useState('')
  const [guiaRapidaForm, setGuiaRapidaForm] = useState({
    numero_guia: '', fecha_emision: today, fecha_despacho: '',
    transportista: '', placa: '', conductor: '',
    distrito_destino: '', direccion_destino: '', observaciones: '',
  })
  const [savingGuiaRapida, setSavingGuiaRapida] = useState(false)

  const [kardexCodigo, setKardexCodigo] = useState('')

  // ── Load tab ──────────────────────────────────────────────────────────
  const loadTab = useCallback(async () => {
    setLoading(true)
    if (tab === 'recepciones') {
      const { data } = await getRecepciones({})
      setRecepciones(data ?? [])
    } else if (tab === 'despachos') {
      const { data } = await getDespachos({})
      setDespachos(data ?? [])
    } else if (tab === 'kardex') {
      const { data } = await getKardex(kardexCodigo || undefined)
      setKardex(data ?? [])
    } else if (tab === 'stock') {
      const { data } = await getStock()
      setStock((data as Record<string, unknown>[]) ?? [])
    }
    setLoading(false)
  }, [tab, kardexCodigo])

  useEffect(() => { loadTab() }, [loadTab])

  // ── Load almacenes + OC list when modal opens ─────────────────────────
  useEffect(() => {
    if (!showRec) return
    getAlmacenes().then(r => {
      const list = r.data ?? []
      setAlmacenesList(list)
      if (list.length === 1) setRecHeader(h => ({ ...h, almacen_id: list[0].id }))
    })
    supabase
      .from('ordenes_compra')
      .select('id, num_oc, operacion_id, proveedor:proveedores(razon_social), operacion:operaciones(correlativo_opci)')
      .eq('tipo', 'Local')
      .not('status', 'in', '("Cerrado","Anulado")')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setOcList((data ?? []) as OCListItem[]))
  }, [showRec])

  // ── Load OC items when OC changes ─────────────────────────────────────
  useEffect(() => {
    const ocId = recHeader.orden_compra_id
    if (!ocId) { setRecItems([]); return }
    setLoadingOcItems(true)
    supabase
      .from('orden_compra_items')
      .select('id, item_oc, codigo_comercial, descripcion, unidad_medida, cantidad')
      .eq('orden_compra_id', ocId)
      .order('item_oc', { nullsFirst: false })
      .then(({ data }) => {
        setRecItems(
          (data ?? []).map(item => ({
            id: item.id as string,
            item_oc: (item.item_oc as string) ?? '',
            codigo_comercial: (item.codigo_comercial as string) ?? '',
            descripcion: (item.descripcion as string) ?? '',
            unidad_medida: (item.unidad_medida as string) ?? 'UND',
            cantidad_oc: Number(item.cantidad) ?? 0,
            cantidad_recibida: String(item.cantidad ?? ''),
          })),
        )
        setLoadingOcItems(false)
      })
  }, [recHeader.orden_compra_id])

  // ── Despacho: product search ──────────────────────────────────────────
  useEffect(() => {
    if (despProdSearch.length > 0 && despProdSearch.length < 2) { setDespProdSugeridos([]); return }
    if (despProdSearch.length === 0) return
    const t = setTimeout(async () => {
      const { data } = await supabase.from('productos')
        .select('id, codigo_comercial, descripcion, unidad_medida')
        .or(`codigo_comercial.ilike.%${despProdSearch}%,descripcion.ilike.%${despProdSearch}%`)
        .eq('activo', true).eq('tipo', 'Producto').limit(20)
      setDespProdSugeridos((data ?? []) as { id: string; codigo_comercial: string; descripcion: string; unidad_medida: string }[])
      setShowDespProdDrop(true)
    }, 250)
    return () => clearTimeout(t)
  }, [despProdSearch])

  // ── Despacho: OPCI search ─────────────────────────────────────────────
  useEffect(() => {
    if (despOpciSearch.length > 0 && despOpciSearch.length < 2) { setDespOpciSugeridas([]); return }
    if (despOpciSearch.length === 0) return
    const t = setTimeout(async () => {
      const { data } = await supabase.from('operaciones')
        .select('id, correlativo_opci')
        .ilike('correlativo_opci', `%${despOpciSearch}%`)
        .not('estado', 'in', '("Cerrada","Anulada")')
        .order('correlativo_opci').limit(20)
      setDespOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
      setShowDespOpciDrop(true)
    }, 250)
    return () => clearTimeout(t)
  }, [despOpciSearch])

  // ── Outside-click closes dropdowns ────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (despProdDropRef.current && !despProdDropRef.current.contains(e.target as Node)) setShowDespProdDrop(false)
      if (despOpciDropRef.current && !despOpciDropRef.current.contains(e.target as Node)) setShowDespOpciDrop(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleDespProdFocus() {
    setShowDespProdDrop(true)
    if (!despProdSearch) {
      const { data } = await supabase.from('productos')
        .select('id, codigo_comercial, descripcion, unidad_medida')
        .eq('activo', true).eq('tipo', 'Producto').order('codigo_comercial').limit(20)
      setDespProdSugeridos((data ?? []) as { id: string; codigo_comercial: string; descripcion: string; unidad_medida: string }[])
    }
  }

  async function handleDespOpciFocus() {
    setShowDespOpciDrop(true)
    if (!despOpciSearch) {
      const { data } = await supabase.from('operaciones')
        .select('id, correlativo_opci')
        .not('estado', 'in', '("Cerrada","Anulada")')
        .order('correlativo_opci').limit(20)
      setDespOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
    }
  }

  function resetDesp() {
    setDespForm(defaultDesp)
    setDespProdSearch('')
    setDespProdSugeridos([])
    setDespOpciSearch('')
    setDespOpciSugeridas([])
  }

  // ── Registrar recepción ───────────────────────────────────────────────
  async function handleRegistrarRecepcion() {
    if (!profile) return
    if (!recHeader.almacen_id) { setRecError('Selecciona un almacén.'); return }
    if (recItems.length === 0) { setRecError('Selecciona una OC para cargar los ítems.'); return }

    const itemsToSave = recItems.filter(i => {
      const cr = parseFloat(i.cantidad_recibida)
      return !isNaN(cr) && cr > 0
    })
    if (itemsToSave.length === 0) {
      setRecError('Ingresa al menos una cantidad recibida mayor a 0.')
      return
    }

    const oc = ocList.find(o => o.id === recHeader.orden_compra_id)
    setSavingRec(true)
    setRecError(null)

    for (const item of itemsToSave) {
      const { error } = await registrarRecepcion(
        {
          almacen_id: recHeader.almacen_id,
          orden_compra_id: recHeader.orden_compra_id || undefined,
          operacion_id: oc?.operacion_id || undefined,
          num_oc: oc?.num_oc || undefined,
          item_oc: item.item_oc || undefined,
          codigo_comercial: item.codigo_comercial,
          descripcion: item.descripcion,
          cantidad_esperada: item.cantidad_oc,
          cantidad_recibida: parseFloat(item.cantidad_recibida),
          unidad_medida: item.unidad_medida,
          conf_almacen: recHeader.conf_almacen,
          motivo_conf_almacen: recHeader.motivo_conf_almacen || undefined,
          fecha_recepcion: recHeader.fecha_recepcion || undefined,
          erp_inta_entrada: recHeader.erp_inta_entrada || undefined,
          notas: recHeader.notas || undefined,
          estado: 'Pendiente',
        } as unknown as Omit<Recepcion, 'id' | 'created_at' | 'updated_at'>,
        profile.id,
      )
      if (error) {
        setRecError(`Error en "${item.codigo_comercial}": ${(error as Error)?.message ?? 'Error desconocido'}`)
        setSavingRec(false)
        return
      }
    }

    setSavingRec(false)
    setShowRec(false)
    resetRec()
    loadTab()
  }

  function resetRec() {
    setRecHeader({ almacen_id: '', orden_compra_id: '', fecha_recepcion: today, conf_almacen: 'Conforme', motivo_conf_almacen: '', erp_inta_entrada: '', notas: '' })
    setRecItems([])
    setRecError(null)
  }

  // ── Registrar despacho ────────────────────────────────────────────────
  async function handleRegistrarDespacho() {
    if (!profile) return
    if (!despForm.almacen_id) return
    setSavingDesp(true)
    const { data: despachoCreado } = await registrarDespacho(
      {
        almacen_id: despForm.almacen_id,
        operacion_id: despForm.operacion_id || undefined,
        codigo_comercial: despForm.codigo_comercial,
        descripcion: despForm.descripcion,
        cantidad: parseFloat(despForm.cantidad),
        unidad_medida: despForm.unidad_medida,
        distrito_despacho: despForm.distrito_despacho || undefined,
        fecha_despacho: despForm.fecha_despacho,
        erp_inta_salida: despForm.erp_inta_salida || undefined,
        notas: despForm.notas || undefined,
        estado: 'Preparando',
      } as unknown as Omit<Despacho, 'id' | 'created_at' | 'updated_at'>,
      profile.id,
    )
    setSavingDesp(false)
    setShowDesp(false)
    resetDesp()
    loadTab()
    if (despachoCreado?.id) {
      setGuiaRapidaDespachoId(despachoCreado.id)
      setGuiaRapidaOpciId(despForm.operacion_id)
      setGuiaRapidaForm(f => ({
        ...f,
        fecha_despacho: despachoCreado.fecha_despacho ?? '',
        distrito_destino: despachoCreado.distrito_despacho ?? '',
      }))
      setShowGuiaRapida(true)
    }
  }

  async function handleGuardarGuiaRapida() {
    if (!profile || !guiaRapidaForm.numero_guia) return
    setSavingGuiaRapida(true)
    await supabase.from('guias_remision').insert({
      despacho_id:      guiaRapidaDespachoId || null,
      operacion_id:     guiaRapidaOpciId || null,
      numero_guia:      guiaRapidaForm.numero_guia,
      fecha_emision:    guiaRapidaForm.fecha_emision || null,
      fecha_despacho:   guiaRapidaForm.fecha_despacho || null,
      transportista:    guiaRapidaForm.transportista || null,
      placa:            guiaRapidaForm.placa || null,
      conductor:        guiaRapidaForm.conductor || null,
      distrito_destino: guiaRapidaForm.distrito_destino || null,
      direccion_destino: guiaRapidaForm.direccion_destino || null,
      observaciones:    guiaRapidaForm.observaciones || null,
      estado: 'Emitida',
      usuario_id: profile.id,
    })
    setSavingGuiaRapida(false)
    setShowGuiaRapida(false)
    setGuiaRapidaDespachoId('')
    setGuiaRapidaOpciId('')
    setGuiaRapidaForm({ numero_guia: '', fecha_emision: today, fecha_despacho: '', transportista: '', placa: '', conductor: '', distrito_destino: '', direccion_destino: '', observaciones: '' })
  }

  const pendRec  = recepciones.filter(r => r.estado === 'Pendiente').length
  const obsRec   = recepciones.filter(r => r.estado === 'Observado').length
  const pendDesp = despachos.filter(d => d.estado === 'Preparando').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Almacén</h1>
          <div className="page-sub">Control de recepciones, despachos y movimientos de inventario</div>
        </div>
        <div className="page-actions">
          {tab === 'recepciones' && (
            <button className="btn primary sm" onClick={() => setShowRec(true)}>
              <Icon name="plus" size={13} /> Registrar recepción
            </button>
          )}
          {tab === 'despachos' && (
            <button className="btn primary sm" onClick={() => {
              resetDesp()
              setShowDesp(true)
              getAlmacenes().then(r => {
                const list = r.data ?? []
                setAlmacenesList(list)
                if (list.length === 1) setDespForm(d => ({ ...d, almacen_id: list[0].id }))
              })
            }}>
              <Icon name="plus" size={13} /> Registrar despacho
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KPI label="Recepciones pendientes" value={pendRec}  deltaTone={pendRec > 0 ? 'down' : ''} delta={pendRec > 0 ? 'por procesar' : ''} icon="warehouse" />
        <KPI label="Recepciones observadas" value={obsRec}   deltaTone={obsRec > 0 ? 'down' : ''} delta={obsRec > 0 ? 'requieren revisión' : ''} icon="warning" />
        <KPI label="Despachos pendientes"   value={pendDesp} deltaTone={pendDesp > 0 ? 'down' : ''} delta={pendDesp > 0 ? 'en preparación' : ''} icon="truck" />
        <KPI label="Productos en stock"     value={stock.length} icon="box" />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Recepciones */}
      {tab === 'recepciones' && (
        <Card padding={false}>
          <DataTable
            columns={[
              { key: 'operacion',        label: 'OPCI',     render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{(r.operacion as { correlativo_opci: string })?.correlativo_opci ?? '—'}</span> },
              { key: 'num_oc',           label: 'N° OC',    render: r => <span className="mono">{r.num_oc as string ?? '—'}</span> },
              { key: 'item_oc',          label: 'Item',     width: 60, render: r => <span className="mono muted">{r.item_oc as string ?? '—'}</span> },
              { key: 'codigo_comercial', label: 'Código',   render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',      label: 'Descripción', render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion as string}</span> },
              { key: 'cantidad_esperada', label: 'Esperada', align: 'right', render: r => <span className="mono">{r.cantidad_esperada as number}</span> },
              { key: 'cantidad_recibida', label: 'Recibida', align: 'right', render: r => <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{r.cantidad_recibida as number}</span> },
              { key: 'unidad_medida',    label: 'UM',       width: 50 },
              { key: 'fecha_recepcion',  label: 'Fecha',    render: r => <span className="mono">{fmtDate(r.fecha_recepcion as string)}</span> },
              { key: 'estado',           label: 'Estado',   render: r => <StatusBadge status={r.estado as string} mapping={RECEPCION_STATUS_TONE} /> },
            ] as Column<Record<string, unknown>>[]}
            rows={recepciones as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="No hay recepciones registradas"
          />
        </Card>
      )}

      {/* Despachos */}
      {tab === 'despachos' && (
        <Card padding={false}>
          <DataTable
            columns={[
              { key: 'operacion',        label: 'OPCI',         render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{(r.operacion as { correlativo_opci: string })?.correlativo_opci ?? '—'}</span> },
              { key: 'codigo_comercial', label: 'Código',       render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',      label: 'Descripción',  render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion as string}</span> },
              { key: 'cantidad',         label: 'Cant.',        align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
              { key: 'unidad_medida',    label: 'UM',           width: 50 },
              { key: 'distrito_despacho', label: 'Distrito',    render: r => <span className="muted">{r.distrito_despacho as string ?? '—'}</span> },
              { key: 'fecha_despacho',   label: 'F. despacho',  render: r => <span className="mono">{fmtDate(r.fecha_despacho as string)}</span> },
              { key: 'erp_inta_salida',  label: 'ERP Salida',   render: r => <span className="mono">{r.erp_inta_salida as string ?? '—'}</span> },
              { key: 'estado',           label: 'Estado',       render: r => <StatusBadge status={r.estado as string} mapping={DESPACHO_STATUS_TONE} /> },
            ] as Column<Record<string, unknown>>[]}
            rows={despachos as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="No hay despachos pendientes"
          />
        </Card>
      )}

      {/* Kardex */}
      {tab === 'kardex' && (
        <Card padding={false}>
          <div className="table-toolbar">
            <div className="input-wrap">
              <Icon name="search" size={13} className="ico" />
              <input className="input with-ico" placeholder="Código de producto…" value={kardexCodigo}
                onChange={e => setKardexCodigo(e.target.value)} style={{ width: 220 }} />
            </div>
            <div className="spacer" />
            <button className="btn sm"><Icon name="download" size={13} /> Exportar kardex</button>
          </div>
          <DataTable
            columns={[
              { key: 'created_at',          label: 'Fecha',      render: r => <span className="mono">{fmtDateTime(r.created_at as string)}</span> },
              { key: 'producto_codigo',      label: 'Código',     render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.producto_codigo as string}</span> },
              { key: 'tipo',                 label: 'Tipo',       render: r => {
                const t = r.tipo as string
                const tone = t === 'entrada' ? 'ok' : t === 'salida' ? 'bad' : t === 'ajuste' ? 'info' : 'violet'
                return <Badge tone={tone}>{t}</Badge>
              }},
              { key: 'documento_referencia', label: 'Documento',  render: r => <span className="mono">{r.documento_referencia as string ?? '—'}</span> },
              { key: 'cantidad_entrada',     label: 'Entrada',    align: 'right', render: r => r.tipo === 'entrada' ? <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{r.cantidad as number}</span> : <span className="muted">—</span> },
              { key: 'cantidad_salida',      label: 'Salida',     align: 'right', render: r => r.tipo === 'salida' ? <span className="mono" style={{ color: 'var(--bad)', fontWeight: 600 }}>{r.cantidad as number}</span> : <span className="muted">—</span> },
              { key: 'stock_final',          label: 'Stock final', align: 'right', render: r => <span className="mono" style={{ fontWeight: 700 }}>{r.stock_final as number}</span> },
              { key: 'comentario',           label: 'Comentario', render: r => <span className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.comentario as string ?? '—'}</span> },
            ] as Column<Record<string, unknown>>[]}
            rows={kardex as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="Sin movimientos registrados"
          />
        </Card>
      )}

      {/* Stock */}
      {tab === 'stock' && (
        <Card padding={false}>
          <div className="table-toolbar">
            <div className="spacer" />
            <button className="btn sm"><Icon name="download" size={13} /> Exportar stock</button>
          </div>
          <DataTable
            columns={[
              { key: 'producto_codigo', label: 'Código',        render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.producto_codigo as string}</span> },
              { key: 'descripcion',     label: 'Descripción' },
              { key: 'unidad_medida',   label: 'UM',            width: 60 },
              { key: 'stock_actual',    label: 'Stock actual',   align: 'right', render: r => {
                const s = r.stock_actual as number
                return <span className="mono" style={{ fontWeight: 700, color: s <= 0 ? 'var(--bad)' : s <= 5 ? 'var(--warn)' : 'var(--ok)' }}>{s}</span>
              }},
            ] as Column<Record<string, unknown>>[]}
            rows={stock}
            idKey="producto_codigo"
            loading={loading}
            emptyMessage="Sin productos en stock"
          />
        </Card>
      )}

      {/* ── Modal: Registrar recepción ─────────────────────────────────── */}
      <Modal
        open={showRec}
        onClose={() => { setShowRec(false); resetRec() }}
        title="Registrar recepción"
        size="xl"
        footer={
          <>
            <button className="btn" onClick={() => { setShowRec(false); resetRec() }}>Cancelar</button>
            <button
              className="btn primary"
              onClick={handleRegistrarRecepcion}
              disabled={savingRec || !recHeader.almacen_id || recItems.length === 0}
            >
              {savingRec ? <><Icon name="spinner" size={12} style={{ animation: 'spin 1s linear infinite' }} /> Registrando…</> : 'Registrar recepción'}
            </button>
          </>
        }
      >
        {recError && (
          <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 14 }}>
            {recError}
          </div>
        )}

        {/* Campos globales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>

          {/* Almacén */}
          <div className="form-field">
            <label className="form-label">Almacén *</label>
            <select
              className="select"
              value={recHeader.almacen_id}
              onChange={e => setRecHeader(h => ({ ...h, almacen_id: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">— Seleccionar almacén —</option>
              {almacenesList.map(a => (
                <option key={a.id} value={a.id}>{a.nombre} {a.codigo ? `(${a.codigo})` : ''}</option>
              ))}
            </select>
          </div>

          {/* OC */}
          <div className="form-field">
            <label className="form-label">Orden de Compra *</label>
            <select
              className="select"
              value={recHeader.orden_compra_id}
              onChange={e => setRecHeader(h => ({ ...h, orden_compra_id: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="">— Seleccionar OC —</option>
              {ocList.map(oc => (
                <option key={oc.id} value={oc.id}>
                  {oc.num_oc}
                  {oc.proveedor ? ` — ${oc.proveedor.razon_social}` : ''}
                  {oc.operacion ? ` (${oc.operacion.correlativo_opci})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha recepción */}
          <div className="form-field">
            <label className="form-label">Fecha recepción *</label>
            <input
              type="date"
              className="input"
              value={recHeader.fecha_recepcion}
              onChange={e => setRecHeader(h => ({ ...h, fecha_recepcion: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Conformidad */}
          <div className="form-field">
            <label className="form-label">Conformidad almacén</label>
            <select
              className="select"
              value={recHeader.conf_almacen}
              onChange={e => setRecHeader(h => ({ ...h, conf_almacen: e.target.value as ConformidadRecepcion }))}
              style={{ width: '100%' }}
            >
              <option>Conforme</option>
              <option>Observado</option>
              <option>Rechazado</option>
            </select>
          </div>

          {/* Motivo (si no es conforme) */}
          {recHeader.conf_almacen !== 'Conforme' && (
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Motivo de observación</label>
              <textarea
                className="input"
                rows={2}
                value={recHeader.motivo_conf_almacen}
                onChange={e => setRecHeader(h => ({ ...h, motivo_conf_almacen: e.target.value }))}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>
          )}

          {/* ERP Entrada */}
          <div className="form-field">
            <label className="form-label">N° ERP / INTA Entrada</label>
            <input
              className="input"
              value={recHeader.erp_inta_entrada}
              onChange={e => setRecHeader(h => ({ ...h, erp_inta_entrada: e.target.value }))}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              placeholder="Ej: INTA-2026-001"
            />
          </div>

          {/* Notas */}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea
              className="input"
              rows={2}
              value={recHeader.notas}
              onChange={e => setRecHeader(h => ({ ...h, notas: e.target.value }))}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Items de la OC */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Ítems a recibir</span>
            {recItems.length > 0 && <Badge tone="muted">{recItems.length}</Badge>}
          </div>

          {!recHeader.orden_compra_id ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, border: '1px dashed var(--border)', borderRadius: 6 }}>
              Selecciona una OC para cargar los ítems
            </div>
          ) : loadingOcItems ? (
            <div className="loading-row" style={{ padding: 20 }}>
              <Icon name="spinner" size={14} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ marginLeft: 8 }}>Cargando ítems…</span>
            </div>
          ) : recItems.length === 0 ? (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12.5, border: '1px dashed var(--border)', borderRadius: 6 }}>
              La OC seleccionada no tiene ítems registrados
            </div>
          ) : (
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 6 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: 'var(--panel-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Item OC', 'Código', 'Descripción', 'UM', 'Cant. OC', 'Cant. recibida *'].map(h => (
                      <th key={h} style={{ padding: '7px 10px', textAlign: h.startsWith('Cant') ? 'right' : 'left', color: 'var(--text-3)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recItems.map((item, idx) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-soft)' }}>
                      <td style={{ padding: '6px 10px' }}>
                        <span className="mono muted">{item.item_oc || '—'}</span>
                      </td>
                      <td style={{ padding: '6px 10px' }}>
                        <span className="mono" style={{ color: 'var(--accent-2)' }}>{item.codigo_comercial}</span>
                      </td>
                      <td style={{ padding: '6px 10px', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.descripcion}>
                        {item.descripcion}
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <span className="mono muted">{item.unidad_medida}</span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        <span className="mono">{item.cantidad_oc}</span>
                      </td>
                      <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                        <input
                          type="number"
                          className="input"
                          value={item.cantidad_recibida}
                          min="0"
                          step="any"
                          style={{ width: 96, fontFamily: 'var(--font-mono)', textAlign: 'right', padding: '4px 8px' }}
                          onChange={e =>
                            setRecItems(prev =>
                              prev.map((it, i) => i === idx ? { ...it, cantidad_recibida: e.target.value } : it),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* ── Modal: Registrar despacho ──────────────────────────────────── */}
      <Modal
        open={showDesp}
        onClose={() => { setShowDesp(false); resetDesp() }}
        title="Registrar despacho"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => { setShowDesp(false); resetDesp() }}>Cancelar</button>
            <button className="btn primary" onClick={handleRegistrarDespacho} disabled={savingDesp || !despForm.almacen_id || !despForm.codigo_comercial || !despForm.cantidad}>
              {savingDesp ? 'Guardando…' : 'Registrar despacho'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

          {/* Almacén */}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Almacén *</label>
            <select className="select" value={despForm.almacen_id} onChange={e => setDespForm(d => ({ ...d, almacen_id: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Seleccionar almacén —</option>
              {almacenesList.map(a => <option key={a.id} value={a.id}>{a.nombre} {a.codigo ? `(${a.codigo})` : ''}</option>)}
            </select>
          </div>

          {/* OPCI search */}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">OPCI (opcional)</label>
            <div style={{ position: 'relative' }} ref={despOpciDropRef}>
              <input
                className="input"
                value={despOpciSearch}
                onChange={e => { setDespOpciSearch(e.target.value); if (!e.target.value) setDespForm(d => ({ ...d, operacion_id: '' })) }}
                onFocus={handleDespOpciFocus}
                placeholder="Buscar OPCI…"
                style={{ width: '100%' }}
              />
              {showDespOpciDrop && despOpciSugeridas.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 180, overflowY: 'auto' }}>
                  {despOpciSugeridas.map(o => (
                    <div key={o.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
                      onMouseDown={() => { setDespOpciSearch(o.correlativo_opci); setDespForm(d => ({ ...d, operacion_id: o.id })); setShowDespOpciDrop(false) }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{o.correlativo_opci}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product search */}
          <div className="form-field" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={despProdDropRef}>
            <label className="form-label">Producto *</label>
            <input
              className="input"
              value={despProdSearch}
              onChange={e => { setDespProdSearch(e.target.value); setShowDespProdDrop(true); if (!e.target.value) setDespForm(d => ({ ...d, codigo_comercial: '', descripcion: '', unidad_medida: 'UND' })) }}
              onFocus={handleDespProdFocus}
              placeholder="Código comercial o descripción…"
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
            />
            {showDespProdDrop && despProdSugeridos.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 200, overflowY: 'auto' }}>
                {despProdSugeridos.map(p => (
                  <div key={p.id} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
                    onMouseDown={() => { setDespProdSearch(p.codigo_comercial); setDespForm(d => ({ ...d, codigo_comercial: p.codigo_comercial, descripcion: p.descripcion, unidad_medida: p.unidad_medida })); setShowDespProdDrop(false) }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, marginRight: 8 }}>{p.codigo_comercial}</span>
                    <span style={{ color: 'var(--text-2)' }}>{p.descripcion}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Descripción (read-only si producto seleccionado) */}
          {despForm.descripcion && (
            <div style={{ gridColumn: '1 / -1', padding: '6px 10px', background: 'var(--accent-soft)', borderRadius: 6, fontSize: 12 }}>
              <span className="muted">Descripción: </span><strong>{despForm.descripcion}</strong>
            </div>
          )}

          <div className="form-field">
            <label className="form-label">Cantidad *</label>
            <input type="number" className="input" value={despForm.cantidad} onChange={e => setDespForm(d => ({ ...d, cantidad: e.target.value }))} style={{ width: '100%' }} step="any" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Unidad de medida</label>
            <input list="dl-umd-desp" className="input" value={despForm.unidad_medida} onChange={e => setDespForm(d => ({ ...d, unidad_medida: e.target.value }))} style={{ width: '100%' }} />
            <datalist id="dl-umd-desp">
              {['UND','KG','M','M2','M3','L','GLN','PAR','SET','CAJA','ROLLO','HRS','TON','PZA'].map(u => <option key={u} value={u} />)}
            </datalist>
          </div>
          <div className="form-field">
            <label className="form-label">Distrito despacho</label>
            <input className="input" value={despForm.distrito_despacho} onChange={e => setDespForm(d => ({ ...d, distrito_despacho: e.target.value }))} style={{ width: '100%' }} placeholder="Ej: Miraflores" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha despacho</label>
            <input type="date" className="input" value={despForm.fecha_despacho} onChange={e => setDespForm(d => ({ ...d, fecha_despacho: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">ERP Salida</label>
            <input className="input" value={despForm.erp_inta_salida} onChange={e => setDespForm(d => ({ ...d, erp_inta_salida: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="INTA-2026-001" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={despForm.notas} onChange={e => setDespForm(d => ({ ...d, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* ── Modal: Guía de remisión rápida (post-despacho) ─────────────── */}
      <Modal
        open={showGuiaRapida}
        onClose={() => setShowGuiaRapida(false)}
        title="¿Emitir guía de remisión?"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowGuiaRapida(false)}>Omitir por ahora</button>
            <button className="btn primary" onClick={handleGuardarGuiaRapida} disabled={savingGuiaRapida || !guiaRapidaForm.numero_guia}>
              {savingGuiaRapida ? 'Guardando…' : 'Emitir guía'}
            </button>
          </>
        }
      >
        <div style={{ background: 'var(--accent-soft)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, marginBottom: 14 }}>
          El despacho fue registrado. Completa los datos del transporte para emitir la guía de remisión ahora, o hazlo más tarde desde <strong>Guías y Despachos</strong>.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">N° Guía *</label>
            <input className="input" value={guiaRapidaForm.numero_guia} onChange={e => setGuiaRapidaForm(f => ({ ...f, numero_guia: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="GR-2026-001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha emisión</label>
            <input type="date" className="input" value={guiaRapidaForm.fecha_emision} onChange={e => setGuiaRapidaForm(f => ({ ...f, fecha_emision: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha despacho</label>
            <input type="date" className="input" value={guiaRapidaForm.fecha_despacho} onChange={e => setGuiaRapidaForm(f => ({ ...f, fecha_despacho: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Transportista</label>
            <input className="input" value={guiaRapidaForm.transportista} onChange={e => setGuiaRapidaForm(f => ({ ...f, transportista: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Placa</label>
            <input className="input" value={guiaRapidaForm.placa} onChange={e => setGuiaRapidaForm(f => ({ ...f, placa: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Conductor</label>
            <input className="input" value={guiaRapidaForm.conductor} onChange={e => setGuiaRapidaForm(f => ({ ...f, conductor: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Distrito destino</label>
            <input className="input" value={guiaRapidaForm.distrito_destino} onChange={e => setGuiaRapidaForm(f => ({ ...f, distrito_destino: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Dirección destino</label>
            <input className="input" value={guiaRapidaForm.direccion_destino} onChange={e => setGuiaRapidaForm(f => ({ ...f, direccion_destino: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observaciones</label>
            <textarea className="input" rows={2} value={guiaRapidaForm.observaciones} onChange={e => setGuiaRapidaForm(f => ({ ...f, observaciones: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
