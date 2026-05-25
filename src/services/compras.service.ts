import { supabase } from '@/lib/supabase'
import type {
  UUID,
  ISODate,
  OrdenCompraLocal,
  OrdenCompraLocalItem,
  ProveedorFechaHistorial,
  OrdenCompraNota,
  PaginationParams,
} from '@/types'

interface ComprasFilters {
  operacion_id?: UUID
  proveedor_id?: UUID
  status?: OrdenCompraLocal['status']
  search?: string
}

export async function getOrdenesCompraLocal(
  filters: ComprasFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 25 },
): Promise<{ data: OrdenCompraLocal[] | null; count: number; error: unknown }> {
  const from = (pagination.page - 1) * pagination.pageSize
  const to = from + pagination.pageSize - 1

  let query = supabase
    .from('ordenes_compra')
    .select('*, operacion:operaciones(correlativo_opci), proveedor:proveedores(razon_social)', {
      count: 'exact',
    })
    .eq('tipo', 'Local')

  if (filters.operacion_id) query = query.eq('operacion_id', filters.operacion_id)
  if (filters.proveedor_id) query = query.eq('proveedor_id', filters.proveedor_id)
  if (filters.status) query = query.eq('status', filters.status)
  if (filters.search) query = query.ilike('num_oc', `%${filters.search}%`)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  return { data: data as OrdenCompraLocal[] | null, count: count ?? 0, error }
}

export async function getOrdenCompraLocal(id: UUID): Promise<{
  data: (OrdenCompraLocal & {
    items: OrdenCompraLocalItem[]
    fechas_historial: ProveedorFechaHistorial[]
    notas_lista: OrdenCompraNota[]
  }) | null
  error: unknown
}> {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .select(`
      *,
      operacion:operaciones(*, cliente:clientes!cliente_id(*)),
      proveedor:proveedores(*),
      items:orden_compra_items(*, producto:productos(codigo_comercial, descripcion, unidad_medida)),
      fechas_historial:proveedor_fecha_historial(*, usuario:profiles(*)),
      notas_lista:ordenes_compra_notas(*, usuario:profiles(nombre_completo))
    `)
    .eq('id', id)
    .single()

  return { data: data as ReturnType<typeof getOrdenCompraLocal> extends Promise<{ data: infer D }> ? D : never, error }
}

export async function createOrdenCompraLocal(
  payload: Omit<OrdenCompraLocal, 'id' | 'created_at' | 'updated_at'>,
  items: Omit<OrdenCompraLocalItem, 'id' | 'orden_compra_id' | 'created_at'>[],
): Promise<{ data: OrdenCompraLocal | null; error: unknown }> {
  const { data: ocl, error: oclError } = await supabase
    .from('ordenes_compra')
    .insert({ ...payload, tipo: 'Local' })
    .select('*')
    .single()

  if (oclError) return { data: null, error: oclError }

  const oclRecord = ocl as OrdenCompraLocal

  if (items.length > 0) {
    const { error: itemsError } = await supabase
      .from('orden_compra_items')
      .insert(items.map((item) => ({ ...item, orden_compra_id: oclRecord.id })))

    if (itemsError) return { data: null, error: itemsError }
  }

  await supabase.from('historial_eventos').insert({
    entidad_tipo: 'orden_compra_local',
    entidad_id: oclRecord.id,
    usuario_id: null,
    accion: 'Creación',
    valor_nuevo: oclRecord.status,
  })

  return { data: oclRecord, error: null }
}

export async function updateOrdenCompraLocal(
  id: UUID,
  payload: Partial<Omit<OrdenCompraLocal, 'id' | 'created_at' | 'updated_at'>>,
): Promise<{ data: OrdenCompraLocal | null; error: unknown }> {
  const { data, error } = await supabase
    .from('ordenes_compra')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as OrdenCompraLocal | null, error }
}

export async function addFechaPrometida(
  compraId: UUID,
  fecha: ISODate,
  tipo: ProveedorFechaHistorial['tipo'],
  motivo: string | undefined,
  userId: UUID,
): Promise<{ data: ProveedorFechaHistorial | null; error: unknown }> {
  const { data, error } = await supabase
    .from('proveedor_fecha_historial')
    .insert({
      compra_id: compraId,
      fecha_prometida: fecha,
      tipo,
      motivo: motivo ?? null,
      usuario_id: userId,
    })
    .select('*, usuario:profiles(*)')
    .single()

  return { data: data as ProveedorFechaHistorial | null, error }
}

export async function getFechasPrometidas(
  compraId: UUID,
): Promise<{ data: ProveedorFechaHistorial[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('proveedor_fecha_historial')
    .select('*, usuario:profiles(*)')
    .eq('compra_id', compraId)
    .order('created_at', { ascending: false })

  return { data: data as ProveedorFechaHistorial[] | null, error }
}
