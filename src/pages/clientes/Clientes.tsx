import { useState, useEffect } from 'react'
import { Icon, Card, DataTable, Modal, Drawer, MetaGrid, Badge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getClientes, createCliente, updateCliente } from '@/services/clientes.service'
import type { Cliente } from '@/types'

interface ClienteForm { ruc: string; razon_social: string; nombre_comercial: string; ciudad: string; sector: string; contacto_nombre: string; contacto_email: string; contacto_telefono: string; activo: boolean }
const defaultForm: ClienteForm = { ruc: '', razon_social: '', nombre_comercial: '', ciudad: '', sector: '', contacto_nombre: '', contacto_email: '', contacto_telefono: '', activo: true }

export function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Cliente | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cliente | null>(null)
  const [form, setForm] = useState<ClienteForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await getClientes(q ? q : undefined)
    setClientes(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [q])

  function openCreate() { setEditing(null); setForm(defaultForm); setShowModal(true) }
  function openEdit(c: Cliente) { setEditing(c); setForm({ ruc: c.ruc ?? '', razon_social: c.razon_social, nombre_comercial: c.nombre_comercial ?? '', ciudad: c.ciudad ?? '', sector: c.sector ?? '', contacto_nombre: c.contacto_nombre ?? '', contacto_email: c.contacto_email ?? '', contacto_telefono: c.contacto_telefono ?? '', activo: c.activo }); setShowModal(true) }

  async function handleSave() {
    if (!form.razon_social) return
    setSaving(true)
    if (editing) await updateCliente(editing.id, form as Partial<Cliente>)
    else await createCliente(form as Omit<Cliente, 'id' | 'created_at' | 'updated_at'>)
    setSaving(false)
    setShowModal(false)
    load()
  }

  const columns: Column<Cliente>[] = [
    { key: 'ruc',           label: 'RUC', render: r => <span className="mono">{r.ruc ?? '—'}</span> },
    { key: 'razon_social',  label: 'Razón social', render: r => <strong style={{ fontSize: 12.5 }}>{r.razon_social}</strong> },
    { key: 'nombre_comercial', label: 'Nombre comercial', render: r => <span className="muted">{r.nombre_comercial ?? '—'}</span> },
    { key: 'ciudad',        label: 'Ciudad', render: r => <span>{r.ciudad ?? '—'}</span> },
    { key: 'sector',        label: 'Sector', render: r => r.sector ? <Badge tone="muted">{r.sector}</Badge> : <span className="muted">—</span> },
    { key: 'contacto_nombre', label: 'Contacto', render: r => (
      <div>
        <div style={{ fontSize: 12.5 }}>{r.contacto_nombre ?? '—'}</div>
        {r.contacto_email && <div className="tiny">{r.contacto_email}</div>}
      </div>
    )},
    { key: 'activo', label: 'Activo', render: r => <Badge tone={r.activo ? 'ok' : 'muted'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
    { key: '_edit', label: '', width: 40, render: r => <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEdit(r) }}><Icon name="edit" size={12} /></button> },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Clientes <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{clientes.length}</span></h1>
          <div className="page-sub">Directorio de clientes · maestro de datos</div>
        </div>
        <div className="page-actions">
          <button className="btn primary sm" onClick={openCreate}><Icon name="plus" size={13} /> Nuevo cliente</button>
        </div>
      </div>
      <Card padding={false}>
        <div className="table-toolbar">
          <div className="input-wrap">
            <Icon name="search" size={13} className="ico" />
            <input className="input with-ico" placeholder="Razón social, RUC…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 260 }} />
          </div>
          <div className="spacer" />
          <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
        </div>
        <DataTable columns={columns as unknown as Column<Record<string, unknown>>[]} rows={clientes as unknown as Record<string, unknown>[]} idKey="id" loading={loading} onRowClick={r => setSelected(r as unknown as Cliente)} emptyMessage="Sin clientes registrados" />
      </Card>

      <Drawer open={!!selected && !showModal} onClose={() => setSelected(null)} title={selected?.razon_social ?? ''} sub={selected?.ruc ?? ''}
        footer={<><button className="btn" onClick={() => { if (selected) openEdit(selected) }}>Editar</button></>}>
        {selected && (
          <MetaGrid cols={2} fields={[
            { label: 'RUC',               value: selected.ruc, mono: true },
            { label: 'Razón social',      value: selected.razon_social },
            { label: 'Nombre comercial',  value: selected.nombre_comercial },
            { label: 'Ciudad',            value: selected.ciudad },
            { label: 'Sector',            value: selected.sector },
            { label: 'Contacto',          value: selected.contacto_nombre },
            { label: 'Email',             value: selected.contacto_email },
            { label: 'Teléfono',          value: selected.contacto_telefono },
            { label: 'Activo',            value: <Badge tone={selected.activo ? 'ok' : 'muted'}>{selected.activo ? 'Activo' : 'Inactivo'}</Badge> },
          ]} />
        )}
      </Drawer>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Editar cliente' : 'Nuevo cliente'} size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSave} disabled={saving || !form.razon_social}>{saving ? 'Guardando…' : 'Guardar'}</button>
          </>
        }>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { label: 'RUC', key: 'ruc' }, { label: 'Razón social *', key: 'razon_social' },
            { label: 'Nombre comercial', key: 'nombre_comercial' }, { label: 'Ciudad', key: 'ciudad' },
            { label: 'Sector', key: 'sector' }, { label: 'Contacto nombre', key: 'contacto_nombre' },
            { label: 'Email contacto', key: 'contacto_email', type: 'email' }, { label: 'Teléfono', key: 'contacto_telefono' },
          ].map(f => (
            <div key={f.key} className="form-field">
              <label className="form-label">{f.label}</label>
              <input type={f.type ?? 'text'} className="input" value={form[f.key as keyof ClienteForm] as string} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} style={{ width: '100%' }} />
            </div>
          ))}
          <div className="form-field">
            <label className="form-label">Activo</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(x => ({ ...x, activo: e.target.checked }))} />
              Cliente activo
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
