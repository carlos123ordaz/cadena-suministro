import { useState, useEffect, useCallback, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, Card, KPI, DataTable, StatusBadge, FACTURA_STATUS_TONE, EtaCell, Modal, Drawer, MetaGrid, Badge, UploadDocumentoModal } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getFacturas, getFactura, registrarPago, createFactura, cambiarEstadoFactura } from '@/services/facturacion.service'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { money, fmtDate, daysFrom, fmtDbError } from '@/lib/utils'
import { downloadCsv } from '@/lib/export'
import type { FacturaVenta, EstadoFactura, PagoFactura } from '@/types'

interface FacturaConPagos extends FacturaVenta { pagos?: PagoFactura[] }

const ESTADOS: EstadoFactura[] = [
  'Pendiente de emisión','Emitida','Enviada al cliente','Pendiente de pago',
  'Pagada parcial','Pagada total','Vencida','Anulada','Nota de crédito emitida',
]

interface PagoForm { fecha_pago: string; monto: string; moneda: string; referencia: string; entidad_financiera: string }
const defaultPago: PagoForm = { fecha_pago: new Date().toISOString().slice(0,10), monto: '', moneda: 'PEN', referencia: '', entidad_financiera: '' }

export function Facturacion() {
  const { profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showUpload, setShowUpload] = useState(false)
  const [facturas, setFacturas] = useState<FacturaVenta[]>([])
  const [selected, setSelected] = useState<FacturaConPagos | null>(null)
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)

  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [soloVencidas, setSoloVencidas] = useState(false)

  const [showPago, setShowPago] = useState(false)
  const [pagoForm, setPagoForm] = useState<PagoForm>(defaultPago)
  const [savingPago, setSavingPago] = useState(false)
  const [errorPago, setErrorPago] = useState<string | null>(null)

  const [showNueva, setShowNueva] = useState(false)
  const [opciSearch, setOpciSearch] = useState('')
  const [opciSugeridas, setOpciSugeridas] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [showOpciDrop, setShowOpciDrop] = useState(false)
  const opciDropRef = useRef<HTMLDivElement>(null)
  const [facturaForm, setFacturaForm] = useState({ operacion_id: '', num_factura: '', fecha_emision: new Date().toISOString().slice(0,10), fecha_prometida_pago: '', moneda: 'USD', monto_total_sin_igv: '', factor_igv: '1.18', tc_usd_sol: '', forma_pago: '', dias_cobranza: '', categoria_forma_pago: '', categoria_operacion: '' })
  const [savingFactura, setSavingFactura] = useState(false)
  const [errorFactura, setErrorFactura] = useState<string | null>(null)

  const [showEstado, setShowEstado] = useState(false)
  const [nuevoEstadoFact, setNuevoEstadoFact] = useState<EstadoFactura | ''>('')
  const [savingEstadoFact, setSavingEstadoFact] = useState(false)

  const [editRow, setEditRow] = useState<FacturaVenta | null>(null)
  const [editForm, setEditForm] = useState({
    num_factura: '', fecha_emision: '', fecha_prometida_pago: '', moneda: 'USD',
    monto_total_sin_igv: '', factor_igv: '1.18', forma_pago: '', dias_cobranza: '',
    status: '' as EstadoFactura | '',
  })
  const [savingEditFact, setSavingEditFact] = useState(false)

  const [deleteRow, setDeleteRow] = useState<FacturaVenta | null>(null)
  const [deletingRow, setDeletingRow] = useState(false)

  function handleExport() {
    downloadCsv(`facturas_${new Date().toISOString().slice(0,10)}`, facturas.map(f => ({
      'N° Factura': f.num_factura ?? '',
      'Estado': f.status,
      'Fecha Emisión': f.fecha_emision ?? '',
      'Fecha Pago Prometida': f.fecha_prometida_pago ?? '',
      'Moneda': f.moneda ?? '',
      'Monto s/IGV': f.monto_total_sin_igv ?? '',
      'Factor IGV': f.factor_igv ?? '',
      'Forma de Pago': f.forma_pago ?? '',
    })))
  }

  function openEditFact(r: FacturaVenta) {
    setEditForm({
      num_factura: r.num_factura ?? '',
      fecha_emision: r.fecha_emision ?? '',
      fecha_prometida_pago: r.fecha_prometida_pago ?? '',
      moneda: r.moneda ?? 'USD',
      monto_total_sin_igv: r.monto_total_sin_igv?.toString() ?? '',
      factor_igv: r.factor_igv?.toString() ?? '1.18',
      forma_pago: r.forma_pago ?? '',
      dias_cobranza: r.dias_cobranza?.toString() ?? '',
      status: r.status,
    })
    setEditRow(r)
  }

  async function handleSaveEditFact() {
    if (!editRow) return
    setSavingEditFact(true)
    await supabase.from('facturas').update({
      num_factura: editForm.num_factura || undefined,
      fecha_emision: editForm.fecha_emision || null,
      fecha_prometida_pago: editForm.fecha_prometida_pago || null,
      moneda: editForm.moneda,
      monto_total_sin_igv: parseFloat(editForm.monto_total_sin_igv) || 0,
      factor_igv: parseFloat(editForm.factor_igv) || 1.18,
      forma_pago: editForm.forma_pago || null,
      dias_cobranza: editForm.dias_cobranza ? parseInt(editForm.dias_cobranza) : null,
      status: editForm.status || undefined,
    }).eq('id', editRow.id)
    setSavingEditFact(false)
    setEditRow(null)
    load()
  }

  async function handleDeleteFact() {
    if (!deleteRow) return
    setDeletingRow(true)
    await supabase.from('facturas').delete().eq('id', deleteRow.id)
    setDeletingRow(false)
    setDeleteRow(null)
    load()
  }

  const load = useCallback(async () => {
    setLoading(true)
    const { data, count } = await getFacturas({
      search: q || undefined,
      status: (estado as EstadoFactura) || undefined,
      vencidas: soloVencidas || undefined,
    }, { page: 1, pageSize: 50 })
    setFacturas(data ?? [])
    setTotal(count)
    setLoading(false)
  }, [q, estado, soloVencidas])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!opciSearch.trim()) { setOpciSugeridas([]); setShowOpciDrop(false); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('operaciones').select('id, correlativo_opci')
        .not('estado', 'in', '("Cerrada","Anulada")')
        .ilike('correlativo_opci', `%${opciSearch}%`).order('correlativo_opci').limit(20)
      setOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
      setShowOpciDrop(true)
    }, 250)
    return () => clearTimeout(t)
  }, [opciSearch])

  useEffect(() => {
    function h(e: MouseEvent) {
      if (opciDropRef.current && !opciDropRef.current.contains(e.target as Node)) setShowOpciDrop(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  async function handleOpciFocus() {
    const { data } = await supabase.from('operaciones').select('id, correlativo_opci')
      .not('estado', 'in', '("Cerrada","Anulada")')
      .order('correlativo_opci').limit(20)
    setOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
    setShowOpciDrop(true)
  }

  // Pre-fill OPCI and open modal when navigated from OperacionDetail
  useEffect(() => {
    const opciParam = searchParams.get('opci')
    if (opciParam) {
      setFacturaForm(f => ({ ...f, operacion_id: opciParam }))
      supabase.from('operaciones').select('correlativo_opci').eq('id', opciParam).single()
        .then(({ data }) => { if (data) setOpciSearch((data as { correlativo_opci: string }).correlativo_opci) })
      setShowNueva(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams, setSearchParams])

  async function handleCrearFactura() {
    if (!facturaForm.num_factura || !facturaForm.monto_total_sin_igv) { setErrorFactura('N° factura y monto son obligatorios.'); return }
    setSavingFactura(true); setErrorFactura(null)
    const { error } = await createFactura({
      operacion_id: facturaForm.operacion_id || (null as unknown as string),
      num_factura: facturaForm.num_factura.trim(),
      fecha_emision: facturaForm.fecha_emision || undefined,
      fecha_prometida_pago: facturaForm.fecha_prometida_pago || undefined,
      moneda: facturaForm.moneda as 'USD' | 'PEN' | 'EUR',
      monto_total_sin_igv: parseFloat(facturaForm.monto_total_sin_igv),
      factor_igv: parseFloat(facturaForm.factor_igv) || 1.18,
      tc_usd_sol: facturaForm.tc_usd_sol ? parseFloat(facturaForm.tc_usd_sol) : undefined,
      forma_pago: facturaForm.forma_pago || undefined,
      dias_cobranza: facturaForm.dias_cobranza ? parseInt(facturaForm.dias_cobranza) : undefined,
      categoria_forma_pago: facturaForm.categoria_forma_pago || undefined,
      categoria_operacion: facturaForm.categoria_operacion || undefined,
      status: 'Pendiente de emisión',
    })
    setSavingFactura(false)
    if (error) { setErrorFactura(fmtDbError(error, 'Error al crear.')); return }
    setShowNueva(false)
    setFacturaForm({ operacion_id: '', num_factura: '', fecha_emision: new Date().toISOString().slice(0,10), fecha_prometida_pago: '', moneda: 'USD', monto_total_sin_igv: '', factor_igv: '1.18', tc_usd_sol: '', forma_pago: '', dias_cobranza: '', categoria_forma_pago: '', categoria_operacion: '' })
    load()
  }

  const NEXT_ESTADOS_FACTURA: Partial<Record<EstadoFactura, EstadoFactura[]>> = {
    'Pendiente de emisión':  ['Emitida', 'Anulada'],
    'Emitida':               ['Enviada al cliente', 'Anulada'],
    'Enviada al cliente':    ['Pendiente de pago', 'Anulada'],
    'Pendiente de pago':     ['Pagada parcial', 'Pagada total', 'Vencida', 'Anulada'],
    'Pagada parcial':        ['Pagada total', 'Vencida', 'Anulada'],
    'Vencida':               ['Pagada parcial', 'Pagada total', 'Anulada'],
    'Pagada total':          ['Nota de crédito emitida'],
  }

  async function openDrawer(f: FacturaVenta) {
    const { data } = await getFactura(f.id)
    setSelected(data as FacturaConPagos | null)
  }

  async function handleCambiarEstadoFactura() {
    if (!selected || !nuevoEstadoFact) return
    setSavingEstadoFact(true)
    await cambiarEstadoFactura(selected.id, nuevoEstadoFact)
    setSavingEstadoFact(false)
    setShowEstado(false)
    setNuevoEstadoFact('')
    load()
    const { data } = await getFactura(selected.id)
    setSelected(data as FacturaConPagos | null)
  }

  async function handlePago() {
    if (!selected) { setErrorPago('Error de sesión. Recarga la página.'); return }
    if (!pagoForm.monto || parseFloat(pagoForm.monto) <= 0) { setErrorPago('Ingresa un monto válido mayor a 0.'); return }
    setSavingPago(true)
    setErrorPago(null)
    const { error } = await registrarPago(selected.id, {
      fecha_pago: pagoForm.fecha_pago,
      monto: parseFloat(pagoForm.monto),
      moneda: pagoForm.moneda,
      referencia: pagoForm.referencia || undefined,
      entidad_financiera: pagoForm.entidad_financiera || undefined,
    } as unknown as Omit<PagoFactura, 'id' | 'factura_id' | 'created_at'>)
    setSavingPago(false)
    if (error) { setErrorPago(fmtDbError(error, 'Error al registrar pago.')); return }
    setShowPago(false)
    setPagoForm(defaultPago)
    load()
    const { data } = await getFactura(selected.id)
    setSelected(data as FacturaConPagos | null)
  }

  const vencidas  = facturas.filter(f => f.status === 'Vencida').length
  const pendPago  = facturas.filter(f => ['Pendiente de pago','Pagada parcial'].includes(f.status)).length
  const montoVenc = facturas.filter(f => f.status === 'Vencida').reduce((a, f) => a + (f.monto_total_sin_igv * (f.factor_igv ?? 1.18)), 0)

  const columns: Column<FacturaVenta>[] = [
    { key: 'num_factura', label: 'N° Factura', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.num_factura}</span> },
    { key: 'operacion',   label: 'OPCI', render: r => <span className="mono" style={{ color: 'var(--text-3)', fontSize: 11 }}>{(r as FacturaVenta & {operacion?: {correlativo_opci: string}}).operacion?.correlativo_opci ?? '—'}</span> },
    { key: 'cliente',     label: 'Cliente', render: r => <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{(r as FacturaVenta & {operacion?: {cliente?: {razon_social: string}}}).operacion?.cliente?.razon_social ?? '—'}</span> },
    { key: 'fecha_emision', label: 'Emisión', render: r => <span className="mono">{fmtDate(r.fecha_emision)}</span> },
    { key: 'fecha_prometida_pago', label: 'Vence', render: r => <EtaCell eta={r.fecha_prometida_pago} pastBad /> },
    { key: 'monto_total_sin_igv', label: 'Sin IGV', align: 'right', render: r => <span className="mono">{money(r.monto_total_sin_igv, r.moneda)}</span> },
    { key: '_igv', label: 'Con IGV', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{money(r.monto_total_sin_igv * (r.factor_igv ?? 1.18), r.moneda)}</span> },
    { key: 'forma_pago', label: 'Forma pago', render: r => <span className="muted">{r.forma_pago ?? '—'}</span> },
    { key: 'dias_cobranza', label: 'Días', align: 'right', render: r => <span className="mono">{r.dias_cobranza ?? '—'}</span> },
    { key: 'status', label: 'Estado', render: r => <StatusBadge status={r.status} mapping={FACTURA_STATUS_TONE} /> },
    {
      key: '_pago', label: '', width: 100,
      render: r => !['Pagada total','Anulada'].includes(r.status) ? (
        <button className="btn primary xs" onClick={e => { e.stopPropagation(); setSelected(r as FacturaConPagos); setShowPago(true) }}>
          <Icon name="dollar" size={11} /> Pago
        </button>
      ) : null,
    },
    {
      key: '_actions', label: '', width: 56,
      render: r => (
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEditFact(r) }} title="Editar">
            <Icon name="edit" size={12} />
          </button>
          <button className="btn ghost xs" style={{ color: 'var(--bad)' }} onClick={e => { e.stopPropagation(); setDeleteRow(r) }} title="Eliminar">
            <Icon name="trash" size={12} />
          </button>
        </div>
      ),
    },
  ]

  const totalPagado = selected?.pagos?.reduce((a, p) => a + p.monto, 0) ?? 0
  const deuda = selected ? selected.monto_total_sin_igv * (selected.factor_igv ?? 1.18) : 0
  const pendiente = deuda - totalPagado

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Facturación <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{total} facturas</span></h1>
          <div className="page-sub">Control de facturas de venta y cobranza</div>
        </div>
        <div className="page-actions">
          <button className="btn sm" onClick={handleExport}><Icon name="download" size={13} /> Exportar</button>
          <button className="btn primary sm" onClick={() => setShowNueva(true)}><Icon name="plus" size={13} /> Nueva factura</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <KPI label="Total facturas"        value={total}                                          icon="invoice" />
        <KPI label="Pendientes de pago"    value={pendPago}    delta={pendPago > 0 ? 'requieren atención' : ''} deltaTone={pendPago > 0 ? 'down' : ''} icon="clock" />
        <KPI label="Facturas vencidas"     value={vencidas}    delta={vencidas > 0 ? 'urgente' : 'al día'} deltaTone={vencidas > 0 ? 'down' : 'up'} icon="warning" />
        <KPI label="Monto vencido"         value={money(montoVenc, 'PEN')}                         icon="dollar" />
      </div>

      <Card padding={false}>
        <div className="table-toolbar">
          <div className="input-wrap">
            <Icon name="search" size={13} className="ico" />
            <input className="input with-ico" placeholder="N° factura, OPCI, cliente…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 260 }} />
          </div>
          <select className="select" value={estado} onChange={e => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={soloVencidas} onChange={e => setSoloVencidas(e.target.checked)} />
            Solo vencidas
          </label>
          <div className="spacer" />
          <button className="btn ghost xs" onClick={() => { setQ(''); setEstado(''); setSoloVencidas(false) }}>
            <Icon name="x" size={11} /> Limpiar
          </button>
        </div>

        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          rows={facturas as unknown as Record<string, unknown>[]}
          idKey="id"
          loading={loading}
          onRowClick={r => openDrawer(r as unknown as FacturaVenta)}
          emptyMessage="No hay facturas que coincidan"
        />
      </Card>

      {/* Drawer detalle factura */}
      <Drawer
        open={!!selected && !showPago && !showEstado}
        onClose={() => setSelected(null)}
        title={selected?.num_factura ?? ''}
        sub={selected ? `${money(selected.monto_total_sin_igv * (selected.factor_igv ?? 1.18), selected.moneda)} · ${selected.status}` : ''}
        footer={
          selected ? (
            <>
              <button className="btn" onClick={() => setShowUpload(true)}><Icon name="paperclip" size={13} /> Adjuntar</button>
              {(NEXT_ESTADOS_FACTURA[selected.status]?.length ?? 0) > 0 && (
                <button className="btn" onClick={() => { setNuevoEstadoFact(''); setShowEstado(true) }}>
                  <Icon name="tag" size={13} /> Estado
                </button>
              )}
              {!['Pagada total','Anulada','Nota de crédito emitida'].includes(selected.status) && (
                <button className="btn primary" onClick={() => setShowPago(true)}>
                  <Icon name="dollar" size={13} /> Registrar pago
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <StatusBadge status={selected.status} mapping={FACTURA_STATUS_TONE} />
            <MetaGrid cols={2} fields={[
              { label: 'N° Factura',        value: selected.num_factura, mono: true },
              { label: 'OPCI',              value: (selected as FacturaVenta & {operacion?: {correlativo_opci: string}}).operacion?.correlativo_opci, mono: true },
              { label: 'Fecha emisión',     value: fmtDate(selected.fecha_emision), mono: true },
              { label: 'Vencimiento',       value: fmtDate(selected.fecha_prometida_pago), mono: true },
              { label: 'Forma de pago',     value: selected.forma_pago },
              { label: 'Días cobranza',     value: selected.dias_cobranza?.toString() },
              { label: 'Moneda',            value: selected.moneda },
              { label: 'Monto sin IGV',     value: money(selected.monto_total_sin_igv, selected.moneda), mono: true },
              { label: 'Factor IGV',        value: selected.factor_igv?.toString() },
              { label: 'Monto con IGV',     value: money(selected.monto_total_sin_igv * (selected.factor_igv ?? 1.18), selected.moneda), mono: true },
              { label: 'T/C USD/Sol',       value: selected.tc_usd_sol?.toString() },
              { label: 'Entidad financiera',value: selected.entidad_financiera },
              { label: 'Notas',             value: selected.notas, span: 2 },
            ]} />

            {/* Pagos */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Pagos registrados</div>
              {(selected.pagos?.length ?? 0) === 0 ? (
                <div className="tiny">Sin pagos registrados</div>
              ) : (
                <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                  {selected.pagos!.map((p, i) => (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, padding: '8px 12px', borderBottom: i < (selected.pagos!.length - 1) ? '1px solid var(--border)' : 'none', alignItems: 'center' }}>
                      <div>
                        <span className="mono" style={{ fontSize: 12.5 }}>{fmtDate(p.fecha_pago)}</span>
                        {p.referencia && <div className="tiny">{p.referencia}</div>}
                      </div>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ok)' }}>{money(p.monto, p.moneda)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--panel-2)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                <span>Total pagado: <strong className="mono" style={{ color: 'var(--ok)' }}>{money(totalPagado, selected.moneda)}</strong></span>
                <span>Pendiente: <strong className="mono" style={{ color: pendiente > 0 ? 'var(--bad)' : 'var(--ok)' }}>{money(pendiente, selected.moneda)}</strong></span>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Modal nueva factura */}
      <Modal open={showNueva} onClose={() => { setShowNueva(false); setOpciSearch(''); setOpciSugeridas([]) }} title="Nueva factura de venta" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowNueva(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCrearFactura} disabled={savingFactura || !facturaForm.num_factura || !facturaForm.monto_total_sin_igv}>
              {savingFactura ? 'Creando…' : 'Crear factura'}
            </button>
          </>
        }>
        {errorFactura && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{errorFactura}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Operación OPCI</label>
            <div style={{ position: 'relative' }} ref={opciDropRef}>
              <input className="input" value={opciSearch} onChange={e => { setOpciSearch(e.target.value); if (!e.target.value) setFacturaForm(f => ({ ...f, operacion_id: '' })) }} onFocus={handleOpciFocus} placeholder="Buscar OPCI…" style={{ width: '100%' }} />
              {showOpciDrop && opciSugeridas.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', maxHeight: 200, overflowY: 'auto' }}>
                  <div onMouseDown={() => { setOpciSearch(''); setFacturaForm(f => ({ ...f, operacion_id: '' })); setShowOpciDrop(false) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--text-3)', borderBottom: '1px solid var(--border-soft)' }}>— Sin vincular a OPCI —</div>
                  {opciSugeridas.map(o => (
                    <div key={o.id} onMouseDown={() => { setOpciSearch(o.correlativo_opci); setFacturaForm(f => ({ ...f, operacion_id: o.id })); setShowOpciDrop(false) }} style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderTop: '1px solid var(--border-soft)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                      <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{o.correlativo_opci}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">N° Factura *</label>
            <input className="input" value={facturaForm.num_factura} onChange={e => setFacturaForm(f => ({ ...f, num_factura: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="F001-00000001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha de emisión</label>
            <input type="date" className="input" value={facturaForm.fecha_emision} onChange={e => setFacturaForm(f => ({ ...f, fecha_emision: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha prometida de pago</label>
            <input type="date" className="input" value={facturaForm.fecha_prometida_pago} onChange={e => setFacturaForm(f => ({ ...f, fecha_prometida_pago: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Forma de pago</label>
            <input className="input" value={facturaForm.forma_pago} onChange={e => setFacturaForm(f => ({ ...f, forma_pago: e.target.value }))} style={{ width: '100%' }} placeholder="30 días neto, Contado…" />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={facturaForm.moneda} onChange={e => setFacturaForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              <option value="USD">USD</option><option value="PEN">PEN</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto sin IGV *</label>
            <input type="number" className="input" value={facturaForm.monto_total_sin_igv} onChange={e => setFacturaForm(f => ({ ...f, monto_total_sin_igv: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Factor IGV</label>
            <input type="number" className="input" value={facturaForm.factor_igv} onChange={e => setFacturaForm(f => ({ ...f, factor_igv: e.target.value }))} style={{ width: '100%' }} step="0.01" />
          </div>
          <div className="form-field">
            <label className="form-label">Días de crédito</label>
            <input type="number" className="input" value={facturaForm.dias_cobranza} onChange={e => setFacturaForm(f => ({ ...f, dias_cobranza: e.target.value }))} style={{ width: '100%' }} min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">T/C USD/Sol</label>
            <input type="number" className="input" value={facturaForm.tc_usd_sol} onChange={e => setFacturaForm(f => ({ ...f, tc_usd_sol: e.target.value }))} style={{ width: '100%' }} step="0.001" />
          </div>
          <div className="form-field">
            <label className="form-label">Categoría forma de pago</label>
            <select className="select" value={facturaForm.categoria_forma_pago} onChange={e => setFacturaForm(f => ({ ...f, categoria_forma_pago: e.target.value }))} style={{ width: '100%' }}>
              <option value="">—</option><option value="Contado">Contado</option><option value="Crédito">Crédito</option><option value="Carta de crédito">Carta de crédito</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Categoría operación</label>
            <select className="select" value={facturaForm.categoria_operacion} onChange={e => setFacturaForm(f => ({ ...f, categoria_operacion: e.target.value }))} style={{ width: '100%' }}>
              <option value="">—</option><option value="Importación">Importación</option><option value="Compra local">Compra local</option><option value="Servicio">Servicio</option>
            </select>
          </div>
          {facturaForm.monto_total_sin_igv && parseFloat(facturaForm.monto_total_sin_igv) > 0 && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
              Con IGV: <strong className="mono">{(parseFloat(facturaForm.monto_total_sin_igv) * (parseFloat(facturaForm.factor_igv) || 1.18)).toFixed(2)} {facturaForm.moneda}</strong>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal registrar pago */}
      <Modal open={showPago} onClose={() => { setShowPago(false); setPagoForm(defaultPago); setErrorPago(null) }}
        title="Registrar pago" subtitle={selected?.num_factura} size="sm"
        footer={
          <>
            <button className="btn" onClick={() => { setShowPago(false); setPagoForm(defaultPago); setErrorPago(null) }}>Cancelar</button>
            <button className="btn primary" onClick={handlePago} disabled={savingPago || !pagoForm.monto}>
              {savingPago ? 'Guardando…' : 'Registrar pago'}
            </button>
          </>
        }>
        {errorPago && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{errorPago}</div>}
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--warn-soft)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
              Pendiente de pago: <strong className="mono">{money(pendiente, selected.moneda)}</strong>
            </div>
            {[
              { label: 'Fecha de pago *', key: 'fecha_pago', type: 'date' },
              { label: 'Monto *', key: 'monto', type: 'number' },
              { label: 'Referencia / N° operación', key: 'referencia', type: 'text' },
              { label: 'Entidad financiera', key: 'entidad_financiera', type: 'text' },
            ].map(f => (
              <div key={f.key} className="form-field">
                <label className="form-label">{f.label}</label>
                <input type={f.type} className="input" value={pagoForm[f.key as keyof PagoForm]} style={{ width: '100%' }}
                  onChange={e => setPagoForm(p => ({ ...p, [f.key]: e.target.value }))} step={f.type === 'number' ? '0.01' : undefined} />
              </div>
            ))}
            <div className="form-field">
              <label className="form-label">Moneda</label>
              <select className="select" value={pagoForm.moneda} onChange={e => setPagoForm(p => ({ ...p, moneda: e.target.value }))} style={{ width: '100%' }}>
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD</option>
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal cambiar estado factura */}
      <Modal
        open={showEstado}
        onClose={() => setShowEstado(false)}
        title="Cambiar estado de factura"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setShowEstado(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCambiarEstadoFactura} disabled={savingEstadoFact || !nuevoEstadoFact}>
              {savingEstadoFact ? 'Guardando…' : 'Confirmar'}
            </button>
          </>
        }
      >
        {selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12.5 }}>
              Estado actual: <StatusBadge status={selected.status} mapping={FACTURA_STATUS_TONE} />
            </div>
            <div className="form-field">
              <label className="form-label">Nuevo estado</label>
              <select className="select" value={nuevoEstadoFact} onChange={e => setNuevoEstadoFact(e.target.value as EstadoFactura)} style={{ width: '100%' }}>
                <option value="">— Seleccionar —</option>
                {(NEXT_ESTADOS_FACTURA[selected.status] ?? []).map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Editar factura */}
      <Modal
        open={!!editRow}
        onClose={() => setEditRow(null)}
        title="Editar Factura"
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setEditRow(null)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEditFact} disabled={savingEditFact || !editForm.num_factura}>
              {savingEditFact ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">N° Factura *</label>
            <input className="input" value={editForm.num_factura} onChange={e => setEditForm(f => ({ ...f, num_factura: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Estado</label>
            <select className="select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value as EstadoFactura }))} style={{ width: '100%' }}>
              {ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Fecha emisión</label>
            <input type="date" className="input" value={editForm.fecha_emision} onChange={e => setEditForm(f => ({ ...f, fecha_emision: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha prometida de pago</label>
            <input type="date" className="input" value={editForm.fecha_prometida_pago} onChange={e => setEditForm(f => ({ ...f, fecha_prometida_pago: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={editForm.moneda} onChange={e => setEditForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              <option value="USD">USD</option><option value="PEN">PEN</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto sin IGV</label>
            <input type="number" className="input" value={editForm.monto_total_sin_igv} onChange={e => setEditForm(f => ({ ...f, monto_total_sin_igv: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Factor IGV</label>
            <input type="number" className="input" value={editForm.factor_igv} onChange={e => setEditForm(f => ({ ...f, factor_igv: e.target.value }))} style={{ width: '100%' }} step="0.01" />
          </div>
          <div className="form-field">
            <label className="form-label">Días de crédito</label>
            <input type="number" className="input" value={editForm.dias_cobranza} onChange={e => setEditForm(f => ({ ...f, dias_cobranza: e.target.value }))} style={{ width: '100%' }} min="0" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Forma de pago</label>
            <input className="input" value={editForm.forma_pago} onChange={e => setEditForm(f => ({ ...f, forma_pago: e.target.value }))} style={{ width: '100%' }} placeholder="30 días neto, Contado…" />
          </div>
        </div>
      </Modal>

      {/* Modal: Confirmar eliminación factura */}
      <Modal
        open={!!deleteRow}
        onClose={() => setDeleteRow(null)}
        title="Eliminar Factura"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setDeleteRow(null)}>Cancelar</button>
            <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={handleDeleteFact} disabled={deletingRow}>
              {deletingRow ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5 }}>
          ¿Eliminar la factura <strong>{deleteRow?.num_factura}</strong>? Esta acción no se puede deshacer.
        </p>
      </Modal>

      {profile && selected && (
        <UploadDocumentoModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          entidadTipo="factura"
          entidadId={selected.id}
          userId={profile.id}
          onUploaded={() => setShowUpload(false)}
        />
      )}
    </div>
  )
}
