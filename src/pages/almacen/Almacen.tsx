import { useState, useEffect, useCallback } from 'react'
import { Icon, Card, KPI, DataTable, StatusBadge, RECEPCION_STATUS_TONE, DESPACHO_STATUS_TONE, Tabs, Modal, Badge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getRecepciones, registrarRecepcion, getDespachos, registrarDespacho, getKardex, getStock } from '@/services/almacen.service'
import { fmtDate, fmtDateTime, money } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import type { Recepcion, Despacho, AlmacenMovimiento } from '@/types'

const TABS = [
  { id: 'recepciones', label: 'Recepciones' },
  { id: 'despachos',   label: 'Despachos' },
  { id: 'kardex',      label: 'Kardex' },
  { id: 'stock',       label: 'Stock' },
]

interface RecepcionForm {
  operacion_id: string; orden_compra_id: string; codigo_comercial: string; descripcion: string
  cantidad_esperada: string; cantidad_recibida: string; unidad_medida: string
  conf_almacen: string; motivo_conf_almacen: string; fecha_recepcion: string; erp_inta_entrada: string; notas: string
}
const defaultRec: RecepcionForm = {
  operacion_id: '', orden_compra_id: '', codigo_comercial: '', descripcion: '',
  cantidad_esperada: '', cantidad_recibida: '', unidad_medida: 'UND',
  conf_almacen: 'Conforme', motivo_conf_almacen: '', fecha_recepcion: new Date().toISOString().slice(0,10),
  erp_inta_entrada: '', notas: '',
}

