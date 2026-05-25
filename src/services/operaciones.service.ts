import { supabase } from '@/lib/supabase'
import type {
  UUID,
  Operacion,
  OperacionItem,
  EstadoOPCI,
  OperacionFilters,
  PaginationParams,
  SortParams,
  DashboardStats,
} from '@/types'

const ALLOWED_TRANSITIONS: Partial<Record<EstadoOPCI, EstadoOPCI[]>> = {
  Borrador: ['Recibida', 'Anulada'],
  Recibida: ['En evaluación', 'Observada', 'Anulada'],
  'En evaluación': ['En compra local', 'En importación', 'Observada', 'Anulada'],
  'En compra local': ['Pendiente de recepción', 'Observada', 'Anulada'],
  'En importación': ['Pendiente de recepción', 'Observada', 'Anulada'],
  'Pendiente de recepción': ['Pendiente de facturación', 'Observada'],
  'Pendiente de facturación': ['Facturada', 'Observada'],
  Facturada: ['Pendiente de despacho', 'Pendiente de cobranza'],
  'Pendiente de despacho': ['Despachada', 'Observada'],
  Despachada: ['Pendiente de cobranza', 'Cerrada'],
  'Pendiente de cobranza': ['Cerrada'],
  Observada: ['En evaluación', 'En compra local', 'En importación', 'Anulada'],
}

export async function getOperaciones(
  filters: OperacionFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 25 },
  sort: SortParams = { field: 'created_at', direction: 'desc' },
): Promise<{ data: Operacion[] | null; count: number; error: unknown }> {
  const from = (pagination.page - 1) * pagination.pageSize
  const to = from + pagination.pageSize - 1

  let query = supabase
    .from('operaciones')
    .select(
      '*, cliente:clientes!cliente_id(*), vendedor1:profiles!operaciones_vendedor1_id_fkey(*), lider:profiles!operaciones_lider_id_fkey(*)',
      { count: 'exact' },
    )

  if (filters.estado) query = query.eq('estado', filters.estado)
  if (filters.cliente_id) query = query.eq('cliente_id', filters.cliente_id)
  if (filters.vendedor1_id) query = query.eq('vendedor1_id', filters.vendedor1_id)
  if (filters.fecha_desde) query = query.gte('fecha_recepcion', filters.fecha_desde)
  if (filters.fecha_hasta) query = query.lte('fecha_recepcion', filters.fecha_hasta)
  if (filters.search) {
    query = query.or(
      `correlativo_opci.ilike.%${filters.search}%,numero_op.ilike.%${filters.search}%,numero_referencia_cliente.ilike.%${filters.search}%`,
    )
  }

  const { data, error, count } = await query
    .order(sort.field, { ascending: sort.direction === 'asc' })
    .range(from, to)

  return { data: data as Operacion[] | null, count: count ?? 0, error }
}

export async function getOperacion(id: UUID): Promise<{
  data: (Operacion & {
    items: OperacionItem[]
    facturas: unknown[]
    recepciones: unknown[]
    despachos: unknown[]
    guias: unknown[]
  }) | null
  error: unknown
}> {
  const { data, error } = await supabase
    .from('operaciones')
    .select(`
      *,
      cliente:clientes!cliente_id(*),
      cliente_final:clientes!cliente_final_id(*),
      vendedor1:profiles!vendedor1_id(*),
      vendedor2:profiles!vendedor2_id(*),
      lider:profiles!lider_id(*),
      items:operacion_items(*, producto:productos(codigo_comercial, descripcion, unidad_medida, marca)),
      facturas:facturas_venta(*),
      recepciones:recepciones(*),
      despachos:despachos(*),
      guias:guias_remision(*)
    `)
    .eq('id', id)
    .single()

  return { data: data as ReturnType<typeof getOperacion> extends Promise<{ data: infer D }> ? D : never, error }
}

export async function createOperacion(
  payload: Omit<Operacion, 'id' | 'created_at' | 'updated_at'> & { items?: Omit<OperacionItem, 'id' | 'operacion_id' | 'created_at' | 'updated_at'>[] },
): Promise<{ data: Operacion | null; error: unknown }> {
  const { items, ...operacionPayload } = payload

  const { data: operacion, error: opError } = await supabase
    .from('operaciones')
    .insert(operacionPayload)
    .select('*')
    .single()

  if (opError) return { data: null, error: opError }

  const op = operacion as Operacion

  if (items && items.length > 0) {
    const { error: itemsError } = await supabase
      .from('operacion_items')
      .insert(items.map((item) => ({ ...item, operacion_id: op.id })))

    if (itemsError) return { data: null, error: itemsError }
  }

  await supabase.from('historial_eventos').insert({
    entidad_tipo: 'operacion',
    entidad_id: op.id,
    usuario_id: (operacionPayload as { lider_id?: UUID }).lider_id ?? null,
    accion: 'Creación',
    valor_nuevo: op.estado,
  })

  return { data: op, error: null }
}

