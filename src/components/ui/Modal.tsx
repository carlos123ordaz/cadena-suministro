import { useEffect, useRef } from 'react'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  children: React.ReactNode
  footer?: React.ReactNode
}

export function Modal({ open, onClose, title, subtitle, size = 'md', children, footer }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal modal-${size}`} ref={ref}>
        <div className="modal-head">
          <div>
            <div className="modal-title">{title}</div>
            {subtitle && <div className="modal-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} title="Cerrar">
            <Icon name="x" size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}

interface DrawerProps {
  open: boolean
  onClose: () => void
  title: string
  sub?: string
  children: React.ReactNode
  footer?: React.ReactNode
  width?: number
}

export function Drawer({ open, onClose, title, sub, children, footer, width = 520 }: DrawerProps) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer" style={{ width }}>
        <div className="drawer-head">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div className="drawer-title">{title}</div>
              {sub && <div className="drawer-sub">{sub}</div>}
            </div>
            <button className="icon-btn" onClick={onClose} style={{ flexShrink: 0 }}>
              <Icon name="x" size={15} />
            </button>
          </div>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </>
  )
}
