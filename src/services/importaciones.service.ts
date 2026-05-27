import { supabase } from '@/lib/supabase'
import type {
  UUID,
  Importacion,
  EstadoImportacion,
  OrdenCompraImportacion,
  CostoImportacion,
  ImportacionFilters,
  PaginationParams,
} from '@/types'

export async function getParametrosLista(tipo: string): Promise<string[]> {
  const { data } = await supabase
    .from('parametros_lista')
    .select('valor')
    .eq('tipo', tipo)
    .eq('activo', true)
    .order('orden')
  return (data ?? []).map((r: { valor: string }) => r.valor)
}

interface CostoUnitarioResult {
  orden_compra_id: UUID
  item_oc: string
  codigo_comercial: string
  descripcion: string
  cantidad: number
  costo_unitario_usd: number
  costo_total_usd: number
}

export async function getImportaciones(
  filters: ImportacionFilters = {},
  pagination: PaginationParams = { page: 1, pageSize: 25 },
): Promise<{ data: Importacion[] | null; count: number; error: unknown }> {
  const from = (pagination.page - 1) * pagination.pageSize
  const to = from + pagination.pageSize - 1

  let query = supabase
    .from('importaciones')
    .select('*', { count: 'exact' })

  if (filters.status) query = query.eq('status', filters.status)
  if (filters.incoterm) query = query.eq('incoterm', filters.incoterm)
  if (filters.tipo_embarque) query = query.eq('tipo_embarque', filters.tipo_embarque)
  if (filters.search) query = query.ilike('grupo_importacion', `%${filters.search}%`)

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to)

  return { data: data as Importacion[] | null, count: count ?? 0, error }
}

export async function getImportacion(id: UUID): Promise<{
  data: (Importacion & {
    ordenes: OrdenCompraImportacion[]
    costos: CostoImportacion[]
    recepciones: unknown[]
  }) | null
  error: unknown
}> {
  const { data, error } = await supabase
    .from('importaciones')
    .select(`
      *,
      ordenes:ordenes_compra(
        *,
        operacion:operaciones(id, correlativo_opci, cliente:clientes!cliente_id(razon_social)),
        proveedor:proveedores(razon_social),
        items:orden_compra_items(*, producto:productos(codigo_comercial, descripcion, unidad_medida)),
        notas_lista:ordenes_compra_notas(*, usuario:profiles(nombre_completo))
      ),
      costos:importacion_costos(*),
      recepciones:recepciones(*)
    `)
    .eq('id', id)
    .single()

  return { data: data as ReturnType<typeof getImportacion> extends Promise<{ data: infer D }> ? D : never, error }
}

export async function createImportacion(
  payload: Omit<Importacion, 'id' | 'created_at' | 'updated_at'>,
  userId?: UUID,
): Promise<{ data: Importacion | null; error: unknown }> {
  const { data, error } = await supabase
    .from('importaciones')
    .insert(payload)
    .select('*')
    .single()

  if (!error && data) {
    const imp = data as Importacion
    await supabase.from('historial_eventos').insert({
      entidad_tipo: 'importacion',
      entidad_id: imp.id,
      usuario_id: userId ?? null,
      accion: 'Creación',
      valor_nuevo: imp.status,
    })
  }

  return { data: data as Importacion | null, error }
}

export async function updateImportacion(
  id: UUID,
  payload: Partial<Omit<Importacion, 'id' | 'created_at' | 'updated_at'>>,
): Promise<{ data: Importacion | null; error: unknown }> {
  const { data, error } = await supabase
    .from('importaciones')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  return { data: data as Importacion | null, error }
}

