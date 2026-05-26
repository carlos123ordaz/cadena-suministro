import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon, Card, DataTable, EtaCell, Modal, Tabs, Badge, StatusBadge, DESPACHO_STATUS_TONE } from '@/components/ui'
import type { Column } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, fmtDbError } from '@/lib/utils'
import { downloadCsv } from '@/lib/export'
import type { GuiaRemision, ConfirmacionEntrega, Despacho, EstadoGuia } from '@/types'

const TABS = [
  { id: 'guias',          label: 'Guías de remisión' },
  { id: 'confirmaciones', label: 'Confirmaciones' },
  { id: 'despachos',      label: 'Despachos' },
]

const GUIA_TONE: Record<string, string> = {
  Emitida: 'info', 'En transporte': 'violet', Entregada: 'ok', Anulada: 'muted',
}

const NEXT_ESTADOS_GUIA: Partial<Record<EstadoGuia, EstadoGuia[]>> = {
  'Emitida':        ['En transporte', 'Anulada'],
  'En transporte':  ['Entregada', 'Anulada'],
}

type EstadoDespacho = 'Preparando' | 'En transporte' | 'Entregado' | 'Observado' | 'Anulado'
const NEXT_ESTADOS_DESPACHO: Partial<Record<EstadoDespacho, EstadoDespacho[]>> = {
  'Preparando':     ['En transporte', 'Observado', 'Anulado'],
  'En transporte':  ['Entregado', 'Observado', 'Anulado'],
  'Observado':      ['Preparando', 'En transporte', 'Anulado'],
}

interface OpciItem { id: string; correlativo_opci: string }
interface DespachoItem { id: string; codigo_comercial: string; descripcion: string; fecha_despacho: string | null; distrito_despacho: string | null; operacion_id: string | null }

interface GuiaForm {
  operacion_id: string; despacho_id: string; numero_guia: string
  fecha_emision: string; fecha_despacho: string
  transportista: string; placa: string; conductor: string
  distrito_destino: string; direccion_destino: string; observaciones: string
}
const defaultGuia: GuiaForm = {
  operacion_id: '', despacho_id: '', numero_guia: '',
  fecha_emision: new Date().toISOString().slice(0, 10), fecha_despacho: '',
  transportista: '', placa: '', conductor: '',
  distrito_destino: '', direccion_destino: '', observaciones: '',
}

interface ConfForm {
  despacho_id: string; fecha_confirmacion: string; recibido_por: string
  conformidad: 'Conforme' | 'Observado' | 'Rechazado'; motivo_observacion: string
}
const defaultConf: ConfForm = {
  despacho_id: '', fecha_confirmacion: new Date().toISOString().slice(0, 10),
  recibido_por: '', conformidad: 'Conforme', motivo_observacion: '',
}

