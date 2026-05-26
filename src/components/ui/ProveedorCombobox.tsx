import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface ProveedorOption {
  id: string
  razon_social: string
}

interface Props {
  value: ProveedorOption | null
  onChange: (val: ProveedorOption | null) => void
  tipo?: 'Local' | 'Importacion'
  placeholder?: string
  style?: React.CSSProperties
  disabled?: boolean
}

export function ProveedorCombobox({ value, onChange, tipo, placeholder = 'Buscar proveedor…', style, disabled }: Props) {
  const [query, setQuery] = useState(value?.razon_social ?? '')
  const [options, setOptions] = useState<ProveedorOption[]>([])
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setQuery(value?.razon_social ?? '')
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
    let qb = supabase.from('proveedores').select('id, razon_social').eq('activo', true)
    if (tipo) qb = qb.eq('tipo', tipo)
    if (q.trim()) qb = qb.ilike('razon_social', `%${q}%`)
    const { data } = await qb.order('razon_social').limit(15)
    setOptions((data ?? []) as ProveedorOption[])
  }, [tipo])

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

  function select(opt: ProveedorOption) {
    setQuery(opt.razon_social)
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
              {opt.razon_social}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
