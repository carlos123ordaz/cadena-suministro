import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ImportacionOption {
  id: string
  grupo_importacion: string
}

interface Props {
  value: ImportacionOption | null
  onChange: (val: ImportacionOption | null) => void
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export function ImportacionCombobox({ value, onChange, placeholder = 'Buscar grupo de importación…', style, disabled }: Props) {
  const [query, setQuery] = useState(value?.grupo_importacion ?? '')
  const [options, setOptions] = useState<ImportacionOption[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(value?.grupo_importacion ?? '')
  }, [value?.id])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    let qb = supabase.from('importaciones').select('id, grupo_importacion')
    if (q.trim()) qb = qb.ilike('grupo_importacion', `%${q}%`)
    const { data } = await qb.order('grupo_importacion').limit(20)
    setOptions((data ?? []) as ImportacionOption[])
  }, [])

  function handleFocus() {
    setOpen(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(query), 0)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    if (!q) onChange(null)
    setOpen(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => doSearch(q), 220)
  }

  function select(opt: ImportacionOption) {
    setQuery(opt.grupo_importacion)
    onChange(opt)
    setOpen(false)
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', ...style }}>
      <input
        className="input"
        value={query}
        onChange={handleChange}
        onFocus={handleFocus}
        placeholder={placeholder}
        disabled={disabled}
        style={{ width: '100%' }}
        autoComplete="off"
      />
      {open && options.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6,
          boxShadow: '0 4px 16px rgba(0,0,0,.18)', maxHeight: 220, overflowY: 'auto',
          marginTop: 2,
        }}>
          {options.map(opt => (
            <div key={opt.id}
              style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }}
              onMouseDown={() => select(opt)}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {opt.grupo_importacion}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