export function GuiasDespachos() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('guias')
  const [guias, setGuias] = useState<GuiaRemision[]>([])
  const [confirmaciones, setConfirmaciones] = useState<ConfirmacionEntrega[]>([])
  const [despachos, setDespachos] = useState<Despacho[]>([])
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')

  const [showGuia, setShowGuia] = useState(false)
  const [guiaForm, setGuiaForm] = useState<GuiaForm>(defaultGuia)
  const [savingGuia, setSavingGuia] = useState(false)
  const [errorGuia, setErrorGuia] = useState<string | null>(null)
  const [opciList, setOpciList] = useState<OpciItem[]>([])
  const [despachosList, setDespachosList] = useState<DespachoItem[]>([])
  const [opciSearch, setOpciSearch] = useState('')
  const [showOpciDrop, setShowOpciDrop] = useState(false)
  const opciDropRef = useRef<HTMLDivElement>(null)

  const [showConf, setShowConf] = useState(false)
  const [confForm, setConfForm] = useState<ConfForm>(defaultConf)
  const [savingConf, setSavingConf] = useState(false)
  const [errorConf, setErrorConf] = useState<string | null>(null)
  const [confDespSearch, setConfDespSearch] = useState('')
  const [showConfDespDrop, setShowConfDespDrop] = useState(false)
  const confDespDropRef = useRef<HTMLDivElement>(null)

  // Estado change — Guía
  const [showEstadoGuia, setShowEstadoGuia] = useState(false)
  const [selectedGuia, setSelectedGuia] = useState<GuiaRemision | null>(null)
  const [nuevoEstadoGuia, setNuevoEstadoGuia] = useState<EstadoGuia | ''>('')
  const [savingEstadoGuia, setSavingEstadoGuia] = useState(false)

  // Estado change — Despacho
  const [showEstadoDesp, setShowEstadoDesp] = useState(false)
  const [selectedDesp, setSelectedDesp] = useState<Despacho | null>(null)
  const [nuevoEstadoDesp, setNuevoEstadoDesp] = useState<EstadoDespacho | ''>('')
  const [savingEstadoDesp, setSavingEstadoDesp] = useState(false)

  const loadTab = useCallback(async () => {
    setLoading(true)
    if (tab === 'guias') {
      let query = supabase
        .from('guias_remision')
        .select('*, operacion:operaciones(correlativo_opci)')
        .order('created_at', { ascending: false })
      if (q) query = query.ilike('numero_guia', `%${q}%`)
      const { data } = await query
      setGuias((data as GuiaRemision[]) ?? [])
    } else if (tab === 'confirmaciones') {
      const { data } = await supabase
        .from('confirmaciones_entrega')
        .select('*, despacho:despachos(id, codigo_comercial, descripcion)')
        .order('created_at', { ascending: false })
      setConfirmaciones((data as ConfirmacionEntrega[]) ?? [])
    } else if (tab === 'despachos') {
      const { data } = await supabase
        .from('despachos')
        .select('*, operacion:operaciones(correlativo_opci)')
        .order('created_at', { ascending: false })
      setDespachos((data as Despacho[]) ?? [])
    }
    setLoading(false)
  }, [tab, q])

  useEffect(() => { loadTab() }, [loadTab])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (opciDropRef.current && !opciDropRef.current.contains(e.target as Node))
        setShowOpciDrop(false)
      if (confDespDropRef.current && !confDespDropRef.current.contains(e.target as Node))
        setShowConfDespDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!showGuia) return
    setOpciSearch('')
    supabase.from('operaciones').select('id, correlativo_opci')
      .not('estado', 'in', '("Cerrada","Anulada")').order('correlativo_opci').limit(200)
      .then(({ data }) => setOpciList((data ?? []) as OpciItem[]))
    supabase.from('despachos').select('id, codigo_comercial, descripcion, fecha_despacho, distrito_despacho, operacion_id')
      .not('estado', 'in', '("Entregado","Anulado")').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setDespachosList((data ?? []) as DespachoItem[]))
  }, [showGuia])

  useEffect(() => {
    if (!showConf) return
    setConfDespSearch('')
    supabase.from('despachos').select('id, codigo_comercial, descripcion, fecha_despacho, distrito_despacho, operacion_id')
      .not('estado', 'in', '("Entregado","Anulado")').order('created_at', { ascending: false }).limit(500)
      .then(({ data }) => setDespachosList((data ?? []) as DespachoItem[]))
  }, [showConf])

  function handleExportGuias() {
    downloadCsv(`guias_remision_${new Date().toISOString().slice(0,10)}`, guias.map(g => ({
      'N° Guía': g.numero_guia,
      'OPCI': ((g as unknown as Record<string, unknown>).operacion as { correlativo_opci?: string } | undefined)?.correlativo_opci ?? '',
      'Fecha Emisión': g.fecha_emision ?? '',
      'Fecha Despacho': g.fecha_despacho ?? '',
      'Transportista': g.transportista ?? '',
      'Placa': g.placa ?? '',
      'Conductor': g.conductor ?? '',
      'Distrito Destino': g.distrito_destino ?? '',
      'Estado': g.estado,
    })))
  }

  async function handleGuardarGuia() {
    if (!profile) { setErrorGuia('Error de sesión. Recarga la página.'); return }
    if (!guiaForm.operacion_id) { setErrorGuia('Selecciona la OPCI asociada a esta guía.'); return }
    if (!guiaForm.numero_guia) { setErrorGuia('El número de guía es obligatorio.'); return }
    setSavingGuia(true)
    setErrorGuia(null)
    const { error } = await supabase.from('guias_remision').insert({
      operacion_id:    guiaForm.operacion_id    || null,
      despacho_id:     guiaForm.despacho_id     || null,
      numero_guia:     guiaForm.numero_guia,
      fecha_emision:   guiaForm.fecha_emision   || null,
      fecha_despacho:  guiaForm.fecha_despacho  || null,
      transportista:   guiaForm.transportista   || null,
      placa:           guiaForm.placa           || null,
      conductor:       guiaForm.conductor       || null,
      distrito_destino:   guiaForm.distrito_destino   || null,
      direccion_destino:  guiaForm.direccion_destino  || null,
      observaciones:   guiaForm.observaciones   || null,
      estado: 'Emitida',
      usuario_id: profile.id,
    })
    setSavingGuia(false)
    if (error) { setErrorGuia(fmtDbError(error, 'Error al guardar la guía.')); return }
    setShowGuia(false)
    setGuiaForm(defaultGuia)
    loadTab()
  }

  async function handleGuardarConf() {
    if (!profile) { setErrorConf('Error de sesión. Recarga la página.'); return }
    if (!confForm.despacho_id) { setErrorConf('Selecciona un despacho.'); return }
    if (!confForm.fecha_confirmacion) { setErrorConf('La fecha de confirmación es obligatoria.'); return }
    setSavingConf(true)
    setErrorConf(null)
    const { error } = await supabase.from('confirmaciones_entrega').insert({
      despacho_id:       confForm.despacho_id || null,
      fecha_confirmacion: confForm.fecha_confirmacion,
      recibido_por:      confForm.recibido_por || null,
      conformidad:       confForm.conformidad,
      motivo_observacion: confForm.conformidad !== 'Conforme' ? confForm.motivo_observacion : null,
      usuario_id: profile.id,
    })
    setSavingConf(false)
    if (error) { setErrorConf(fmtDbError(error, 'Error al registrar confirmación.')); return }
    setShowConf(false)
    setConfForm(defaultConf)
    loadTab()
  }

  async function handleCambiarEstadoGuia() {
    if (!selectedGuia || !nuevoEstadoGuia) return
    setSavingEstadoGuia(true)
    await supabase.from('guias_remision').update({ estado: nuevoEstadoGuia }).eq('id', selectedGuia.id)
    setSavingEstadoGuia(false)
    setShowEstadoGuia(false)
    setSelectedGuia(null)
    setNuevoEstadoGuia('')
    loadTab()
  }

  async function handleCambiarEstadoDesp() {
    if (!selectedDesp || !nuevoEstadoDesp) return
    setSavingEstadoDesp(true)
    await supabase.from('despachos').update({ estado: nuevoEstadoDesp }).eq('id', selectedDesp.id)
    setSavingEstadoDesp(false)
    setShowEstadoDesp(false)
    setSelectedDesp(null)
    setNuevoEstadoDesp('')
    loadTab()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Guías y Despachos</h1>
          <div className="page-sub">Guías de remisión, confirmaciones de entrega y seguimiento de despachos</div>
        </div>
        <div className="page-actions">
          {tab === 'guias'          && <button className="btn primary sm" onClick={() => setShowGuia(true)}><Icon name="plus" size={13} /> Nueva guía</button>}
          {tab === 'confirmaciones' && <button className="btn primary sm" onClick={() => setShowConf(true)}><Icon name="plus" size={13} /> Registrar confirmación</button>}
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {/* Guías */}
      {tab === 'guias' && (
        <Card padding={false}>
          <div className="table-toolbar">
            <div className="input-wrap">
              <Icon name="search" size={13} className="ico" />
              <input className="input with-ico" placeholder="N° guía, OPCI…" value={q}
                onChange={e => setQ(e.target.value)} style={{ width: 220 }} />
            </div>
            <div className="spacer" />
            <button className="btn sm" onClick={handleExportGuias}><Icon name="download" size={13} /> Exportar</button>
          </div>
          <DataTable
            columns={[
              { key: 'numero_guia',      label: 'N° Guía',       render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.numero_guia as string}</span> },
              { key: 'operacion',        label: 'OPCI',          render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{(r.operacion as { correlativo_opci: string })?.correlativo_opci ?? '—'}</span> },
              { key: 'fecha_emision',    label: 'Emisión',       render: r => <span className="mono">{fmtDate(r.fecha_emision as string)}</span> },
              { key: 'transportista',    label: 'Transportista', render: r => <span>{(r.transportista as string) ?? '—'}</span> },
              { key: 'placa',            label: 'Placa',         render: r => <span className="mono">{(r.placa as string) ?? '—'}</span> },
              { key: 'conductor',        label: 'Conductor',     render: r => <span>{(r.conductor as string) ?? '—'}</span> },
              { key: 'distrito_destino', label: 'Distrito',      render: r => <span className="muted">{(r.distrito_destino as string) ?? '—'}</span> },
              { key: 'fecha_despacho',   label: 'F. despacho',   render: r => <EtaCell eta={r.fecha_despacho as string} /> },
              { key: 'estado',           label: 'Estado',        render: r => <Badge tone={(GUIA_TONE[r.estado as string] ?? 'muted') as 'ok' | 'warn' | 'bad' | 'info' | 'muted' | 'violet' | 'teal'}>{r.estado as EstadoGuia}</Badge> },
              {
                key: '_accion', label: '', width: 80,
                render: r => {
                  const nextStates = NEXT_ESTADOS_GUIA[r.estado as EstadoGuia] ?? []
                  return nextStates.length > 0 ? (
                    <button className="btn xs" onClick={e => { e.stopPropagation(); setSelectedGuia(r as unknown as GuiaRemision); setNuevoEstadoGuia(''); setShowEstadoGuia(true) }}>
                      <Icon name="tag" size={11} /> Estado
                    </button>
                  ) : null
                },
              },
            ] as Column<Record<string, unknown>>[]}
            rows={guias as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="Sin guías de remisión registradas"
          />
        </Card>
      )}

      {/* Confirmaciones */}
      {tab === 'confirmaciones' && (
        <Card padding={false}>
          <DataTable
            columns={[
              { key: 'fecha_confirmacion', label: 'Fecha confirmación', render: r => <span className="mono">{fmtDate(r.fecha_confirmacion as string)}</span> },
              { key: 'despacho',           label: 'Despacho', render: r => {
                const d = r.despacho as { codigo_comercial: string; descripcion: string } | null
                return d
                  ? <span className="mono" style={{ fontSize: 11 }}>{d.codigo_comercial} — <span className="muted">{d.descripcion}</span></span>
                  : <span className="muted">—</span>
              }},
              { key: 'recibido_por',       label: 'Recibido por',   render: r => <span>{(r.recibido_por as string) ?? '—'}</span> },
              { key: 'conformidad',        label: 'Conformidad',    render: r => {
                const c = r.conformidad as string
                const tone = c === 'Conforme' ? 'ok' : c === 'Rechazado' ? 'bad' : 'warn'
                return <Badge tone={tone}>{c}</Badge>
              }},
              { key: 'motivo_observacion', label: 'Motivo', render: r => <span className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{(r.motivo_observacion as string) ?? '—'}</span> },
            ] as Column<Record<string, unknown>>[]}
            rows={confirmaciones as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="Sin confirmaciones registradas"
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
              { key: 'distrito_despacho', label: 'Distrito',    render: r => <span className="muted">{(r.distrito_despacho as string) ?? '—'}</span> },
              { key: 'fecha_despacho',   label: 'F. despacho',  render: r => <span className="mono">{fmtDate(r.fecha_despacho as string)}</span> },
              { key: 'estado',           label: 'Estado',       render: r => <StatusBadge status={r.estado as string} mapping={DESPACHO_STATUS_TONE} /> },
              {
                key: '_accion', label: '', width: 80,
                render: r => {
                  const nextStates = NEXT_ESTADOS_DESPACHO[r.estado as EstadoDespacho] ?? []
                  return nextStates.length > 0 ? (
                    <button className="btn xs" onClick={e => { e.stopPropagation(); setSelectedDesp(r as unknown as Despacho); setNuevoEstadoDesp(''); setShowEstadoDesp(true) }}>
                      <Icon name="tag" size={11} /> Estado
                    </button>
                  ) : null
                },
              },
            ] as Column<Record<string, unknown>>[]}
            rows={despachos as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="Sin despachos"
          />
        </Card>
      )}

      {/* Modal nueva guía */}
      <Modal open={showGuia} onClose={() => { setShowGuia(false); setGuiaForm(defaultGuia); setErrorGuia(null); setOpciSearch('') }}
        title="Nueva guía de remisión" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => { setShowGuia(false); setGuiaForm(defaultGuia); setErrorGuia(null); setOpciSearch('') }}>Cancelar</button>
            <button className="btn primary" onClick={handleGuardarGuia} disabled={savingGuia}>
              {savingGuia ? 'Guardando…' : 'Guardar guía'}
            </button>
          </>
        }
      >
        {errorGuia && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{errorGuia}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">OPCI *</label>
            <div style={{ position: 'relative' }} ref={opciDropRef}>
              <input
                className="input"
                value={opciSearch}
                onChange={e => {
                  setOpciSearch(e.target.value)
                  setShowOpciDrop(true)
                  if (!e.target.value) setGuiaForm(g => ({ ...g, operacion_id: '', despacho_id: '' }))
                }}
                onFocus={() => setShowOpciDrop(true)}
                placeholder="Buscar OPCI…"
                style={{ width: '100%' }}
                autoComplete="off"
              />
              {showOpciDrop && (() => {
                const filtered = opciSearch
                  ? opciList.filter(o => o.correlativo_opci.toLowerCase().includes(opciSearch.toLowerCase()))
                  : opciList
                return filtered.length > 0 ? (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 200, overflowY: 'auto', marginTop: 2 }}>
                    {filtered.map(o => (
                      <div key={o.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
                        onMouseDown={() => {
                          setOpciSearch(o.correlativo_opci)
                          setGuiaForm(g => ({ ...g, operacion_id: o.id, despacho_id: '' }))
                          setShowOpciDrop(false)
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{o.correlativo_opci}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Despacho asociado{guiaForm.operacion_id ? '' : ' (selecciona OPCI primero)'}</label>
            <select className="select" value={guiaForm.despacho_id}
              disabled={!guiaForm.operacion_id}
              onChange={e => {
                const d = despachosList.find(x => x.id === e.target.value)
                setGuiaForm(g => ({
                  ...g,
                  despacho_id: e.target.value,
                  ...(d ? {
                    distrito_destino: d.distrito_despacho ?? g.distrito_destino,
                    fecha_despacho: d.fecha_despacho ?? g.fecha_despacho,
                  } : {}),
                }))
              }} style={{ width: '100%' }}>
              <option value="">— Sin despacho —</option>
              {despachosList
                .filter(d => d.operacion_id === guiaForm.operacion_id)
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.codigo_comercial} — {d.descripcion}{d.fecha_despacho ? ` (${fmtDate(d.fecha_despacho)})` : ''}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">N° Guía *</label>
            <input className="input" value={guiaForm.numero_guia} onChange={e => setGuiaForm(g => ({ ...g, numero_guia: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="Ej: GR-2026-001" />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha emisión</label>
            <input type="date" className="input" value={guiaForm.fecha_emision} onChange={e => setGuiaForm(g => ({ ...g, fecha_emision: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Fecha despacho</label>
            <input type="date" className="input" value={guiaForm.fecha_despacho} onChange={e => setGuiaForm(g => ({ ...g, fecha_despacho: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Transportista</label>
            <input className="input" value={guiaForm.transportista} onChange={e => setGuiaForm(g => ({ ...g, transportista: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Placa</label>
            <input className="input" value={guiaForm.placa} onChange={e => setGuiaForm(g => ({ ...g, placa: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)', textTransform: 'uppercase' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Conductor</label>
            <input className="input" value={guiaForm.conductor} onChange={e => setGuiaForm(g => ({ ...g, conductor: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Distrito destino</label>
            <input className="input" value={guiaForm.distrito_destino} onChange={e => setGuiaForm(g => ({ ...g, distrito_destino: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Dirección destino</label>
            <input className="input" value={guiaForm.direccion_destino} onChange={e => setGuiaForm(g => ({ ...g, direccion_destino: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observaciones</label>
            <textarea className="input" rows={2} value={guiaForm.observaciones} onChange={e => setGuiaForm(g => ({ ...g, observaciones: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* Modal confirmación */}
      <Modal open={showConf} onClose={() => { setShowConf(false); setConfForm(defaultConf); setErrorConf(null); setConfDespSearch('') }}
        title="Registrar confirmación de entrega" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => { setShowConf(false); setConfForm(defaultConf); setErrorConf(null); setConfDespSearch('') }}>Cancelar</button>
            <button className="btn primary" onClick={handleGuardarConf} disabled={savingConf}>
              {savingConf ? 'Guardando…' : 'Registrar'}
            </button>
          </>
        }
      >
        {errorConf && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{errorConf}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Despacho *</label>
            <div style={{ position: 'relative' }} ref={confDespDropRef}>
              <input
                className="input"
                value={confDespSearch}
                onChange={e => {
                  setConfDespSearch(e.target.value)
                  setShowConfDespDrop(true)
                  if (!e.target.value) setConfForm(c => ({ ...c, despacho_id: '' }))
                }}
                onFocus={() => setShowConfDespDrop(true)}
                placeholder="Buscar por código o descripción…"
                style={{ width: '100%' }}
                autoComplete="off"
              />
              {showConfDespDrop && (() => {
                const q = confDespSearch.toLowerCase()
                const filtered = q
                  ? despachosList.filter(d =>
                      d.codigo_comercial?.toLowerCase().includes(q) ||
                      d.descripcion?.toLowerCase().includes(q)
                    )
                  : despachosList
                return filtered.length > 0 ? (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
                    {filtered.map(d => (
                      <div key={d.id}
                        style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5, borderBottom: '1px solid var(--border)' }}
                        onMouseDown={() => {
                          setConfDespSearch(`${d.codigo_comercial} — ${d.descripcion}`)
                          setConfForm(c => ({ ...c, despacho_id: d.id }))
                          setShowConfDespDrop(false)
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{d.codigo_comercial}</span>
                        <span className="muted" style={{ marginLeft: 8 }}>{d.descripcion}</span>
                        {d.fecha_despacho && <span className="mono muted" style={{ marginLeft: 8, fontSize: 11 }}>{fmtDate(d.fecha_despacho)}</span>}
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Fecha confirmación *</label>
            <input type="date" className="input" value={confForm.fecha_confirmacion} onChange={e => setConfForm(c => ({ ...c, fecha_confirmacion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Recibido por</label>
            <input className="input" value={confForm.recibido_por} onChange={e => setConfForm(c => ({ ...c, recibido_por: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Conformidad</label>
            <select className="select" value={confForm.conformidad} onChange={e => setConfForm(c => ({ ...c, conformidad: e.target.value as 'Conforme' | 'Observado' | 'Rechazado' }))} style={{ width: '100%' }}>
              <option>Conforme</option><option>Observado</option><option>Rechazado</option>
            </select>
          </div>
          {confForm.conformidad !== 'Conforme' && (
            <div className="form-field">
              <label className="form-label">Motivo</label>
              <textarea className="input" rows={3} value={confForm.motivo_observacion} onChange={e => setConfForm(c => ({ ...c, motivo_observacion: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
            </div>
          )}
        </div>
      </Modal>

      {/* Modal cambiar estado — Guía */}
      <Modal open={showEstadoGuia} onClose={() => setShowEstadoGuia(false)}
        title="Cambiar estado de guía" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setShowEstadoGuia(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCambiarEstadoGuia} disabled={savingEstadoGuia || !nuevoEstadoGuia}>
              {savingEstadoGuia ? 'Guardando…' : 'Confirmar'}
            </button>
          </>
        }
      >
        {selectedGuia && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12.5 }}>
              Guía: <span className="mono" style={{ color: 'var(--accent-2)' }}>{selectedGuia.numero_guia}</span>
              &nbsp;· Estado actual: <Badge tone={(GUIA_TONE[selectedGuia.estado] ?? 'muted') as 'ok' | 'warn' | 'bad' | 'info' | 'muted' | 'violet' | 'teal'}>{selectedGuia.estado}</Badge>
            </div>
            <div className="form-field">
              <label className="form-label">Nuevo estado</label>
              <select className="select" value={nuevoEstadoGuia} onChange={e => setNuevoEstadoGuia(e.target.value as EstadoGuia)} style={{ width: '100%' }}>
                <option value="">— Seleccionar —</option>
                {(NEXT_ESTADOS_GUIA[selectedGuia.estado] ?? []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal cambiar estado — Despacho */}
      <Modal open={showEstadoDesp} onClose={() => setShowEstadoDesp(false)}
        title="Cambiar estado de despacho" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setShowEstadoDesp(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCambiarEstadoDesp} disabled={savingEstadoDesp || !nuevoEstadoDesp}>
              {savingEstadoDesp ? 'Guardando…' : 'Confirmar'}
            </button>
          </>
        }
      >
        {selectedDesp && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ fontSize: 12.5 }}>
              Código: <span className="mono">{selectedDesp.codigo_comercial}</span>
              &nbsp;· Estado actual: <StatusBadge status={selectedDesp.estado} mapping={DESPACHO_STATUS_TONE} />
            </div>
            <div className="form-field">
              <label className="form-label">Nuevo estado</label>
              <select className="select" value={nuevoEstadoDesp} onChange={e => setNuevoEstadoDesp(e.target.value as EstadoDespacho)} style={{ width: '100%' }}>
                <option value="">— Seleccionar —</option>
                {(NEXT_ESTADOS_DESPACHO[selectedDesp.estado as EstadoDespacho] ?? []).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
