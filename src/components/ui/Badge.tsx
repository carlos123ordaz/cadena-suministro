import { Icon } from './Icon'

export type BadgeTone = 'ok' | 'warn' | 'bad' | 'info' | 'muted' | 'violet' | 'teal'

interface BadgeProps {
  tone?: BadgeTone
  icon?: string
  children: React.ReactNode
  className?: string
}

export function Badge({ tone = 'muted', icon, children, className }: BadgeProps) {
  return (
    <span className={`badge ${tone}${className ? ' ' + className : ''}`}>
      {icon && <Icon name={icon} size={10} />}
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: string
  mapping: Record<string, BadgeTone | string>
  showPin?: boolean
}

export function StatusBadge({ status, mapping, showPin = true }: StatusBadgeProps) {
  const tone = (mapping?.[status] ?? 'muted') as BadgeTone
  return (
    <span className={`badge ${tone}`}>
      {showPin && <span className="pin" />}
      {status}
    </span>
  )
}

// Status tone mappings
export const OPCI_STATUS_TONE: Record<string, BadgeTone> = {
  'Borrador':               'muted',
  'Recibida':               'info',
  'En evaluación':          'info',
  'En compra local':        'violet',
  'En importación':         'violet',
  'Pendiente de recepción': 'warn',
  'Pendiente de facturación':'warn',
  'Facturada':              'teal',
  'Pendiente de despacho':  'warn',
  'Despachada':             'teal',
  'Pendiente de cobranza':  'warn',
  'Cerrada':                'ok',
  'Observada':              'bad',
  'Anulada':                'muted',
}

export const OCL_STATUS_TONE: Record<string, BadgeTone> = {
  'Pendiente de cotización': 'warn',
  'Cotizado':                'info',
  'OC emitida':              'info',
  'Confirmado por proveedor':'violet',
  'En espera de entrega':    'warn',
  'Recibido parcial':        'warn',
  'Recibido completo':       'teal',
  'Facturado por proveedor': 'teal',
  'Cerrado':                 'ok',
  'Observado':               'bad',
  'Anulado':                 'muted',
}

export const OCI_STATUS_TONE: Record<string, BadgeTone> = {
  'Borrador':              'muted',
  'OC emitida':            'info',
  'Confirmada por proveedor':'violet',
  'Pendiente de invoice':  'warn',
  'Invoice recibida':      'info',
  'En preparación de embarque':'info',
  'Embarcada':             'violet',
  'En tránsito':           'violet',
  'Arribada':              'info',
  'En aduanas':            'warn',
  'Nacionalizada':         'teal',
  'En traslado a almacén': 'teal',
  'Recibida en almacén':   'teal',
  'Costeada':              'ok',
  'Cerrada':               'ok',
  'Observada':             'bad',
  'Anulada':               'muted',
}

export const FACTURA_STATUS_TONE: Record<string, BadgeTone> = {
  'Pendiente de emisión':  'muted',
  'Emitida':               'info',
  'Enviada al cliente':    'info',
  'Pendiente de pago':     'warn',
  'Pagada parcial':        'warn',
  'Pagada total':          'ok',
  'Vencida':               'bad',
  'Anulada':               'muted',
  'Nota de crédito emitida':'violet',
}

export const DESPACHO_STATUS_TONE: Record<string, BadgeTone> = {
  'Preparando':    'warn',
  'En transporte': 'violet',
  'Entregado':     'ok',
  'Observado':     'bad',
  'Anulado':       'muted',
}

export const RECEPCION_STATUS_TONE: Record<string, BadgeTone> = {
  'Pendiente':         'warn',
  'Recibido parcial':  'warn',
  'Recibido completo': 'ok',
  'Observado':         'bad',
}
