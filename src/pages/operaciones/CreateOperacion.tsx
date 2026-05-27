import { useState, useEffect, useRef } from 'react'
import { Modal, Icon } from '@/components/ui'
import { getClientes } from '@/services/clientes.service'
import { createOperacion } from '@/services/operaciones.service'
import { getNextCorrelativoOPCI } from '@/services/configuracion.service'
import { supabase } from '@/lib/supabase'
import { money, fmtDbError } from '@/lib/utils'
import type { Cliente, EstadoOPCI, Currency } from '@/types'

const FORMAS_PAGO = [
  'Contado',
  'Crédito 15 días',
  'Crédito 30 días',
  'Crédito 45 días',
  'Crédito 60 días',
  'Crédito 90 días',
  'Carta de crédito',
  'Transferencia anticipada',
]

interface Form {
  correlativo_opci: string
  fecha_recepcion: string
  fecha_inicio: string
  fecha_procesamiento_vi: string
  cliente_id: string
  cliente_final_id: string
  cliente_proveedor: string
  numero_op: string
  numero_referencia_cliente: string
  moneda: Currency
  monto_total_sin_igv: string
  u_bruta_coti: string
  forma_pago: string
  estado: EstadoOPCI
  vendedor1_id: string
  vendedor2_id: string
  lider_id: string
}

const defaultForm: Form = {
  correlativo_opci: '',
  fecha_recepcion: new Date().toISOString().slice(0, 10),
  fecha_inicio: '',
  fecha_procesamiento_vi: '',
  cliente_id: '',
  cliente_final_id: '',
  cliente_proveedor: '',
  numero_op: '',
  numero_referencia_cliente: '',
  moneda: 'USD',
  monto_total_sin_igv: '',
  u_bruta_coti: '',
  forma_pago: '',
  estado: 'Borrador',
  vendedor1_id: '',
  vendedor2_id: '',
  lider_id: '',
}

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (id: string, correlativo: string) => void
}

const dropdownStyle: React.CSSProperties = {
  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
  background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6,
  boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 220, overflowY: 'auto',
}

const dropItemStyle: React.CSSProperties = {
  padding: '8px 12px', cursor: 'pointer', fontSize: 12.5,
}

