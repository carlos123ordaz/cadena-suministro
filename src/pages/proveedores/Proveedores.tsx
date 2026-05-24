import { useState, useEffect } from 'react'
import { Icon, Card, DataTable, Modal, Badge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getProveedores, createProveedor, updateProveedor } from '@/services/proveedores.service'
import type { Proveedor, TipoProveedor } from '@/types'

interface ProvForm { ruc_nro_doc: string; razon_social: string; tipo: TipoProveedor; pais: string; ciudad: string; contacto_nombre: string; contacto_email: string; moneda_habitual: string; activo: boolean }
const defaultForm: ProvForm = { ruc_nro_doc: '', razon_social: '', tipo: 'Local', pais: 'Perú', ciudad: '', contacto_nombre: '', contacto_email: '', moneda_habitual: 'USD', activo: true }

export function Proveedores() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [tipoFilt, setTipoFilt] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<ProvForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await getProveedores(q || undefined, tipoFilt as TipoProveedor || undefined)
    setProveedores(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q, tipoFilt])

  function openCreate() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(p: Proveedor) {
    setEditing(p)
    setForm({ ruc_nro_doc: p.ruc_nro_doc ?? '', razon_social: p.razon_social, tipo: p.tipo, pais: p.pais ?? '', ciudad: p.ciudad ?? '', contacto_nombre: p.contacto_nombre ?? '', contacto_email: p.contacto_email ?? '', moneda_habitual: p.moneda_habitual ?? 'USD', activo: p.activo })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.razon_social) return
    setSaving(true)
    if (editing) await updateProveedor(editing.id, form as Partial<Proveedor>)
    else await createProveedor(form as Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>)
    setSaving(false)
    setShowModal(false)
    load()
  }

  const columns: Column<Proveedor>[] = [
    { key: 'ruc_nro_doc',  label: 'RUC / N° doc', render: r => <span className="mono">{r.ruc_nro_doc ?? '—'}</span> },
    { key: 'razon_social', label: 'Razón social', render: r => <strong style={{ fontSize: 12.5 }}>{r.razon_social}</strong> },
    { key: 'tipo',         label: 'Tipo', render: r => <Badge tone={r.tipo === 'Local' ? 'info' : 'violet'}>{r.tipo}</Badge> },
    { key: 'pais',         label: 'País', render: r => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="globe" size={11} style={{ color: 'var(--text-3)' }} />{r.pais ?? '—'}</span> },
    { key: 'ciudad',       label: 'Ciudad', render: r => <span className="muted">{r.ciudad ?? '—'}</span> },
    { key: 'contacto_nombre', label: 'Contacto', render: r => (
      <div>
        <div>{r.contacto_nombre ?? '—'}</div>
        {r.contacto_email && <div className="tiny">{r.contacto_email}</div>}
      </div>
    )},
    { key: 'moneda_habitual', label: 'Moneda', render: r => <Badge tone="muted">{r.moneda_habitual ?? 'USD'}</Badge> },
    { key: 'activo', label: 'Activo', render: r => <Badge tone={r.activo ? 'ok' : 'muted'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
    { key: '_edit', label: '', width: 40, render: r => <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEdit(r) }}><Icon name="edit" size={12} /></button> },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Proveedores <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{proveedores.length}</span></h1>
          <div className="page-sub">Directorio de proveedores locales e internacionales</div>
        </div>
        <div className="page-actions">
          <button className="btn primary sm" onClick={openCreate}><Icon name="plus" size={13} /> Nuevo proveedor</button>
        </div>
      </div>
      <Card padding={false}>
        <div className="table-toolbar">
          <div className="input-wrap">
            <Icon name="search" size={13} className="ico" />
            <input className="input with-ico" placeholder="Razón social, RUC…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 240 }} />
          </div>
          <select className="select" value={tipoFilt} onChange={e => setTipoFilt(e.target.value)}>
            <option value="">Todos los tipos</option>
            <option value="Local">Local</option>
            <option value="Importacion">Importación</option>
          </select>
          <div className="spacer" />
          <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
        </div>
        <DataTable columns={columns as unknown as Column<Record<string, unknown>>[]} rows={proveedores as unknown as Record<string, unknown>[]} idKey="id" loading={loading} emptyMessage="Sin proveedores registrados" />
      </Card>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar proveedor' : 'Nuevo proveedor'} size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSave} disabled={saving || !form.razon_social}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'RUC / N° doc', key: 'ruc_nro_doc' }, { label: 'Razón social *', key: 'razon_social' },
            { label: 'País', key: 'pais' }, { label: 'Ciudad', key: 'ciudad' },
            { label: 'Contacto', key: 'contacto_nombre' }, { label: 'Email contacto', key: 'contacto_email', type: 'email' },
          ].map(f => (
            <div key={f.key} className="form-field">
              <label className="form-label">{f.label}</label>
              <input type={f.type ?? 'text'} className="input" value={form[f.key as keyof ProvForm] as string} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} style={{ width: '100%' }} />
            </div>
          ))}
          <div className="form-field">
            <label className="form-label">Tipo</label>
            <select className="select" value={form.tipo} onChange={e => setForm(x => ({ ...x, tipo: e.target.value as TipoProveedor }))} style={{ width: '100%' }}>
              <option value="Local">Local</option><option value="Importacion">Importación</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Moneda habitual</label>
            <select className="select" value={form.moneda_habitual} onChange={e => setForm(x => ({ ...x, moneda_habitual: e.target.value }))} style={{ width: '100%' }}>
              <option value="USD">USD</option><option value="PEN">PEN</option><option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Activo</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(x => ({ ...x, activo: e.target.checked }))} />
              Proveedor activo
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
