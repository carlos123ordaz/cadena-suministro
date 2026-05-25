import { useState, useEffect } from 'react'
import { Icon, Card, KPI, DataTable, StatusBadge, OPCI_STATUS_TONE, FACTURA_STATUS_TONE, OCI_STATUS_TONE, EtaCell, Badge, Tabs } from '@/components/ui'
import type { Column } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtDate, money, daysFrom } from '@/lib/utils'

const TABS = [
  { id: 'opci_estado',   label: 'OPCI por estado' },
  { id: 'vencidas',      label: 'Facturas vencidas' },
  { id: 'cobranza',      label: 'Cobranza pendiente' },
  { id: 'importaciones', label: 'Importaciones por estado' },
  { id: 'despachos',     label: 'Despachos pendientes' },
  { id: 'proveedores',   label: 'Retrasos proveedor' },
]

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="empty-state" style={{ padding: 60 }}>
      <Icon name="chart" size={36} className="empty-icon" />
      <div className="empty-title">{label}</div>
      <div className="empty-sub">Este reporte estará disponible próximamente.</div>
    </div>
  )
}

export function Reportes() {
  const [tab, setTab] = useState('opci_estado')

  // OPCI por estado
  const [opciEstado, setOpciEstado] = useState<{estado: string; cantidad: number; monto: number}[]>([])
  const [loadingOpci, setLoadingOpci] = useState(false)

  // Facturas vencidas
  const [facturasVenc, setFacturasVenc] = useState<Record<string, unknown>[]>([])
  const [loadingVenc, setLoadingVenc] = useState(false)

  // Cobranza pendiente
  const [cobranza, setCobranza] = useState<Record<string, unknown>[]>([])
  const [loadingCob, setLoadingCob] = useState(false)

  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // Importaciones por estado
  const [importEstado, setImportEstado] = useState<{ status: string; count: number }[]>([])
  const [loadingImport, setLoadingImport] = useState(false)

  // Despachos pendientes
  const [despachosPend, setDespachosPend] = useState<Record<string, unknown>[]>([])
  const [loadingDesp, setLoadingDesp] = useState(false)

  // Retrasos proveedor
  const [ocRetraso, setOcRetraso] = useState<Record<string, unknown>[]>([])
  const [loadingOc, setLoadingOc] = useState(false)

  async function loadOpciEstado() {
    setLoadingOpci(true)
    const { data } = await supabase.from('operaciones').select('estado, monto_total_sin_igv')
    if (data) {
      const grouped = data.reduce<Record<string, {cantidad: number; monto: number}>>((acc, r) => {
        if (!acc[r.estado]) acc[r.estado] = { cantidad: 0, monto: 0 }
        acc[r.estado].cantidad++
        acc[r.estado].monto += r.monto_total_sin_igv ?? 0
        return acc
      }, {})
      setOpciEstado(Object.entries(grouped).map(([estado, v]) => ({ estado, ...v })).sort((a, b) => b.cantidad - a.cantidad))
    }
    setLoadingOpci(false)
  }

  async function loadFacturasVencidas() {
    setLoadingVenc(true)
    const today = new Date().toISOString().slice(0, 10)
    let query = supabase.from('facturas_venta')
      .select('*, operacion:operaciones(correlativo_opci, cliente:clientes(razon_social))')
      .or(`status.eq.Vencida,and(fecha_prometida_pago.lt.${today},fecha_pago.is.null)`)
      .order('fecha_prometida_pago', { ascending: true })
    if (fechaDesde) query = query.gte('fecha_emision', fechaDesde)
    if (fechaHasta) query = query.lte('fecha_emision', fechaHasta)
    const { data } = await query
    setFacturasVenc((data as Record<string, unknown>[]) ?? [])
    setLoadingVenc(false)
  }

  async function loadImportaciones() {
    setLoadingImport(true)
    const { data } = await supabase.from('importaciones').select('status')
    if (data) {
      const grouped = data.reduce<Record<string, number>>((acc, r) => {
        acc[r.status] = (acc[r.status] ?? 0) + 1
        return acc
      }, {})
      setImportEstado(Object.entries(grouped).map(([status, count]) => ({ status, count })).sort((a, b) => b.count - a.count))
    }
    setLoadingImport(false)
  }

  async function loadDespachos() {
    setLoadingDesp(true)
    const { data } = await supabase
      .from('despachos')
      .select('*, operacion:operaciones(correlativo_opci, cliente:clientes!cliente_id(razon_social))')
      .not('estado', 'in', '("Entregado","Anulado")')
      .order('fecha_despacho', { ascending: true })
    setDespachosPend((data as Record<string, unknown>[]) ?? [])
    setLoadingDesp(false)
  }

  async function loadProveedores() {
    setLoadingOc(true)
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await supabase
      .from('ordenes_compra')
      .select('*, proveedor:proveedores(razon_social), operacion:operaciones(correlativo_opci)')
      .lt('fecha_ofrecida', today)
      .not('status', 'in', '("Recibido completo","Cerrado","Anulado")')
      .order('fecha_ofrecida', { ascending: true })
    setOcRetraso((data as Record<string, unknown>[]) ?? [])
    setLoadingOc(false)
  }

  async function loadCobranza() {
    setLoadingCob(true)
    const { data } = await supabase.from('facturas_venta')
      .select('*, operacion:operaciones(correlativo_opci, cliente:clientes(razon_social))')
      .in('status', ['Pendiente de pago','Pagada parcial','Vencida'])
      .order('fecha_prometida_pago', { ascending: true })
    setCobranza((data as Record<string, unknown>[]) ?? [])
    setLoadingCob(false)
  }

  useEffect(() => {
    if (tab === 'opci_estado') loadOpciEstado()
    else if (tab === 'vencidas') loadFacturasVencidas()
    else if (tab === 'cobranza') loadCobranza()
    else if (tab === 'importaciones') loadImportaciones()
    else if (tab === 'despachos') loadDespachos()
    else if (tab === 'proveedores') loadProveedores()
  }, [tab, fechaDesde, fechaHasta])

  const totalVencido = facturasVenc.reduce((a, f) => a + ((f.monto_total_sin_igv as number ?? 0) * ((f.factor_igv as number) ?? 1.18)), 0)
  const totalCobranza = cobranza.reduce((a, f) => a + ((f.monto_total_sin_igv as number ?? 0) * ((f.factor_igv as number) ?? 1.18)), 0)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Reportes</h1>
          <div className="page-sub">Análisis operativo, financiero y de desempeño</div>
        </div>
        <div className="page-actions">
          <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* OPCI por estado */}
      {tab === 'opci_estado' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <KPI label="Estados distintos"   value={opciEstado.length} />
            <KPI label="Total operaciones"   value={opciEstado.reduce((a, e) => a + e.cantidad, 0)} />
            <KPI label="Monto total USD"     value={money(opciEstado.reduce((a, e) => a + e.monto, 0), 'USD')} />
            <KPI label="Operaciones cerradas" value={opciEstado.find(e => e.estado === 'Cerrada')?.cantidad ?? 0} deltaTone="up" />
          </div>
          <Card title="Distribución de operaciones por estado" icon="opci" padding={false}>
            <DataTable
              columns={[
                { key: 'estado',    label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={OPCI_STATUS_TONE} /> },
                { key: 'cantidad',  label: 'Cantidad', align: 'right', render: r => <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{r.cantidad as number}</span> },
                { key: 'monto',     label: 'Monto total sin IGV', align: 'right', render: r => <span className="mono">{money(r.monto as number, 'USD')}</span> },
                { key: '_pct',      label: '% del total', align: 'right', render: r => {
                  const total = opciEstado.reduce((a, e) => a + e.cantidad, 0)
                  const pct = total ? Math.round(((r.cantidad as number) / total) * 100) : 0
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <span className="mono">{pct}%</span>
                      <div style={{ width: 60, height: 4, background: 'var(--muted-soft)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)' }} />
                      </div>
                    </div>
                  )
                }},
              ]}
              rows={opciEstado as unknown as Record<string, unknown>[]}
              idKey="estado"
              loading={loadingOpci}
              emptyMessage="Sin datos"
            />
          </Card>
        </div>
      )}

      {/* Facturas vencidas */}
      {tab === 'vencidas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KPI label="Facturas vencidas"   value={facturasVenc.length} deltaTone={facturasVenc.length > 0 ? 'down' : ''} />
            <KPI label="Monto vencido total" value={money(totalVencido, 'PEN')} deltaTone={totalVencido > 0 ? 'down' : ''} />
            <KPI label="Máx. días vencida"   value={Math.max(0, ...facturasVenc.map(f => Math.abs(daysFrom(f.fecha_prometida_pago as string))))} />
          </div>
          <Card padding={false}>
            <div className="table-toolbar">
              <span className="tiny">Fecha emisión desde</span>
              <input type="date" className="input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} style={{ width: 130 }} />
              <span className="tiny">hasta</span>
              <input type="date" className="input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} style={{ width: 130 }} />
              <div className="spacer" />
              <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
            </div>
            <DataTable
              columns={[
                { key: 'num_factura',  label: 'N° Factura', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.num_factura as string}</span> },
                { key: '_opci',        label: 'OPCI', render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{((r.operacion as {correlativo_opci: string}) ?? {}).correlativo_opci ?? '—'}</span> },
                { key: '_cliente',     label: 'Cliente', render: r => <span style={{ maxWidth: 220, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{((r.operacion as {cliente?: {razon_social: string}}) ?? {}).cliente?.razon_social ?? '—'}</span> },
                { key: 'fecha_emision',label: 'Emisión', render: r => <span className="mono">{fmtDate(r.fecha_emision as string)}</span> },
                { key: 'fecha_prometida_pago', label: 'Vencimiento', render: r => <span className="mono" style={{ color: 'var(--bad)', fontWeight: 600 }}>{fmtDate(r.fecha_prometida_pago as string)}</span> },
                { key: '_dias',        label: 'Días vencida', align: 'right', render: r => {
                  const d = Math.abs(daysFrom(r.fecha_prometida_pago as string))
                  return <span className="mono" style={{ fontWeight: 700, color: 'var(--bad)' }}>{d}d</span>
                }},
                { key: '_monto',       label: 'Con IGV', align: 'right', render: r => <span className="mono" style={{ color: 'var(--bad)', fontWeight: 600 }}>{money((r.monto_total_sin_igv as number) * ((r.factor_igv as number) ?? 1.18), r.moneda as string)}</span> },
                { key: 'forma_pago',   label: 'Forma pago', render: r => <span className="muted">{r.forma_pago as string ?? '—'}</span> },
                { key: 'status',       label: 'Estado', render: r => <StatusBadge status={r.status as string} mapping={FACTURA_STATUS_TONE} /> },
              ] as Column<Record<string, unknown>>[]}
              rows={facturasVenc}
              idKey="id"
              loading={loadingVenc}
              emptyMessage="No hay facturas vencidas"
            />
          </Card>
        </div>
      )}

      {/* Cobranza pendiente */}
      {tab === 'cobranza' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KPI label="Documentos pendientes" value={cobranza.length} />
            <KPI label="Monto pendiente total" value={money(totalCobranza, 'PEN')} deltaTone={totalCobranza > 0 ? 'down' : ''} />
            <KPI label="Vencen esta semana"    value={cobranza.filter(f => { const d = daysFrom(f.fecha_prometida_pago as string); return d >= 0 && d <= 7 }).length} deltaTone="down" />
          </div>
          <Card padding={false}>
            <DataTable
              columns={[
                { key: 'num_factura',  label: 'N° Factura', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.num_factura as string}</span> },
                { key: '_opci',        label: 'OPCI', render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{((r.operacion as {correlativo_opci: string}) ?? {}).correlativo_opci ?? '—'}</span> },
                { key: '_cliente',     label: 'Cliente', render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{((r.operacion as {cliente?: {razon_social: string}}) ?? {}).cliente?.razon_social ?? '—'}</span> },
                { key: '_monto',       label: 'Monto pendiente', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{money((r.monto_total_sin_igv as number) * ((r.factor_igv as number) ?? 1.18), r.moneda as string)}</span> },
                { key: 'fecha_prometida_pago', label: 'Vence', render: r => <EtaCell eta={r.fecha_prometida_pago as string} pastBad /> },
                { key: 'status',       label: 'Estado', render: r => <StatusBadge status={r.status as string} mapping={FACTURA_STATUS_TONE} /> },
                { key: 'dias_cobranza', label: 'Días créd.', align: 'right', render: r => <span className="mono">{r.dias_cobranza as number ?? '—'}</span> },
              ] as Column<Record<string, unknown>>[]}
              rows={cobranza}
              idKey="id"
              loading={loadingCob}
              emptyMessage="Sin cobranzas pendientes"
            />
          </Card>
        </div>
      )}

      {/* Importaciones por estado */}
      {tab === 'importaciones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KPI label="Total importaciones"  value={importEstado.reduce((a, e) => a + e.count, 0)} />
            <KPI label="Estados distintos"    value={importEstado.length} />
            <KPI label="En tránsito"          value={importEstado.find(e => e.status === 'En tránsito')?.count ?? 0} />
          </div>
          <Card title="Importaciones por estado" icon="ship" padding={false}>
            <DataTable
              columns={[
                { key: 'status',  label: 'Estado',    render: r => <StatusBadge status={r.status as string} mapping={OCI_STATUS_TONE} /> },
                { key: 'count',   label: 'Cantidad',  align: 'right', render: r => <span className="mono" style={{ fontWeight: 700, fontSize: 14 }}>{r.count as number}</span> },
                { key: '_pct',    label: '% del total', align: 'right', render: r => {
                  const total = importEstado.reduce((a, e) => a + e.count, 0)
                  const pct = total ? Math.round(((r.count as number) / total) * 100) : 0
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <span className="mono">{pct}%</span>
                      <div style={{ width: 60, height: 4, background: 'var(--muted-soft)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: 'var(--violet)' }} />
                      </div>
                    </div>
                  )
                }},
              ] as Column<Record<string, unknown>>[]}
              rows={importEstado as unknown as Record<string, unknown>[]}
              idKey="status"
              loading={loadingImport}
              emptyMessage="Sin importaciones"
            />
          </Card>
        </div>
      )}

      {/* Despachos pendientes */}
      {tab === 'despachos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KPI label="Despachos pendientes"  value={despachosPend.length} deltaTone={despachosPend.length > 0 ? 'down' : ''} />
            <KPI label="En transporte"         value={despachosPend.filter(d => d.estado === 'En transporte').length} />
            <KPI label="Observados"            value={despachosPend.filter(d => d.estado === 'Observado').length} deltaTone={despachosPend.filter(d => d.estado === 'Observado').length > 0 ? 'down' : ''} />
          </div>
          <Card title="Despachos en curso" icon="truck" padding={false}>
            <DataTable
              columns={[
                { key: 'codigo_comercial', label: 'Código',    render: r => <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{r.codigo_comercial as string}</span> },
                { key: 'descripcion',      label: 'Descripción', render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion as string ?? '—'}</span> },
                { key: '_opci',            label: 'OPCI',      render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{((r.operacion as { correlativo_opci?: string }) ?? {}).correlativo_opci ?? '—'}</span> },
                { key: '_cliente',         label: 'Cliente',   render: r => <span>{((r.operacion as { cliente?: { razon_social?: string } }) ?? {}).cliente?.razon_social ?? '—'}</span> },
                { key: 'fecha_despacho',   label: 'Fecha',     render: r => <span className="mono">{fmtDate(r.fecha_despacho as string)}</span> },
                { key: 'estado',           label: 'Estado',    render: r => {
                  const tone: Record<string, 'warn' | 'info' | 'bad' | 'muted'> = { 'Preparando': 'warn', 'En transporte': 'info', 'Observado': 'bad' }
                  return <Badge tone={tone[r.estado as string] ?? 'muted'}>{r.estado as string}</Badge>
                }},
              ] as Column<Record<string, unknown>>[]}
              rows={despachosPend}
              idKey="id"
              loading={loadingDesp}
              emptyMessage="Sin despachos pendientes"
            />
          </Card>
        </div>
      )}

      {/* Retrasos proveedor */}
      {tab === 'proveedores' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <KPI label="OC retrasadas"     value={ocRetraso.length} deltaTone={ocRetraso.length > 0 ? 'down' : ''} />
            <KPI label="Máx. días retraso" value={Math.max(0, ...ocRetraso.map(oc => Math.abs(daysFrom(oc.fecha_ofrecida as string))))} deltaTone={ocRetraso.length > 0 ? 'down' : ''} />
            <KPI label="Proveedores con retraso" value={new Set(ocRetraso.map(oc => ((oc.proveedor as { razon_social?: string }) ?? {}).razon_social)).size} />
          </div>
          <Card title="Órdenes de compra retrasadas" icon="warning" padding={false}>
            <DataTable
              columns={[
                { key: 'num_oc',        label: 'N° OC',      render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.num_oc as string}</span> },
                { key: '_proveedor',    label: 'Proveedor',  render: r => <span>{((r.proveedor as { razon_social?: string }) ?? {}).razon_social ?? '—'}</span> },
                { key: '_opci',         label: 'OPCI',       render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{((r.operacion as { correlativo_opci?: string }) ?? {}).correlativo_opci ?? '—'}</span> },
                { key: 'fecha_ofrecida',label: 'F. ofrecida', render: r => <span className="mono" style={{ color: 'var(--bad)' }}>{fmtDate(r.fecha_ofrecida as string)}</span> },
                { key: '_dias',         label: 'Días retraso', align: 'right', render: r => {
                  const d = Math.abs(daysFrom(r.fecha_ofrecida as string))
                  return <span className="mono" style={{ fontWeight: 700, color: 'var(--bad)' }}>{d}d</span>
                }},
                { key: 'status',        label: 'Estado',     render: r => <StatusBadge status={r.status as string} mapping={OCI_STATUS_TONE} /> },
              ] as Column<Record<string, unknown>>[]}
              rows={ocRetraso}
              idKey="id"
              loading={loadingOc}
              emptyMessage="Sin órdenes retrasadas"
            />
          </Card>
        </div>
      )}
    </div>
  )
}
