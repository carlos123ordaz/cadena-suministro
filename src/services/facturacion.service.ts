import { supabase } from '@/lib/supabase'
import type {
  UUID,
  FacturaVenta,
  PagoFactura,
  EstadoFactura,
  FacturaFilters,
  PaginationParams,
} from '@/types'

export async function getFacturas(
  filters: FacturaFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 25 },
): Promise<{ data: FacturaVenta[] | null; count: number; error: unknown }> {
  const from = (pagination.page - 1) * pagination.pageSize
  const to = from + pagination.pageSize - 1

  let query = supabase
    .from('facturas_venta')
    .select('*, operacion:operaciones(correlativo_opci, cliente:clientes!cliente_id(razon_social))', { count: 'exact' })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.fecha_desde) query = query.gte('fecha_emision', filters.fecha_desde)
  if (filters.fecha_hasta) query = query.lte('fecha_emision', filters.fecha_hasta)
  if (filters.vencidas) {
    const today = new Date().toISOString().split('T')[0]
    query = query
      .lt('fecha_prometida_pago', today)
      .not('status', 'in', '("Pagada total","Anulada")')
  }
  if (filters.search) {
    query = query.ilike('num_factura', `%${filters.search}%`)
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  return { data: data as FacturaVenta[] | null, count: count ?? 0, error }
}

export async function getFactura(
  id: UUID,
): Promise<{ data: (FacturaVenta & { pagos: PagoFactura[] }) | null; error: unknown }> {
  const { data, error } = await supabase
    .from('facturas_venta')
    .select(`
      *,
      operacion:operaciones(*, cliente:clientes!cliente_id(*)),
      pagos:pagos_factura(*)
    `)
    .eq('id', id)
    .single()

  return { data: data as (FacturaVenta & { pagos: PagoFactura[] }) | null, error }
}

export async function createFactura(
  payload: Omit<FacturaVenta, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ data: FacturaVenta | null; error: unknown }> {
  const { data, error } = await supabase
    .from('facturas_venta')
    .insert(payload)
    .select('*')
    .single()

  return { data: data as FacturaVenta | null, error }
}

export async function registrarPago(
  facturaId: UUID,
  pago: Omit<PagoFactura, 'id' | 'factura_id' | 'created_at'>,
): Promise<{ data: PagoFactura | null; error: unknown }> {
  const { data: pagoData, error: pagoError } = await supabase
    .from('pagos_factura')
    .insert({ ...pago, factura_id: facturaId })
    .select('*')
    .single()

  if (pagoError) return { data: null, error: pagoError }

  const { data: allPagos } = await supabase
    .from('pagos_factura')
    .select('monto')
    .eq('factura_id', facturaId)

  const { data: factura } = await supabase
    .from('facturas_venta')
    .select('monto_total_sin_igv, factor_igv')
    .eq('id', facturaId)
    .single()

  if (factura && allPagos) {
    const igv = (factura as FacturaVenta).factor_igv ?? 1.18
    const totalConIgv = (factura as FacturaVenta).monto_total_sin_igv * igv
    const totalPagado = (allPagos as { monto: number }[]).reduce((sum, p) => sum + p.monto, 0)

    let nuevoStatus: EstadoFactura = 'Pendiente de pago'
    if (totalPagado >= totalConIgv) {
      nuevoStatus = 'Pagada total'
    } else if (totalPagado > 0) {
      nuevoStatus = 'Pagada parcial'
    }

    await supabase
      .from('facturas_venta')
      .update({ status: nuevoStatus, updated_at: new Date().toISOString() })
      .eq('id', facturaId)
  }

  return { data: pagoData as PagoFactura | null, error: null }
}

export async function marcarVencidas(): Promise<{ count: number; error: unknown }> {
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('facturas_venta')
    .update({ status: 'Vencida' as EstadoFactura, updated_at: new Date().toISOString() })
    .lt('fecha_prometida_pago', today)
    .not('status', 'in', '("Pagada total","Anulada","Vencida")')
    .select('id')

  return { count: data?.length ?? 0, error }
}

export async function getCobranzaPendiente(): Promise<{ data: FacturaVenta[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('facturas_venta')
    .select('*, operacion:operaciones(correlativo_opci, cliente:clientes!cliente_id(razon_social))')
    .not('status', 'in', '("Pagada total","Anulada")')
    .not('fecha_prometida_pago', 'is', null)
    .order('fecha_prometida_pago', { ascending: true })

  return { data: data as FacturaVenta[] | null, error }
}

export async function cambiarEstadoFactura(
  facturaId: UUID,
  nuevoStatus: EstadoFactura,
  userId?: UUID,
  statusAnterior?: string,
): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('facturas_venta')
    .update({ status: nuevoStatus })
    .eq('id', facturaId)
  if (!error) {
    await supabase.from('historial_eventos').insert({
      entidad_tipo: 'factura',
      entidad_id: facturaId,
      usuario_id: userId ?? null,
      accion: 'Cambio de estado',
      valor_anterior: statusAnterior ?? null,
      valor_nuevo: nuevoStatus,
    })
  }
  return { error }
}
