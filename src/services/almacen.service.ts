import { supabase } from '@/lib/supabase'
import type {
  UUID,
  Recepcion,
  Despacho,
  AlmacenMovimiento,
  TipoMovimientoAlmacen,
} from '@/types'

interface RecepcionFilters {
  operacion_id?: UUID
  importacion_id?: UUID
  almacen_id?: UUID
  estado?: Recepcion['estado']
}

interface DespachoFilters {
  operacion_id?: UUID
  almacen_id?: UUID
  estado?: Despacho['estado']
}

export async function getAlmacenes(): Promise<{
  data: { id: string; nombre: string; codigo: string }[] | null
  error: unknown
}> {
  const { data, error } = await supabase
    .from('almacenes')
    .select('id, nombre, codigo')
    .eq('activo', true)
    .order('nombre')
  return { data: data as { id: string; nombre: string; codigo: string }[] | null, error }
}

export async function getRecepciones(
  filters: RecepcionFilters = {},
): Promise<{ data: Recepcion[] | null; error: unknown }> {
  let query = supabase
    .from('recepciones')
    .select('*, operacion:operaciones(correlativo_opci)')

  if (filters.operacion_id) query = query.eq('operacion_id', filters.operacion_id)
  if (filters.importacion_id) query = query.eq('importacion_id', filters.importacion_id)
  if (filters.almacen_id) query = query.eq('almacen_id', filters.almacen_id)
  if (filters.estado) query = query.eq('estado', filters.estado)

  const { data, error } = await query.order('created_at', { ascending: false })
  return { data: data as Recepcion[] | null, error }
}

export async function registrarRecepcion(
  payload: Omit<Recepcion, 'id' | 'created_at' | 'updated_at'>,
  userId: UUID,
): Promise<{ data: Recepcion | null; error: unknown }> {
  const { data: recepcion, error: recepcionError } = await supabase
    .from('recepciones')
    .insert({ ...payload, usuario_id: userId })
    .select('*')
    .single()

  if (recepcionError) return { data: null, error: recepcionError }

  const rec = recepcion as Recepcion

  const { data: stockRow } = await supabase
    .from('almacen_stock')
    .select('cantidad')
    .eq('almacen_id', rec.almacen_id)
    .eq('producto_codigo', rec.codigo_comercial)
    .maybeSingle()

  const stockAnterior = (stockRow as { cantidad: number } | null)?.cantidad ?? 0
  const stockFinal = stockAnterior + rec.cantidad_recibida

  await supabase.from('almacen_movimientos').insert({
    almacen_id: rec.almacen_id,
    producto_codigo: rec.codigo_comercial,
    tipo: 'entrada' as TipoMovimientoAlmacen,
    cantidad: rec.cantidad_recibida,
    stock_anterior: stockAnterior,
    stock_final: stockFinal,
    documento_referencia: rec.num_oc ?? rec.id,
    documento_tipo: 'recepcion',
    operacion_id: rec.operacion_id ?? null,
    recepcion_id: rec.id,
    usuario_id: userId,
  })

  await supabase
    .from('almacen_stock')
    .upsert(
      { almacen_id: rec.almacen_id, producto_codigo: rec.codigo_comercial, cantidad: stockFinal },
      { onConflict: 'almacen_id,producto_codigo' },
    )

  await supabase.from('historial_eventos').insert({
    entidad_tipo: 'recepcion',
    entidad_id: rec.id,
    usuario_id: userId,
    accion: 'Recepción registrada',
    valor_nuevo: `${rec.codigo_comercial} × ${rec.cantidad_recibida} ${rec.unidad_medida ?? ''}`.trim(),
  })

  return { data: rec, error: null }
}

export async function getDespachos(
  filters: DespachoFilters = {},
): Promise<{ data: Despacho[] | null; error: unknown }> {
  let query = supabase
    .from('despachos')
    .select('*, operacion:operaciones(correlativo_opci, cliente:clientes!cliente_id(razon_social))')

  if (filters.operacion_id) query = query.eq('operacion_id', filters.operacion_id)
  if (filters.almacen_id) query = query.eq('almacen_id', filters.almacen_id)
  if (filters.estado) query = query.eq('estado', filters.estado)

  const { data, error } = await query.order('created_at', { ascending: false })
  return { data: data as Despacho[] | null, error }
}