export async function getCostosImportacion(
  importacionId: UUID,
): Promise<{ data: CostoImportacion[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('importacion_costos')
    .select('*')
    .eq('importacion_id', importacionId)
    .order('fecha', { ascending: true })

  return { data: data as CostoImportacion[] | null, error }
}

export async function addCostoImportacion(
  payload: Omit<CostoImportacion, 'id' | 'created_at' | 'updated_at'>,
): Promise<{ data: CostoImportacion | null; error: unknown }> {
  const { data, error } = await supabase
    .from('importacion_costos')
    .insert(payload)
    .select('*')
    .single()

  return { data: data as CostoImportacion | null, error }
}

export async function calcularCostoUnitario(
  importacionId: UUID,
): Promise<{ data: CostoUnitarioResult[] | null; error: unknown }> {
  const { data: costos, error: costosError } = await supabase
    .from('importacion_costos')
    .select('*')
    .eq('importacion_id', importacionId)

  if (costosError) return { data: null, error: costosError }

  const { data: ociList, error: ociError } = await supabase
    .from('ordenes_compra_importacion')
    .select('*, items:ordenes_compra_importacion_items(*)')
    .eq('importacion_id', importacionId)

  if (ociError) return { data: null, error: ociError }

  type ItemRow = {
    orden_compra_id: UUID
    item_oc: string
    codigo_comercial: string
    descripcion: string
    cantidad: number
    monto_total: number
    tc_usd?: number
  }

  const allItems: ItemRow[] = (ociList as (OrdenCompraImportacion & { items: ItemRow[] })[]).flatMap(
    (oci) => oci.items ?? [],
  )

  const totalValorUSD = allItems.reduce((sum, item) => {
    const tc = item.tc_usd ?? 1
    return sum + item.monto_total * tc
  }, 0)

  const totalCostosUSD = (costos as CostoImportacion[]).reduce(
    (sum, c) => sum + c.monto_usd,
    0,
  )

  const results: CostoUnitarioResult[] = allItems.map((item) => {
    const tc = item.tc_usd ?? 1
    const valorItemUSD = item.monto_total * tc
    const proporcion = totalValorUSD > 0 ? valorItemUSD / totalValorUSD : 0
    const costoAsignado = totalCostosUSD * proporcion
    const costoTotalUSD = valorItemUSD + costoAsignado
    const costoUnitario = item.cantidad > 0 ? costoTotalUSD / item.cantidad : 0

    return {
      orden_compra_id: item.orden_compra_id,
      item_oc: item.item_oc,
      codigo_comercial: item.codigo_comercial,
      descripcion: item.descripcion,
      cantidad: item.cantidad,
      costo_unitario_usd: Math.round(costoUnitario * 100000) / 100000,
      costo_total_usd: Math.round(costoTotalUSD * 100) / 100,
    }
  })

  return { data: results, error: null }
}

export async function cerrarImportacion(
  id: UUID,
  userId: UUID,
): Promise<{ data: Importacion | null; error: unknown }> {
  const { data: importacion, error: fetchError } = await supabase
    .from('importaciones')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) return { data: null, error: fetchError }

  const current = (importacion as { status: EstadoImportacion }).status
  const allowedToClose: EstadoImportacion[] = ['Costeada', 'Recibida en almacén', 'Nacionalizada']

  if (!allowedToClose.includes(current)) {
    return {
      data: null,
      error: new Error(
        `No se puede cerrar una importación en estado "${current}". Estado requerido: ${allowedToClose.join(', ')}.`,
      ),
    }
  }

  const { data: costos } = await supabase
    .from('importacion_costos')
    .select('id')
    .eq('importacion_id', id)
    .limit(1)

  if (!costos || costos.length === 0) {
    return { data: null, error: new Error('La importación no tiene costos registrados. Ingrese al menos un costo antes de cerrar.') }
  }

  const { data, error } = await supabase
    .from('importaciones')
    .update({ status: 'Cerrada' as EstadoImportacion, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()

  if (error) return { data: null, error }

  await supabase.from('historial_eventos').insert({
    entidad_tipo: 'importacion',
    entidad_id: id,
    usuario_id: userId,
    accion: 'Cierre',
    valor_anterior: current,
    valor_nuevo: 'Cerrada',
  })

  return { data: data as Importacion | null, error: null }
}
