import { useState, useEffect, useCallback } from 'react'
import { Icon, Card, DataTable, EtaCell, Modal, Tabs, Badge, StatusBadge, DESPACHO_STATUS_TONE } from '@/components/ui'
import type { Column } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { fmtDate } from '@/lib/utils'
import type { GuiaRemision, ConfirmacionEntrega, Despacho, EstadoGuia } from '@/types'

const TABS = [
  { id: 'guias',          label: 'Guías de remisión' },
  { id: 'confirmaciones', label: 'Confirmaciones' },
  { id: 'despachos',      label: 'Despachos' },
]

const GUIA_TONE: Record<string, string> = { Emitida: 'info', 'En transporte': 'violet', Entregada: 'ok', Anulada: 'muted' }

interface GuiaForm {
  operacion_id: string; numero_guia: string; fecha_emision: string; fecha_despacho: string
  transportista: string; placa: string; conductor: string; distrito_destino: string
  direccion_destino: string; observaciones: string
}
const defaultGuia: GuiaForm = {
  operacion_id: '', numero_guia: '', fecha_emision: new Date().toISOString().slice(0,10), fecha_despacho: '',
  transportista: '', placa: '', conductor: '', distrito_destino: '', direccion_destino: '', observaciones: '',
}

interface ConfForm {
  despacho_id: string; fecha_confirmacion: string; recibido_por: string
  conformidad: 'Conforme' | 'Observado' | 'Rechazado'; motivo_observacion: string
}
const defaultConf: ConfForm = {
  despacho_id: '', fecha_confirmacion: new Date().toISOString().slice(0,10),
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

  const [showConf, setShowConf] = useState(false)
  const [confForm, setConfForm] = useState<ConfForm>(defaultConf)
  const [savingConf, setSavingConf] = useState(false)

  const loadTab = useCallback(async () => {
    setLoading(true)
    if (tab === 'guias') {
      let query = supabase.from('guias_remision').select('*, operacion:operaciones(correlativo_opci)').order('created_at', { ascending: false })
      if (q) query = query.ilike('numero_guia', `%${q}%`)
      const { data } = await query
      setGuias((data as GuiaRemision[]) ?? [])
    } else if (tab === 'confirmaciones') {
      const { data } = await supabase.from('confirmaciones_entrega').select('*, despacho:despachos(id)').order('created_at', { ascending: false })
      setConfirmaciones((data as ConfirmacionEntrega[]) ?? [])
    } else if (tab === 'despachos') {
      const { data } = await supabase.from('despachos').select('*, operacion:operaciones(correlativo_opci)').order('created_at', { ascending: false })
      setDespachos((data as Despacho[]) ?? [])
    }
    setLoading(false)
  }, [tab, q])

  useEffect(() => { loadTab() }, [loadTab])

  async function handleGuardarGuia() {
    if (!profile || !guiaForm.numero_guia) return
    setSavingGuia(true)
    await supabase.from('guias_remision').insert({
      operacion_id: guiaForm.operacion_id || null,
      numero_guia: guiaForm.numero_guia,
      fecha_emision: guiaForm.fecha_emision,
      fecha_despacho: guiaForm.fecha_despacho || null,
      transportista: guiaForm.transportista || null,
      placa: guiaForm.placa || null,
      conductor: guiaForm.conductor || null,
      distrito_destino: guiaForm.distrito_destino || null,
      direccion_destino: guiaForm.direccion_destino || null,
      observaciones: guiaForm.observaciones || null,
      estado: 'Emitida',
      usuario_id: profile.id,
    })
    setSavingGuia(false)
    setShowGuia(false)
    setGuiaForm(defaultGuia)
    loadTab()
  }

  async function handleGuardarConf() {
    if (!profile || !confForm.fecha_confirmacion) return
    setSavingConf(true)
    await supabase.from('confirmaciones_entrega').insert({
      despacho_id: confForm.despacho_id || null,
      fecha_confirmacion: confForm.fecha_confirmacion,
      recibido_por: confForm.recibido_por || null,
      conformidad: confForm.conformidad,
      motivo_observacion: confForm.conformidad !== 'Conforme' ? confForm.motivo_observacion : null,
      usuario_id: profile.id,
    })
    setSavingConf(false)
    setShowConf(false)
    setConfForm(defaultConf)
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
            <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
          </div>
          <DataTable
            columns={[
              { key: 'numero_guia',    label: 'N° Guía', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.numero_guia as string}</span> },
              { key: 'operacion',      label: 'OPCI', render: r => <span className="mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{(r.operacion as {correlativo_opci: string})?.correlativo_opci ?? '—'}</span> },
              { key: 'fecha_emision',  label: 'Emisión', render: r => <span className="mono">{fmtDate(r.fecha_emision as string)}</span> },
              { key: 'transportista',  label: 'Transportista', render: r => <span>{r.transportista as string ?? '—'}</span> },
              { key: 'placa',          label: 'Placa', render: r => <span className="mono">{r.placa as string ?? '—'}</span> },
              { key: 'conductor',      label: 'Conductor', render: r => <span>{r.conductor as string ?? '—'}</span> },
              { key: 'distrito_destino', label: 'Distrito', render: r => <span className="muted">{r.distrito_destino as string ?? '—'}</span> },
              { key: 'fecha_despacho', label: 'F. despacho', render: r => <EtaCell eta={r.fecha_despacho as string} /> },
              { key: 'estado',         label: 'Estado', render: r => <Badge tone={(GUIA_TONE[r.estado as string] ?? 'muted') as 'ok' | 'warn' | 'bad' | 'info' | 'muted' | 'violet' | 'teal'}>{r.estado as string}</Badge> },
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
              { key: 'despacho',           label: 'Despacho', render: r => <span className="mono" style={{ fontSize: 11 }}>{(r.despacho as {id: string})?.id?.slice(0,8) ?? '—'}</span> },
              { key: 'recibido_por',       label: 'Recibido por', render: r => <span>{r.recibido_por as string ?? '—'}</span> },
              { key: 'conformidad',        label: 'Conformidad', render: r => {
                const c = r.conformidad as string
                const tone = c === 'Conforme' ? 'ok' : c === 'Rechazado' ? 'bad' : 'warn'
                return <Badge tone={tone}>{c}</Badge>
              }},
              { key: 'motivo_observacion', label: 'Motivo', render: r => <span className="muted" style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>{r.motivo_observacion as string ?? '—'}</span> },
            ] as Column<Record<string, unknown>>[]}
            rows={confirmaciones as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="Sin confirmaciones registradas"
          />
        </Card>
      )}

      {/* Despachos resumen */}
      {tab === 'despachos' && (
        <Card padding={false}>
          <DataTable
            columns={[
              { key: 'operacion',       label: 'OPCI', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{(r.operacion as {correlativo_opci: string})?.correlativo_opci ?? '—'}</span> },
              { key: 'codigo_comercial',label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',     label: 'Descripción', render: r => <span style={{ maxWidth: 200, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.descripcion as string}</span> },
              { key: 'cantidad',        label: 'Cant.', align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
              { key: 'distrito_despacho', label: 'Distrito', render: r => <span className="muted">{r.distrito_despacho as string ?? '—'}</span> },
              { key: 'fecha_despacho',  label: 'F. despacho', render: r => <span className="mono">{fmtDate(r.fecha_despacho as string)}</span> },
              { key: 'estado',          label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={DESPACHO_STATUS_TONE} /> },
            ] as Column<Record<string, unknown>>[]}
            rows={despachos as unknown as Record<string, unknown>[]}
            idKey="id"
            loading={loading}
            emptyMessage="Sin despachos"
          />
        </Card>
      )}

      {/* Modal nueva guía */}
      <Modal open={showGuia} onClose={() => { setShowGuia(false); setGuiaForm(defaultGuia) }}
        title="Nueva guía de remisión" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowGuia(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleGuardarGuia} disabled={savingGuia || !guiaForm.numero_guia}>
              {savingGuia ? 'Guardando…' : 'Guardar guía'}
            </button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'OPCI (opcional)', key: 'operacion_id' },
            { label: 'N° Guía *', key: 'numero_guia' },
            { label: 'Fecha emisión', key: 'fecha_emision', type: 'date' },
            { label: 'Fecha despacho', key: 'fecha_despacho', type: 'date' },
            { label: 'Transportista', key: 'transportista' },
            { label: 'Placa', key: 'placa' },
            { label: 'Conductor', key: 'conductor' },
            { label: 'Distrito destino', key: 'distrito_destino' },
            { label: 'Dirección destino', key: 'direccion_destino', span: 2 },
          ].map(f => (
            <div key={f.key} className="form-field" style={f.span ? { gridColumn: '1 / -1' } : undefined}>
              <label className="form-label">{f.label}</label>
              <input type={f.type ?? 'text'} className="input"
                value={guiaForm[f.key as keyof GuiaForm]}
                onChange={e => setGuiaForm(g => ({ ...g, [f.key]: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
          ))}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observaciones</label>
            <textarea className="input" rows={2} value={guiaForm.observaciones}
              onChange={e => setGuiaForm(g => ({ ...g, observaciones: e.target.value }))}
              style={{ width: '100%' }} />
          </div>
        </div>
      </Modal>

      {/* Modal confirmación */}
      <Modal open={showConf} onClose={() => { setShowConf(false); setConfForm(defaultConf) }}
        title="Registrar confirmación de entrega" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setShowConf(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleGuardarConf} disabled={savingConf}>
              {savingConf ? 'Guardando…' : 'Registrar'}
            </button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Despacho ID', key: 'despacho_id' },
            { label: 'Fecha confirmación', key: 'fecha_confirmacion', type: 'date' },
            { label: 'Recibido por', key: 'recibido_por' },
          ].map(f => (
            <div key={f.key} className="form-field">
              <label className="form-label">{f.label}</label>
              <input type={f.type ?? 'text'} className="input"
                value={confForm[f.key as keyof ConfForm]}
                onChange={e => setConfForm(c => ({ ...c, [f.key]: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
          ))}
          <div className="form-field">
            <label className="form-label">Conformidad</label>
            <select className="select" value={confForm.conformidad}
              onChange={e => setConfForm(c => ({ ...c, conformidad: e.target.value as 'Conforme' | 'Observado' | 'Rechazado' }))}
              style={{ width: '100%' }}>
              <option>Conforme</option><option>Observado</option><option>Rechazado</option>
            </select>
          </div>
          {confForm.conformidad !== 'Conforme' && (
            <div className="form-field">
              <label className="form-label">Motivo</label>
              <textarea className="input" rows={3} value={confForm.motivo_observacion}
                onChange={e => setConfForm(c => ({ ...c, motivo_observacion: e.target.value }))}
                style={{ width: '100%' }} />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