export function CreateOperacion({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<Form>(defaultForm)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [vendedores, setVendedores] = useState<{ id: string; nombre_completo: string }[]>([])
  const [correlatvoLoading, setCorrelatvoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Combo cliente
  const [clienteSearch, setClienteSearch] = useState('')
  const [showClienteDrop, setShowClienteDrop] = useState(false)
  const clienteRef = useRef<HTMLDivElement>(null)

  // Combo cliente final
  const [clienteFinalSearch, setClienteFinalSearch] = useState('')
  const [showClienteFinalDrop, setShowClienteFinalDrop] = useState(false)
  const clienteFinalRef = useRef<HTMLDivElement>(null)

  // Combo cliente proveedor (TEXT field — stores razon_social or free text)
  const [showClienteProvDrop, setShowClienteProvDrop] = useState(false)
  const clienteProvRef = useRef<HTMLDivElement>(null)

  // Combo vendedor 1 / 2 / líder
  const [vendedor1Search, setVendedor1Search] = useState('')
  const [showVendedor1Drop, setShowVendedor1Drop] = useState(false)
  const vendedor1Ref = useRef<HTMLDivElement>(null)

  const [vendedor2Search, setVendedor2Search] = useState('')
  const [showVendedor2Drop, setShowVendedor2Drop] = useState(false)
  const vendedor2Ref = useRef<HTMLDivElement>(null)

  const [liderSearch, setLiderSearch] = useState('')
  const [showLiderDrop, setShowLiderDrop] = useState(false)
  const liderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setForm(defaultForm)
    setError('')
    setClienteSearch('')
    setClienteFinalSearch('')
    setShowClienteDrop(false)
    setShowClienteFinalDrop(false)
    setShowClienteProvDrop(false)
    setVendedor1Search('')
    setVendedor2Search('')
    setLiderSearch('')
    setShowVendedor1Drop(false)
    setShowVendedor2Drop(false)
    setShowLiderDrop(false)
    setCorrelatvoLoading(true)
    getNextCorrelativoOPCI().then(c => {
      setForm(f => ({ ...f, correlativo_opci: c }))
      setCorrelatvoLoading(false)
    })
    getClientes().then(r => setClientes(r.data ?? []))
    supabase
      .from('profiles')
      .select('id, nombre_completo')
      .eq('activo', true)
      .eq('es_vendedor', true)
      .order('nombre_completo')
      .then(({ data }) => setVendedores((data ?? []) as { id: string; nombre_completo: string }[]))
  }, [open])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) setShowClienteDrop(false)
      if (clienteFinalRef.current && !clienteFinalRef.current.contains(e.target as Node)) setShowClienteFinalDrop(false)
      if (clienteProvRef.current && !clienteProvRef.current.contains(e.target as Node)) setShowClienteProvDrop(false)
      if (vendedor1Ref.current && !vendedor1Ref.current.contains(e.target as Node)) setShowVendedor1Drop(false)
      if (vendedor2Ref.current && !vendedor2Ref.current.contains(e.target as Node)) setShowVendedor2Drop(false)
      if (liderRef.current && !liderRef.current.contains(e.target as Node)) setShowLiderDrop(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function filterClientes(q: string): Cliente[] {
    if (!q.trim()) return clientes.slice(0, 10)
    const lower = q.toLowerCase()
    return clientes.filter(c =>
      c.razon_social.toLowerCase().includes(lower) ||
      (c.nombre_comercial ?? '').toLowerCase().includes(lower) ||
      (c.ruc ?? '').includes(q)
    ).slice(0, 10)
  }

  function filterVendedores(q: string) {
    if (!q.trim()) return vendedores.slice(0, 15)
    const lower = q.toLowerCase()
    return vendedores.filter(v => v.nombre_completo.toLowerCase().includes(lower)).slice(0, 15)
  }

  function set(field: keyof Form, value: string) {
    setForm(f => {
      const next = { ...f, [field]: value }
      if (field === 'vendedor1_id' && !f.vendedor2_id) {
        next.vendedor2_id = value
      }
      return next
    })
  }

  async function handleSave() {
    if (!form.correlativo_opci || !form.cliente_id || !form.fecha_recepcion) {
      setError('Correlativo, cliente y fecha de recepción son obligatorios.')
      return
    }
    setSaving(true)
    setError('')
    const { data, error: err } = await createOperacion({
      correlativo_opci: form.correlativo_opci.trim(),
      fecha_recepcion: form.fecha_recepcion,
      fecha_inicio: form.fecha_inicio || undefined,
      fecha_procesamiento_vi: form.fecha_procesamiento_vi || undefined,
      cliente_id: form.cliente_id,
      cliente_final_id: form.cliente_final_id || undefined,
      cliente_proveedor: form.cliente_proveedor || undefined,
      numero_op: form.numero_op || undefined,
      numero_referencia_cliente: form.numero_referencia_cliente || undefined,
      moneda: form.moneda,
      monto_total_sin_igv: parseFloat(form.monto_total_sin_igv) || 0,
      u_bruta_coti: form.u_bruta_coti ? parseFloat(form.u_bruta_coti) / 100 : undefined,
      forma_pago: form.forma_pago || undefined,
      estado: form.estado,
      vendedor1_id: form.vendedor1_id || undefined,
      vendedor2_id: form.vendedor2_id || undefined,
      lider_id: form.lider_id || undefined,
    })
    setSaving(false)
    if (err || !data) {
      setError(fmtDbError(err, 'Error al crear la operación.'))
      return
    }
    onCreated(data.id, data.correlativo_opci)
  }

  const totalConIgv = parseFloat(form.monto_total_sin_igv) > 0
    ? parseFloat(form.monto_total_sin_igv) * 1.18
    : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nueva Operación OPCI"
      size="lg"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving || !form.correlativo_opci || !form.cliente_id}
          >
            {saving ? 'Creando…' : 'Crear OPCI'}
          </button>
        </>
      }
    >
      {error && (
        <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* Correlativo — auto-generado */}
        <div className="form-field">
          <label className="form-label">Correlativo OPCI</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 34, paddingLeft: 10, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
            {correlatvoLoading ? (
              <span style={{ color: 'var(--text-3)', fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="spinner" size={12} style={{ animation: 'spin 1s linear infinite' }} /> Generando…
              </span>
            ) : (
              <span className="mono" style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--accent-2)', letterSpacing: 1 }}>
                {form.correlativo_opci}
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-3)', paddingRight: 10 }}>Auto</span>
          </div>
        </div>

        {/* Fecha recepción */}
        <div className="form-field">
          <label className="form-label">Fecha de recepción *</label>
          <input type="date" className="input" value={form.fecha_recepcion} onChange={e => set('fecha_recepcion', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Fecha inicio */}
        <div className="form-field">
          <label className="form-label">Fecha de inicio</label>
          <input type="date" className="input" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Fecha procesamiento VI */}
        <div className="form-field">
          <label className="form-label">Fecha procesamiento VI</label>
          <input type="date" className="input" value={form.fecha_procesamiento_vi} onChange={e => set('fecha_procesamiento_vi', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* ── Cliente (combo con búsqueda) ── */}
        <div className="form-field" style={{ gridColumn: '1 / -1' }} ref={clienteRef}>
          <label className="form-label">Cliente *</label>
          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 0, position: 'relative' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input
                className="input"
                value={clienteSearch}
                onChange={e => {
                  setClienteSearch(e.target.value)
                  setShowClienteDrop(true)
                  if (!e.target.value) set('cliente_id', '')
                }}
                onFocus={() => setShowClienteDrop(true)}
                placeholder="Buscar por razón social, nombre comercial o RUC…"
                style={{ width: '100%', paddingLeft: 30 }}
              />
              {form.cliente_id && (
                <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => { set('cliente_id', ''); setClienteSearch('') }}>
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
            {showClienteDrop && (
              <div style={dropdownStyle}>
                {filterClientes(clienteSearch).length === 0 ? (
                  <div style={{ ...dropItemStyle, color: 'var(--text-3)' }}>Sin resultados</div>
                ) : filterClientes(clienteSearch).map(c => (
                  <div key={c.id} style={dropItemStyle}
                    onMouseDown={() => { set('cliente_id', c.id); setClienteSearch(c.razon_social); setShowClienteDrop(false) }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{c.razon_social}</span>
                    {c.ruc && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{c.ruc}</span>}
                    {c.ciudad && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11 }}>· {c.ciudad}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Cliente final (combo con búsqueda) ── */}
        <div className="form-field" ref={clienteFinalRef}>
          <label className="form-label">Cliente final</label>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
              <input
                className="input"
                value={clienteFinalSearch}
                onChange={e => {
                  setClienteFinalSearch(e.target.value)
                  setShowClienteFinalDrop(true)
                  if (!e.target.value) set('cliente_final_id', '')
                }}
                onFocus={() => setShowClienteFinalDrop(true)}
                placeholder="Sin especificar…"
                style={{ width: '100%', paddingLeft: 30 }}
              />
              {form.cliente_final_id && (
                <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                  onClick={() => { set('cliente_final_id', ''); setClienteFinalSearch('') }}>
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
            {showClienteFinalDrop && (
              <div style={dropdownStyle}>
                {filterClientes(clienteFinalSearch).length === 0 ? (
                  <div style={{ ...dropItemStyle, color: 'var(--text-3)' }}>Sin resultados</div>
                ) : filterClientes(clienteFinalSearch).map(c => (
                  <div key={c.id} style={dropItemStyle}
                    onMouseDown={() => { set('cliente_final_id', c.id); setClienteFinalSearch(c.razon_social); setShowClienteFinalDrop(false) }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{c.razon_social}</span>
                    {c.ruc && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{c.ruc}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Cliente proveedor (combo con búsqueda sobre clientes, guarda texto libre) ── */}
        <div className="form-field" ref={clienteProvRef}>
          <label className="form-label">Cliente proveedor</label>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', zIndex: 1 }} />
            <input
              className="input"
              value={form.cliente_proveedor}
              onChange={e => { set('cliente_proveedor', e.target.value); setShowClienteProvDrop(true) }}
              onFocus={() => setShowClienteProvDrop(true)}
              placeholder="Buscar cliente o escribir libremente…"
              style={{ width: '100%', paddingLeft: 30 }}
            />
            {showClienteProvDrop && (
              <div style={dropdownStyle}>
                {filterClientes(form.cliente_proveedor).length === 0 ? (
                  <div style={{ ...dropItemStyle, color: 'var(--text-3)' }}>
                    {form.cliente_proveedor ? 'Sin coincidencias — se guardará el texto escrito' : 'Sin clientes cargados'}
                  </div>
                ) : filterClientes(form.cliente_proveedor).map(c => (
                  <div key={c.id} style={dropItemStyle}
                    onMouseDown={() => { set('cliente_proveedor', c.razon_social); setShowClienteProvDrop(false) }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{c.razon_social}</span>
                    {c.ruc && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{c.ruc}</span>}
                    {c.ciudad && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11 }}>· {c.ciudad}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* N° OP cliente */}
        <div className="form-field">
          <label className="form-label">N° OP cliente</label>
          <input className="input" value={form.numero_op} onChange={e => set('numero_op', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Referencia cliente */}
        <div className="form-field">
          <label className="form-label">N° Referencia cliente</label>
          <input className="input" value={form.numero_referencia_cliente} onChange={e => set('numero_referencia_cliente', e.target.value)} style={{ width: '100%' }} />
        </div>

        {/* Moneda */}
        <div className="form-field">
          <label className="form-label">Moneda</label>
          <select className="select" value={form.moneda} onChange={e => set('moneda', e.target.value)} style={{ width: '100%' }}>
            <option value="USD">USD – Dólares</option>
            <option value="PEN">PEN – Soles</option>
            <option value="EUR">EUR – Euros</option>
          </select>
        </div>

        {/* Monto */}
        <div className="form-field">
          <label className="form-label">Monto sin IGV</label>
          <input type="number" className="input" value={form.monto_total_sin_igv} onChange={e => set('monto_total_sin_igv', e.target.value)} placeholder="0.00" step="0.01" min="0" style={{ width: '100%' }} />
        </div>

        {/* Utilidad bruta cotización */}
        <div className="form-field">
          <label className="form-label">Utilidad bruta cotización (%)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className="input"
              value={form.u_bruta_coti}
              onChange={e => set('u_bruta_coti', e.target.value)}
              placeholder="Ej: 25.5"
              step="0.01"
              min="0"
              max="100"
              style={{ width: '100%', paddingRight: 28 }}
            />
            <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-3)', pointerEvents: 'none' }}>%</span>
          </div>
        </div>

        {/* Forma de pago */}
        <div className="form-field">
          <label className="form-label">Forma de pago</label>
          <select className="select" value={form.forma_pago} onChange={e => set('forma_pago', e.target.value)} style={{ width: '100%' }}>
            <option value="">— Sin especificar —</option>
            {FORMAS_PAGO.map(fp => <option key={fp} value={fp}>{fp}</option>)}
          </select>
        </div>

        {/* Estado */}
        <div className="form-field">
          <label className="form-label">Estado inicial</label>
          <select className="select" value={form.estado} onChange={e => set('estado', e.target.value)} style={{ width: '100%' }}>
            <option value="Borrador">Borrador</option>
            <option value="Recibida">Recibida</option>
          </select>
        </div>

        {/* Vendedor 1 */}
        <div className="form-field" ref={vendedor1Ref}>
          <label className="form-label">Vendedor 1</label>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              className="input"
              value={vendedor1Search}
              onChange={e => {
                setVendedor1Search(e.target.value)
                setShowVendedor1Drop(true)
                if (!e.target.value) { set('vendedor1_id', ''); setVendedor2Search('') }
              }}
              onFocus={() => setShowVendedor1Drop(true)}
              placeholder="Buscar vendedor…"
              style={{ width: '100%', paddingLeft: 30 }}
            />
            {form.vendedor1_id && (
              <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => { set('vendedor1_id', ''); setVendedor1Search(''); setVendedor2Search('') }}>
                <Icon name="x" size={11} />
              </button>
            )}
            {showVendedor1Drop && (
              <div style={dropdownStyle}>
                {filterVendedores(vendedor1Search).length === 0 ? (
                  <div style={{ ...dropItemStyle, color: 'var(--text-3)' }}>Sin resultados</div>
                ) : filterVendedores(vendedor1Search).map(v => (
                  <div key={v.id} style={dropItemStyle}
                    onMouseDown={() => {
                      const wasEmpty = !form.vendedor2_id
                      set('vendedor1_id', v.id)
                      setVendedor1Search(v.nombre_completo)
                      if (wasEmpty) setVendedor2Search(v.nombre_completo)
                      setShowVendedor1Drop(false)
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {v.nombre_completo}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Vendedor 2 */}
        <div className="form-field" ref={vendedor2Ref}>
          <label className="form-label">Vendedor 2 <span className="tiny muted">(copia vendedor 1 por defecto)</span></label>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              className="input"
              value={vendedor2Search}
              onChange={e => {
                setVendedor2Search(e.target.value)
                setShowVendedor2Drop(true)
                if (!e.target.value) set('vendedor2_id', '')
              }}
              onFocus={() => setShowVendedor2Drop(true)}
              placeholder="Buscar vendedor…"
              style={{ width: '100%', paddingLeft: 30 }}
            />
            {form.vendedor2_id && (
              <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => { set('vendedor2_id', ''); setVendedor2Search('') }}>
                <Icon name="x" size={11} />
              </button>
            )}
            {showVendedor2Drop && (
              <div style={dropdownStyle}>
                {filterVendedores(vendedor2Search).length === 0 ? (
                  <div style={{ ...dropItemStyle, color: 'var(--text-3)' }}>Sin resultados</div>
                ) : filterVendedores(vendedor2Search).map(v => (
                  <div key={v.id} style={dropItemStyle}
                    onMouseDown={() => { set('vendedor2_id', v.id); setVendedor2Search(v.nombre_completo); setShowVendedor2Drop(false) }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {v.nombre_completo}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Líder */}
        <div className="form-field" style={{ gridColumn: '1 / -1' }} ref={liderRef}>
          <label className="form-label">Líder</label>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
            <input
              className="input"
              value={liderSearch}
              onChange={e => {
                setLiderSearch(e.target.value)
                setShowLiderDrop(true)
                if (!e.target.value) set('lider_id', '')
              }}
              onFocus={() => setShowLiderDrop(true)}
              placeholder="Buscar líder…"
              style={{ width: '100%', paddingLeft: 30 }}
            />
            {form.lider_id && (
              <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                onClick={() => { set('lider_id', ''); setLiderSearch('') }}>
                <Icon name="x" size={11} />
              </button>
            )}
            {showLiderDrop && (
              <div style={dropdownStyle}>
                {filterVendedores(liderSearch).length === 0 ? (
                  <div style={{ ...dropItemStyle, color: 'var(--text-3)' }}>Sin resultados</div>
                ) : filterVendedores(liderSearch).map(v => (
                  <div key={v.id} style={dropItemStyle}
                    onMouseDown={() => { set('lider_id', v.id); setLiderSearch(v.nombre_completo); setShowLiderDrop(false) }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    {v.nombre_completo}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Preview monto */}
        {totalConIgv && (
          <div style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
            Con IGV estimado (18%): <strong className="mono">{money(totalConIgv, form.moneda)}</strong>
          </div>
        )}
      </div>
    </Modal>
  )
}
