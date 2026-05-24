import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon, Card, KPI, DataTable, StatusBadge, OCI_STATUS_TONE, EtaCell, Badge, Modal } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getImportaciones, createImportacion } from '@/services/importaciones.service'
import { money, fmtDate } from '@/lib/utils'
import type { Importacion, EstadoImportacion } from '@/types'

const ESTADOS: EstadoImportacion[] = [
  'Borrador','OC emitida','Confirmada por proveedor','Pendiente de invoice',
  'Invoice recibida','En preparación de embarque','Embarcada','En tránsito',
  'Arribada','En aduanas','Nacionalizada','En traslado a almacén',
  'Recibida en almacén','Costeada','Cerrada','Observada','Anulada',
]

export function ImportacionesList() {
  const navigate = useNavigate()
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [estado, setEstado] = useState('')
  const [incoterm, setIncoterm] = useState('')
  const [tipoEmbarque, setTipoEmbarque] = useState('')

  const [showNueva, setShowNueva] = useState(false)
  const [impForm, setImpForm] = useState({ grupo_importacion: '', operador_logistico: '', incoterm: '', tipo_embarque: '', pais_origen: '', pais_embarque: '', ciudad_embarque: '', eta: '', peso_bruto_kg: '', flete_usd: '', observaciones: '' })
  const [savingNueva, setSavingNueva] = useState(false)
  const [errorNueva, setErrorNueva] = useState<string | null>(null)

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
    setImpForm({ grupo_importacion: '', operador_logistico: '', incoterm: '', tipo_embarque: '', pais_origen: '', pais_embarque: '', ciudad_embarque: '', eta: '', peso_bruto_kg: '', flete_usd: '', observaciones: '' })
    load()
  }

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

  const enTransito    = importaciones.filter(i => i.status === 'En tránsito').length
  const enAduanas     = importaciones.filter(i => i.status === 'En aduanas').length
  const etaSemana     = importaciones.filter(i => { const d = i.eta ? Math.ceil((new Date(i.eta).getTime() - Date.now()) / 86400000) : 999; return d >= 0 && d <= 7 }).length
  const pendCosteo    = importaciones.filter(i => ['Recibida en almacén','Nacionalizada'].includes(i.status)).length

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
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Importaciones
            <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{importaciones.length} grupos</span>
          </h1>
          <div className="page-sub">Grupos de importación · cada grupo agrupa varias OCI bajo un mismo trámite aduanal</div>
        </div>
        <div className="page-actions">
          <button className="btn primary sm" onClick={() => setShowNueva(true)}><Icon name="plus" size={13} /> Nuevo grupo</button>
        </div>
      </div>

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
      <Modal open={showNueva} onClose={() => setShowNueva(false)} title="Nuevo grupo de importación" size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowNueva(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCrearImportacion} disabled={savingNueva || !impForm.grupo_importacion}>
              {savingNueva ? 'Creando…' : 'Crear grupo'}
            </button>
          </>
        }>
        {errorNueva && <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>{errorNueva}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Nombre del grupo *</label>
            <input className="input" value={impForm.grupo_importacion} onChange={e => setImpForm(f => ({ ...f, grupo_importacion: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="IMP-2026-012" />
          </div>
          <div className="form-field">
            <label className="form-label">Operador logístico</label>
            <input className="input" value={impForm.operador_logistico} onChange={e => setImpForm(f => ({ ...f, operador_logistico: e.target.value }))} style={{ width: '100%' }} placeholder="DHL, Kuehne+Nagel…" />
          </div>
          <div className="form-field">
            <label className="form-label">Incoterm</label>
            <select className="select" value={impForm.incoterm} onChange={e => setImpForm(f => ({ ...f, incoterm: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {['FOB','CIF','CFR','FCA','EXW','DAP','DDP'].map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Tipo de embarque</label>
            <select className="select" value={impForm.tipo_embarque} onChange={e => setImpForm(f => ({ ...f, tipo_embarque: e.target.value }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {['Marítimo FCL','Marítimo LCL','Aéreo','Terrestre','Courier'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">País de origen</label>
            <input className="input" value={impForm.pais_origen} onChange={e => setImpForm(f => ({ ...f, pais_origen: e.target.value }))} style={{ width: '100%' }} placeholder="China, Alemania…" />
          </div>
          <div className="form-field">
            <label className="form-label">País de embarque</label>
            <input className="input" value={impForm.pais_embarque} onChange={e => setImpForm(f => ({ ...f, pais_embarque: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Ciudad de embarque</label>
            <input className="input" value={impForm.ciudad_embarque} onChange={e => setImpForm(f => ({ ...f, ciudad_embarque: e.target.value }))} style={{ width: '100%' }} placeholder="Shanghái, Hamburgo…" />
          </div>
          <div className="form-field">
            <label className="form-label">ETA estimada</label>
            <input type="date" className="input" value={impForm.eta} onChange={e => setImpForm(f => ({ ...f, eta: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Peso bruto (kg)</label>
            <input type="number" className="input" value={impForm.peso_bruto_kg} onChange={e => setImpForm(f => ({ ...f, peso_bruto_kg: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Flete USD</label>
            <input type="number" className="input" value={impForm.flete_usd} onChange={e => setImpForm(f => ({ ...f, flete_usd: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Observaciones</label>
            <textarea className="input" rows={2} value={impForm.observaciones} onChange={e => setImpForm(f => ({ ...f, observaciones: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