export async function updateOperacion(
  id: UUID,
  payload: Partial<Omit<Operacion, 'id' | 'created_at' | 'updated_at'>>,
  userId?: UUID,
): Promise<{ data: Operacion | null; error: unknown }> {
  const { data: current, error: fetchError } = await supabase
    .from('operaciones')
    .select('estado')
    .eq('id', id)
    .single()

  if (fetchError) return { data: null, error: fetchError }

  const { data, error } = await supabase
    .from('operaciones')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { data: null, error }

  const prev = (current as { estado: EstadoOPCI }).estado
  const next = (data as Operacion).estado

  if (payload.estado && prev !== next && userId) {
    await supabase.from('historial_eventos').insert({
      entidad_tipo: 'operacion',
      entidad_id: id,
      usuario_id: userId,
      accion: 'Cambio de estado',
      valor_anterior: prev,
      valor_nuevo: next,
    })
  }

  return { data: data as Operacion | null, error: null }
}

export async function cambiarEstadoOperacion(
  id: UUID,
  nuevoEstado: EstadoOPCI,
  comentario?: string,
  userId?: UUID,
): Promise<{ data: Operacion | null; error: unknown }> {
  const { data: current, error: fetchError } = await supabase
    .from('operaciones')
    .select('estado')
    .eq('id', id)
    .single()

  if (fetchError) return { data: null, error: fetchError }

  const estadoActual = (current as { estado: EstadoOPCI }).estado
  const permitidos = ALLOWED_TRANSITIONS[estadoActual] ?? []

  if (!permitidos.includes(nuevoEstado)) {
    return {
      data: null,
      error: new Error(
        `Transición no permitida: "${estadoActual}" → "${nuevoEstado}". Transiciones válidas: ${permitidos.join(', ') || 'ninguna'}.`,
      ),
    }
  }

  const { data, error } = await supabase
    .from('operaciones')
    .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { data: null, error }

  await supabase.from('historial_eventos').insert({
    entidad_tipo: 'operacion',
    entidad_id: id,
    usuario_id: userId ?? null,
    accion: 'Cambio de estado',
    valor_anterior: estadoActual,
    valor_nuevo: nuevoEstado,
    comentario: comentario ?? null,
  })

  return { data: data as Operacion | null, error: null }
}

export async function getDashboardStats(): Promise<{ data: DashboardStats | null; error: unknown }> {
  const today = new Date().toISOString().split('T')[0]
  const etaWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [
    { count: operaciones_activas },
    { count: importaciones_en_transito },
    { count: importaciones_en_aduanas },
    { count: importaciones_pendientes_costeo },
    { count: facturas_vencidas },
    { count: pedidos_pendientes_despacho },
    { count: productos_pendientes_recepcion },
    { count: alertas_eta_proxima },
  ] = await Promise.all([
    supabase
      .from('operaciones')
      .select('*', { count: 'exact', head: true })
      .not('estado', 'in', '("Cerrada","Anulada")'),
    supabase
      .from('importaciones')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'En tránsito'),
    supabase
      .from('importaciones')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'En aduanas'),
    supabase
      .from('importaciones')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Recibida en almacén'),
    supabase
      .from('facturas_venta')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Vencida'),
    supabase
      .from('despachos')
      .select('*', { count: 'exact', head: true })
      .eq('estado', 'Preparando'),
    supabase
      .from('recepciones')
      .select('*', { count: 'exact', head: true })
      .in('estado', ['Pendiente', 'Recibido parcial']),
    supabase
      .from('importaciones')
      .select('*', { count: 'exact', head: true })
      .gte('eta', today)
      .lte('eta', etaWindow)
      .not('status', 'in', '("Cerrada","Anulada","Recibida en almacén")'),
  ])

  const stats: DashboardStats = {
    operaciones_activas: operaciones_activas ?? 0,
    importaciones_en_transito: importaciones_en_transito ?? 0,
    importaciones_en_aduanas: importaciones_en_aduanas ?? 0,
    importaciones_pendientes_costeo: importaciones_pendientes_costeo ?? 0,
    facturas_vencidas: facturas_vencidas ?? 0,
    pedidos_pendientes_despacho: pedidos_pendientes_despacho ?? 0,
    productos_pendientes_recepcion: productos_pendientes_recepcion ?? 0,
    alertas_eta_proxima: alertas_eta_proxima ?? 0,
  }

  return { data: stats, error: null }
}

export async function getRecentOperaciones(
  limit = 10,
): Promise<{ data: Operacion[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('operaciones')
    .select('*, cliente:clientes!cliente_id(razon_social)')
    .order('updated_at', { ascending: false })
    .limit(limit)

  return { data: data as Operacion[] | null, error }
}
