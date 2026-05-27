import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Icon, Card, DataTable, StatusBadge, OPCI_STATUS_TONE, OCL_STATUS_TONE,
  OCI_STATUS_TONE, FACTURA_STATUS_TONE, RECEPCION_STATUS_TONE,
  DESPACHO_STATUS_TONE, EtaCell, Tabs, Timeline, MetaGrid, Modal, Badge,
  UploadDocumentoModal,
} from '@/components/ui'
import type { Column } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { getOperacion, cambiarEstadoOperacion } from '@/services/operaciones.service'
import { getParametrosLista } from '@/services/configuracion.service'
import { addComentario, getComentarios, getHistorial } from '@/services/historial.service'
import { getDocumentos } from '@/services/documentos.service'
import { useAuth } from '@/context/AuthContext'
import { fmtDate, fmtDateTime, money, initials, fmtDbError } from '@/lib/utils'
import type {
  Operacion, OperacionItem, OrdenCompraLocal, OrdenCompraImportacion,
  FacturaVenta, Recepcion, Despacho, GuiaRemision, HistorialEvento,
  Comentario, DocumentoAdjunto, EstadoOPCI, EstadoItem, Producto,
  TipoNegocio, SubTipoNegocio, SubTipoNegocio2,
} from '@/types'

const UNIDADES_MEDIDA_DEFAULT = ['UND', 'KG', 'M', 'M2', 'M3', 'L', 'GLN', 'PAR', 'SET', 'CAJA', 'ROLLO', 'HRS', 'TON', 'PZA']

const TABS = [
  { id: 'resumen',   label: 'Resumen' },
  { id: 'items',     label: 'Ítems' },
  { id: 'ocl',       label: 'Compras Locales' },
  { id: 'oci',       label: 'Importaciones' },
  { id: 'facturas',  label: 'Facturación' },
  { id: 'almacen',   label: 'Almacén' },
  { id: 'guias',     label: 'Guías / Despachos' },
  { id: 'docs',      label: 'Documentos' },
  { id: 'historial', label: 'Historial' },
  { id: 'notas',     label: 'Comentarios' },
]

const NEXT_STATES: Partial<Record<EstadoOPCI, EstadoOPCI[]>> = {
  Borrador: ['Recibida', 'Anulada'],
  Recibida: ['En evaluación', 'Observada', 'Anulada'],
  'En evaluación': ['En compra local', 'En importación', 'Observada', 'Anulada'],
  'En compra local': ['Pendiente de recepción', 'Observada', 'Anulada'],
  'En importación': ['Pendiente de recepción', 'Observada', 'Anulada'],
  'Pendiente de recepción': ['Pendiente de facturación', 'Observada'],
  'Pendiente de facturación': ['Facturada'],
  Facturada: ['Pendiente de despacho', 'Pendiente de cobranza'],
  'Pendiente de despacho': ['Despachada'],
  Despachada: ['Pendiente de cobranza', 'Cerrada'],
  'Pendiente de cobranza': ['Cerrada'],
  Observada: ['En evaluación', 'En compra local', 'En importación', 'Anulada'],
}

interface FullOperacion extends Operacion {
  items?: OperacionItem[]
  ordenes_locales?: OrdenCompraLocal[]
  ordenes_importacion?: OrdenCompraImportacion[]
  facturas?: FacturaVenta[]
  recepciones?: Recepcion[]
  despachos?: Despacho[]
  guias?: GuiaRemision[]
  historial?: HistorialEvento[]
}

