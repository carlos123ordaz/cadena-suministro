import { useState, useEffect, useCallback } from 'react'
import { Icon, Card, KPI, DataTable, StatusBadge, FACTURA_STATUS_TONE, EtaCell, Modal, Drawer, MetaGrid, Badge, UploadDocumentoModal } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getFacturas, getFactura, registrarPago, createFactura } from '@/services/facturacion.service'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { money, fmtDate, daysFrom } from '@/lib/utils'
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

  const [showNueva, setShowNueva] = useState(false)
  const [opciList, setOpciList] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [facturaForm, setFacturaForm] = useState({ operacion_id: '', num_factura: '', fecha_emision: new Date().toISOString().slice(0,10), fecha_prometida_pago: '', moneda: 'USD', monto_total_sin_igv: '', factor_igv: '1.18', tc_usd_sol: '', forma_pago: '', dias_cobranza: '', categoria_forma_pago: '', categoria_operacion: '' })
  const [savingFactura, setSavingFactura] = useState(false)
  const [errorFactura, setErrorFactura] = useState<string | null>(null)

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
    supabase.from('operaciones').select('id, correlativo_opci').not('estado', 'in', '("Cerrada","Anulada")').order('correlativo_opci')
      .then(({ data }) => setOpciList((data ?? []) as { id: string; correlativo_opci: string }[]))
  }, [])

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
    if (error) { setErrorFactura((error as Error)?.message ?? 'Error al crear.'); return }
    setShowNueva(false)
    setFacturaForm({ operacion_id: '', num_factura: '', fecha_emision: new Date().toISOString().slice(0,10), fecha_prometida_pago: '', moneda: 'USD', monto_total_sin_igv: '', factor_igv: '1.18', tc_usd_sol: '', forma_pago: '', dias_cobranza: '', categoria_forma_pago: '', categoria_operacion: '' })
    load()
  }

  async function openDrawer(f: FacturaVenta) {
    const { data } = await getFactura(f.id)
    setSelected(data as FacturaConPagos | null)
  }

  async function handlePago() {
    if (!selected || !pagoForm.monto) return
    setSavingPago(true)
    await registrarPago(selected.id, {
      fecha_pago: pagoForm.fecha_pago,
      monto: parseFloat(pagoForm.monto),
      moneda: pagoForm.moneda,
      referencia: pagoForm.referencia || undefined,
      entidad_financiera: pagoForm.entidad_financiera || undefined,
    } as unknown as Omit<PagoFactura, 'id' | 'factura_id' | 'created_at'>)
    setSavingPago(false)
    setShowPago(false)
    setPagoForm(defaultPago)
    load()
    // refresh drawer
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
          <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
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
        open={!!selected && !showPago}
        onClose={() => setSelected(null)}
        title={selected?.num_factura ?? ''}
        sub={selected ? `${money(selected.monto_total_sin_igv * (selected.factor_igv ?? 1.18), selected.moneda)} · ${selected.status}` : ''}
        footer={
          selected && !['Pagada total','Anulada'].includes(selected.status) ? (
            <>
              <button className="btn" onClick={() => setShowUpload(true)}><Icon name="paperclip" size={13} /> Adjuntar</button>
              <button className="btn primary" onClick={() => setShowPago(true)}>
                <Icon name="dollar" size={13} /> Registrar pago
              </button>
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
      <Modal open={showNueva} onClose={() => setShowNueva(false)} title="Nueva factura de venta" size="lg"
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
            <select className="select" value={facturaForm.operacion_id} onChange={e => setFacturaForm(f => ({ ...f, operacion_id: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin vincular a OPCI —</option>
              {opciList.map(o => <option key={o.id} value={o.id}>{o.correlativo_opci}</option>)}
            </select>
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
      <Modal open={showPago} onClose={() => { setShowPago(false); setPagoForm(defaultPago) }}
        title="Registrar pago" subtitle={selected?.num_factura} size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setShowPago(false)}>Cancelar</button>
            <button className="btn primary" onClick={handlePago} disabled={savingPago || !pagoForm.monto}>
              {savingPago ? 'Guardando…' : 'Registrar pago'}
            </button>
          </>
        }>
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
