import { useState, useMemo } from 'react'
import { Icon } from './Icon'

export interface Column<T> {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: number
  render?: (row: T) => React.ReactNode
}

interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  idKey: keyof T
  density?: 'default' | 'compact' | 'cozy'
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
  pageSize?: number
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  idKey,
  density = 'default',
  onRowClick,
  loading = false,
  emptyMessage = 'Sin datos',
  pageSize = 50,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  const sorted = useMemo(() => {
    if (!sortKey) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = av < bv ? -1 : av > bv ? 1 : 0
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [rows, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  const densityClass = density === 'compact' ? 'compact' : ''

  return (
    <div className="table-wrap">
      <table className={`data-table ${densityClass}`}>
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                className={[
                  col.sortable ? 'sortable' : '',
                  col.align === 'right' ? 'r' : col.align === 'center' ? 'c' : '',
                ].join(' ')}
                style={col.width ? { width: col.width } : undefined}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <Icon name={sortDir === 'asc' ? 'arrowUp' : 'arrowDown'} size={10} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Icon name="spinner" size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  Cargando…
                </div>
              </td>
            </tr>
          ) : paged.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="empty-state">
                  <Icon name="box" size={28} className="empty-icon" />
                  <div className="empty-title">{emptyMessage}</div>
                </div>
              </td>
            </tr>
          ) : (
            paged.map(row => (
              <tr
                key={String(row[idKey])}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={!onRowClick ? { cursor: 'default' } : undefined}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={col.align === 'right' ? 'r' : col.align === 'center' ? 'c' : ''}
                    onClick={e => {
                      // allow inner buttons to prevent row click
                      if ((e.target as HTMLElement).closest('button')) e.stopPropagation()
                    }}
                  >
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {totalPages > 1 && (
        <div className="table-footer">
          <span>{sorted.length} registros</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="btn ghost xs"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <Icon name="arrowLeft" size={11} />
            </button>
            <span style={{ fontSize: 11, padding: '0 4px' }}>
              {page} / {totalPages}
            </span>
            <button
              className="btn ghost xs"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <Icon name="chevron" size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
