interface Field {
  label: string
  value?: string | number | React.ReactNode | null
  mono?: boolean
  span?: number
}

interface MetaGridProps {
  fields: Field[]
  cols?: 2 | 3 | 4
}

export function MetaGrid({ fields, cols = 2 }: MetaGridProps) {
  return (
    <div
      className="meta-grid"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {fields.map((f, i) => (
        <div
          key={i}
          className="meta-field"
          style={f.span ? { gridColumn: `span ${f.span}` } : undefined}
        >
          <div className="meta-label">{f.label}</div>
          <div className={`meta-value${f.mono ? ' mono' : ''}`}>
            {f.value == null || f.value === '' ? (
              <span className="muted">—</span>
            ) : (
              f.value
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