export function OperacionDetail() {
  const { id: operacionId = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [op, setOp] = useState<FullOperacion | null>(null)
  const [historial, setHistorial] = useState<HistorialEvento[]>([])
  const [comentarios, setComentarios] = useState<Comentario[]>([])
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([])
  const [docsRelacionados, setDocsRelacionados] = useState<(DocumentoAdjunto & { _fuente: string })[]>([])
  const [compraItems, setCompraItems] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('resumen')
  const [unidadesMedida, setUnidadesMedida] = useState<string[]>(UNIDADES_MEDIDA_DEFAULT)

  const [showUpload, setShowUpload] = useState(false)

  // ── Edit encabezado ────────────────────────────────────────────────
  const [showEditOp, setShowEditOp] = useState(false)
  const [editOpForm, setEditOpForm] = useState({
    fecha_recepcion: '', fecha_inicio: '', fecha_procesamiento_vi: '',
    cliente_id: '', cliente_final_id: '', cliente_proveedor: '',
    numero_op: '', numero_referencia_cliente: '',
    moneda: 'USD', monto_total_sin_igv: '', u_bruta_coti: '',
    forma_pago: '', comision_compartida: '',
    vendedor1_id: '', vendedor2_id: '', lider_id: '',
  })
  const [savingEditOp, setSavingEditOp] = useState(false)
  const [editOpError, setEditOpError] = useState<string | null>(null)
  const [clientes, setClientes] = useState<{ id: string; razon_social: string; ruc?: string; ciudad?: string }[]>([])
  const [vendedores, setVendedores] = useState<{ id: string; nombre_completo: string }[]>([])
  const [proveedores, setProveedores] = useState<{ id: string; razon_social: string; pais?: string; ruc_nro_doc?: string }[]>([])
  // combo search strings
  const [editClienteSearch, setEditClienteSearch] = useState('')
  const [showEditClienteDrop, setShowEditClienteDrop] = useState(false)
  const [editClienteFinalSearch, setEditClienteFinalSearch] = useState('')
  const [showEditClienteFinalDrop, setShowEditClienteFinalDrop] = useState(false)
  const [showEditClienteProvDrop, setShowEditClienteProvDrop] = useState(false)
  const [editVend1Search, setEditVend1Search] = useState('')
  const [showEditVend1Drop, setShowEditVend1Drop] = useState(false)
  const [editVend2Search, setEditVend2Search] = useState('')
  const [showEditVend2Drop, setShowEditVend2Drop] = useState(false)
  const [editLiderSearch, setEditLiderSearch] = useState('')
  const [showEditLiderDrop, setShowEditLiderDrop] = useState(false)
  const editClienteRef = useRef<HTMLDivElement>(null)
  const editClienteFinalRef = useRef<HTMLDivElement>(null)
  const editClienteProvRef = useRef<HTMLDivElement>(null)
  const editVend1Ref = useRef<HTMLDivElement>(null)
  const editVend2Ref = useRef<HTMLDivElement>(null)
  const editLiderRef = useRef<HTMLDivElement>(null)

  const [showEstado, setShowEstado] = useState(false)
  const [nuevoEstado, setNuevoEstado] = useState<EstadoOPCI | ''>('')
  const [comentEstado, setComentEstado] = useState('')
  const [savingEstado, setSavingEstado] = useState(false)

  const [nuevoComentario, setNuevoComentario] = useState('')
  const [savingComent, setSavingComent] = useState(false)

  const [showAddItem, setShowAddItem] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [itemError, setItemError] = useState<string | null>(null)
  const [itemForm, setItemForm] = useState({
    item_op: '',
    producto_id: '',
    producto_tipo: '',
    codigo_comercial: '',
    descripcion: '',
    cantidad: '',
    unidad_medida: '',
    moneda: 'USD',
    precio_unitario: '',
    tc_usd: '',
    tipo_negocio: '' as TipoNegocio | '',
    sub_tipo_negocio: '' as SubTipoNegocio | '',
    sub_tipo_negocio_2: '' as SubTipoNegocio2 | '',
    fecha_req_cliente: '',
    requiere_armado: false,
    codigo_cliente: '',
    num_deal: '',
    centro_costo: '',
    subcentro_costo: '',
    sub_sub_centro_costo: '',
    t_e_semanas: '',
    numero_servicio: '',
    numero_proyecto: '',
    precio_total_estimado: '',
  })
  const [itemNotas, setItemNotas] = useState<string[]>([])
  const [itemNotaInput, setItemNotaInput] = useState('')
  const [tipoProdFiltro, setTipoProdFiltro] = useState<'Producto' | 'Servicio' | 'Proyecto' | ''>('')
  const [productosSearch, setProductosSearch] = useState('')
  const [productosSugeridos, setProductosSugeridos] = useState<Producto[]>([])
  const [showProductosDrop, setShowProductosDrop] = useState(false)
  const productoDropRef = useRef<HTMLDivElement>(null)
  const [umSearch, setUmSearch] = useState('')
  const [showUmDrop, setShowUmDrop] = useState(false)
  const umRef = useRef<HTMLDivElement>(null)
  const umSelectedRef = useRef('')

  const [editItemRow, setEditItemRow] = useState<OperacionItem | null>(null)
  const [editItemForm, setEditItemForm] = useState({
    item_op: '', descripcion: '', cantidad: '', unidad_medida: '', moneda: 'USD',
    precio_unitario: '', tc_usd: '', estado: '' as EstadoItem | '',
    tipo_negocio: '' as TipoNegocio | '', sub_tipo_negocio: '' as SubTipoNegocio | '',
    sub_tipo_negocio_2: '' as SubTipoNegocio2 | '',
    fecha_req_cliente: '', requiere_armado: false,
    codigo_cliente: '', num_deal: '', centro_costo: '', subcentro_costo: '', sub_sub_centro_costo: '',
    t_e_semanas: '', numero_servicio: '', numero_proyecto: '', precio_total_estimado: '',
  })
  const [savingEditItem, setSavingEditItem] = useState(false)
  const [editItemError, setEditItemError] = useState<string | null>(null)
  const [deleteItemRow, setDeleteItemRow] = useState<OperacionItem | null>(null)
  const [deletingItem, setDeletingItem] = useState(false)
  const [deleteItemError, setDeleteItemError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [opRes, histRes, comRes, docRes, ciRes] = await Promise.all([
      getOperacion(operacionId),
      getHistorial('operacion', operacionId),
      getComentarios('operacion', operacionId),
      getDocumentos('operacion', operacionId),
      supabase
        .from('orden_compra_items')
        .select(`
          id, item_oc, item_op, codigo_comercial, descripcion, cantidad, unidad_medida, pcu1, monto_total, moneda,
          orden_compra:ordenes_compra(id, num_oc, tipo, status, proveedor:proveedores(razon_social), importacion:importaciones(id, grupo_importacion))
        `)
        .eq('operacion_id', operacionId)
        .order('created_at'),
    ])
    setOp(opRes.data as FullOperacion | null)
    setHistorial(histRes.data ?? [])
    setComentarios(comRes.data ?? [])
    setDocumentos(docRes.data ?? [])
    setCompraItems((ciRes.data ?? []) as Record<string, unknown>[])

    type RawOci = { id: string; num_oc: string; importacion?: { id: string; grupo_importacion: string } | Array<{ id: string; grupo_importacion: string }> | null }
    const getRawOci = (item: unknown): RawOci | null => {
      const oc = (item as Record<string, unknown>).orden_compra
      if (!oc) return null
      return (Array.isArray(oc) ? oc[0] : oc) as RawOci
    }
    const getRawImp = (oci: RawOci): { id: string; grupo_importacion: string } | null => {
      if (!oci.importacion) return null
      return Array.isArray(oci.importacion) ? oci.importacion[0] : oci.importacion
    }
    const ciRows = (ciRes.data ?? []) as unknown[]
    const ociIds = [...new Set(ciRows.map(i => getRawOci(i)?.id).filter((x): x is string => !!x))]
    const impIds = [...new Set(ciRows.map(i => { const oc = getRawOci(i); return oc ? getRawImp(oc)?.id : undefined }).filter((x): x is string => !!x))]
    const ociMap: Record<string, string> = {}
    const impMap: Record<string, string> = {}
    for (const row of ciRows) {
      const oc = getRawOci(row)
      if (oc) { ociMap[oc.id] = oc.num_oc; const imp = getRawImp(oc); if (imp) impMap[imp.id] = imp.grupo_importacion }
    }
    const [docsOciRes, docsImpRes] = await Promise.all([
      ociIds.length > 0
        ? supabase.from('documentos_adjuntos').select('*, usuario:profiles(*)').eq('entidad_tipo', 'orden_compra_importacion').in('entidad_id', ociIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      impIds.length > 0
        ? supabase.from('documentos_adjuntos').select('*, usuario:profiles(*)').eq('entidad_tipo', 'importacion').in('entidad_id', impIds).order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ])
    setDocsRelacionados([
      ...((docsOciRes.data ?? []) as DocumentoAdjunto[]).map(d => ({ ...d, _fuente: `OCI ${ociMap[d.entidad_id] ?? ''}`.trim() })),
      ...((docsImpRes.data ?? []) as DocumentoAdjunto[]).map(d => ({ ...d, _fuente: `Importación ${impMap[d.entidad_id] ?? ''}`.trim() })),
    ])

    setLoading(false)
  }, [operacionId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getParametrosLista('unidad_medida').then(vals => {
      if (vals.length > 0) setUnidadesMedida(vals)
    })
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (umRef.current && !umRef.current.contains(e.target as Node)) {
        setShowUmDrop(false)
        setUmSearch(umSelectedRef.current)
      }
      if (editClienteRef.current && !editClienteRef.current.contains(e.target as Node)) setShowEditClienteDrop(false)
      if (editClienteFinalRef.current && !editClienteFinalRef.current.contains(e.target as Node)) setShowEditClienteFinalDrop(false)
      if (editClienteProvRef.current && !editClienteProvRef.current.contains(e.target as Node)) setShowEditClienteProvDrop(false)
      if (editVend1Ref.current && !editVend1Ref.current.contains(e.target as Node)) setShowEditVend1Drop(false)
      if (editVend2Ref.current && !editVend2Ref.current.contains(e.target as Node)) setShowEditVend2Drop(false)
      if (editLiderRef.current && !editLiderRef.current.contains(e.target as Node)) setShowEditLiderDrop(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!showEditOp || !op) return
    setEditOpError(null)
    setEditOpForm({
      fecha_recepcion: op.fecha_recepcion ?? '',
      fecha_inicio: op.fecha_inicio ?? '',
      fecha_procesamiento_vi: op.fecha_procesamiento_vi ?? '',
      cliente_id: op.cliente_id ?? '',
      cliente_final_id: op.cliente_final_id ?? '',
      cliente_proveedor: op.cliente_proveedor ?? '',
      numero_op: op.numero_op ?? '',
      numero_referencia_cliente: op.numero_referencia_cliente ?? '',
      moneda: op.moneda ?? 'USD',
      monto_total_sin_igv: op.monto_total_sin_igv != null ? String(op.monto_total_sin_igv) : '',
      u_bruta_coti: op.u_bruta_coti != null ? String((op.u_bruta_coti * 100).toFixed(4)).replace(/\.?0+$/, '') : '',
      forma_pago: op.forma_pago ?? '',
      comision_compartida: op.comision_compartida ?? '',
      vendedor1_id: op.vendedor1_id ?? '',
      vendedor2_id: op.vendedor2_id ?? '',
      lider_id: op.lider_id ?? '',
    })
    setEditClienteSearch(op.cliente?.razon_social ?? '')
    setEditClienteFinalSearch(op.cliente_final?.razon_social ?? '')
    setEditVend1Search(op.vendedor1?.nombre_completo ?? '')
    setEditVend2Search(op.vendedor2?.nombre_completo ?? '')
    setEditLiderSearch(op.lider?.nombre_completo ?? '')
    // load combos
    supabase.from('clientes').select('id, razon_social, ruc, ciudad').eq('activo', true).order('razon_social').limit(200)
      .then(({ data }) => setClientes((data ?? []) as typeof clientes))
    supabase.from('profiles').select('id, nombre_completo').eq('activo', true).eq('es_vendedor', true).order('nombre_completo')
      .then(({ data }) => setVendedores((data ?? []) as typeof vendedores))
    supabase.from('proveedores').select('id, razon_social, pais, ruc_nro_doc').order('razon_social').limit(200)
      .then(({ data }) => setProveedores((data ?? []) as typeof proveedores))
  }, [showEditOp])

  function filterClientes(q: string) {
    if (!q.trim()) return clientes.slice(0, 10)
    const l = q.toLowerCase()
    return clientes.filter(c => c.razon_social.toLowerCase().includes(l) || (c.ruc ?? '').includes(q)).slice(0, 10)
  }
  function filterVendedores(q: string) {
    if (!q.trim()) return vendedores.slice(0, 15)
    return vendedores.filter(v => v.nombre_completo.toLowerCase().includes(q.toLowerCase())).slice(0, 15)
  }
  function filterProveedores(q: string) {
    if (!q.trim()) return proveedores.slice(0, 10)
    const l = q.toLowerCase()
    return proveedores.filter(p => p.razon_social.toLowerCase().includes(l) || (p.ruc_nro_doc ?? '').toLowerCase().includes(l)).slice(0, 10)
  }

  async function handleSaveEditOp() {
    if (!editOpForm.cliente_id || !editOpForm.fecha_recepcion) {
      setEditOpError('Cliente y fecha de recepción son obligatorios.')
      return
    }
    setSavingEditOp(true)
    setEditOpError(null)
    const { error } = await supabase.from('operaciones').update({
      fecha_recepcion: editOpForm.fecha_recepcion,
      fecha_inicio: editOpForm.fecha_inicio || null,
      fecha_procesamiento_vi: editOpForm.fecha_procesamiento_vi || null,
      cliente_id: editOpForm.cliente_id,
      cliente_final_id: editOpForm.cliente_final_id || null,
      cliente_proveedor: editOpForm.cliente_proveedor || null,
      numero_op: editOpForm.numero_op || null,
      numero_referencia_cliente: editOpForm.numero_referencia_cliente || null,
      moneda: editOpForm.moneda,
      monto_total_sin_igv: parseFloat(editOpForm.monto_total_sin_igv) || 0,
      u_bruta_coti: editOpForm.u_bruta_coti ? parseFloat(editOpForm.u_bruta_coti) / 100 : null,
      forma_pago: editOpForm.forma_pago || null,
      comision_compartida: editOpForm.comision_compartida || null,
      vendedor1_id: editOpForm.vendedor1_id || null,
      vendedor2_id: editOpForm.vendedor2_id || null,
      lider_id: editOpForm.lider_id || null,
    }).eq('id', operacionId)
    setSavingEditOp(false)
    if (error) { setEditOpError(fmtDbError(error, 'Error al guardar.')); return }
    setShowEditOp(false)
    load()
  }

  async function handleCambiarEstado() {
    if (!nuevoEstado || !profile) return
    setSavingEstado(true)
    await cambiarEstadoOperacion(operacionId, nuevoEstado, comentEstado || undefined, profile.id)
    setSavingEstado(false)
    setShowEstado(false)
    setComentEstado('')
    setNuevoEstado('')
    load()
  }

  useEffect(() => {
    if (productosSearch.length < 2) { setProductosSugeridos([]); return }
    const t = setTimeout(async () => {
      let q = supabase
        .from('productos')
        .select('id, codigo_comercial, descripcion, unidad_medida, marca, tipo')
        .or(`codigo_comercial.ilike.%${productosSearch}%,descripcion.ilike.%${productosSearch}%`)
        .eq('activo', true)
      if (tipoProdFiltro) q = q.eq('tipo', tipoProdFiltro)
      const { data } = await q.limit(20)
      setProductosSugeridos((data ?? []) as Producto[])
    }, 250)
    return () => clearTimeout(t)
  }, [productosSearch, tipoProdFiltro])

  function selectProducto(p: Producto) {
    const um = p.unidad_medida || ''
    setItemForm(f => ({
      ...f,
      producto_id: p.id,
      producto_tipo: p.tipo ?? '',
      codigo_comercial: p.codigo_comercial,
      descripcion: p.descripcion,
      unidad_medida: um || f.unidad_medida,
      numero_servicio: '',
      numero_proyecto: '',
      precio_total_estimado: '',
    }))
    if (um) { umSelectedRef.current = um; setUmSearch(um) }
    setProductosSearch(p.codigo_comercial)
    setProductosSugeridos([])
    setShowProductosDrop(false)
  }

  function clearProducto() {
    setItemForm(f => ({ ...f, producto_id: '', producto_tipo: '', codigo_comercial: '', descripcion: '', numero_servicio: '', numero_proyecto: '', precio_total_estimado: '' }))
    setProductosSearch('')
    setProductosSugeridos([])
  }

  async function handleProductoFocus() {
    let q = supabase
      .from('productos')
      .select('id, codigo_comercial, descripcion, unidad_medida, marca, tipo')
      .eq('activo', true)
      .order('codigo_comercial')
    if (tipoProdFiltro) q = q.eq('tipo', tipoProdFiltro)
    const { data } = await q.limit(20)
    setProductosSugeridos((data ?? []) as Producto[])
    setShowProductosDrop(true)
  }

  async function handleAddItem() {
    if (!itemForm.descripcion.trim()) { setItemError('Selecciona un producto o escribe una descripción.'); return }
    if (!itemForm.cantidad || parseFloat(itemForm.cantidad) <= 0) { setItemError('La cantidad debe ser mayor a 0.'); return }
    if (!itemForm.precio_unitario || parseFloat(itemForm.precio_unitario) < 0) { setItemError('El precio unitario es requerido.'); return }
    setItemError(null)
    setSavingItem(true)
    const cantidad = parseFloat(itemForm.cantidad)
    const precio = parseFloat(itemForm.precio_unitario)
    const { data: itemCreado, error } = await supabase.from('operacion_items').insert({
      operacion_id: operacionId,
      producto_id: itemForm.producto_id || null,
      item_op: itemForm.item_op || null,
      codigo_comercial: itemForm.codigo_comercial || null,
      descripcion: itemForm.descripcion.trim(),
      cantidad,
      unidad_medida: itemForm.unidad_medida || null,
      moneda: itemForm.moneda || 'USD',
      precio_unitario: precio,
      tc_usd: itemForm.tc_usd ? parseFloat(itemForm.tc_usd) : null,
      monto_total: cantidad * precio,
      tipo_negocio: itemForm.tipo_negocio || null,
      sub_tipo_negocio: itemForm.sub_tipo_negocio || null,
      sub_tipo_negocio_2: itemForm.sub_tipo_negocio_2 || null,
      fecha_req_cliente: itemForm.fecha_req_cliente || null,
      requiere_armado: itemForm.requiere_armado,
      codigo_cliente: itemForm.codigo_cliente || null,
      num_deal: itemForm.num_deal || null,
      centro_costo: itemForm.centro_costo || null,
      subcentro_costo: itemForm.subcentro_costo || null,
      sub_sub_centro_costo: itemForm.sub_sub_centro_costo || null,
      t_e_semanas: itemForm.t_e_semanas ? parseFloat(itemForm.t_e_semanas) : null,
      numero_servicio: itemForm.numero_servicio || null,
      numero_proyecto: itemForm.numero_proyecto || null,
      precio_total_estimado: itemForm.precio_total_estimado ? parseFloat(itemForm.precio_total_estimado) : null,
      estado: 'Pendiente',
    }).select('id').single()
    if (error) { setSavingItem(false); setItemError(fmtDbError(error, 'Error al guardar.')); return }
    if (itemCreado?.id && itemNotas.length > 0 && profile) {
      await supabase.from('operacion_item_notas').insert(
        itemNotas.map(nota => ({ operacion_item_id: (itemCreado as { id: string }).id, nota, usuario_id: profile.id }))
      )
    }
    setSavingItem(false)
    setShowAddItem(false)
    setItemForm({
      item_op: '', producto_id: '', producto_tipo: '', codigo_comercial: '', descripcion: '',
      cantidad: '', unidad_medida: '', moneda: op?.moneda ?? 'USD', precio_unitario: '',
      tc_usd: '', tipo_negocio: '', sub_tipo_negocio: '', sub_tipo_negocio_2: '',
      fecha_req_cliente: '', requiere_armado: false, codigo_cliente: '', num_deal: '',
      centro_costo: '', subcentro_costo: '', sub_sub_centro_costo: '',
      t_e_semanas: '', numero_servicio: '', numero_proyecto: '', precio_total_estimado: '',
    })
    setItemNotas([])
    setItemNotaInput('')
    setProductosSearch('')
    umSelectedRef.current = ''
    setUmSearch('')
    setTipoProdFiltro('')
    load()
  }

  function openEditItem(r: OperacionItem) {
    setEditItemError(null)
    setEditItemForm({
      item_op: r.item_op ?? '',
      descripcion: r.descripcion ?? '',
      cantidad: String(r.cantidad ?? ''),
      unidad_medida: r.unidad_medida ?? '',
      moneda: r.moneda ?? 'USD',
      precio_unitario: String(r.precio_unitario ?? ''),
      tc_usd: r.tc_usd != null ? String(r.tc_usd) : '',
      estado: r.estado ?? '',
      tipo_negocio: r.tipo_negocio ?? '',
      sub_tipo_negocio: r.sub_tipo_negocio ?? '',
      sub_tipo_negocio_2: r.sub_tipo_negocio_2 ?? '',
      fecha_req_cliente: r.fecha_req_cliente ?? '',
      requiere_armado: r.requiere_armado ?? false,
      codigo_cliente: r.codigo_cliente ?? '',
      num_deal: r.num_deal ?? '',
      centro_costo: r.centro_costo ?? '',
      subcentro_costo: r.subcentro_costo ?? '',
      sub_sub_centro_costo: r.sub_sub_centro_costo ?? '',
      t_e_semanas: r.t_e_semanas != null ? String(r.t_e_semanas) : '',
      numero_servicio: r.numero_servicio ?? '',
      numero_proyecto: r.numero_proyecto ?? '',
      precio_total_estimado: r.precio_total_estimado != null ? String(r.precio_total_estimado) : '',
    })
    setEditItemRow(r)
  }

  async function handleSaveEditItem() {
    if (!editItemRow) return
    if (!editItemForm.descripcion.trim()) { setEditItemError('La descripción es requerida.'); return }
    if (!editItemForm.cantidad || parseFloat(editItemForm.cantidad) <= 0) { setEditItemError('La cantidad debe ser mayor a 0.'); return }
    setSavingEditItem(true)
    setEditItemError(null)
    const cantidad = parseFloat(editItemForm.cantidad)
    const precio = parseFloat(editItemForm.precio_unitario) || 0
    const { error } = await supabase.from('operacion_items').update({
      item_op: editItemForm.item_op || null,
      descripcion: editItemForm.descripcion.trim(),
      cantidad,
      unidad_medida: editItemForm.unidad_medida || null,
      moneda: editItemForm.moneda || 'USD',
      precio_unitario: precio,
      tc_usd: editItemForm.tc_usd ? parseFloat(editItemForm.tc_usd) : null,
      monto_total: cantidad * precio,
      estado: editItemForm.estado || null,
      tipo_negocio: editItemForm.tipo_negocio || null,
      sub_tipo_negocio: editItemForm.sub_tipo_negocio || null,
      sub_tipo_negocio_2: editItemForm.sub_tipo_negocio_2 || null,
      fecha_req_cliente: editItemForm.fecha_req_cliente || null,
      requiere_armado: editItemForm.requiere_armado,
      codigo_cliente: editItemForm.codigo_cliente || null,
      num_deal: editItemForm.num_deal || null,
      centro_costo: editItemForm.centro_costo || null,
      subcentro_costo: editItemForm.subcentro_costo || null,
      sub_sub_centro_costo: editItemForm.sub_sub_centro_costo || null,
      t_e_semanas: editItemForm.t_e_semanas ? parseFloat(editItemForm.t_e_semanas) : null,
      numero_servicio: editItemForm.numero_servicio || null,
      numero_proyecto: editItemForm.numero_proyecto || null,
      precio_total_estimado: editItemForm.precio_total_estimado ? parseFloat(editItemForm.precio_total_estimado) : null,
    }).eq('id', editItemRow.id)
    setSavingEditItem(false)
    if (error) { setEditItemError(fmtDbError(error, 'Error al guardar.')); return }
    setEditItemRow(null)
    load()
  }

  async function handleDeleteItem() {
    if (!deleteItemRow) return
    setDeletingItem(true)
    setDeleteItemError(null)
    const { error } = await supabase.from('operacion_items').delete().eq('id', deleteItemRow.id)
    setDeletingItem(false)
    if (error) { setDeleteItemError(fmtDbError(error, 'Error al eliminar.')); return }
    setDeleteItemRow(null)
    load()
  }

  async function handleAddComentario() {
    if (!nuevoComentario.trim() || !profile) return
    setSavingComent(true)
    await addComentario('operacion', operacionId, profile.id, nuevoComentario.trim())
    setNuevoComentario('')
    const res = await getComentarios('operacion', operacionId)
    setComentarios(res.data ?? [])
    setSavingComent(false)
  }

  function DocCard({ doc, fuente }: { doc: DocumentoAdjunto; fuente?: string }) {
    return (
      <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: '10px 12px', background: 'var(--panel-2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="doc" size={16} style={{ color: 'var(--info)', flexShrink: 0 }} />
          <Badge tone="muted" className="xs">{doc.tipo_documento}</Badge>
        </div>
        <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.nombre_archivo}
        </div>
        {fuente && (
          <div className="tiny" style={{ marginTop: 3, color: 'var(--accent-2)', fontWeight: 500 }}>{fuente}</div>
        )}
        <div className="tiny" style={{ marginTop: 3 }}>{fmtDate(doc.created_at)}</div>
        <a href={doc.url_storage} target="_blank" rel="noopener noreferrer"
          className="btn ghost xs" style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
          <Icon name="download" size={11} /> Descargar
        </a>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="page">
        <div className="loading-row" style={{ padding: 80 }}>
          <Icon name="spinner" size={18} style={{ animation: 'spin 1s linear infinite' }} />
          <span>Cargando operación…</span>
        </div>
      </div>
    )
  }

  if (!op) {
    return (
      <div className="page">
        <button className="btn ghost xs" onClick={() => navigate('/operaciones')} style={{ marginBottom: 16 }}>
          <Icon name="arrowLeft" size={12} /> Operaciones
        </button>
        <div className="empty-state">
          <Icon name="warning" size={28} className="empty-icon" />
          <div className="empty-title">Operación no encontrada</div>
        </div>
      </div>
    )
  }

  const nextStates = NEXT_STATES[op.estado] ?? []

  const tabsWithCounts = TABS.map(t => {
    const countMap: Record<string, number> = {
      items:     op.items?.length ?? 0,
      ocl:       compraItems.filter(i => (i.orden_compra as Record<string, unknown> | undefined)?.tipo === 'Local').length,
      oci:       compraItems.filter(i => (i.orden_compra as Record<string, unknown> | undefined)?.tipo === 'Importacion').length,
      historial: historial.length,
      docs:      documentos.length + docsRelacionados.length,
      notas:     comentarios.length,
    }
    return countMap[t.id] != null ? { ...t, count: countMap[t.id] } : t
  })

  return (
    <div className="page">
      {/* Back */}
      <button className="btn ghost xs" onClick={() => navigate('/operaciones')} style={{ marginBottom: 12 }}>
        <Icon name="arrowLeft" size={12} /> Operaciones
      </button>

      {/* Header */}
      <div className="detail-head">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 className="detail-title">
              <span className="corr">{op.correlativo_opci}</span>
              <span>{op.cliente?.razon_social}</span>
            </h1>
            <div className="detail-meta">
              <StatusBadge status={op.estado} mapping={OPCI_STATUS_TONE} />
              <div className="detail-meta-item">
                <Icon name="clock" size={12} style={{ color: 'var(--text-3)' }} />
                <span>Recibido: {fmtDate(op.fecha_recepcion)}</span>
              </div>
              <div className="detail-meta-item">
                <Icon name="dollar" size={12} style={{ color: 'var(--text-3)' }} />
                <span className="mono" style={{ fontWeight: 600 }}>{money(op.monto_total_sin_igv, op.moneda)}</span>
              </div>
              {op.vendedor1 && (
                <div className="detail-meta-item">
                  <span className="avatar" style={{ width: 18, height: 18, fontSize: 8 }}>
                    {initials(op.vendedor1.nombre_completo)}
                  </span>
                  <span>{op.vendedor1.nombre_completo}</span>
                </div>
              )}
              {op.numero_op && (
                <div className="detail-meta-item">
                  <Icon name="tag" size={12} style={{ color: 'var(--text-3)' }} />
                  <span className="mono">{op.numero_op}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="btn sm" onClick={() => setShowEditOp(true)}>
              <Icon name="edit" size={13} /> Editar
            </button>
            {nextStates.length > 0 && (
              <button className="btn sm" onClick={() => setShowEstado(true)}>
                <Icon name="refresh" size={13} /> Cambiar estado
              </button>
            )}
            <button className="btn sm" onClick={() => setShowUpload(true)}>
              <Icon name="paperclip" size={13} /> Adjuntar
            </button>
            <button className="btn sm">
              <Icon name="comment" size={13} /> Comentar
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />

      {/* Resumen */}
      {tab === 'resumen' && (
        <Card title="Datos de la operación" icon="opci">
          <MetaGrid cols={3} fields={[
            { label: 'Correlativo OPCI',    value: op.correlativo_opci, mono: true },
            { label: 'Fecha recepción',     value: fmtDate(op.fecha_recepcion), mono: true },
            { label: 'Fecha inicio',        value: fmtDate(op.fecha_inicio), mono: true },
            { label: 'Fecha proc. VI',      value: fmtDate(op.fecha_procesamiento_vi), mono: true },
            { label: 'N° OP cliente',       value: op.numero_op, mono: true },
            { label: 'Ref. cliente',        value: op.numero_referencia_cliente, mono: true },
            { label: 'Cliente',             value: op.cliente?.razon_social, span: 2 },
            { label: 'Cliente final',       value: op.cliente_final?.razon_social },
            { label: 'Cliente-Proveedor',   value: op.cliente_proveedor },
            { label: 'Moneda',              value: op.moneda },
            { label: 'Monto sin IGV',       value: money(op.monto_total_sin_igv, op.moneda), mono: true },
            { label: 'Forma de pago',       value: op.forma_pago },
            { label: 'Vendedor 1',          value: op.vendedor1?.nombre_completo },
            { label: 'Vendedor 2',          value: op.vendedor2?.nombre_completo },
            { label: 'Líder',               value: op.lider?.nombre_completo },
            { label: 'U. bruta cotización', value: op.u_bruta_coti != null ? (op.u_bruta_coti * 100).toFixed(2) + '%' : null },
            { label: 'Comisión compartida', value: op.comision_compartida },
            { label: 'Estado',              value: <StatusBadge status={op.estado} mapping={OPCI_STATUS_TONE} /> },
          ]} />
        </Card>
      )}

      {/* Ítems */}
      {tab === 'items' && (
        <Card title="Ítems de la operación" icon="box" padding={false}
          actions={<button className="btn primary xs" onClick={() => { setItemForm(f => ({ ...f, moneda: op.moneda ?? 'USD' })); setItemError(null); setShowAddItem(true) }}><Icon name="plus" size={11} /> Agregar ítem</button>}>
          <DataTable
            columns={[
              { key: 'item_op',         label: 'Item OP', width: 60 },
              { key: 'codigo_comercial',label: 'Código',     render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion',     label: 'Descripción' },
              { key: 'tipo_negocio',    label: 'Tipo', width: 80, render: r => r.tipo_negocio ? <Badge tone={r.tipo_negocio === 'Venta' ? 'ok' : r.tipo_negocio === 'Servicio' ? 'info' : 'violet'}>{r.tipo_negocio as string}</Badge> : <span className="muted">—</span> },
              { key: 'cantidad',        label: 'Cant.', align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
              { key: 'unidad_medida',   label: 'UM', width: 60 },
              { key: 'precio_unitario', label: 'Precio U.', align: 'right', render: r => <span className="mono">{money(r.precio_unitario as number, r.moneda as string)}</span> },
              { key: 'monto_total',     label: 'Total', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{money(r.monto_total as number, r.moneda as string)}</span> },
              { key: 'estado',          label: 'Estado', render: r => <Badge tone="info">{r.estado as string}</Badge> },
              {
                key: '_actions', label: '', width: 72,
                render: r => (
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                    <button className="btn ghost xs" title="Editar" onClick={() => openEditItem(r as unknown as OperacionItem)}>
                      <Icon name="edit" size={12} />
                    </button>
                    <button className="btn ghost xs" title="Eliminar" style={{ color: 'var(--bad)' }} onClick={() => { setDeleteItemError(null); setDeleteItemRow(r as unknown as OperacionItem) }}>
                      <Icon name="trash" size={12} />
                    </button>
                  </div>
                ),
              },
            ] as Column<Record<string, unknown>>[]}
            rows={(op.items ?? []) as unknown as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin ítems registrados"
          />
        </Card>
      )}

      {/* Compras Locales */}
      {tab === 'ocl' && (
        <Card title="Ítems de compras locales" icon="cart" padding={false}>
          <DataTable
            columns={[
              { key: '_oc',    label: 'N° OC',      width: 130, render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{(r.orden_compra as Record<string,unknown>)?.num_oc as string ?? '—'}</span> },
              { key: '_prov',  label: 'Proveedor',               render: r => <span>{((r.orden_compra as Record<string,unknown>)?.proveedor as {razon_social:string}|undefined)?.razon_social ?? '—'}</span> },
              { key: '_est',   label: 'Estado OC',  width: 150,  render: r => { const s = (r.orden_compra as Record<string,unknown>)?.status as string; return s ? <StatusBadge status={s} mapping={OCL_STATUS_TONE} /> : <span className="muted">—</span> } },
              { key: 'item_oc', label: 'Ítem OC',   width: 70 },
              { key: 'item_op', label: 'Ítem OP',   width: 70,   render: r => r.item_op ? <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{r.item_op as string}</span> : <span className="muted">—</span> },
              { key: 'codigo_comercial', label: 'Código',        render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion', label: 'Descripción',        render: r => <span style={{ maxWidth: 180, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion as string}>{r.descripcion as string}</span> },
              { key: 'cantidad', label: 'Cant.', align: 'right', width: 70, render: r => <span className="mono">{r.cantidad as number}</span> },
              { key: 'unidad_medida', label: 'UM', width: 55 },
              { key: 'pcu1',   label: 'P.U.',   align: 'right',  render: r => <span className="mono">{(r.pcu1 as number)?.toFixed(2)} {r.moneda as string}</span> },
              { key: 'monto_total', label: 'Total', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{(r.monto_total as number)?.toFixed(2)} {r.moneda as string}</span> },
            ] as Column<Record<string, unknown>>[]}
            rows={compraItems.filter(i => (i.orden_compra as Record<string,unknown>|undefined)?.tipo === 'Local')}
            idKey="id"
            pageSize={20}
            emptyMessage="Sin ítems de compras locales asociados a esta OPCI"
          />
        </Card>
      )}

      {/* Importaciones */}
      {tab === 'oci' && (
        <Card title="Ítems de compras por importación" icon="ship" padding={false}>
          <DataTable
            columns={[
              { key: '_oc',    label: 'N° OCI',     width: 130, render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{(r.orden_compra as Record<string,unknown>)?.num_oc as string ?? '—'}</span> },
              { key: '_imp',   label: 'Grupo Imp.',              render: r => <span className="mono" style={{ fontSize: 11 }}>{((r.orden_compra as Record<string,unknown>)?.importacion as {grupo_importacion:string}|undefined)?.grupo_importacion ?? '—'}</span> },
              { key: '_prov',  label: 'Proveedor',               render: r => <span>{((r.orden_compra as Record<string,unknown>)?.proveedor as {razon_social:string}|undefined)?.razon_social ?? '—'}</span> },
              { key: '_est',   label: 'Estado OC',  width: 150,  render: r => { const s = (r.orden_compra as Record<string,unknown>)?.status as string; return s ? <StatusBadge status={s} mapping={OCI_STATUS_TONE} /> : <span className="muted">—</span> } },
              { key: 'item_oc', label: 'Ítem OC',   width: 70 },
              { key: 'item_op', label: 'Ítem OP',   width: 70,   render: r => r.item_op ? <span className="mono" style={{ color: 'var(--accent-2)', fontSize: 11 }}>{r.item_op as string}</span> : <span className="muted">—</span> },
              { key: 'codigo_comercial', label: 'Código',        render: r => <span className="mono">{r.codigo_comercial as string}</span> },
              { key: 'descripcion', label: 'Descripción',        render: r => <span style={{ maxWidth: 160, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion as string}>{r.descripcion as string}</span> },
              { key: 'cantidad', label: 'Cant.', align: 'right', width: 70, render: r => <span className="mono">{r.cantidad as number}</span> },
              { key: 'unidad_medida', label: 'UM', width: 55 },
              { key: 'pcu1',   label: 'P.U.',   align: 'right',  render: r => <span className="mono">{(r.pcu1 as number)?.toFixed(2)} {r.moneda as string}</span> },
              { key: 'monto_total', label: 'Total', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600 }}>{(r.monto_total as number)?.toFixed(2)} {r.moneda as string}</span> },
            ] as Column<Record<string, unknown>>[]}
            rows={compraItems.filter(i => (i.orden_compra as Record<string,unknown>|undefined)?.tipo === 'Importacion')}
            idKey="id"
            pageSize={20}
            emptyMessage="Sin ítems de compras por importación asociados a esta OPCI"
          />
        </Card>
      )}

      {/* Facturación */}
      {tab === 'facturas' && (
        <Card title="Facturas de venta" icon="invoice" padding={false}
          actions={<button className="btn primary xs" onClick={() => navigate(`/facturacion?opci=${operacionId}`)}><Icon name="plus" size={11} /> Nueva factura</button>}>
          <DataTable
            columns={[
              { key: 'num_factura',    label: 'N° Factura', render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.num_factura as string}</span> },
              { key: 'fecha_emision',  label: 'Emisión', render: r => <span className="mono">{fmtDate(r.fecha_emision as string)}</span> },
              { key: 'monto_total_sin_igv', label: 'Monto s/IGV', align: 'right', render: r => <span className="mono">{money(r.monto_total_sin_igv as number, r.moneda as string)}</span> },
              { key: 'forma_pago',     label: 'Forma pago', render: r => <span className="muted">{r.forma_pago as string ?? '—'}</span> },
              { key: 'fecha_prometida_pago', label: 'Vence', render: r => <EtaCell eta={r.fecha_prometida_pago as string} pastBad /> },
              { key: 'status',         label: 'Estado', render: r => <StatusBadge status={r.status as string} mapping={FACTURA_STATUS_TONE} /> },
            ] as Column<Record<string, unknown>>[]}
            rows={(op.facturas ?? []) as unknown as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin facturas registradas"
          />
        </Card>
      )}

      {/* Almacén */}
      {tab === 'almacen' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Recepciones" icon="warehouse" padding={false}>
            <DataTable
              columns={[
                { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
                { key: 'descripcion',      label: 'Descripción' },
                { key: 'cantidad_esperada',  label: 'Esperada', align: 'right', render: r => <span className="mono">{r.cantidad_esperada as number}</span> },
                { key: 'cantidad_recibida',  label: 'Recibida', align: 'right', render: r => <span className="mono" style={{ fontWeight: 600, color: 'var(--ok)' }}>{r.cantidad_recibida as number}</span> },
                { key: 'fecha_recepcion',    label: 'Fecha', render: r => <span className="mono">{fmtDate(r.fecha_recepcion as string)}</span> },
                { key: 'estado',             label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={RECEPCION_STATUS_TONE} /> },
              ] as Column<Record<string, unknown>>[]}
              rows={(op.recepciones ?? []) as unknown as Record<string, unknown>[]}
              idKey="id"
              emptyMessage="Sin recepciones registradas"
            />
          </Card>
          <Card title="Despachos" icon="truck" padding={false}>
            <DataTable
              columns={[
                { key: 'codigo_comercial', label: 'Código', render: r => <span className="mono">{r.codigo_comercial as string}</span> },
                { key: 'descripcion',      label: 'Descripción' },
                { key: 'cantidad',         label: 'Cantidad', align: 'right', render: r => <span className="mono">{r.cantidad as number}</span> },
                { key: 'distrito_despacho',label: 'Distrito' },
                { key: 'fecha_despacho',   label: 'Fecha despacho', render: r => <span className="mono">{fmtDate(r.fecha_despacho as string)}</span> },
                { key: 'estado',           label: 'Estado', render: r => <StatusBadge status={r.estado as string} mapping={DESPACHO_STATUS_TONE} /> },
              ] as Column<Record<string, unknown>>[]}
              rows={(op.despachos ?? []) as unknown as Record<string, unknown>[]}
              idKey="id"
              emptyMessage="Sin despachos registrados"
            />
          </Card>
        </div>
      )}

      {/* Guías */}
      {tab === 'guias' && (
        <Card title="Guías de remisión y despachos" icon="truck" padding={false}
          actions={<button className="btn primary xs"><Icon name="plus" size={11} /> Nueva guía</button>}>
          <DataTable
            columns={[
              { key: 'numero_guia',    label: 'N° Guía', render: r => <span className="mono" style={{ color: 'var(--accent-2)' }}>{r.numero_guia as string}</span> },
              { key: 'fecha_emision',  label: 'Emisión', render: r => <span className="mono">{fmtDate(r.fecha_emision as string)}</span> },
              { key: 'transportista',  label: 'Transportista' },
              { key: 'placa',          label: 'Placa', render: r => <span className="mono">{r.placa as string ?? '—'}</span> },
              { key: 'distrito_destino', label: 'Distrito' },
              { key: 'fecha_despacho', label: 'Fecha despacho', render: r => <EtaCell eta={r.fecha_despacho as string} /> },
              { key: 'estado',         label: 'Estado', render: r => <Badge tone={r.estado === 'Entregada' ? 'ok' : r.estado === 'Anulada' ? 'muted' : 'info'}>{r.estado as string}</Badge> },
            ] as Column<Record<string, unknown>>[]}
            rows={(op.guias ?? []) as unknown as Record<string, unknown>[]}
            idKey="id"
            emptyMessage="Sin guías de remisión"
          />
        </Card>
      )}

      {/* Documentos */}
      {tab === 'docs' && (
        <Card title="Documentos adjuntos" icon="paperclip"
          actions={<button className="btn primary xs" onClick={() => setShowUpload(true)}><Icon name="upload" size={11} /> Subir documento</button>}>
          {documentos.length === 0 && docsRelacionados.length === 0 ? (
            <div className="empty-state">
              <Icon name="paperclip" size={28} className="empty-icon" />
              <div className="empty-title">Sin documentos adjuntos</div>
              <div className="empty-sub">Adjunta facturas, OC, packing list, BL u otros documentos relevantes.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {documentos.length > 0 && (
                <div>
                  {docsRelacionados.length > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>
                      Propios de la operación
                    </div>
                  )}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {documentos.map(doc => (
                      <DocCard key={doc.id} doc={doc} />
                    ))}
                  </div>
                </div>
              )}
              {docsRelacionados.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)', marginBottom: 10 }}>
                    De importaciones vinculadas
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {docsRelacionados.map(doc => (
                      <DocCard key={doc.id} doc={doc} fuente={doc._fuente} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Historial */}
      {tab === 'historial' && (
        <Card title="Historial de eventos" icon="history">
          <Timeline eventos={historial} />
        </Card>
      )}

      {/* Comentarios */}
      {tab === 'notas' && (
        <Card title="Comentarios" icon="comment">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {comentarios.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px 0' }}>
                <div className="empty-title">Sin comentarios aún</div>
              </div>
            ) : (
              comentarios.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span className="avatar" style={{ width: 26, height: 26, fontSize: 9, flexShrink: 0 }}>
                    {initials(c.usuario?.nombre_completo)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 600 }}>{c.usuario?.nombre_completo ?? 'Usuario'}</span>
                      <span className="tiny">{fmtDateTime(c.created_at)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
                      {c.texto}
                    </div>
                  </div>
                </div>
              ))
            )}

            <div style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div className="form-field" style={{ marginBottom: 8 }}>
                <label className="form-label">Agregar comentario</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Escribe un comentario o nota sobre esta operación…"
                  value={nuevoComentario}
                  onChange={e => setNuevoComentario(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              <button
                className="btn primary sm"
                onClick={handleAddComentario}
                disabled={savingComent || !nuevoComentario.trim()}
              >
                {savingComent ? <><Icon name="spinner" size={12} style={{ animation: 'spin 1s linear infinite' }} /> Guardando…</> : 'Agregar comentario'}
              </button>
            </div>
          </div>
        </Card>
      )}

      {profile && (
        <UploadDocumentoModal
          open={showUpload}
          onClose={() => setShowUpload(false)}
          entidadTipo="operacion"
          entidadId={operacionId}
          userId={profile.id}
          onUploaded={() => {
            getDocumentos('operacion', operacionId).then(r => setDocumentos(r.data ?? []))
          }}
        />
      )}

      {/* Modal agregar ítem */}
      <Modal
        open={showAddItem}
        onClose={() => { setShowAddItem(false); setItemError(null); setProductosSearch(''); setProductosSugeridos([]); setItemNotas([]); setItemNotaInput(''); umSelectedRef.current = ''; setUmSearch(''); setTipoProdFiltro('') }}
        title="Agregar ítem a la operación"
        subtitle={op?.correlativo_opci}
        size="xl"
        footer={
          <>
            <button className="btn" onClick={() => setShowAddItem(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleAddItem} disabled={savingItem || !itemForm.descripcion.trim()}>
              {savingItem ? 'Guardando…' : 'Agregar ítem'}
            </button>
          </>
        }
      >
        {itemError && (
          <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>
            {itemError}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>

          {/* Tipo de producto */}
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Tipo de producto</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {([['', 'Todos'], ['Producto', 'Venta'], ['Servicio', 'Servicio'], ['Proyecto', 'Proyecto']] as const).map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  className={`btn sm${tipoProdFiltro === val ? ' primary' : ''}`}
                  onClick={() => {
                    setTipoProdFiltro(val)
                    setProductosSugeridos([])
                    // Auto-completar tipo_negocio
                    const tipoNeg = val === 'Producto' ? 'Venta' : val === 'Servicio' ? 'Servicio' : val === 'Proyecto' ? 'Proyecto' : ''
                    if (tipoNeg) setItemForm(f => ({ ...f, tipo_negocio: tipoNeg as TipoNegocio }))
                  }}
                  style={{ minWidth: 80 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Producto unificado */}
          <div className="form-field" style={{ gridColumn: '1 / -1', position: 'relative' }} ref={productoDropRef}>
            <label className="form-label">Producto *</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                value={productosSearch}
                onChange={e => {
                  const val = e.target.value
                  setProductosSearch(val)
                  setShowProductosDrop(!!val)
                  if (itemForm.producto_id) {
                    setItemForm(f => ({ ...f, producto_id: '', codigo_comercial: '', descripcion: val }))
                  } else {
                    setItemForm(f => ({ ...f, descripcion: val }))
                  }
                }}
                onFocus={handleProductoFocus}
                placeholder="Busca por código o descripción, o escribe descripción libre…"
                style={{ width: '100%', paddingRight: itemForm.producto_id ? 36 : undefined }}
              />
              {itemForm.producto_id && (
                <button
                  type="button"
                  className="btn ghost xs"
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                  onMouseDown={e => { e.preventDefault(); clearProducto() }}
                >
                  <Icon name="x" size={11} />
                </button>
              )}
            </div>
            {itemForm.producto_id && (
              <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: 'var(--accent-soft)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12.5 }}>
                <span className="mono" style={{ color: 'var(--accent-2)', fontWeight: 600, flexShrink: 0 }}>{itemForm.codigo_comercial}</span>
                <span style={{ color: 'var(--border)' }}>·</span>
                <span style={{ color: 'var(--text-1)', flex: 1, lineHeight: 1.4 }}>{itemForm.descripcion}</span>
              </div>
            )}
            {showProductosDrop && productosSugeridos.length > 0 && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--shadow-md)', maxHeight: 220, overflowY: 'auto' }}>
                {productosSugeridos.map(p => (
                  <div
                    key={p.id}
                    style={{ padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-soft)' }}
                    onMouseDown={() => selectProducto(p)}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--panel-2)')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}
                  >
                    <span className="mono" style={{ color: 'var(--accent-2)', marginRight: 8, fontWeight: 600 }}>{p.codigo_comercial}</span>
                    <span style={{ fontSize: 12 }}>{p.descripcion}</span>
                    {p.marca && <span className="tiny muted" style={{ marginLeft: 8 }}>{p.marca}</span>}
                    <span style={{ marginLeft: 8, fontSize: 10 }}><Badge tone="muted">{p.unidad_medida}</Badge></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ítem OP */}
          <div className="form-field">
            <label className="form-label">Ítem OP</label>
            <input className="input" value={itemForm.item_op} onChange={e => setItemForm(f => ({ ...f, item_op: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="1, 2, 3…" />
          </div>

          {/* Código cliente */}
          <div className="form-field">
            <label className="form-label">Código cliente</label>
            <input className="input" value={itemForm.codigo_cliente} onChange={e => setItemForm(f => ({ ...f, codigo_cliente: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>

          {/* Cantidad */}
          <div className="form-field">
            <label className="form-label">Cantidad *</label>
            <input type="number" className="input" value={itemForm.cantidad} onChange={e => setItemForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
          </div>

          {/* Unidad de medida */}
          <div className="form-field" ref={umRef} style={{ position: 'relative' }}>
            <label className="form-label">Unidad de medida</label>
            <input
              className="input"
              value={umSearch}
              style={{ width: '100%' }}
              placeholder="UND, KG, M2…"
              autoComplete="off"
              onFocus={() => { setUmSearch(''); setShowUmDrop(true) }}
              onBlur={() => setUmSearch(umSelectedRef.current)}
              onChange={e => {
                const v = e.target.value.toUpperCase()
                setUmSearch(v)
                setItemForm(f => ({ ...f, unidad_medida: v }))
                setShowUmDrop(true)
              }}
            />
            {showUmDrop && (() => {
              const filtered = umSearch ? unidadesMedida.filter(u => u.includes(umSearch)) : unidadesMedida
              return filtered.length > 0 ? (
                <div style={{
                  position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0,
                  background: 'var(--panel)', border: '1px solid var(--border)',
                  borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,.15)',
                  maxHeight: 180, overflowY: 'auto', marginTop: 2,
                }}>
                  {filtered.map(u => (
                    <div
                      key={u}
                      onMouseDown={() => {
                        umSelectedRef.current = u
                        setUmSearch(u)
                        setItemForm(f => ({ ...f, unidad_medida: u }))
                        setShowUmDrop(false)
                      }}
                      style={{
                        padding: '7px 12px', cursor: 'pointer', fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        background: itemForm.unidad_medida === u ? 'var(--accent-soft)' : undefined,
                        color: itemForm.unidad_medida === u ? 'var(--accent)' : 'var(--text)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--muted-soft)')}
                      onMouseLeave={e => (e.currentTarget.style.background = itemForm.unidad_medida === u ? 'var(--accent-soft)' : '')}
                    >
                      {u}
                    </div>
                  ))}
                </div>
              ) : null
            })()}
          </div>

          {/* Moneda */}
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={itemForm.moneda} onChange={e => setItemForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              {['USD', 'PEN', 'EUR'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          {/* Precio unitario */}
          <div className="form-field">
            <label className="form-label">Precio unitario *</label>
            <input type="number" className="input" value={itemForm.precio_unitario} onChange={e => setItemForm(f => ({ ...f, precio_unitario: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>

          {/* Tasa de cambio USD */}
          <div className="form-field">
            <label className="form-label">Tasa de cambio USD</label>
            <input type="number" className="input" value={itemForm.tc_usd} onChange={e => setItemForm(f => ({ ...f, tc_usd: e.target.value }))} style={{ width: '100%' }} step="0.001" min="0" placeholder="Ej: 3.85" />
          </div>

          {/* Total preview — siempre ocupa la celda para estabilizar el grid */}
          <div className="form-field">
            <label className="form-label">Total</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 34, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', fontSize: 12.5 }}>
              {itemForm.cantidad && itemForm.precio_unitario ? (
                <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-2)' }}>
                  {(parseFloat(itemForm.cantidad || '0') * parseFloat(itemForm.precio_unitario || '0')).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {itemForm.moneda}
                </span>
              ) : (
                <span style={{ color: 'var(--text-3)' }}>—</span>
              )}
            </div>
          </div>

          {/* Tipo de negocio */}
          <div className="form-field">
            <label className="form-label">Tipo de negocio</label>
            <select className="select" value={itemForm.tipo_negocio} onChange={e => setItemForm(f => ({ ...f, tipo_negocio: e.target.value as TipoNegocio | '' }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              <option value="Venta">Venta</option>
              <option value="Servicio">Servicio</option>
              <option value="Proyecto">Proyecto</option>
            </select>
          </div>

          {/* Sub tipo de negocio */}
          <div className="form-field">
            <label className="form-label">Sub tipo de negocio</label>
            <select className="select" value={itemForm.sub_tipo_negocio} onChange={e => setItemForm(f => ({ ...f, sub_tipo_negocio: e.target.value as SubTipoNegocio | '' }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              <option value="Importación">Importación</option>
              <option value="Local">Local</option>
              <option value="Servicio">Servicio</option>
            </select>
          </div>

          {/* Sub tipo de negocio 2 */}
          <div className="form-field">
            <label className="form-label">Sub tipo negocio 2</label>
            <select className="select" value={itemForm.sub_tipo_negocio_2} onChange={e => setItemForm(f => ({ ...f, sub_tipo_negocio_2: e.target.value as SubTipoNegocio2 | '' }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              {(['Backorder','Consumo Interno','Demo','Garantía','Stock','Venta Bajo Pedido'] as SubTipoNegocio2[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Fecha requerimiento cliente */}
          <div className="form-field">
            <label className="form-label">Fecha req. cliente</label>
            <input type="date" className="input" value={itemForm.fecha_req_cliente} onChange={e => setItemForm(f => ({ ...f, fecha_req_cliente: e.target.value }))} style={{ width: '100%' }} />
          </div>

          {/* N° Deal */}
          <div className="form-field">
            <label className="form-label">N° Deal</label>
            <input className="input" value={itemForm.num_deal} onChange={e => setItemForm(f => ({ ...f, num_deal: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>

          {/* Requiere armado */}
          <div className="form-field">
            <label className="form-label">Requiere armado</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 34, padding: '0 10px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <input type="checkbox" checked={itemForm.requiere_armado} onChange={e => setItemForm(f => ({ ...f, requiere_armado: e.target.checked }))} />
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Sí, requiere armado</span>
            </label>
          </div>

          {/* Centro de costo */}
          <div className="form-field">
            <label className="form-label">Centro de costo</label>
            <input className="input" value={itemForm.centro_costo} onChange={e => setItemForm(f => ({ ...f, centro_costo: e.target.value }))} style={{ width: '100%' }} />
          </div>

          {/* Sub centro de costo */}
          <div className="form-field">
            <label className="form-label">Sub centro de costo</label>
            <input className="input" value={itemForm.subcentro_costo} onChange={e => setItemForm(f => ({ ...f, subcentro_costo: e.target.value }))} style={{ width: '100%' }} />
          </div>

          {/* Sub sub centro de costo */}
          <div className="form-field">
            <label className="form-label">Sub sub centro de costo</label>
            <input className="input" value={itemForm.sub_sub_centro_costo} onChange={e => setItemForm(f => ({ ...f, sub_sub_centro_costo: e.target.value }))} style={{ width: '100%' }} />
          </div>

          {/* Tiempo en semanas — siempre visible */}
          <div className="form-field">
            <label className="form-label">Tiempo en semanas (T/E)</label>
            <input type="number" className="input" value={itemForm.t_e_semanas} onChange={e => setItemForm(f => ({ ...f, t_e_semanas: e.target.value }))} style={{ width: '100%' }} step="0.5" min="0" placeholder="Ej: 4" />
          </div>

          {/* Campos condicionales por tipo de producto */}
          {itemForm.producto_tipo === 'Servicio' && (
            <div className="form-field">
              <label className="form-label">N° de Servicio</label>
              <input className="input" value={itemForm.numero_servicio} onChange={e => setItemForm(f => ({ ...f, numero_servicio: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="SRV-001" />
            </div>
          )}
          {itemForm.producto_tipo === 'Proyecto' && (
            <>
              <div className="form-field">
                <label className="form-label">N° de Proyecto</label>
                <input className="input" value={itemForm.numero_proyecto} onChange={e => setItemForm(f => ({ ...f, numero_proyecto: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="PRY-001" />
              </div>
              <div className="form-field">
                <label className="form-label">Precio total estimado</label>
                <input type="number" className="input" value={itemForm.precio_total_estimado} onChange={e => setItemForm(f => ({ ...f, precio_total_estimado: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
              </div>
            </>
          )}
        </div>

        {/* Notas del ítem */}
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Notas del ítem
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input
              className="input"
              value={itemNotaInput}
              onChange={e => setItemNotaInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && itemNotaInput.trim()) {
                  e.preventDefault()
                  setItemNotas(n => [...n, itemNotaInput.trim()])
                  setItemNotaInput('')
                }
              }}
              placeholder="Escribe una nota y presiona Agregar o Enter…"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              className="btn sm"
              disabled={!itemNotaInput.trim()}
              onClick={() => { setItemNotas(n => [...n, itemNotaInput.trim()]); setItemNotaInput('') }}
            >
              <Icon name="plus" size={12} /> Agregar
            </button>
          </div>
          {itemNotas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {itemNotas.map((nota, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '7px 10px' }}>
                  <span style={{ flex: 1, fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-1)' }}>{nota}</span>
                  <button type="button" className="btn ghost xs" style={{ flexShrink: 0 }} onClick={() => setItemNotas(n => n.filter((_, j) => j !== i))}>
                    <Icon name="x" size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal editar encabezado operación */}
      <Modal
        open={showEditOp}
        onClose={() => setShowEditOp(false)}
        title="Editar operación"
        subtitle={op?.correlativo_opci}
        size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setShowEditOp(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEditOp} disabled={savingEditOp}>
              {savingEditOp ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </>
        }
      >
        {editOpError && (
          <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>
            {editOpError}
          </div>
        )}

        {(() => {
          const dropStyle: React.CSSProperties = { position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.18)', maxHeight: 220, overflowY: 'auto' }
          const dropItem: React.CSSProperties = { padding: '8px 12px', cursor: 'pointer', fontSize: 12.5 }
          const hl = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'var(--panel-2)')
          const ul = (e: React.MouseEvent<HTMLDivElement>) => (e.currentTarget.style.background = 'transparent')

          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Fecha recepción */}
              <div className="form-field">
                <label className="form-label">Fecha de recepción *</label>
                <input type="date" className="input" value={editOpForm.fecha_recepcion} onChange={e => setEditOpForm(f => ({ ...f, fecha_recepcion: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* Fecha inicio */}
              <div className="form-field">
                <label className="form-label">Fecha de inicio</label>
                <input type="date" className="input" value={editOpForm.fecha_inicio} onChange={e => setEditOpForm(f => ({ ...f, fecha_inicio: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* Fecha procesamiento VI */}
              <div className="form-field">
                <label className="form-label">Fecha procesamiento VI</label>
                <input type="date" className="input" value={editOpForm.fecha_procesamiento_vi} onChange={e => setEditOpForm(f => ({ ...f, fecha_procesamiento_vi: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* N° OP cliente */}
              <div className="form-field">
                <label className="form-label">N° OP cliente</label>
                <input className="input" value={editOpForm.numero_op} onChange={e => setEditOpForm(f => ({ ...f, numero_op: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* N° Referencia cliente */}
              <div className="form-field">
                <label className="form-label">N° Referencia cliente</label>
                <input className="input" value={editOpForm.numero_referencia_cliente} onChange={e => setEditOpForm(f => ({ ...f, numero_referencia_cliente: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* Moneda */}
              <div className="form-field">
                <label className="form-label">Moneda</label>
                <select className="select" value={editOpForm.moneda} onChange={e => setEditOpForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
                  <option value="USD">USD – Dólares</option>
                  <option value="PEN">PEN – Soles</option>
                  <option value="EUR">EUR – Euros</option>
                </select>
              </div>

              {/* Monto sin IGV */}
              <div className="form-field">
                <label className="form-label">Monto sin IGV</label>
                <input type="number" className="input" value={editOpForm.monto_total_sin_igv} onChange={e => setEditOpForm(f => ({ ...f, monto_total_sin_igv: e.target.value }))} step="0.01" min="0" style={{ width: '100%' }} />
              </div>

              {/* Utilidad bruta */}
              <div className="form-field">
                <label className="form-label">Utilidad bruta cotización (%)</label>
                <div style={{ position: 'relative' }}>
                  <input type="number" className="input" value={editOpForm.u_bruta_coti} onChange={e => setEditOpForm(f => ({ ...f, u_bruta_coti: e.target.value }))} step="0.01" min="0" max="100" style={{ width: '100%', paddingRight: 28 }} />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--text-3)', pointerEvents: 'none' }}>%</span>
                </div>
              </div>

              {/* Forma de pago */}
              <div className="form-field">
                <label className="form-label">Forma de pago</label>
                <select className="select" value={editOpForm.forma_pago} onChange={e => setEditOpForm(f => ({ ...f, forma_pago: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">— Sin especificar —</option>
                  {['Contado','Crédito 15 días','Crédito 30 días','Crédito 45 días','Crédito 60 días','Crédito 90 días','Carta de crédito','Transferencia anticipada'].map(fp => <option key={fp} value={fp}>{fp}</option>)}
                </select>
              </div>

              {/* Comisión compartida */}
              <div className="form-field">
                <label className="form-label">Comisión compartida</label>
                <input className="input" value={editOpForm.comision_compartida} onChange={e => setEditOpForm(f => ({ ...f, comision_compartida: e.target.value }))} style={{ width: '100%' }} />
              </div>

              {/* Cliente */}
              <div className="form-field" style={{ gridColumn: '1 / -1' }} ref={editClienteRef}>
                <label className="form-label">Cliente *</label>
                <div style={{ position: 'relative' }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input className="input" value={editClienteSearch}
                    onChange={e => { setEditClienteSearch(e.target.value); setShowEditClienteDrop(true); if (!e.target.value) setEditOpForm(f => ({ ...f, cliente_id: '' })) }}
                    onFocus={() => setShowEditClienteDrop(true)}
                    placeholder="Buscar por razón social o RUC…"
                    style={{ width: '100%', paddingLeft: 30 }} />
                  {editOpForm.cliente_id && (
                    <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => { setEditOpForm(f => ({ ...f, cliente_id: '' })); setEditClienteSearch('') }}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                  {showEditClienteDrop && (
                    <div style={dropStyle}>
                      {filterClientes(editClienteSearch).map(c => (
                        <div key={c.id} style={dropItem} onMouseDown={() => { setEditOpForm(f => ({ ...f, cliente_id: c.id })); setEditClienteSearch(c.razon_social); setShowEditClienteDrop(false) }} onMouseEnter={hl} onMouseLeave={ul}>
                          <span style={{ fontWeight: 600 }}>{c.razon_social}</span>
                          {c.ruc && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{c.ruc}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cliente final */}
              <div className="form-field" ref={editClienteFinalRef}>
                <label className="form-label">Cliente final</label>
                <div style={{ position: 'relative' }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input className="input" value={editClienteFinalSearch}
                    onChange={e => { setEditClienteFinalSearch(e.target.value); setShowEditClienteFinalDrop(true); if (!e.target.value) setEditOpForm(f => ({ ...f, cliente_final_id: '' })) }}
                    onFocus={() => setShowEditClienteFinalDrop(true)}
                    placeholder="Sin especificar…"
                    style={{ width: '100%', paddingLeft: 30 }} />
                  {editOpForm.cliente_final_id && (
                    <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => { setEditOpForm(f => ({ ...f, cliente_final_id: '' })); setEditClienteFinalSearch('') }}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                  {showEditClienteFinalDrop && (
                    <div style={dropStyle}>
                      {filterClientes(editClienteFinalSearch).map(c => (
                        <div key={c.id} style={dropItem} onMouseDown={() => { setEditOpForm(f => ({ ...f, cliente_final_id: c.id })); setEditClienteFinalSearch(c.razon_social); setShowEditClienteFinalDrop(false) }} onMouseEnter={hl} onMouseLeave={ul}>
                          <span style={{ fontWeight: 600 }}>{c.razon_social}</span>
                          {c.ruc && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{c.ruc}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Cliente proveedor */}
              <div className="form-field" ref={editClienteProvRef}>
                <label className="form-label">Cliente proveedor</label>
                <div style={{ position: 'relative' }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none', zIndex: 1 }} />
                  <input className="input" value={editOpForm.cliente_proveedor}
                    onChange={e => { setEditOpForm(f => ({ ...f, cliente_proveedor: e.target.value })); setShowEditClienteProvDrop(true) }}
                    onFocus={() => setShowEditClienteProvDrop(true)}
                    placeholder="Buscar o escribir libremente…"
                    style={{ width: '100%', paddingLeft: 30 }} />
                  {showEditClienteProvDrop && (
                    <div style={dropStyle}>
                      {filterProveedores(editOpForm.cliente_proveedor).map(p => (
                        <div key={p.id} style={dropItem} onMouseDown={() => { setEditOpForm(f => ({ ...f, cliente_proveedor: p.razon_social })); setShowEditClienteProvDrop(false) }} onMouseEnter={hl} onMouseLeave={ul}>
                          <span style={{ fontWeight: 600 }}>{p.razon_social}</span>
                          {p.pais && <span style={{ color: 'var(--text-3)', marginLeft: 8, fontSize: 11 }}>· {p.pais}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Vendedor 1 */}
              <div className="form-field" ref={editVend1Ref}>
                <label className="form-label">Vendedor 1</label>
                <div style={{ position: 'relative' }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input className="input" value={editVend1Search}
                    onChange={e => { setEditVend1Search(e.target.value); setShowEditVend1Drop(true); if (!e.target.value) setEditOpForm(f => ({ ...f, vendedor1_id: '' })) }}
                    onFocus={() => setShowEditVend1Drop(true)}
                    placeholder="Buscar vendedor…"
                    style={{ width: '100%', paddingLeft: 30 }} />
                  {editOpForm.vendedor1_id && (
                    <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => { setEditOpForm(f => ({ ...f, vendedor1_id: '' })); setEditVend1Search('') }}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                  {showEditVend1Drop && (
                    <div style={dropStyle}>
                      {filterVendedores(editVend1Search).map(v => (
                        <div key={v.id} style={dropItem} onMouseDown={() => { setEditOpForm(f => ({ ...f, vendedor1_id: v.id })); setEditVend1Search(v.nombre_completo); setShowEditVend1Drop(false) }} onMouseEnter={hl} onMouseLeave={ul}>
                          {v.nombre_completo}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Vendedor 2 */}
              <div className="form-field" ref={editVend2Ref}>
                <label className="form-label">Vendedor 2</label>
                <div style={{ position: 'relative' }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input className="input" value={editVend2Search}
                    onChange={e => { setEditVend2Search(e.target.value); setShowEditVend2Drop(true); if (!e.target.value) setEditOpForm(f => ({ ...f, vendedor2_id: '' })) }}
                    onFocus={() => setShowEditVend2Drop(true)}
                    placeholder="Buscar vendedor…"
                    style={{ width: '100%', paddingLeft: 30 }} />
                  {editOpForm.vendedor2_id && (
                    <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => { setEditOpForm(f => ({ ...f, vendedor2_id: '' })); setEditVend2Search('') }}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                  {showEditVend2Drop && (
                    <div style={dropStyle}>
                      {filterVendedores(editVend2Search).map(v => (
                        <div key={v.id} style={dropItem} onMouseDown={() => { setEditOpForm(f => ({ ...f, vendedor2_id: v.id })); setEditVend2Search(v.nombre_completo); setShowEditVend2Drop(false) }} onMouseEnter={hl} onMouseLeave={ul}>
                          {v.nombre_completo}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Líder */}
              <div className="form-field" style={{ gridColumn: '1 / -1' }} ref={editLiderRef}>
                <label className="form-label">Líder</label>
                <div style={{ position: 'relative' }}>
                  <Icon name="search" size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }} />
                  <input className="input" value={editLiderSearch}
                    onChange={e => { setEditLiderSearch(e.target.value); setShowEditLiderDrop(true); if (!e.target.value) setEditOpForm(f => ({ ...f, lider_id: '' })) }}
                    onFocus={() => setShowEditLiderDrop(true)}
                    placeholder="Buscar líder…"
                    style={{ width: '100%', paddingLeft: 30 }} />
                  {editOpForm.lider_id && (
                    <button className="btn ghost xs" style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                      onClick={() => { setEditOpForm(f => ({ ...f, lider_id: '' })); setEditLiderSearch('') }}>
                      <Icon name="x" size={11} />
                    </button>
                  )}
                  {showEditLiderDrop && (
                    <div style={dropStyle}>
                      {filterVendedores(editLiderSearch).map(v => (
                        <div key={v.id} style={dropItem} onMouseDown={() => { setEditOpForm(f => ({ ...f, lider_id: v.id })); setEditLiderSearch(v.nombre_completo); setShowEditLiderDrop(false) }} onMouseEnter={hl} onMouseLeave={ul}>
                          {v.nombre_completo}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </div>
          )
        })()}
      </Modal>

      {/* Modal editar ítem */}
      <Modal
        open={!!editItemRow}
        onClose={() => { setEditItemRow(null); setEditItemError(null) }}
        title="Editar ítem"
        subtitle={op?.correlativo_opci}
        size="lg"
        footer={
          <>
            <button className="btn" onClick={() => setEditItemRow(null)}>Cancelar</button>
            <button className="btn primary" onClick={handleSaveEditItem} disabled={savingEditItem}>
              {savingEditItem ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        {editItemError && (
          <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)', marginBottom: 12 }}>
            {editItemError}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
          <div className="form-field" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Descripción *</label>
            <input className="input" value={editItemForm.descripcion} onChange={e => setEditItemForm(f => ({ ...f, descripcion: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Ítem OP</label>
            <input className="input" value={editItemForm.item_op} onChange={e => setEditItemForm(f => ({ ...f, item_op: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Cantidad *</label>
            <input type="number" className="input" value={editItemForm.cantidad} onChange={e => setEditItemForm(f => ({ ...f, cantidad: e.target.value }))} style={{ width: '100%' }} step="1" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Unidad de medida</label>
            <input className="input" value={editItemForm.unidad_medida} onChange={e => setEditItemForm(f => ({ ...f, unidad_medida: e.target.value.toUpperCase() }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} placeholder="UND, KG, M2…" />
          </div>
          <div className="form-field">
            <label className="form-label">Moneda</label>
            <select className="select" value={editItemForm.moneda} onChange={e => setEditItemForm(f => ({ ...f, moneda: e.target.value }))} style={{ width: '100%' }}>
              {['USD', 'PEN', 'EUR'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Precio unitario</label>
            <input type="number" className="input" value={editItemForm.precio_unitario} onChange={e => setEditItemForm(f => ({ ...f, precio_unitario: e.target.value }))} style={{ width: '100%' }} step="0.01" min="0" />
          </div>
          <div className="form-field">
            <label className="form-label">Total</label>
            <div style={{ display: 'flex', alignItems: 'center', height: 34, background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 12px', fontSize: 12.5 }}>
              {editItemForm.cantidad && editItemForm.precio_unitario ? (
                <span className="mono" style={{ fontWeight: 600, color: 'var(--accent-2)' }}>
                  {(parseFloat(editItemForm.cantidad || '0') * parseFloat(editItemForm.precio_unitario || '0')).toLocaleString('es-PE', { minimumFractionDigits: 2 })} {editItemForm.moneda}
                </span>
              ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Estado</label>
            <select className="select" value={editItemForm.estado} onChange={e => setEditItemForm(f => ({ ...f, estado: e.target.value as EstadoItem }))} style={{ width: '100%' }}>
              {(['Pendiente','En compra','En importación','Recibido','Facturado','Despachado','Entregado'] as EstadoItem[]).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Tipo de negocio</label>
            <select className="select" value={editItemForm.tipo_negocio} onChange={e => setEditItemForm(f => ({ ...f, tipo_negocio: e.target.value as TipoNegocio | '' }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              <option value="Venta">Venta</option>
              <option value="Servicio">Servicio</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Sub tipo de negocio</label>
            <select className="select" value={editItemForm.sub_tipo_negocio} onChange={e => setEditItemForm(f => ({ ...f, sub_tipo_negocio: e.target.value as SubTipoNegocio | '' }))} style={{ width: '100%' }}>
              <option value="">— Sin especificar —</option>
              <option value="Importación">Importación</option>
              <option value="Local">Local</option>
              <option value="Servicio">Servicio</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Fecha req. cliente</label>
            <input type="date" className="input" value={editItemForm.fecha_req_cliente} onChange={e => setEditItemForm(f => ({ ...f, fecha_req_cliente: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Código cliente</label>
            <input className="input" value={editItemForm.codigo_cliente} onChange={e => setEditItemForm(f => ({ ...f, codigo_cliente: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">N° Deal</label>
            <input className="input" value={editItemForm.num_deal} onChange={e => setEditItemForm(f => ({ ...f, num_deal: e.target.value }))} style={{ width: '100%', fontFamily: 'var(--font-mono)' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Centro de costo</label>
            <input className="input" value={editItemForm.centro_costo} onChange={e => setEditItemForm(f => ({ ...f, centro_costo: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Requiere armado</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', height: 34, padding: '0 10px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
              <input type="checkbox" checked={editItemForm.requiere_armado} onChange={e => setEditItemForm(f => ({ ...f, requiere_armado: e.target.checked }))} />
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Sí, requiere armado</span>
            </label>
          </div>
        </div>
      </Modal>

      {/* Modal eliminar ítem */}
      <Modal
        open={!!deleteItemRow}
        onClose={() => { setDeleteItemRow(null); setDeleteItemError(null) }}
        title="Eliminar ítem"
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => { setDeleteItemRow(null); setDeleteItemError(null) }}>Cancelar</button>
            <button className="btn" style={{ background: 'var(--bad)', color: '#fff' }} onClick={handleDeleteItem} disabled={deletingItem}>
              {deletingItem ? 'Eliminando…' : 'Eliminar'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13.5 }}>
          ¿Eliminar el ítem <strong>{deleteItemRow?.codigo_comercial || deleteItemRow?.descripcion}</strong>? Esta acción no se puede deshacer.
        </p>
        {deleteItemError && (
          <p style={{ fontSize: 13, color: 'var(--bad)', marginTop: 8, marginBottom: 0 }}>{deleteItemError}</p>
        )}
      </Modal>

      {/* Modal cambiar estado */}
      <Modal
        open={showEstado}
        onClose={() => { setShowEstado(false); setNuevoEstado(''); setComentEstado('') }}
        title="Cambiar estado de la operación"
        subtitle={op.correlativo_opci}
        size="sm"
        footer={
          <>
            <button className="btn" onClick={() => setShowEstado(false)}>Cancelar</button>
            <button className="btn primary" onClick={handleCambiarEstado} disabled={!nuevoEstado || savingEstado}>
              {savingEstado ? 'Guardando…' : 'Confirmar cambio'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tiny">Estado actual:</span>
            <StatusBadge status={op.estado} mapping={OPCI_STATUS_TONE} />
          </div>
          <div className="form-field">
            <label className="form-label">Nuevo estado *</label>
            <select className="select" value={nuevoEstado} onChange={e => setNuevoEstado(e.target.value as EstadoOPCI)} style={{ width: '100%' }}>
              <option value="">— Selecciona —</option>
              {nextStates.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Comentario (opcional)</label>
            <textarea
              className="input"
              rows={3}
              placeholder="Motivo del cambio de estado…"
              value={comentEstado}
              onChange={e => setComentEstado(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
