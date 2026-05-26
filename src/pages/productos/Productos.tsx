import { useState, useEffect, useCallback, useRef } from 'react'
import { Icon, Card, DataTable, Modal, Badge } from '@/components/ui'
import type { Column } from '@/components/ui'
import { getProductos, searchProductos, createProducto, updateProducto } from '@/services/productos.service'
import { supabase } from '@/lib/supabase'
import { money } from '@/lib/utils'
import { downloadCsv } from '@/lib/export'
import type { Producto, TipoProducto } from '@/types'
import { getParametrosLista } from '@/services/configuracion.service'

const UNIDADES_MEDIDA_DEFAULT = ['UND', 'KG', 'M', 'M2', 'M3', 'L', 'GLN', 'PAR', 'SET', 'CAJA', 'ROLLO', 'HRS', 'TON', 'PZA', 'BOL', 'JGO', 'GLB', 'MLL']

const TIPO_TONE: Record<TipoProducto, 'ok' | 'info' | 'warn'> = {
  Producto: 'ok',
  Servicio: 'info',
  Proyecto: 'warn',
}

interface ProdForm {
  codigo_comercial: string
  descripcion: string
  tipo: TipoProducto
  clase: string
  subclase: string
  subsubclase: string
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
  tipo: 'Producto',
  clase: '',
  subclase: '',
  subsubclase: '',
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
  const [filterTipo, setFilterTipo] = useState<TipoProducto | ''>('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState<ProdForm>(defaultForm)
  const [saving, setSaving] = useState(false)

  // Unidad de medida combobox
  const [unidadesMedida, setUnidadesMedida] = useState<string[]>(UNIDADES_MEDIDA_DEFAULT)
  const [umSearch, setUmSearch] = useState('UND')
  const [showUmDrop, setShowUmDrop] = useState(false)
  const umRef = useRef<HTMLDivElement>(null)
  const umSelectedRef = useRef('UND')   // tracks confirmed selection to restore on blur

  // Autocomplete lists for clase / subclase / subsubclase
  const [clasesList, setClasesList] = useState<string[]>([])
  const [subclasesList, setSubclasesList] = useState<string[]>([])
  const [subsubclasesList, setSubsubclasesList] = useState<string[]>([])

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

  useEffect(() => {
    getParametrosLista('unidad_medida').then(vals => {
      if (vals.length) setUnidadesMedida(vals)
    })
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (umRef.current && !umRef.current.contains(e.target as Node)) {
        setShowUmDrop(false)
        setUmSearch(umSelectedRef.current)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load distinct classification values once
  useEffect(() => {
    supabase.from('productos').select('clase').not('clase', 'is', null)
      .then(({ data }) => setClasesList([...new Set((data ?? []).map((r: { clase: string }) => r.clase).filter(Boolean))].sort()))
    supabase.from('productos').select('subclase').not('subclase', 'is', null)
      .then(({ data }) => setSubclasesList([...new Set((data ?? []).map((r: { subclase: string }) => r.subclase).filter(Boolean))].sort()))
    supabase.from('productos').select('subsubclase').not('subsubclase', 'is', null)
      .then(({ data }) => setSubsubclasesList([...new Set((data ?? []).map((r: { subsubclase: string }) => r.subsubclase).filter(Boolean))].sort()))
  }, [])

  function openCreate() {
    setEditing(null)
    setForm(defaultForm)
    umSelectedRef.current = defaultForm.unidad_medida
    setUmSearch(defaultForm.unidad_medida)
    setShowModal(true)
  }

  function openEdit(p: Producto) {
    setEditing(p)
    const um = p.unidad_medida ?? 'UND'
    setForm({
      codigo_comercial: p.codigo_comercial,
      descripcion: p.descripcion,
      tipo: p.tipo ?? 'Producto',
      clase: p.clase ?? '',
      subclase: p.subclase ?? '',
      subsubclase: p.subsubclase ?? '',
      unidad_medida: um,
      marca: p.marca ?? '',
      codigo_erp: p.codigo_erp ?? '',
      precio_referencial: p.precio_referencial?.toString() ?? '',
      moneda_ref: p.moneda_ref ?? 'USD',
      activo: p.activo,
    })
    umSelectedRef.current = um
    setUmSearch(um)
    setShowModal(true)
  }

  async function handleSave() {
    if (!form.codigo_comercial || !form.descripcion) return
    setSaving(true)
    const payload = {
      codigo_comercial: form.codigo_comercial,
      descripcion: form.descripcion,
      tipo: form.tipo,
      clase: form.clase || undefined,
      subclase: form.subclase || undefined,
      subsubclase: form.subsubclase || undefined,
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
    // Refresh autocomplete lists in case new values were added
    supabase.from('productos').select('clase').not('clase', 'is', null)
      .then(({ data }) => setClasesList([...new Set((data ?? []).map((r: { clase: string }) => r.clase).filter(Boolean))].sort()))
    supabase.from('productos').select('subclase').not('subclase', 'is', null)
      .then(({ data }) => setSubclasesList([...new Set((data ?? []).map((r: { subclase: string }) => r.subclase).filter(Boolean))].sort()))
    supabase.from('productos').select('subsubclase').not('subsubclase', 'is', null)
      .then(({ data }) => setSubsubclasesList([...new Set((data ?? []).map((r: { subsubclase: string }) => r.subsubclase).filter(Boolean))].sort()))
  }

  const filtered = filterTipo ? productos.filter(p => p.tipo === filterTipo) : productos

  const columns: Column<Producto>[] = [
    {
      key: 'tipo',
      label: 'Tipo',
      width: 90,
      render: r => <Badge tone={TIPO_TONE[r.tipo ?? 'Producto']}>{r.tipo ?? 'Producto'}</Badge>,
    },
    {
      key: 'codigo_comercial',
      label: 'Código',
      render: r => <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600 }}>{r.codigo_comercial}</span>,
    },
    { key: 'descripcion', label: 'Descripción', render: r => <span>{r.descripcion}</span> },
    {
      key: 'clase',
      label: 'Clase / Subclase',
      render: r => r.clase ? (
        <span style={{ fontSize: 12 }}>
          {r.clase}
          {r.subclase && <span className="muted"> › {r.subclase}</span>}
          {r.subsubclase && <span className="muted"> › {r.subsubclase}</span>}
        </span>
      ) : <span className="muted">—</span>,
    },
    { key: 'marca', label: 'Marca', render: r => r.marca ? <span>{r.marca}</span> : <span className="muted">—</span> },
    { key: 'unidad_medida', label: 'UM', width: 60, render: r => <Badge tone="muted">{r.unidad_medida ?? '—'}</Badge> },
    {
      key: 'precio_referencial',
      label: 'Precio ref.',
      align: 'right',
      render: r => r.precio_referencial
        ? <span className="mono">{money(r.precio_referencial, r.moneda_ref ?? 'USD')}</span>
        : <span className="muted">—</span>,
    },
    { key: 'activo', label: 'Estado', render: r => <Badge tone={r.activo ? 'ok' : 'muted'}>{r.activo ? 'Activo' : 'Inactivo'}</Badge> },
    {
      key: '_edit',
      label: '',
      width: 40,
      render: r => <button className="btn ghost xs" onClick={e => { e.stopPropagation(); openEdit(r) }}><Icon name="edit" size={12} /></button>,
    },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">
            Catálogo
            <span className="tiny" style={{ marginLeft: 8, color: 'var(--text-3)' }}>{filtered.length}</span>
          </h1>
          <div className="page-sub">Productos, servicios y proyectos</div>
        </div>
        <div className="page-actions">
          <button className="btn primary sm" onClick={openCreate}><Icon name="plus" size={13} /> Nuevo</button>
        </div>
      </div>

      <Card padding={false}>
        <div className="table-toolbar">
          <div className="input-wrap">
            <Icon name="search" size={13} className="ico" />
            <input
              className="input with-ico"
              placeholder="Código, descripción, marca…"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{ width: 260 }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['', 'Producto', 'Servicio', 'Proyecto'] as (TipoProducto | '')[]).map(t => (
              <button
                key={t || 'todos'}
                type="button"
                onClick={() => setFilterTipo(t)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: `1.5px solid ${filterTipo === t ? 'var(--accent)' : 'var(--border)'}`,
                  background: filterTipo === t ? 'var(--accent-soft)' : 'var(--panel-2)',
                  color: filterTipo === t ? 'var(--accent)' : 'var(--text-2)',
                  fontWeight: filterTipo === t ? 600 : 400,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all .12s',
                }}
              >
                {t || 'Todos'}
              </button>
            ))}
          </div>
          <div className="spacer" />
          <button className="btn sm" onClick={() => downloadCsv(`productos_${new Date().toISOString().slice(0,10)}`, filtered.map(p => ({
            'Código': p.codigo_comercial ?? '',
            'Descripción': p.descripcion ?? '',
            'Tipo': p.tipo ?? '',
            'Clase': p.clase ?? '',
            'Subclase': p.subclase ?? '',
            'UM': p.unidad_medida ?? '',
            'Marca': p.marca ?? '',
            'Precio Ref.': p.precio_referencial ?? '',
            'Moneda Ref.': p.moneda_ref ?? '',
            'Activo': p.activo ? 'Sí' : 'No',
          })))}><Icon name="download" size={13} /> Exportar</button>
        </div>
        <DataTable
          columns={columns as unknown as Column<Record<string, unknown>>[]}
          rows={filtered as unknown as Record<string, unknown>[]}
          idKey="id"
          loading={loading}
          emptyMessage="Sin registros"
        />
      </Card>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editing ? 'Editar' : 'Nuevo'}
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

