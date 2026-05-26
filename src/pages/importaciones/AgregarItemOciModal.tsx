import { useState, useRef, useEffect } from 'react'
import { Modal } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { getParametrosLista } from '@/services/configuracion.service'
import { fmtDbError } from '@/lib/utils'

interface Props {
  open: boolean
  onClose: () => void
  ordenCompraId: string
  ordenMoneda?: string
  operacionId?: string
  onSuccess: () => void
}

type ItemForm = {
  item_oc: string
  producto_id: string
  codigo_comercial: string
  descripcion: string
  cantidad: string
  unidad_medida: string
  moneda: string
  pcu1: string
  operacion_item_id: string
  opci_id: string
}

const defaultForm = (moneda = 'USD'): ItemForm => ({
  item_oc: '', producto_id: '', codigo_comercial: '', descripcion: '',
  cantidad: '', unidad_medida: '', moneda, pcu1: '', operacion_item_id: '', opci_id: '',
})

const UM_LIST_DEFAULT = ['UND','KG','M','M2','M3','L','GLN','PAR','SET','CAJA','ROLLO','HRS','TON','PZA','BOL','JGO','GLB','MLL']

type OpciItem = { id: string; item_op: string; codigo_comercial: string; descripcion: string; cantidad: number; unidad_medida: string; producto_id?: string }

