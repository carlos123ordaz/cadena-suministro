import { supabase } from '@/lib/supabase'
import type { UUID, Producto } from '@/types'

export async function getProductos(): Promise<{ data: Producto[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .order('codigo_comercial', { ascending: true })

  return { data: data as Producto[] | null, error }
}

export async function getProducto(
  id: UUID,
): Promise<{ data: Producto | null; error: unknown }> {
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('id', id)
    .single()

  return { data: data as Producto | null, error }
}

export async function createProducto(
  payload: Omit<Producto, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ data: Producto | null; error: unknown }> {
  const { data, error } = await supabase
    .from('productos')
    .insert(payload)
    .select('*')
    .single()

  return { data: data as Producto | null, error }
}

export async function updateProducto(
  id: UUID,
  payload: Partial<Omit<Producto, 'id' | 'created_at' | 'updated_at'>>,
): Promise<{ data: Producto | null; error: unknown }> {
  const { data, error } = await supabase
    .from('productos')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as Producto | null, error }
}

export async function searchProductos(
  q: string,
): Promise<{ data: Producto[] | null; error: unknown }> {
  const term = q.trim()
  const { data, error } = await supabase
    .from('productos')
    .select('*')
    .eq('activo', true)
    .or(`codigo_comercial.ilike.%${term}%,descripcion.ilike.%${term}%`)
    .order('codigo_comercial', { ascending: true })
    .limit(50)

  return { data: data as Producto[] | null, error }
}
