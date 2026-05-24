import { daysFrom, fmtDate, etaTone } from '@/lib/utils'

interface EtaCellProps {
  eta?: string | null
  pastBad?: boolean
}

export function EtaCell({ eta, pastBad }: EtaCellProps) {
  if (!eta) return <span className="muted">—</span>
  const days = daysFrom(eta)
  const tone = pastBad && days < 0 ? 'bad' : etaTone(days)
  const label = days === 9999 ? '' : days < 0 ? `hace ${Math.abs(days)}d` : days === 0 ? 'hoy' : `en ${days}d`

  return (
    <span className={`status-cell ${tone}`}>
      <span className="dot" />
      <span className="mono" style={{ color: 'var(--text)' }}>{fmtDate(eta)}</span>
      {label && <span className="tiny">{label}</span>}
    </span>
  )
}
