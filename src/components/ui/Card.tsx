import { Icon } from './Icon'

interface CardProps {
  title?: string
  icon?: string
  actions?: React.ReactNode
  children: React.ReactNode
  padding?: boolean
  className?: string
  style?: React.CSSProperties
  bodyStyle?: React.CSSProperties
}

export function Card({ title, icon, actions, children, padding = true, className, style, bodyStyle }: CardProps) {
  return (
    <div className={`card${className ? ' ' + className : ''}`} style={style}>
      {title && (
        <div className="card-head">
          <div className="card-title">
            {icon && <Icon name={icon} size={13} className="card-title-icon" />}
            {title}
          </div>
          {actions && <div>{actions}</div>}
        </div>
      )}
      <div className={padding ? 'card-body' : 'card-body no-pad'} style={bodyStyle}>
        {children}
      </div>
    </div>
  )
}

interface KPIProps {
  label: string
  value: string | number
  delta?: string
  deltaTone?: 'up' | 'down' | ''
  icon?: string
  onClick?: () => void
}

export function KPI({ label, value, delta, deltaTone = '', icon, onClick }: KPIProps) {
  return (
    <div
      className="kpi"
      onClick={onClick}
      style={onClick ? { cursor: 'pointer' } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div className="kpi-label">{label}</div>
        {icon && <Icon name={icon} size={14} style={{ color: 'var(--text-3)' }} />}
      </div>
      <div className="kpi-value">{value}</div>
      {delta && (
        <div className={`kpi-delta ${deltaTone}`}>
          {deltaTone === 'up' && <Icon name="arrowUp" size={10} />}
          {deltaTone === 'down' && <Icon name="arrowDown" size={10} />}
          {delta}
        </div>
      )}
    </div>
  )
}
