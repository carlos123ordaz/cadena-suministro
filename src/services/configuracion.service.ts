import { supabase } from '@/lib/supabase'

export async function getParametrosLista(tipo: string): Promise<string[]> {
  const { data } = await supabase
    .from('parametros_lista')
    .select('valor')
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('orden')
  return (data ?? []).map((r: { valor: string }) => r.valor)
}

export async function getAppConfig(clave: string): Promise<string | null> {
  const { data } = await supabase
    .from('app_configuracion')
    .select('valor')
    .eq('clave', clave)
    .maybeSingle()
  return (data as { valor: string } | null)?.valor ?? null
}

export async function setAppConfig(clave: string, valor: string): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('app_configuracion')
    .upsert({ clave, valor }, { onConflict: 'clave' })
  return { error }
}

export async function getNextCorrelativoOPCI(): Promise<string> {
  const [configRes, opRes] = await Promise.all([
    getAppConfig('correlativo_opci_inicio'),
    supabase
      .from('operaciones')
      .select('correlativo_opci')
      .order('correlativo_opci', { ascending: false })
      .limit(100),
  ])

  const inicio = Math.max(1, parseInt(configRes ?? '1', 10) || 1)

  let maxNum = 0
  for (const row of (opRes.data ?? []) as { correlativo_opci: string }[]) {
    const match = row.correlativo_opci?.match(/^OPCI-(\d{8})$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (n > maxNum) maxNum = n
    }
  }

  const next = Math.max(inicio, maxNum + 1)
  return `OPCI-${String(next).padStart(8, '0')}`
}