          {/* Tipo */}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tipo *</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['Producto', 'Servicio', 'Proyecto'] as TipoProducto[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(x => ({ ...x, tipo: t }))}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    borderRadius: 6,
                    border: `2px solid ${form.tipo === t ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.tipo === t ? 'var(--accent-soft)' : 'var(--panel-2)',
                    color: form.tipo === t ? 'var(--accent)' : 'var(--text-2)',
                    fontWeight: form.tipo === t ? 600 : 400,
                    cursor: 'pointer',
                    fontSize: 13,
                    transition: 'all .15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Identifiers */}
          <div className="form-field">
            <label className="form-label">Código comercial *</label>
            <input
              className="input"
              value={form.codigo_comercial}
              onChange={e => setForm(x => ({ ...x, codigo_comercial: e.target.value }))}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              readOnly={!!editing}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Código ERP</label>
            <input
              className="input"
              value={form.codigo_erp}
              onChange={e => setForm(x => ({ ...x, codigo_erp: e.target.value }))}
              style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
              placeholder="Código en sistema ERP"
            />
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Descripción *</label>
            <input
              className="input"
              value={form.descripcion}
              onChange={e => setForm(x => ({ ...x, descripcion: e.target.value }))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Classification */}
          <div className="form-field">
            <label className="form-label">Clase</label>
            <input
              list="dl-clase"
              className="input"
              value={form.clase}
              onChange={e => setForm(x => ({ ...x, clase: e.target.value }))}
              style={{ width: '100%' }}
              placeholder="Ej: Mecánica, Eléctrica…"
            />
            <datalist id="dl-clase">
              {clasesList.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div className="form-field">
            <label className="form-label">Subclase</label>
            <input
              list="dl-subclase"
              className="input"
              value={form.subclase}
              onChange={e => setForm(x => ({ ...x, subclase: e.target.value }))}
              style={{ width: '100%' }}
              placeholder="Ej: Rodamientos, Cables…"
            />
            <datalist id="dl-subclase">
              {subclasesList.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Sub-subclase</label>
            <input
              list="dl-subsubclase"
              className="input"
              value={form.subsubclase}
              onChange={e => setForm(x => ({ ...x, subsubclase: e.target.value }))}
              style={{ width: '100%' }}
              placeholder="Ej: Rodamientos de bolas…"
            />
            <datalist id="dl-subsubclase">
              {subsubclasesList.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>

          {/* Physical / pricing */}
          <div className="form-field">
            <label className="form-label">Marca</label>
            <input
              className="input"
              value={form.marca}
              onChange={e => setForm(x => ({ ...x, marca: e.target.value }))}
              style={{ width: '100%' }}
              placeholder="Fabricante o marca"
            />
          </div>
          <div className="form-field" ref={umRef} style={{ position: 'relative' }}>
            <label className="form-label">Unidad de medida</label>
            <input
              className="input"
              value={umSearch}
              style={{ width: '100%' }}
              placeholder="Ej: UND, KG…"
              autoComplete="off"
              onFocus={() => { setUmSearch(''); setShowUmDrop(true) }}
              onBlur={() => setUmSearch(umSelectedRef.current)}
              onChange={e => {
                const v = e.target.value.toUpperCase()
                setUmSearch(v)
                setForm(x => ({ ...x, unidad_medida: v }))
                setShowUmDrop(true)
              }}
            />
            {showUmDrop && (() => {
              const filtered = umSearch
                ? unidadesMedida.filter(u => u.includes(umSearch))
                : unidadesMedida
              return filtered.length > 0 ? (
                <div style={{
                  position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
                  background: 'var(--panel)', border: '1px solid var(--border)',
                  borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                  maxHeight: 180, overflowY: 'auto', marginTop: 2,
                }}>
                  {filtered.map(u => (
                    <div
                      key={u}
                      onMouseDown={() => {
                        umSelectedRef.current = u
                        setUmSearch(u)
                        setForm(x => ({ ...x, unidad_medida: u }))
                        setShowUmDrop(false)
                      }}
                      style={{
                        padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        background: form.unidad_medida === u ? 'var(--accent-soft)' : undefined,
                        color: form.unidad_medida === u ? 'var(--accent)' : 'var(--text)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = form.unidad_medida === u ? 'var(--accent-soft)' : '')}
                    >
                      {u}
                    </div>
                  ))}
                </div>
              ) : null
            })()}
          </div>
          <div className="form-field">
            <label className="form-label">Precio referencial</label>
            <input
              type="number"
              className="input"
              value={form.precio_referencial}
              onChange={e => setForm(x => ({ ...x, precio_referencial: e.target.value }))}
              style={{ width: '100%' }}
              step="0.01"
              min="0"
            />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda ref.</label>
            <select
              className="select"
              value={form.moneda_ref}
              onChange={e => setForm(x => ({ ...x, moneda_ref: e.target.value }))}
              style={{ width: '100%' }}
            >
              <option value="USD">USD</option>
              <option value="PEN">PEN</option>
              <option value="EUR">EUR</option>
            </select>
          </div>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.activo} onChange={e => setForm(x => ({ ...x, activo: e.target.checked }))} />
              <span className="form-label" style={{ margin: 0 }}>Activo</span>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