interface DespachoForm {
  operacion_id: string; codigo_comercial: string; descripcion: string
  cantidad: string; unidad_medida: string; distrito_despacho: string
  fecha_despacho: string; erp_inta_salida: string; notas: string
}
const defaultDesp: DespachoForm = {
  operacion_id: '', codigo_comercial: '', descripcion: '', cantidad: '',
  unidad_medida: 'UND', distrito_despacho: '', fecha_despacho: new Date().toISOString().slice(0,10),
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

  const [showRec, setShowRec] = useState(false)
  const [recForm, setRecForm] = useState<RecepcionForm>(defaultRec)
  const [savingRec, setSavingRec] = useState(false)

  const [showDesp, setShowDesp] = useState(false)
  const [despForm, setDespForm] = useState<DespachoForm>(defaultDesp)
  const [savingDesp, setSavingDesp] = useState(false)

  const [kardexCodigo, setKardexCodigo] = useState('')

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

  async function handleRegistrarRecepcion() {
    if (!profile) return
    setSavingRec(true)
    await registrarRecepcion({
      operacion_id: recForm.operacion_id || undefined,
      orden_compra_id: recForm.orden_compra_id || undefined,
      codigo_comercial: recForm.codigo_comercial,
      descripcion: recForm.descripcion,
      cantidad_esperada: parseFloat(recForm.cantidad_esperada),
      cantidad_recibida: parseFloat(recForm.cantidad_recibida),
      unidad_medida: recForm.unidad_medida,
      conf_almacen: recForm.conf_almacen as 'Conforme' | 'Observado' | 'Rechazado',
      motivo_conf_almacen: recForm.motivo_conf_almacen || undefined,
      fecha_recepcion: recForm.fecha_recepcion,
      erp_inta_entrada: recForm.erp_inta_entrada || undefined,
      notas: recForm.notas || undefined,
      almacen_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      estado: 'Pendiente',
    } as unknown as Omit<Recepcion, 'id' | 'created_at' | 'updated_at'>, profile.id)
    setSavingRec(false)
    setShowRec(false)
    setRecForm(defaultRec)
    loadTab()
  }

  async function handleRegistrarDespacho() {
    if (!profile) return
    setSavingDesp(true)
    await registrarDespacho({
      operacion_id: despForm.operacion_id,
      codigo_comercial: despForm.codigo_comercial,
      descripcion: despForm.descripcion,
      cantidad: parseFloat(despForm.cantidad),
      unidad_medida: despForm.unidad_medida,
      distrito_despacho: despForm.distrito_despacho || undefined,
      fecha_despacho: despForm.fecha_despacho,
      erp_inta_salida: despForm.erp_inta_salida || undefined,
      notas: despForm.notas || undefined,
      almacen_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      estado: 'Preparando',
    } as unknown as Omit<Despacho, 'id' | 'created_at' | 'updated_at'>, profile.id)
    setSavingDesp(false)
    setShowDesp(false)
    setDespForm(defaultDesp)
    loadTab()
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
            <button className="btn primary sm" onClick={() => setShowDesp(true)}>
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
              { key: 'operacion',       label: 'OPCI', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{(r.operacion as {correlativo_opci: string})?.correlativo_opci ?? '—'}</span> },
              { key: 'num_oc',          label: 'N° OC', render: r => <span className="mono">{r.num_oc as string ?? '—'}</span> },
              { key: 'codigo_comercial',label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',     label: 'Descripción', render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion as string}</span> },
              { key: 'cantidad_esperada', label: 'Esperada', align: 'right', render: r => <span className="mono">{r.cantidad_esperada as number}</span> },
              { key: 'cantidad_recibida', label: 'Recibida', align: 'right', render: r => <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{r.cantidad_recibida as number}</span> },
              { key: 'unidad_medida',   label: 'UM', width: 50 },
              { key: 'fecha_recepcion', label: 'Fecha', render: r => <span className="mono">{fmtDate(r.fecha_recepcion as string)}</span> },
              { key: 'estado',          label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={RECEPCION_STATUS_TONE} /> },
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
              { key: 'operacion',       label: 'OPCI', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{(r.operacion as {correlativo_opci: string})?.correlativo_opci ?? '—'}</span> },
              { key: 'codigo_comercial',label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',     label: 'Descripción', render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion as string}</span> },
              { key: 'cantidad',        label: 'Cant.', align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
              { key: 'unidad_medida',   label: 'UM', width: 50 },
              { key: 'distrito_despacho', label: 'Distrito', render: r => <span className="muted">{r.distrito_despacho as string ?? '—'}</span> },
              { key: 'fecha_despacho',  label: 'F. despacho', render: r => <span className="mono">{fmtDate(r.fecha_despacho as string)}</span> },
              { key: 'erp_inta_salida', label: 'ERP Salida', render: r => <span className="mono">{r.erp_inta_salida as string ?? '—'}</span> },
              { key: 'estado',          label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={DESPACHO_STATUS_TONE} /> },
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
              { key: 'created_at',       label: 'Fecha', render: r => <span className="mono">{fmtDateTime(r.created_at as string)}</span> },
              { key: 'producto_codigo',  label: 'Código', render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.producto_codigo as string}</span> },
              { key: 'tipo',             label: 'Tipo', render: r => {
                const t = r.tipo as string
                const tone = t === 'entrada' ? 'ok' : t === 'salida' ? 'bad' : t === 'ajuste' ? 'info' : 'violet'
                return <Badge tone={tone}>{t}</Badge>
              }},
              { key: 'documento_referencia', label: 'Documento', render: r => <span className="mono">{r.documento_referencia as string ?? '—'}</span> },
              { key: 'cantidad_entrada', label: 'Entrada', align: 'right', render: r => r.tipo === 'entrada' ? <span className="mono" style={{ color: 'var(--ok)', fontWeight: 600 }}>{r.cantidad as number}</span> : <span className="muted">—</span> },
              { key: 'cantidad_salida',  label: 'Salida', align: 'right', render: r => r.tipo === 'salida' ? <span className="mono" style={{ color: 'var(--bad)', fontWeight: 600 }}>{r.cantidad as number}</span> : <span className="muted">—</span> },
              { key: 'stock_final',      label: 'Stock final', align: 'right', render: r => <span className="mono" style={{ fontWeight: 700 }}>{r.stock_final as number}</span> },
              { key: 'comentario',       label: 'Comentario', render: r => <span className="muted" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.comentario as string ?? '—'}</span> },
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
              { key: 'producto_codigo', label: 'Código', render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.producto_codigo as string}</span> },
              { key: 'descripcion',     label: 'Descripción' },
              { key: 'unidad_medida',   label: 'UM', width: 60 },
              { key: 'stock_actual',    label: 'Stock actual', align: 'right', render: r => {
                const s = r.stock_actual as number
                return <span className="mono" style={{ fontWeight: 700, color: s <= 0 ? 'var(--bad)' : s <= 5 ? 'var(--warn)' : 'var(--ok)' }}>{s}</span>
              }},
              { key: 'ultimo_movimiento', label: 'Último movimiento', render: r => <span className="mono">{fmtDate(r.ultimo_movimiento as string)}</span> },
            ] as Column<Record<string, unknown>>[]}
            rows={stock}
            idKey="producto_codigo"
            loading={loading}
            emptyMessage="Sin productos en stock"
          />
        </Card>
      )}

      {/* Modal recepción */}
      <Modal open={showRec} onClose={() => { setShowRec(false); setRecForm(defaultRec) }}
        title="Registrar recepción" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowRec(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleRegistrarRecepcion} disabled={savingRec || !recForm.codigo_comercial || !recForm.cantidad_recibida}>
              {savingRec ? 'Guardando…' : 'Registrar recepción'}
            </button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'OPCI (opcional)', key: 'operacion_id' },
            { label: 'N° OC (opcional)', key: 'orden_compra_id' },
            { label: 'Código comercial *', key: 'codigo_comercial' },
            { label: 'Descripción *', key: 'descripcion' },
            { label: 'Cantidad esperada *', key: 'cantidad_esperada', type: 'number' },
            { label: 'Cantidad recibida *', key: 'cantidad_recibida', type: 'number' },
            { label: 'Unidad de medida', key: 'unidad_medida' },
            { label: 'Fecha recepción', key: 'fecha_recepcion', type: 'date' },
            { label: 'ERP Entrada', key: 'erp_inta_entrada' },
          ].map(f => (
            <div key={f.key} className="form-field">
              <label className="form-label">{f.label}</label>
              <input type={f.type ?? 'text'} className="input"
                value={recForm[f.key as keyof RecepcionForm]}
                onChange={e => setRecForm(r => ({ ...r, [f.key]: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
          ))}
          <div className="form-field">
            <label className="form-label">Conformidad almacén</label>
            <select className="select" value={recForm.conf_almacen}
              onChange={e => setRecForm(r => ({ ...r, conf_almacen: e.target.value }))}
              style={{ width: '100%' }}>
              <option>Conforme</option><option>Observado</option><option>Rechazado</option>
            </select>
          </div>
          {recForm.conf_almacen !== 'Conforme' && (
            <div className="form-field" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Motivo de observación</label>
              <textarea className="input" rows={2} value={recForm.motivo_conf_almacen}
                onChange={e => setRecForm(r => ({ ...r, motivo_conf_almacen: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
          )}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={recForm.notas}
              onChange={e => setRecForm(r => ({ ...r, notas: e.target.value }))}
              style={{ width: '100%' }} />
          </div>
        </div>
      </Modal>

      {/* Modal despacho */}
      <Modal open={showDesp} onClose={() => { setShowDesp(false); setDespForm(defaultDesp) }}
        title="Registrar despacho" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowDesp(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleRegistrarDespacho} disabled={savingDesp || !despForm.codigo_comercial || !despForm.cantidad}>
              {savingDesp ? 'Guardando…' : 'Registrar despacho'}
            </button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'OPCI *', key: 'operacion_id' },
            { label: 'Código comercial *', key: 'codigo_comercial' },
            { label: 'Descripción', key: 'descripcion' },
            { label: 'Cantidad *', key: 'cantidad', type: 'number' },
            { label: 'Unidad de medida', key: 'unidad_medida' },
            { label: 'Distrito de despacho', key: 'distrito_despacho' },
            { label: 'Fecha despacho', key: 'fecha_despacho', type: 'date' },
            { label: 'ERP Salida', key: 'erp_inta_salida' },
          ].map(f => (
            <div key={f.key} className="form-field">
              <label className="form-label">{f.label}</label>
              <input type={f.type ?? 'text'} className="input"
                value={despForm[f.key as keyof DespachoForm]}
                onChange={e => setDespForm(d => ({ ...d, [f.key]: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
          ))}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Notas</label>
            <textarea className="input" rows={2} value={despForm.notas}
              onChange={e => setDespForm(d => ({ ...d, notas: e.target.value }))}
              style={{ width: '100%' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
