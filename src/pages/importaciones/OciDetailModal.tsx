import { useState, useEffect } from 'react'
import { Modal, DataTable, Icon, ProveedorCombobox, ImportacionCombobox, UploadDocumentoModal } from '@/components/ui'
import type { Column, ProveedorOption, ImportacionOption } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { fmtDbError } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { AgregarItemOciModal } from './AgregarItemOciModal'

interface Props {
  ociId: string | null
  onClose: () => void
  onChanged?: () => void
}

type OciRow = Record<string, unknown>
type NotaRow = { id?: string; nota: string; created_at?: string; usuario?: { nombre_completo?: string } }

const OCI_ESTADOS = [
  'Borrador','OC emitida','Confirmada por proveedor','Pendiente de invoice',
  'Invoice recibida','En preparación de embarque','Embarcada','En tránsito',
  'Arribada','En aduanas','Nacionalizada','En traslado a almacén',
  'Recibida en almacén','Costeada','Cerrada','Observada','Anulada',
]

const UM_LIST = ['UN','UND','KG','M','M2','M3','L','GLN','PAR','SET','CAJA','ROLLO','HRS','TON','PZA']

const ERR_STYLE = { background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 10 }
const SECTION_STYLE = { border: '1px solid var(--accent)', borderRadius: 8, padding: 14, marginTop: 4, background: 'var(--accent-soft)' }
const SECTION_INVOICE_STYLE = { border: '1px solid var(--ok)', borderRadius: 8, padding: 14, marginTop: 4, background: 'var(--ok-soft, rgba(0,200,80,.06))' }

