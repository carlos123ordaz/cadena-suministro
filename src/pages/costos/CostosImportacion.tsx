import { useState, useEffect } from 'react'
import { Icon, Card, KPI, DataTable, Badge, Modal } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getImportaciones, getCostosImportacion, addCostoImportacion, calcularCostoUnitario } from '@/services/importaciones.service'
import { fmtDate, money } from '@/lib/utils'
import type { Importacion, CostoImportacion, TipoCosto, CriterioDistribucion } from '@/types'

const TIPOS_COSTO: TipoCosto[] = ['Flete internacional','Seguro','Aduanas','Agente de aduana','Transporte local','Gastos portuarios','Almacenaje','IGV','Percepción','Otros gastos']

interface CostoForm { importacion_id: string; tipo_costo: TipoCosto | ''; descripcion: string; moneda: 'USD' | 'PEN'; monto: string; tipo_cambio: string; fecha: string; criterio_distribucion: CriterioDistribucion }
const defaultForm: CostoForm = { importacion_id: '', tipo_costo: '', descripcion: '', moneda: 'USD', monto: '', tipo_cambio: '1', fecha: new Date().toISOString().slice(0,10), criterio_distribucion: 'valor' }

export function CostosImportacion() {
  const [importaciones, setImportaciones] = useState<Importacion[]>([])
  const [selectedImp, setSelectedImp] = useState<string>('')
  const [costos, setCostos] = useState<CostoImportacion[]>([])
  const [distribucion, setDistribucion] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<CostoForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getImportaciones().then(r => setImportaciones(r.data ?? []))
  }, [])

  useEffect(() => {
    if (!selectedImp) { setCostos([]); setDistribucion([]); return }
    setLoading(true)
    getCostosImportacion(selectedImp).then(r => { setCostos(r.data ?? []); setLoading(false) })
  }, [selectedImp])

  async function handleSave() {
    if (!form.importacion_id || !form.tipo_costo || !form.monto) return
    setSaving(true)
    const monto = parseFloat(form.monto)
    const tc = parseFloat(form.tipo_cambio) || 1
    await addCostoImportacion({ importacion_id: form.importacion_id, tipo_costo: form.tipo_costo, descripcion: form.descripcion || undefined, moneda: form.moneda, monto, tipo_cambio: tc, monto_usd: form.moneda === 'USD' ? monto : monto / tc, criterio_distribucion: form.criterio_distribucion, fecha: form.fecha } as Omit<CostoImportacion, 'id' | 'created_at' | 'updated_at'>)
    setSaving(false)
    setShowModal(false)
    setForm(defaultForm)
    if (selectedImp) {
      const r = await getCostosImportacion(selectedImp)
      setCostos(r.data ?? [])
    }
  }

  async function handleCalcDist() {
    if (!selectedImp) return
    const r = await calcularCostoUnitario(selectedImp)
    setDistribucion((r.data as unknown as Record<string, unknown>[]) ?? [])
  }

  const totalCostos = costos.reduce((a, c) => a + c.monto_usd, 0)
  const impConCosteo = importaciones.filter(i => ['Recibida en almacén','Nacionalizada'].includes(i.status)).length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Costos de Importación</h1>
          <div className="page-sub">Registro y distribución de costos por grupo de importación</div>
        </div>
        <div className="page-actions">
          <button className="btn primary sm" onClick={() => { setForm(f => ({ ...f, importacion_id: selectedImp })); setShowModal(true) }} disabled={!selectedImp}>
            <Icon name="plus" size={13} /> Agregar costo
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <KPI label="Importaciones totales"       value={importaciones.length} icon="ship" />
        <KPI label="Pendientes de costeo"        value={impConCosteo} deltaTone={impConCosteo > 0 ? 'down' : ''} delta={impConCosteo > 0 ? 'sin costo asignado' : ''} icon="warning" />
        <KPI label="Costos seleccionado (USD)"   value={money(totalCostos, 'USD')} icon="coin" />
      </div>

      <Card title="Seleccionar importación" icon="filter">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="form-field" style={{ flex: 1 }}>
            <label className="form-label">Grupo de importación</label>
            <select className="select" value={selectedImp} onChange={e => setSelectedImp(e.target.value)} style={{ width: '100%' }}>
              <option value="">— Selecciona una importación —</option>
              {importaciones.map(i => (
                <option key={i.id} value={i.id}>{i.grupo_importacion} · {i.status} · {i.pais_origen ?? ''}</option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {selectedImp && (
        <>
          <Card title="Costos registrados" icon="coin" padding={false} className="" style={{ marginTop: 14 }}>
            <DataTable
              columns={[
                { key: 'tipo_costo',            label: 'Tipo', render: r => <Badge tone="info">{r.tipo_costo as string}</Badge> },
                { key: 'descripcion',           label: 'Descripción', render: r => <span className="muted">{r.descripcion as string ?? '—'}</span> },
                { key: 'moneda',                label: 'Moneda', width: 60 },
                { key: 'monto',                 label: 'Monto', align: 'right', render: r => <span className="mono">{money(r.monto as number, r.moneda as string)}</span> },
                { key: 'tipo_cambio',           label: 'T/C', align: 'right', render: r => <span className="mono">{r.tipo_cambio as number ?? 1}</span> },
                { key: 'monto_usd',             label: 'Monto USD', align: 'right', render: r => <span className="mono" style={{ fontWeight: 700 }}>{money(r.monto_usd as number, 'USD')}</span> },
                { key: 'criterio_distribucion', label: 'Criterio', render: r => <Badge tone="muted">{r.criterio_distribucion as string}</Badge> },
                { key: 'fecha',                 label: 'Fecha', render: r => <span className="mono">{fmtDate(r.fecha as string)}</span> },
              ] as Column<Record<string, unknown>>[]}
              rows={costos as unknown as Record<string, unknown>[]}
              idKey="id"
              loading={loading}
              emptyMessage="Sin costos registrados para esta importación"
            />
          </Card>

          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn sm" onClick={handleCalcDist}>
              <Icon name="refresh" size={13} /> Calcular distribución por ítem
            </button>
            {distribucion.length > 0 && <span className="tiny">{distribucion.length} ítems calculados</span>}
          </div>

          {distribucion.length > 0 && (
            <Card title="Distribución de costos por ítem" icon="layers" padding={false} style={{ marginTop: 12 }}>
              <DataTable
                columns={[
                  { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.codigo_comercial as string}</span> },
                  { key: 'descripcion',      label: 'Descripción' },
                  { key: 'costo_producto',   label: 'Costo producto', align: 'right', render: r => <span className="mono">{money(r.costo_producto as number, 'USD')}</span> },
                  { key: 'costo_flete',      label: 'Flete asignado', align: 'right', render: r => <span className="mono">{money(r.costo_flete as number, 'USD')}</span> },
                  { key: 'otros_costos',     label: 'Otros costos', align: 'right', render: r => <span className="mono">{money(r.otros_costos as number, 'USD')}</span> },
                  { key: 'costo_total',      label: 'Total importado', align: 'right', render: r => <span className="mono" style={{ fontWeight: 700 }}>{money(r.costo_total as number, 'USD')}</span> },
                  { key: 'costo_unitario',   label: 'Costo unit.', align: 'right', render: r => <span className="mono" style={{ color: 'var(--accent)', fontWeight: 700 }}>{money(r.costo_unitario as number, 'USD')}</span> },
                ]}
                rows={distribucion}
                idKey="codigo_comercial"
              />
            </Card>
          )}
        </>
      )}

      {!selectedImp && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <Icon name="coin" size={36} className="empty-icon" />
          <div className="empty-title">Selecciona una importación</div>
          <div className="empty-sub">Elige un grupo de importación para ver y gestionar sus costos.</div>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar costo de importación" size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSave} disabled={saving || !form.tipo_costo || !form.monto}>{saving ? 'Guardando…' : 'Guardar costo'}</button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tipo de costo *</label>
            <select className="select" value={form.tipo_costo} onChange={e => setForm(f => ({ ...f, tipo_costo: e.target.value as TipoCosto }))} style={{ width: '100%' }}>
              <option value="">— Selecciona —</option>
              {TIPOS_COSTO.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Descripción</label>
            <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value as 'USD' | 'PEN', tipo_cambio: e.target.value === 'USD' ? '1' : f.tipo_cambio }))} style={{ width: '100%' }}>
              <option value="USD">USD</option><option value="PEN">PEN</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Monto *</label>
            <input type="number" className="input" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} style={{ width: '100%' }} step="0.01" />
          </div>
          {form.moneda !== 'USD' && (
            <div className="form-field">
              <label className="form-label">T/C (PEN→USD)</label>
              <input type="number" className="input" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: e.target.value }))} style={{ width: '100%' }} step="0.001" />
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Fecha</label>
            <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Criterio de distribución</label>
            <select className="select" value={form.criterio_distribucion} onChange={e => setForm(f => ({ ...f, criterio_distribucion: e.target.value as CriterioDistribucion }))} style={{ width: '100%' }}>
              <option value="valor">Por valor</option><option value="peso">Por peso</option><option value="cantidad">Por cantidad</option><option value="manual">Manual</option>
            </select>
          </div>
          {form.monto && parseFloat(form.monto) > 0 && (
            <div style={{ gridColumn: '1 / -1', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
              Monto USD equivalente: <strong className="mono">{money(parseFloat(form.monto) / (parseFloat(form.tipo_cambio) || 1), 'USD')}</strong>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
