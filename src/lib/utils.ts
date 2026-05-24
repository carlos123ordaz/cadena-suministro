import { format, differenceInDays, parseISO, isValid } from 'date-fns'
import { es } from 'date-fns/locale'

export function fmtDate(date?: string | null): string {
  if (!date) return '—'
  try {
    const d = parseISO(date)
    if (!isValid(d)) return '—'
    return format(d, 'dd/MM/yyyy', { locale: es })
  } catch {
    return '—'
  }
}

export function fmtDateTime(date?: string | null): string {
  if (!date) return '—'
  try {
    const d = parseISO(date)
    if (!isValid(d)) return '—'
    return format(d, 'dd/MM/yyyy HH:mm', { locale: es })
  } catch {
    return '—'
  }
}

export function daysFrom(date?: string | null): number {
  if (!date) return 9999
  try {
    const d = parseISO(date)
    if (!isValid(d)) return 9999
    return differenceInDays(d, new Date())
  } catch {
    return 9999
  }
}

export function money(amount: number | null | undefined, currency = 'USD'): string {
  if (amount == null) return '—'
  const locale = currency === 'PEN' ? 'es-PE' : 'en-US'
  const symbol = currency === 'PEN' ? 'S/ ' : currency === 'USD' ? 'USD ' : currency + ' '
  return symbol + amount.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function pct(value: number): string {
  return value.toFixed(1) + '%'
}

export function cls(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function initials(name?: string | null): string {
  if (!name) return '??'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}

export function generateCorrelativo(prefix: string, year: number, seq: number): string {
  return `${prefix}-${year}-${String(seq).padStart(4, '0')}`
}

export function isOverdue(dateStr?: string | null, pagado = false): boolean {
  if (pagado || !dateStr) return false
  return daysFrom(dateStr) < 0
}

export function etaTone(days: number): 'bad' | 'warn' | 'info' | 'ok' | 'muted' {
  if (days === 9999) return 'muted'
  if (days < 0) return 'bad'
  if (days <= 3) return 'warn'
  if (days <= 7) return 'info'
  return 'ok'
}
