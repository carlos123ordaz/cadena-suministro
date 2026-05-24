import { supabase } from '@/lib/supabase'
import type { UUID, Proveedor, TipoProveedor } from '@/types'

export async function getProveedores(search?: string, tipo?: TipoProveedor): Promise<{ data: Proveedor[] | null; error: unknown }> {
  let query = supabase.from('proveedores').select('*').eq('activo', true).order('razon_social', { ascending: true })
  if (search) query = query.ilike('razon_social', `%${search}%`)
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query
  return { data: data as Proveedor[] | null, error }
}

export async function getProveedor(
  id: UUID,
): Promise<{ data: Proveedor | null; error: unknown }> {
  const { data, error } = await supabase
    .from('proveedores')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as Proveedor | null, error }
}

export async function createProveedor(
  payload: Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ data: Proveedor | null; error: unknown }> {
  const { data, error } = await supabase
    .from('proveedores')
    .insert(payload)
    .select('*')
    .single()

  return { data: data as Proveedor | null, error }
}

export async function updateProveedor(
  id: UUID,
  payload: Partial<Omit<Proveedor, 'id' | 'created_at' | 'updated_at'>>,
): Promise<{ data: Proveedor | null; error: unknown }> {
  const { data, error } = await supabase
    .from('proveedores')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as Proveedor | null, error }
}
