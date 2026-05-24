import { fmtDateTime } from '@/lib/utils'
import type { BadgeTone } from './Badge'
import type { HistorialEvento } from '@/types'

function toneForAction(accion: string): BadgeTone {
  if (accion.toLowerCase().includes('creó') || accion.toLowerCase().includes('registr')) return 'info'
  if (accion.toLowerCase().includes('cerr') || accion.toLowerCase().includes('complet')) return 'ok'
  if (accion.toLowerCase().includes('anuló') || accion.toLowerCase().includes('rechazó')) return 'bad'
  if (accion.toLowerCase().includes('observ') || accion.toLowerCase().includes('alerta')) return 'warn'
  if (accion.toLowerCase().includes('cambió') || accion.toLowerCase().includes('actualizó')) return 'violet'
  return 'muted'
}

interface TimelineProps {
  eventos: HistorialEvento[]
  loading?: boolean
}

export function Timeline({ eventos, loading }: TimelineProps) {
  if (loading) {
    return (
      <div className="loading-row">
        <span>Cargando historial…</span>
      </div>
    )
  }

  if (eventos.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-title">Sin eventos registrados</div>
      </div>
    )
  }

  return (
    <div className="timeline">
      {eventos.map(ev => {
        const tone = toneForAction(ev.accion)
        return (
          <div className="tl-item" key={ev.id}>
            <div className="tl-line">
              <div className={`tl-dot ${tone}`} />
              <div className="tl-connector" />
            </div>
            <div className="tl-content">
              <div className="tl-action">{ev.accion}</div>
              <div className="tl-meta">
                {ev.usuario?.nombre_completo ?? 'Sistema'} · {fmtDateTime(ev.created_at)}
                {ev.valor_anterior && ev.valor_nuevo && (
                  <span style={{ marginLeft: 6 }}>
                    <span style={{ color: 'var(--bad)' }}>{ev.valor_anterior}</span>
                    {' → '}
                    <span style={{ color: 'var(--ok)' }}>{ev.valor_nuevo}</span>
                  </span>
                )}
              </div>
              {ev.comentario && (
                <div className="tl-comment">{ev.comentario}</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
