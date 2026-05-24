import { useState, useEffect, useCallback } from 'react'
import { Icon, Card, DataTable, Modal, Badge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getProductos, searchProductos, createProducto, updateProducto } from '@/services/productos.service'
import { money } from '@/lib/utils'
import type { Producto } from '@/types'

const UNIDADES_MEDIDA = ['UND', 'KG', 'M', 'M2', 'M3', 'L', 'GLN', 'PAR', 'SET', 'CAJA', 'ROLLO', 'HRS', 'TON', 'PZA']

interface ProdForm {
  codigo_comercial: string
  descripcion: string
  unidad_medida: string
  marca: string
  codigo_erp: string
  precio_referencial: string
  moneda_ref: string
  activo: boolean
}

const defaultForm: ProdForm = {
  codigo_comercial: '',
  descripcion: '',
  unidad_medida: 'UND',
  marca: '',
  codigo_erp: '',
  precio_referencial: '',
  moneda_ref: 'USD',
  activo: true,
}

export function Productos() {
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState<ProdForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    if (q.length >= 2) {
      const { data } = await searchProductos(q)
      setProductos(data ?? [])
    } else {
      const { data } = await getProductos()
      setProductos(data ?? [])
    }
    setLoading(false)
  }, [q])

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
  }, [load])

  function openCreate() { setEditing(null); setForm(defaultForm); setShowModal(true) }

  function openEdit(p: Producto) {
    setEditing(p)
    setForm({
      codigo_comercial: p.codigo_comercial,
      descripcion: p.descripcion,
      unidad_medida: p.unidad_medida ?? 'UND',
      marca: p.marca ?? '',
      codigo_erp: p.codigo_erp ?? '',
      precio_referencial: p.precio_referencial?.toString() ?? '',
      moneda_ref: p.moneda_ref ?? 'USD',
      activo: p.activo,
    })
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.codigo_comercial || !form.descripcion) return
    setSaving(true)
    const payload = {
      codigo_comercial: form.codigo_comercial,
      descripcion: form.descripcion,
      unidad_medida: form.unidad_medida,
      marca: form.marca || undefined,
      codigo_erp: form.codigo_erp || undefined,
      precio_referencial: form.precio_referencial ? parseFloat(form.precio_referencial) : undefined,
      moneda_ref: form.moneda_ref as 'USD' | 'PEN' | 'EUR',
      activo: form.activo,
    }
    if (editing) await updateProducto(editing.id, payload)
    else await createProducto(payload as Omit<Producto, 'id' | 'created_at' | 'updated_at'>)
    setSaving(false)
    setShowModal(false)
    load()
  }

  const columns: Column<Producto>[] = [
    { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.codigo_comercial}</span> },
    { key: 'descripcion', label: 'Descripción', render: r => <span>{r.descripcion}</span> },
    { key: 'marca', label: 'Marca', render: r => r.marca ? <span>{r.marca}</span> : <span className="muted">—</span> },
    { key: 'codigo_erp', label: 'Cód. ERP', render: r => r.codigo_erp ? <span className="mono" style={{ fontSize: 11 }}>{r.codigo_erp}</span> : <span className="muted">—</span> },
    { key: 'unidad_medida', label: 'UM', width: 60, render: r => <Badge tone="muted">{r.unidad_medida ?? 'UND'}</Badge> },
    { key: 'precio_referencial', label: 'Precio ref.', align: 'right', render: r => r.precio_referencial ? <span className="mono">{money(r.precio_referencial, r.moneda_ref ?? 'USD')}</span> : <span className="muted">—</span> },
    { key: 'moneda_ref', label: 'Moneda', render: r => <Badge tone="muted">{r.moneda_ref ?? 'USD'}</Badge> },
    { key: 'activo', label: 'Activo', render: r => <Badge tone={r.activo ? 'ok' : 'muted'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
    { key: '_edit', label: '', width: 40, render: r => <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEdit(r) }}><Icon name="edit" size={12} /></button> },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Productos / Catálogo <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{productos.length}</span></h1>
          <div className="page-sub">Catálogo de productos y repuestos industriales</div>
        </div>
        <div className="page-actions">
          <button className="btn primary sm" onClick={openCreate}><Icon name="plus" size={13} /> Nuevo producto</button>
        </div>
      </div>
      <Card padding={false}>
        <div className="table-toolbar">
          <div className="input-wrap">
            <Icon name="search" size={13} className="ico" />
            <input className="input with-ico" placeholder="Código, descripción, marca…" value={q} onChange={e => setQ(e.target.value)} style={{ width: 280 }} />
          </div>
          <div className="spacer" />
          <button className="btn sm"><Icon name="download" size={13} /> Exportar</button>
        </div>
        <DataTable columns={columns as unknown as Column<Record<string, unknown>>[]} rows={productos as unknown as Record<string, unknown>[]} idKey="id" loading={loading} emptyMessage="Sin productos registrados" />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar producto' : 'Nuevo producto'}
        size="md"
        footer={
          <>
            <button className="btn" onClick={() => setShowModal(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSave} disabled={saving || !form.codigo_comercial || !form.descripcion}>
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Código comercial *</label>
            <input className="input" value={form.codigo_comercial} onChange={e => setForm(x => ({ ...x, codigo_comercial: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} readOnly={!!editing} />
          </div>
          <div className="form-field">
            <label className="form-label">Código ERP</label>
            <input className="input" value={form.codigo_erp} onChange={e => setForm(x => ({ ...x, codigo_erp: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="Código en sistema ERP" />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Descripción *</label>
            <input className="input" value={form.descripcion} onChange={e => setForm(x => ({ ...x, descripcion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Marca</label>
            <input className="input" value={form.marca} onChange={e => setForm(x => ({ ...x, marca: e.target.value }))} style={{ width: '100%' }} placeholder="Fabricante o marca" />
          </div>
          <div className="form-field">
            <label className="form-label">Unidad de medida</label>
            <select className="select" value={form.unidad_medida} onChange={e => setForm(x => ({ ...x, unidad_medida: e.target.value }))} style={{ width: '100%' }}>
              {UNIDADES_MEDIDA.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Precio referencial</label>
            <input type="number" className="input" value={form.precio_referencial} onChange={e => setForm(x => ({ ...x, precio_referencial: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda ref.</label>
            <select className="select" value={form.moneda_ref} onChange={e => setForm(x => ({ ...x, moneda_ref: e.target.value }))} style={{ width: '100%' }}>
              <option value="USD">USD</option>
              <option value="PEN">PEN</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Activo</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(x => ({ ...x, activo: e.target.checked }))} />
              Producto activo
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