export function OciDetailModal({ ociId, onClose, onChanged }: Props) {
  const { profile } = useAuth()
  const [oci, setOci] = useState<OciRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newNota, setNewNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)

  // ── Edit OCI header ────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false)
  const [editProv, setEditProv] = useState<ProveedorOption | null>(null)
  const [editImportacion, setEditImportacion] = useState<ImportacionOption | null>(null)
  const [editForm, setEditForm] = useState({
    num_oc: '', fecha_oc: '', moneda: 'USD', monto_total: '', status: '', notas: '',
    num_cotizacion_proveedor: '', fecha_ofrecida: '',
    num_confirmacion_proveedor: '', fecha_invoice: '', num_invoice: '',
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  // ── Edit item (inline panel) ───────────────────────────────────────────
  const [editItemId, setEditItemId] = useState<string | null>(null)
  const [editItemForm, setEditItemForm] = useState({
    item_oc: '', codigo_comercial: '', descripcion: '', cantidad: '',
    unidad_medida: '', moneda: 'USD', pcu1: '', num_item_invoice: '',
  })
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)

  // ── Delete item ────────────────────────────────────────────────────────
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)

  // ── Upload document ────────────────────────────────────────────────────
  const [showUploadDoc, setShowUploadDoc] = useState<'confirmacion' | 'invoice' | null>(null)

  async function load(id: string) {
    setLoading(true)
    const { data } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        proveedor:proveedores(id, razon_social),
        importacion:importaciones(id, grupo_importacion),
        operacion:operaciones(id, correlativo_opci),
        items:orden_compra_items(*, operacion:operaciones(id, correlativo_opci)),
        notas_lista:ordenes_compra_notas(*, usuario:profiles(nombre_completo))
      `)
      .eq('id', id)
      .single()
    setOci(data as OciRow | null)
    setLoading(false)
  }

  useEffect(() => {
    if (!ociId) { setOci(null); setNewNota(''); setEditMode(false); setEditItemId(null); return }
    load(ociId)
  }, [ociId])

  function openEdit() {
    if (!oci) return
    const prov = oci.proveedor as { id?: string; razon_social?: string } | undefined
    const imp = oci.importacion as { id?: string; grupo_importacion?: string } | undefined
    setEditProv(prov?.id ? { id: prov.id, razon_social: prov.razon_social ?? '' } : null)
    setEditImportacion(imp?.id ? { id: imp.id, grupo_importacion: imp.grupo_importacion ?? '' } : null)
    setEditForm({
      num_oc: oci.num_oc as string ?? '',
      fecha_oc: oci.fecha_oc as string ?? '',
      moneda: oci.moneda as string ?? 'USD',
      monto_total: String(oci.monto_total ?? ''),
      status: oci.status as string ?? 'Borrador',
      notas: oci.notas as string ?? '',
      num_cotizacion_proveedor: oci.num_cotizacion_proveedor as string ?? '',
      fecha_ofrecida: oci.fecha_ofrecida as string ?? '',
      num_confirmacion_proveedor: oci.num_confirmacion_proveedor as string ?? '',
      fecha_invoice: oci.fecha_invoice as string ?? '',
      num_invoice: oci.num_invoice as string ?? '',
    })
    setEditError(null)
    setEditMode(true)
  }

  async function handleSaveEdit() {
    if (!oci || !editProv || !editForm.num_oc) {
      setEditError('Proveedor y N° OC son obligatorios.')
      return
    }
    setSavingEdit(true)
    setEditError(null)
    const { error } = await supabase.from('ordenes_compra').update({
      proveedor_id: editProv.id,
      importacion_id: editImportacion?.id ?? null,
      num_oc: editForm.num_oc,
      fecha_oc: editForm.fecha_oc || null,
      moneda: editForm.moneda,
      monto_total: parseFloat(editForm.monto_total) || 0,
      status: editForm.status,
      notas: editForm.notas || null,
      num_cotizacion_proveedor: editForm.num_cotizacion_proveedor || null,
      fecha_ofrecida: editForm.fecha_ofrecida || null,
      num_confirmacion_proveedor: editForm.num_confirmacion_proveedor || null,
      fecha_invoice: editForm.fecha_invoice || null,
      num_invoice: editForm.num_invoice || null,
      updated_at: new Date().toISOString(),
    }).eq('id', oci.id as string)
    setSavingEdit(false)
    if (error) { setEditError(fmtDbError(error, 'Error al actualizar.')); return }
    setEditMode(false)
    load(ociId!)
    onChanged?.()
  }

  function openEditItem(item: Record<string, unknown>) {
    setEditItemId(item.id as string)
    setEditItemForm({
      item_oc: item.item_oc as string ?? '',
      codigo_comercial: item.codigo_comercial as string ?? '',
      descripcion: item.descripcion as string ?? '',
      cantidad: String(item.cantidad ?? ''),
      unidad_medida: item.unidad_medida as string ?? '',
      moneda: item.moneda as string ?? 'USD',
      pcu1: String(item.pcu1 ?? ''),
      num_item_invoice: item.num_item_invoice as string ?? '',
    })
    setItemError(null)
    setSavingItem(false)
  }

  async function handleSaveItem() {
    if (!editItemId || !editItemForm.descripcion.trim() || !editItemForm.cantidad || !editItemForm.pcu1) {
      setItemError('Descripción, cantidad y precio son obligatorios.')
      return
    }
    setSavingItem(true)
    setItemError(null)
    const cantidad = parseFloat(editItemForm.cantidad)
    const pcu1 = parseFloat(editItemForm.pcu1)
    const { error } = await supabase.from('orden_compra_items').update({
      item_oc: editItemForm.item_oc || null,
      codigo_comercial: editItemForm.codigo_comercial || null,
      descripcion: editItemForm.descripcion.trim(),
      cantidad,
      unidad_medida: editItemForm.unidad_medida || null,
      moneda: editItemForm.moneda,
      pcu1,
      monto_total: cantidad * pcu1,
      num_item_invoice: editItemForm.num_item_invoice || null,
    }).eq('id', editItemId)
    setSavingItem(false)
    if (error) { setItemError(fmtDbError(error, 'Error al guardar.')); return }
    setEditItemId(null)
    if (ociId) load(ociId)
    onChanged?.()
  }

  async function handleDeleteItem(itemId: string) {
    if (!window.confirm('¿Eliminar este ítem? La acción no se puede deshacer.')) return
    setDeletingItemId(itemId)
    await supabase.from('orden_compra_items').delete().eq('id', itemId)
    setDeletingItemId(null)
    if (ociId) load(ociId)
    onChanged?.()
  }

  async function handleAddNota() {
    if (!newNota.trim() || !oci || !profile) return
    setSavingNota(true)
    await supabase.from('ordenes_compra_notas').insert({
      orden_compra_id: oci.id as string,
      nota: newNota.trim(),
      usuario_id: profile.id,
    })
    setSavingNota(false)
    setNewNota('')
    load(ociId!)
    onChanged?.()
  }

  const items = (oci?.items as Record<string, unknown>[]) ?? []
  const notas = (oci?.notas_lista as NotaRow[]) ?? []

  const itemColumns: Column<Record<string, unknown>>[] = [
    { key: 'item_oc',          label: 'Ítem OC',   width: 60 },
    { key: 'item_op',          label: 'Ítem OP',   width: 70,
      render: r => r.item_op
        ? <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, fontSize: 11 }}>{r.item_op as string}</span>
        : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span> },
    { key: 'operacion',        label: 'OPCI',      width: 110,
      render: r => {
        const op = r.operacion as { correlativo_opci?: string } | undefined
        return op?.correlativo_opci
          ? <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{op.correlativo_opci}</span>
          : <span className="muted" style={{ fontSize: 11 }}>—</span>
      }},
    { key: 'codigo_comercial', label: 'Código',    render: r => <span className="mono">{r.codigo_comercial as string ?? '—'}</span> },
    { key: 'descripcion',      label: 'Descripción' },
    { key: 'cantidad',         label: 'Cant.',     align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
    { key: 'unidad_medida',    label: 'UM',        width: 60 },
    { key: 'num_item_invoice', label: 'Ítem Inv.', width: 90,
      render: r => r.num_item_invoice
        ? <span className="mono">{r.num_item_invoice as string}</span>
        : <span className="muted">—</span> },
    { key: 'pcu1',             label: 'Precio U.', align: 'right', render: r => <span className="mono">{(r.pcu1 as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} {r.moneda as string}</span> },
    { key: 'monto_total',      label: 'Total',     align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{(r.monto_total as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} {r.moneda as string}</span> },
    {
      key: '_actions', label: '', width: 72,
      render: r => (
        <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
          <button className="btn ghost xs" title="Editar ítem"
            onClick={() => openEditItem(r)}
            style={{ color: editItemId === (r.id as string) ? 'var(--accent)' : undefined }}>
            <Icon name="edit" size={11} />
          </button>
          <button className="btn ghost xs" title="Eliminar ítem" style={{ color: 'var(--bad)' }}
            disabled={deletingItemId === (r.id as string)}
            onClick={() => handleDeleteItem(r.id as string)}>
            <Icon name="trash" size={11} />
          </button>
        </div>
      ),
    },
  ]

  const isConfirmada = editForm.status === 'Confirmada por proveedor'
  const isInvoice    = editForm.status === 'Invoice recibida'

  return (
    <>
      <Modal
        open={!!ociId}
        onClose={() => { setEditMode(false); setEditItemId(null); onClose() }}
        title={editMode ? `Editar OCI ${oci?.num_oc as string ?? ''}` : `OCI ${oci?.num_oc as string ?? ''}`}
        subtitle={editMode ? undefined : (oci?.proveedor as { razon_social?: string } | undefined)?.razon_social}
        size="lg"
        footer={
          editMode ? (
            <>
              <button className="btn" onClick={() => { setEditMode(false); setEditError(null) }}>Cancelar</button>
              <button className="btn primary" onClick={handleSaveEdit} disabled={savingEdit || !editProv || !editForm.num_oc}>
                {savingEdit ? 'Guardando…' : 'Guardar cambios'}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={openEdit}><Icon name="edit" size={12} /> Editar</button>
              <button className="btn" onClick={() => { setEditItemId(null); onClose() }}>Cerrar</button>
            </>
          )
        }
      >
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Cargando…</div>
        )}

        {/* ── Edit mode form ─────────────────────────────────────────── */}
        {oci && !loading && editMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {editError && <div style={ERR_STYLE}>{editError}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Proveedor *</label>
                <ProveedorCombobox value={editProv} onChange={setEditProv} tipo="Importacion" placeholder="Buscar proveedor…" />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Grupo de importación</label>
                <ImportacionCombobox value={editImportacion} onChange={setEditImportacion} placeholder="Buscar grupo de importación…" />
              </div>
              <div className="form-field">
                <label className="form-label">N° OC *</label>
                <input className="input" value={editForm.num_oc} onChange={e => setEditForm(f => ({ ...f, num_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
              </div>
              <div className="form-field">
                <label className="form-label">Fecha OC</label>
                <input type="date" className="input" value={editForm.fecha_oc} onChange={e => setEditForm(f => ({ ...f, fecha_oc: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div className="form-field">
                <label className="form-label">N° Cotización proveedor</label>
                <input className="input" value={editForm.num_cotizacion_proveedor} onChange={e => setEditForm(f => ({ ...f, num_cotizacion_proveedor: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="COT-001" />
              </div>
              <div className="form-field">
                <label className="form-label">Fecha ofrecida</label>
                <input type="date" className="input" value={editForm.fecha_ofrecida} onChange={e => setEditForm(f => ({ ...f, fecha_ofrecida: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div className="form-field">
                <label className="form-label">Moneda</label>
                <select className="select" value={editForm.moneda} onChange={e => setEditForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
                  {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label className="form-label">Monto total</label>
                <input type="number" className="input" value={editForm.monto_total} onChange={e => setEditForm(f => ({ ...f, monto_total: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Estado</label>
                <select className="select" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%' }}>
                  {OCI_ESTADOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Notas</label>
                <textarea className="input" rows={2} value={editForm.notas} onChange={e => setEditForm(f => ({ ...f, notas: e.target.value }))} style={{ width: '100%', resize: 'vertical' }} />
              </div>
            </div>

            {/* ── Confirmación section ─────────────────────────────── */}
            {isConfirmada && (
              <div style={SECTION_STYLE}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--accent)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="check" size={12} /> Datos de confirmación proveedor
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'flex-end' }}>
                  <div className="form-field" style={{ margin: 0 }}>
                    <label className="form-label">N° Confirmación proveedor</label>
                    <input className="input" value={editForm.num_confirmacion_proveedor}
                      onChange={e => setEditForm(f => ({ ...f, num_confirmacion_proveedor: e.target.value }))}
                      style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="CONF-001" />
                  </div>
                  {ociId && profile && (
                    <button className="btn sm" style={{ whiteSpace: 'nowrap' }}
                      onClick={() => setShowUploadDoc('confirmacion')}>
                      <Icon name="paperclip" size={12} /> Adjuntar confirmación
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Invoice section ──────────────────────────────────── */}
            {isInvoice && (
              <div style={SECTION_INVOICE_STYLE}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ok)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="doc" size={12} /> Datos de invoice
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-field" style={{ margin: 0 }}>
                    <label className="form-label">Fecha invoice</label>
                    <input type="date" className="input" value={editForm.fecha_invoice}
                      onChange={e => setEditForm(f => ({ ...f, fecha_invoice: e.target.value }))}
                      style={{ width: '100%' }} />
                  </div>
                  <div className="form-field" style={{ margin: 0 }}>
                    <label className="form-label">N° Invoice</label>
                    <input className="input" value={editForm.num_invoice}
                      onChange={e => setEditForm(f => ({ ...f, num_invoice: e.target.value }))}
                      style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="INV-001" />
                  </div>
                </div>
                <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-3)' }}>
                  El N° ítem de invoice se registra por ítem en la tabla de ítems.
                </div>
                {ociId && profile && (
                  <button className="btn sm" style={{ marginTop: 10 }}
                    onClick={() => setShowUploadDoc('invoice')}>
                    <Icon name="paperclip" size={12} /> Adjuntar invoice
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── View mode ──────────────────────────────────────────────── */}
        {oci && !loading && !editMode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12.5 }}>
              {[
                { label: 'N° OC',                value: oci.num_oc as string },
                { label: 'Moneda',               value: oci.moneda as string },
                { label: 'Monto total',          value: `${(oci.monto_total as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ${oci.moneda as string}` },
                { label: 'Estado',               value: oci.status as string },
                { label: 'N° Cotización prov.',  value: (oci.num_cotizacion_proveedor as string) || undefined },
                { label: 'Fecha ofrecida',       value: (oci.fecha_ofrecida as string) || undefined },
                { label: 'N° Confirmación',      value: (oci.num_confirmacion_proveedor as string) || undefined },
                { label: 'N° Invoice',           value: (oci.num_invoice as string) || undefined },
                { label: 'Fecha invoice',        value: (oci.fecha_invoice as string) || undefined },
                { label: 'ETA',                  value: (oci.eta as string) || undefined },
                { label: 'Grupo importación',    value: (oci.importacion as { grupo_importacion?: string } | undefined)?.grupo_importacion || undefined },
              ].map(f => (
                <div key={f.label} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px' }}>
                  <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>{f.label}</div>
                  <div className="mono" style={{ fontWeight: 600 }}>{f.value ?? '—'}</div>
                </div>
              ))}
            </div>

            {/* Items */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
                  Ítems ({items.length})
                </span>
                <button className="btn primary xs" onClick={() => { setEditItemId(null); setShowAddItem(true) }}>
                  <Icon name="plus" size={11} /> Agregar ítem
                </button>
              </div>

              {/* Inline item edit panel */}
              {editItemId && (
                <div style={{ border: '1px solid var(--accent)', borderRadius: 8, padding: 14, marginBottom: 10, background: 'var(--panel-2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-2)' }}>Editar ítem</span>
                    <button className="icon-btn" onClick={() => { setEditItemId(null); setItemError(null) }} title="Cancelar">
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                  {itemError && <div style={{ ...ERR_STYLE, marginBottom: 8 }}>{itemError}</div>}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div className="form-field">
                      <label className="form-label">Ítem OC</label>
                      <input className="input" value={editItemForm.item_oc} onChange={e => setEditItemForm(f => ({ ...f, item_oc: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Código comercial</label>
                      <input className="input" value={editItemForm.codigo_comercial} onChange={e => setEditItemForm(f => ({ ...f, codigo_comercial: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Descripción *</label>
                      <input className="input" value={editItemForm.descripcion} onChange={e => setEditItemForm(f => ({ ...f, descripcion: e.target.value }))} style={{ width: '100%' }} />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Cantidad *</label>
                      <input type="number" className="input" value={editItemForm.cantidad} onChange={e => setEditItemForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">Unidad de medida</label>
                      <input list="umd-edit-oci" className="input" value={editItemForm.unidad_medida} onChange={e => setEditItemForm(f => ({ ...f, unidad_medida: e.target.value }))} style={{ width: '100%' }} />
                      <datalist id="umd-edit-oci">{UM_LIST.map(u => <option key={u} value={u} />)}</datalist>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Moneda</label>
                      <select className="select" value={editItemForm.moneda} onChange={e => setEditItemForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
                        {['USD','PEN','EUR'].map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div className="form-field">
                      <label className="form-label">Precio unitario *</label>
                      <input type="number" className="input" value={editItemForm.pcu1} onChange={e => setEditItemForm(f => ({ ...f, pcu1: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
                    </div>
                    <div className="form-field">
                      <label className="form-label">N° Ítem Invoice</label>
                      <input className="input" value={editItemForm.num_item_invoice} onChange={e => setEditItemForm(f => ({ ...f, num_item_invoice: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="001" />
                    </div>
                    {editItemForm.cantidad && editItemForm.pcu1 && (
                      <div style={{ gridColumn: '1 / -1', background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', fontSize: 12.5 }}>
                        <span className="muted">Total: </span>
                        <span className="mono" style={{ fontWeight: 600 }}>
                          {(parseFloat(editItemForm.cantidad) * parseFloat(editItemForm.pcu1)).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {editItemForm.moneda}
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                    <button className="btn sm" onClick={() => { setEditItemId(null); setItemError(null) }}>Cancelar</button>
                    <button className="btn primary sm" onClick={handleSaveItem} disabled={savingItem || !editItemForm.descripcion || !editItemForm.cantidad || !editItemForm.pcu1}>
                      {savingItem ? 'Guardando…' : 'Guardar ítem'}
                    </button>
                  </div>
                </div>
              )}

              <DataTable
                columns={itemColumns}
                rows={items}
                idKey="id"
                density="compact"
                emptyMessage="Sin ítems. Usa 'Agregar ítem' para añadir productos."
              />
            </div>

            {/* Notes */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>
                Notas ({notas.length})
              </div>
              {!!oci.notas && (
                <div style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, marginBottom: 8, color: 'var(--text-2)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', marginRight: 6 }}>Nota original:</span>
                  <span>{oci.notas as string}</span>
                </div>
              )}
              {notas.map((n, i) => (
                <div key={n.id ?? i} style={{ background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, marginBottom: 6 }}>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent-2)' }}>{n.usuario?.nombre_completo ?? 'Usuario'}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{n.created_at ? new Date(n.created_at).toLocaleDateString('es-PE') : ''}</span>
                  </div>
                  <div style={{ color: 'var(--text-1)' }}>{n.nota}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  className="input"
                  value={newNota}
                  onChange={e => setNewNota(e.target.value)}
                  placeholder="Agregar nota…"
                  style={{ flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNota() } }}
                />
                <button className="btn primary sm" onClick={handleAddNota} disabled={savingNota || !newNota.trim()}>
                  {savingNota ? '…' : 'Agregar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <AgregarItemOciModal
        open={showAddItem}
        onClose={() => setShowAddItem(false)}
        ordenCompraId={oci?.id as string ?? ''}
        ordenMoneda={oci?.moneda as string}
        operacionId={oci?.operacion_id as string}
        onSuccess={() => { ociId && load(ociId); onChanged?.() }}
      />

      {/* Document upload modals */}
      {showUploadDoc && ociId && profile && (
        <UploadDocumentoModal
          open={!!showUploadDoc}
          onClose={() => setShowUploadDoc(null)}
          entidadTipo="orden_compra_importacion"
          entidadId={ociId}
          userId={profile.id}
          onUploaded={() => setShowUploadDoc(null)}
        />
      )}
    </>
  )
}
