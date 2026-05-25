import { useState, useEffect } from 'react'
import { Modal, DataTable, Icon } from '@/components/ui'
import type { Column } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { AgregarItemOciModal } from './AgregarItemOciModal'

interface Props {
  ociId: string | null
  onClose: () => void
  onChanged?: () => void
}

type OciRow = Record<string, unknown>
type NotaRow = { id?: string; nota: string; created_at?: string; usuario?: { nombre_completo?: string } }

export function OciDetailModal({ ociId, onClose, onChanged }: Props) {
  const { profile } = useAuth()
  const [oci, setOci] = useState<OciRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [showAddItem, setShowAddItem] = useState(false)
  const [newNota, setNewNota] = useState('')
  const [savingNota, setSavingNota] = useState(false)

  async function load(id: string) {
    setLoading(true)
    const { data } = await supabase
      .from('ordenes_compra')
      .select(`
        *,
        proveedor:proveedores(razon_social),
        operacion:operaciones(id, correlativo_opci),
        items:orden_compra_items(*),
        notas_lista:ordenes_compra_notas(*, usuario:profiles(nombre_completo))
      `)
      .eq('id', id)
      .single()
    setOci(data as OciRow | null)
    setLoading(false)
  }

  useEffect(() => {
    if (!ociId) { setOci(null); setNewNota(''); return }
    load(ociId)
  }, [ociId])

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

  return (
    <>
      <Modal
        open={!!ociId}
        onClose={onClose}
        title={`OCI ${oci?.num_oc as string ?? ''}`}
        subtitle={(oci?.proveedor as { razon_social?: string } | undefined)?.razon_social}
        size="lg"
        footer={<button className="btn" onClick={onClose}>Cerrar</button>}
      >
        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Cargando…</div>
        )}

        {oci && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, fontSize: 12.5 }}>
              {[
                { label: 'N° OC',       value: oci.num_oc as string },
                { label: 'Moneda',      value: oci.moneda as string },
                { label: 'Monto total', value: `${(oci.monto_total as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} ${oci.moneda as string}` },
                { label: 'Estado',      value: oci.status as string },
                { label: 'N° Invoice',  value: (oci.num_invoice as string) ?? '—' },
                { label: 'ETA',         value: (oci.eta as string) ?? '—' },
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
                <button className="btn primary xs" onClick={() => setShowAddItem(true)}>
                  <Icon name="plus" size={11} /> Agregar ítem
                </button>
              </div>
              <DataTable
                columns={[
                  { key: 'item_oc',          label: 'Ítem OC',   width: 60 },
                  { key: 'item_op',          label: 'Ítem OP',   width: 70, render: r => r.item_op ? <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, fontSize: 11 }}>{r.item_op as string}</span> : <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span> },
                  { key: 'codigo_comercial', label: 'Código',    render: r => <span className="mono">{r.codigo_comercial as string ?? '—'}</span> },
                  { key: 'descripcion',      label: 'Descripción' },
                  { key: 'cantidad',         label: 'Cant.',     align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
                  { key: 'unidad_medida',    label: 'UM',        width: 60 },
                  { key: 'pcu1',             label: 'Precio U.', align: 'right', render: r => <span className="mono">{(r.pcu1 as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} {r.moneda as string}</span> },
                  { key: 'monto_total',      label: 'Total',     align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{(r.monto_total as number)?.toLocaleString('es-PE', { minimumFractionDigits: 2 })} {r.moneda as string}</span> },
                ] as Column<Record<string, unknown>>[]}
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
    </>
  )
}
