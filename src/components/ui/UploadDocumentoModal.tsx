import { useRef, useState } from 'react'
import { Modal } from './Modal'
import { Icon } from './Icon'
import { uploadDocumento } from '@/services/documentos.service'
import type { EntidadTipo, TipoDocumento } from '@/types'

const TIPOS: TipoDocumento[] = [
  'OC cliente', 'Cotización proveedor', 'Confirmación proveedor', 'Factura proveedor',
  'Commercial Invoice', 'Packing List', 'Documento de transporte', 'BL / AWB / tracking',
  'Guía de remisión', 'Factura de venta', 'Evidencia de entrega', 'Comprobante de pago',
  'Documentos de aduanas', 'Otro',
]

interface Props {
  open: boolean
  onClose: () => void
  entidadTipo: EntidadTipo
  entidadId: string
  userId: string
  onUploaded: () => void
}

export function UploadDocumentoModal({ open, onClose, entidadTipo, entidadId, userId, onUploaded }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [tipo, setTipo] = useState<TipoDocumento>('Otro')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  function reset() {
    setFile(null)
    setTipo('Otro')
    setError(null)
    setSuccess(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null
    setFile(f)
    setError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const f = e.dataTransfer.files?.[0] ?? null
    if (f) { setFile(f); setError(null) }
  }

  async function handleUpload() {
    if (!file) { setError('Selecciona un archivo primero.'); return }
    setUploading(true)
    setError(null)
    const { error: err } = await uploadDocumento(entidadTipo, entidadId, file, tipo, userId)
    setUploading(false)
    if (err) {
      const msg = (err as { message?: string })?.message ?? 'Error al subir el archivo.'
      setError(msg)
      return
    }
    setSuccess(true)
    onUploaded()
  }

  const fmtSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(1)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Adjuntar documento"
      size="sm"
      footer={
        success ? (
          <button className="btn primary" onClick={handleClose}>Listo</button>
        ) : (
          <>
            <button className="btn" onClick={handleClose}>Cancelar</button>
            <button className="btn primary" onClick={handleUpload} disabled={uploading || !file}>
              {uploading
                ? <><Icon name="spinner" size={12} style={{ animation: 'spin 1s linear infinite' }} /> Subiendo…</>
                : <><Icon name="upload" size={12} /> Subir archivo</>}
            </button>
          </>
        )
      }
    >
      {success ? (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <Icon name="check" size={32} style={{ color: 'var(--ok)', display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Archivo subido correctamente</div>
          <div className="tiny muted">{file?.name}</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)' }}>
              {error}
            </div>
          )}

          {/* Drop zone */}
          <div
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            style={{
              border: `2px dashed ${file ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 8,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: 'pointer',
              background: file ? 'var(--accent-soft)' : 'var(--panel-2)',
              transition: 'border-color 0.15s, background 0.15s',
            }}
          >
            <input ref={inputRef} type="file" style={{ display: 'none' }} onChange={handleFileChange} />
            {file ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Icon name="doc" size={24} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 13, fontWeight: 600, wordBreak: 'break-all' }}>{file.name}</div>
                <div className="tiny muted">{fmtSize(file.size)}</div>
                <button
                  className="btn ghost xs"
                  style={{ marginTop: 4 }}
                  onClick={e => { e.stopPropagation(); setFile(null); if (inputRef.current) inputRef.current.value = '' }}
                >
                  Cambiar archivo
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Icon name="upload" size={24} style={{ color: 'var(--text-3)' }} />
                <div style={{ fontSize: 13, fontWeight: 500 }}>Arrastra un archivo o haz clic para seleccionar</div>
                <div className="tiny muted">PDF, Excel, Word, imágenes — máx. 20 MB</div>
              </div>
            )}
          </div>

          {/* Tipo de documento */}
          <div className="form-field">
            <label className="form-label">Tipo de documento</label>
            <select className="select" value={tipo} onChange={e => setTipo(e.target.value as TipoDocumento)} style={{ width: '100%' }}>
              {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
      )}
    </Modal>
  )
}
