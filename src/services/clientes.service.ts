import { supabase } from '@/lib/supabase'
import type { UUID, Cliente } from '@/types'

export async function getClientes(search?: string): Promise<{ data: Cliente[] | null; error: unknown }> {
  let query = supabase.from('clientes').select('*').eq('activo', true).order('razon_social', { ascending: true })
  if (search) query = query.ilike('razon_social', `%${search}%`)
  const { data, error } = await query
  return { data: data as Cliente[] | null, error }
}

export async function getCliente(
  id: UUID,
): Promise<{ data: Cliente | null; error: unknown }> {
  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as Cliente | null, error }
}

export async function createCliente(
  payload: Omit<Cliente, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ data: Cliente | null; error: unknown }> {
  const { data, error } = await supabase
    .from('clientes')
    .insert(payload)
    .select('*')
    .single()

  return { data: data as Cliente | null, error }
}

export async function updateCliente(
  id: UUID,
  payload: Partial<Omit<Cliente, 'id' | 'created_at' | 'updated_at'>>,
): Promise<{ data: Cliente | null; error: unknown }> {
  const { data, error } = await supabase
    .from('clientes')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as Cliente | null, error }
}