export async function registrarDespacho(
  payload: Omit<Despacho, 'id' | 'created_at' | 'updated_at'>,
  userId: UUID,
): Promise<{ data: Despacho | null; error: unknown }> {
  const { data: despacho, error: despachoError } = await supabase
    .from('despachos')
    .insert({ ...payload, usuario_id: userId })
    .select('*')
    .single()

  if (despachoError) return { data: null, error: despachoError }

  const des = despacho as Despacho

  const { data: stockRow } = await supabase
    .from('almacen_stock')
    .select('cantidad')
    .eq('almacen_id', des.almacen_id)
    .eq('producto_codigo', des.codigo_comercial)
    .maybeSingle()

  const stockAnterior = (stockRow as { cantidad: number } | null)?.cantidad ?? 0
  const stockFinal = Math.max(0, stockAnterior - des.cantidad)

  await supabase.from('almacen_movimientos').insert({
    almacen_id: des.almacen_id,
    producto_codigo: des.codigo_comercial,
    tipo: 'salida' as TipoMovimientoAlmacen,
    cantidad: des.cantidad,
    stock_anterior: stockAnterior,
    stock_final: stockFinal,
    documento_referencia: des.id,
    documento_tipo: 'despacho',
    operacion_id: des.operacion_id,
    despacho_id: des.id,
    usuario_id: userId,
  })

  await supabase
    .from('almacen_stock')
    .upsert(
      { almacen_id: des.almacen_id, producto_codigo: des.codigo_comercial, cantidad: stockFinal },
      { onConflict: 'almacen_id,producto_codigo' },
    )

  await supabase.from('historial_eventos').insert({
    entidad_tipo: 'despacho',
    entidad_id: des.id,
    usuario_id: userId,
    accion: 'Despacho registrado',
    valor_nuevo: `${des.codigo_comercial} × ${des.cantidad} ${des.unidad_medida ?? ''}`.trim(),
  })

  return { data: des, error: null }
}

export async function getKardex(
  productoCodigo?: string,
  almacenId?: UUID,
): Promise<{ data: AlmacenMovimiento[] | null; error: unknown }> {
  let query = supabase
    .from('almacen_movimientos')
    .select('*')

  if (productoCodigo) query = query.eq('producto_codigo', productoCodigo)
  if (almacenId) query = query.eq('almacen_id', almacenId)

  const { data, error } = await query.order('created_at', { ascending: false })
  return { data: data as AlmacenMovimiento[] | null, error }
}

export async function getStock(almacenId?: UUID): Promise<{
  data: { almacen_id: UUID; producto_codigo: string; cantidad: number; stock_actual: number; descripcion: string; unidad_medida: string }[] | null
  error: unknown
}> {
  let query = supabase.from('almacen_stock').select('*')
  if (almacenId) query = query.eq('almacen_id', almacenId)

  const { data, error } = await query.order('producto_codigo', { ascending: true })
  if (!data || data.length === 0) return { data: [], error }

  const codigos = [...new Set((data as { producto_codigo: string }[]).map(s => s.producto_codigo))]
  const { data: productos } = await supabase
    .from('productos')
    .select('codigo_comercial, descripcion, unidad_medida')
    .in('codigo_comercial', codigos)

  const prodMap = Object.fromEntries(
    ((productos ?? []) as { codigo_comercial: string; descripcion: string; unidad_medida: string }[])
      .map(p => [p.codigo_comercial, p]),
  )

  const enriched = (data as { almacen_id: UUID; producto_codigo: string; cantidad: number }[]).map(s => ({
    ...s,
    stock_actual: s.cantidad,
    descripcion: prodMap[s.producto_codigo]?.descripcion ?? '—',
    unidad_medida: prodMap[s.producto_codigo]?.unidad_medida ?? '—',
  }))

  return { data: enriched, error }
}

export async function getDespachosPendientes(): Promise<{ data: Despacho[] | null; error: unknown }> {
  const { data, error } = await supabase
    .from('despachos')
    .select('*, operacion:operaciones(correlativo_opci, cliente:clientes!cliente_id(razon_social))')
    .eq('estado', 'Preparando')
    .order('created_at', { ascending: true })

  return { data: data as Despacho[] | null, error }
}