export function AgregarItemOciModal({ open, onClose, ordenCompraId, ordenMoneda = 'USD', operacionId, onSuccess }: Props) {
  const [form, setForm] = useState<ItemForm>(() => defaultForm(ordenMoneda))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [opciSearch, setOpciSearch] = useState('')
  const [opciSugeridas, setOpciSugeridas] = useState<{ id: string; correlativo_opci: string }[]>([])
  const [showOpciDrop, setShowOpciDrop] = useState(false)
  const [opciItems, setOpciItems] = useState<OpciItem[]>([])
  const opciDropRef = useRef<HTMLDivElement>(null)
  const [unidadesMedida, setUnidadesMedida] = useState<string[]>(UM_LIST_DEFAULT)
  const [umSearch, setUmSearch] = useState('')
  const [showUmDrop, setShowUmDrop] = useState(false)
  const umRef = useRef<HTMLDivElement>(null)
  const umSelectedRef = useRef('')

  useEffect(() => {
    getParametrosLista('unidad_medida').then(vals => { if (vals.length) setUnidadesMedida(vals) })
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

  useEffect(() => {
    if (!open) return
    setForm(defaultForm(ordenMoneda))
    setError(null)
    setOpciSearch('')
    setOpciSugeridas([])
    setOpciItems([])
    umSelectedRef.current = ''
    setUmSearch('')
  }, [open, ordenMoneda])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (opciDropRef.current && !opciDropRef.current.contains(e.target as Node))
        setShowOpciDrop(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  useEffect(() => {
    if (!opciSearch || opciSearch.length < 2) { setOpciSugeridas([]); return }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('operaciones')
        .select('id, correlativo_opci')
        .ilike('correlativo_opci', `%${opciSearch}%`)
        .not('estado', 'in', '("Cerrada","Anulada")')
        .order('correlativo_opci').limit(10)
      setOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
      setShowOpciDrop(true)
    }, 250)
    return () => clearTimeout(t)
  }, [opciSearch])

  async function handleOpciFocus() {
    setShowOpciDrop(true)
    if (!opciSearch) {
      const { data } = await supabase.from('operaciones')
        .select('id, correlativo_opci')
        .not('estado', 'in', '("Cerrada","Anulada")')
        .order('correlativo_opci').limit(20)
      setOpciSugeridas((data ?? []) as { id: string; correlativo_opci: string }[])
    }
  }

  function selectOpci(o: { id: string; correlativo_opci: string }) {
    setOpciSearch(o.correlativo_opci)
    setForm(f => ({ ...f, opci_id: o.id, operacion_item_id: '' }))
    setOpciItems([])
    setShowOpciDrop(false)
    supabase.from('operacion_items')
      .select('id, item_op, codigo_comercial, descripcion, cantidad, unidad_medida, producto_id')
      .eq('operacion_id', o.id).order('item_op')
      .then(({ data }) => setOpciItems((data ?? []) as OpciItem[]))
  }

  async function handleSubmit() {
    if (!form.descripcion.trim()) { setError('La descripción del ítem es obligatoria.'); return }
    if (!form.cantidad || parseFloat(form.cantidad) <= 0) { setError('Ingresa una cantidad válida mayor a 0.'); return }
    if (!form.pcu1 || parseFloat(form.pcu1) <= 0) { setError('Ingresa el precio unitario.'); return }
    setSaving(true)
    setError(null)
    const cantidad = parseFloat(form.cantidad)
    const pcu1 = parseFloat(form.pcu1)
    const linkedItem = opciItems.find(i => i.id === form.operacion_item_id)
    const { error: dbError } = await supabase.from('orden_compra_items').insert({
      orden_compra_id: ordenCompraId,
      producto_id: form.producto_id || null,
      operacion_id: form.opci_id || operacionId || null,
      operacion_item_id: form.operacion_item_id || null,
      item_oc: form.item_oc || null,
      item_op: linkedItem?.item_op || null,
      codigo_comercial: form.codigo_comercial || null,
      descripcion: form.descripcion.trim(),
      cantidad,
      unidad_medida: form.unidad_medida || null,
      moneda: form.moneda || 'USD',
      pcu1,
      monto_total: cantidad * pcu1,
    })
    setSaving(false)
    if (dbError) { setError(fmtDbError(dbError, 'Error al guardar.')); return }
    onSuccess()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title="Agregar ítem a la OCI" size="md"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Guardando…' : 'Agregar ítem'}
          </button>
        </>
      }>
      {error && (
        <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

        {/* OPCI search */}
        <div className="form-field" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label">Ítem OPCI que origina esta compra</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: '0 0 200px', position: 'relative' }} ref={opciDropRef}>
              <input
                className="input"
                value={opciSearch}
                onChange={e => {
                  setOpciSearch(e.target.value)
                  if (!e.target.value) {
                    setForm(f => ({ ...f, operacion_item_id: '' }))
                    setOpciItems([])
                  }
                }}
                onFocus={handleOpciFocus}
                placeholder="Buscar OPCI…"
                style={{ width: '100%' }}
              />
              {showOpciDrop && opciSugeridas.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 200, overflowY: 'auto' }}>
                  {opciSugeridas.map(o => (
                    <div key={o.id}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
                      onMouseDown={() => selectOpci(o)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span className="mono" style={{ color: 'var(--accent)', fontWeight: 600 }}>{o.correlativo_opci}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {opciItems.length > 0 && (
              <select
                className="select"
                value={form.operacion_item_id}
                onChange={e => {
                  const sel = opciItems.find(i => i.id === e.target.value)
                  if (sel?.unidad_medida) { umSelectedRef.current = sel.unidad_medida; setUmSearch(sel.unidad_medida) }
                  setForm(f => ({
                    ...f,
                    operacion_item_id: e.target.value,
                    ...(sel ? { descripcion: sel.descripcion, codigo_comercial: sel.codigo_comercial, unidad_medida: sel.unidad_medida, producto_id: sel.producto_id ?? '' } : {}),
                  }))
                }}
                style={{ flex: 1 }}
              >
                <option value="">— Seleccionar ítem —</option>
                {opciItems.map(i => (
                  <option key={i.id} value={i.id}>{i.item_op} · {i.codigo_comercial} ({i.cantidad} {i.unidad_medida})</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Product preview strip */}
        {form.descripcion && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5 }}>
            {form.codigo_comercial && <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, flexShrink: 0 }}>{form.codigo_comercial}</span>}
            {form.codigo_comercial && <span style={{ color: 'var(--border)' }}>·</span>}
            <span style={{ color: 'var(--text-1)' }}>{form.descripcion}</span>
          </div>
        )}

        <div className="form-field">
          <label className="form-label">Ítem OC</label>
          <input className="input" value={form.item_oc} onChange={e => setForm(f => ({ ...f, item_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="1, 2, 3…" />
        </div>
        <div className="form-field">
          <label className="form-label">Cantidad *</label>
          <input type="number" className="input" value={form.cantidad} onChange={e => setForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
        </div>
        <div className="form-field" ref={umRef} style={{ position: 'relative' }}>
          <label className="form-label">Unidad de medida</label>
          <input
            className="input"
            value={umSearch}
            style={{ width: '100%' }}
            placeholder="UND, KG, M…"
            autoComplete="off"
            onFocus={() => { setUmSearch(''); setShowUmDrop(true) }}
            onBlur={() => setUmSearch(umSelectedRef.current)}
            onChange={e => {
              const v = e.target.value.toUpperCase()
              setUmSearch(v)
              setForm(f => ({ ...f, unidad_medida: v }))
              setShowUmDrop(true)
            }}
          />
          {showUmDrop && (() => {
            const filtered = umSearch ? unidadesMedida.filter(u => u.includes(umSearch)) : unidadesMedida
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
                      setForm(f => ({ ...f, unidad_medida: u }))
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
          <label className="form-label">Moneda</label>
          <select className="select" value={form.moneda} onChange={e => setForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
            {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label className="form-label">Precio unitario *</label>
          <input type="number" className="input" value={form.pcu1} onChange={e => setForm(f => ({ ...f, pcu1: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
        </div>

        {form.cantidad && form.pcu1 && (
          <div style={{ gridColumn: '1 / -1', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5 }}>
            <span className="muted">Total: </span>
            <span className="mono" style={{ fontWeight: 600 }}>
              {(parseFloat(form.cantidad) * parseFloat(form.pcu1)).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {form.moneda}
            </span>
          </div>
        )}
      </div>
    </Modal>
  )
}
