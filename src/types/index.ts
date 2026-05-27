// ─── Core primitives ──────────────────────────────────────────────

export type UUID = string
export type ISODate = string   // "YYYY-MM-DD"
export type ISOTimestamp = string

export type Currency = 'USD' | 'PEN' | 'EUR'

export type Moneda = Currency

// ─── Auth / Roles ──────────────────────────────────────────────────

export type RolNombre =
  | 'Administrador'
  | 'Ventas'
  | 'Compras Locales'
  | 'Importaciones'
  | 'Almacen'
  | 'Facturacion'
  | 'Gerencia'
  | 'Lectura'

export interface Profile {
  id: UUID
  email: string
  nombre_completo: string
  iniciales: string
  avatar_url?: string
  rol: RolNombre
  es_vendedor: boolean
  activo: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Clientes ─────────────────────────────────────────────────────

export interface Cliente {
  id: UUID
  ruc: string
  razon_social: string
  nombre_comercial?: string
  ciudad?: string
  sector?: string
  contacto_nombre?: string
  contacto_email?: string
  contacto_telefono?: string
  activo: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Proveedores ──────────────────────────────────────────────────

export type TipoProveedor = 'Local' | 'Importacion'

export interface Proveedor {
  id: UUID
  ruc_nro_doc?: string
  razon_social: string
  tipo: TipoProveedor
  pais?: string
  ciudad?: string
  contacto_nombre?: string
  contacto_email?: string
  moneda_habitual?: Currency
  activo: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Productos ────────────────────────────────────────────────────

export type TipoProducto = 'Producto' | 'Servicio' | 'Proyecto'

export interface Producto {
  id: UUID
  codigo_comercial: string
  descripcion: string
  tipo: TipoProducto
  clase?: string
  subclase?: string
  subsubclase?: string
  unidad_medida: string
  marca?: string
  codigo_erp?: string
  precio_referencial?: number
  moneda_ref?: Currency
  activo: boolean
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Operaciones OPCI ─────────────────────────────────────────────

export type EstadoOPCI =
  | 'Borrador'
  | 'Recibida'
  | 'En evaluación'
  | 'En compra local'
  | 'En importación'
  | 'Pendiente de recepción'
  | 'Pendiente de facturación'
  | 'Facturada'
  | 'Pendiente de despacho'
  | 'Despachada'
  | 'Pendiente de cobranza'
  | 'Cerrada'
  | 'Observada'
  | 'Anulada'

export interface Operacion {
  id: UUID
  correlativo_opci: string
  fecha_recepcion: ISODate
  fecha_inicio?: ISODate
  fecha_procesamiento_vi?: ISODate
  cliente_id: UUID
  cliente?: Cliente
  cliente_final_id?: UUID
  cliente_final?: Cliente
  cliente_proveedor?: string
  numero_op?: string
  moneda: Currency
  monto_total_sin_igv: number
  numero_referencia_cliente?: string
  forma_pago?: string
  vendedor1_id?: UUID
  vendedor1?: Profile
  vendedor2_id?: UUID
  vendedor2?: Profile
  lider_id?: UUID
  lider?: Profile
  u_bruta_coti?: number
  comision_compartida?: string
  estado: EstadoOPCI
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Ítems de Operación ───────────────────────────────────────────

export type EstadoItem =
  | 'Pendiente'
  | 'En compra'
  | 'En importación'
  | 'Recibido'
  | 'Facturado'
  | 'Despachado'
  | 'Entregado'

export type TipoNegocio = 'Venta' | 'Servicio' | 'Proyecto'
export type SubTipoNegocio = 'Importación' | 'Local' | 'Servicio'
export type SubTipoNegocio2 = 'Backorder' | 'Consumo Interno' | 'Demo' | 'Garantía' | 'Stock' | 'Venta Bajo Pedido'

export interface OperacionItem {
  id: UUID
  operacion_id: UUID
  producto_id?: UUID
  producto?: Producto
  item_op: string
  codigo_comercial: string
  descripcion: string
  cantidad: number
  unidad_medida: string
  moneda: Currency
  precio_unitario: number
  tc_usd?: number
  monto_total: number
  tipo_negocio?: TipoNegocio
  sub_tipo_negocio?: SubTipoNegocio
  sub_tipo_negocio_2?: SubTipoNegocio2
  fecha_req_cliente?: ISODate
  requiere_armado?: boolean
  codigo_cliente?: string
  num_deal?: string
  centro_costo?: string
  subcentro_costo?: string
  sub_sub_centro_costo?: string
  t_e_semanas?: number
  numero_servicio?: string
  numero_proyecto?: string
  precio_total_estimado?: number
  estado: EstadoItem
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export interface OperacionItemNota {
  id: UUID
  operacion_item_id: UUID
  nota: string
  usuario_id: UUID
  usuario?: Profile
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Compras Locales (OCL) ────────────────────────────────────────

export type EstadoOCL =
  | 'Pendiente de cotización'
  | 'Cotizado'
  | 'OC emitida'
  | 'Confirmado por proveedor'
  | 'En espera de entrega'
  | 'Recibido parcial'
  | 'Recibido completo'
  | 'Facturado por proveedor'
  | 'Cerrado'
  | 'Observado'
  | 'Anulado'

export interface OrdenCompraLocal {
  id: UUID
  operacion_id?: UUID
  operacion?: Operacion
  proveedor_id: UUID
  proveedor?: Proveedor
  num_oc: string
  fecha_oc: ISODate
  fecha_inicio?: ISODate
  categoria_forma_pago?: string
  forma_pago?: string
  moneda: Currency
  monto_total: number
  t_e_semanas?: number
  num_cotizacion_proveedor?: string
  fecha_ofrecida?: ISODate
  num_confirmacion_proveedor?: string
  fecha_factura_prov?: ISODate
  numero_factura_proveedor?: string
  status: EstadoOCL
  notas?: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export interface OrdenCompraLocalItem {
  id: UUID
  orden_compra_id: UUID
  producto_id?: UUID
  producto?: Producto
  operacion_id?: UUID
  operacion_item_id?: UUID
  item_oc: string
  item_op?: string
  codigo_comercial: string
  descripcion: string
  cantidad: number
  unidad_medida: string
  moneda: Currency
  pcu1: number
  pcu2?: number
  tc_usd?: number
  monto_total: number
  created_at: ISOTimestamp
}

export interface OrdenCompraNota {
  id: UUID
  orden_compra_id: UUID
  nota: string
  usuario_id: UUID
  usuario?: Profile
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export interface ProveedorFechaHistorial {
  id: UUID
  compra_id: UUID
  fecha_prometida: ISODate
  tipo: 'inicial' | 'actualizacion'
  motivo?: string
  usuario_id: UUID
  usuario?: Profile
  created_at: ISOTimestamp
}

// ─── Compras Importación (OCI) ────────────────────────────────────

export type EstadoOCI =
  | 'Borrador'
  | 'OC emitida'
  | 'Confirmada por proveedor'
  | 'Pendiente de invoice'
  | 'Invoice recibida'
  | 'En preparación de embarque'
  | 'Embarcada'
  | 'En tránsito'
  | 'Arribada'
  | 'En aduanas'
  | 'Nacionalizada'
  | 'En traslado a almacén'
  | 'Recibida en almacén'
  | 'Costeada'
  | 'Cerrada'
  | 'Observada'
  | 'Anulada'

export interface OrdenCompraImportacion {
  id: UUID
  operacion_id?: UUID
  operacion?: Operacion
  importacion_id?: UUID
  importacion?: Importacion
  proveedor_id: UUID
  proveedor?: Proveedor
  num_oc: string
  fecha_oc: ISODate
  categoria_forma_pago?: string
  forma_pago?: string
  status: EstadoOCI
  moneda: Currency
  monto_total: number
  t_e_semanas?: number
  num_cotizacion_proveedor?: string
  fecha_ofrecida?: ISODate
  num_confirmacion_proveedor?: string
  fecha_invoice?: ISODate
  num_invoice?: string
  tipo_embarque?: string
  pais_embarque?: string
  ciudad_embarque?: string
  pais_origen?: string
  num_doc_transporte?: string
  eta?: ISODate
  peso_bruto_kgs?: number
  flete_usd?: number
  notas?: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export interface OrdenCompraImportacionItem {
  id: UUID
  orden_compra_id: UUID
  producto_id?: UUID
  producto?: Producto
  operacion_id?: UUID
  operacion_item_id?: UUID
  item_oc: string
  item_op?: string
  codigo_comercial: string
  descripcion: string
  cantidad: number
  unidad_medida: string
  moneda: Currency
  pcu1: number
  pcu2?: number
  tc_usd?: number
  monto_total: number
  num_item_invoice?: string
  created_at: ISOTimestamp
}

// ─── Importaciones / Grupos ───────────────────────────────────────

export type EstadoImportacion =
  | 'Borrador'
  | 'OC emitida'
  | 'Confirmada por proveedor'
  | 'Pendiente de invoice'
  | 'Invoice recibida'
  | 'En preparación de embarque'
  | 'Embarcada'
  | 'En tránsito'
  | 'Arribada'
  | 'En aduanas'
  | 'Nacionalizada'
  | 'En traslado a almacén'
  | 'Recibida en almacén'
  | 'Costeada'
  | 'Cerrada'
  | 'Observada'
  | 'Anulada'

export interface Importacion {
  id: UUID
  grupo_importacion: string
  operador_logistico?: string
  incoterm?: string
  tipo_embarque?: string
  pais_embarque?: string
  ciudad_embarque?: string
  pais_origen?: string
  numero_documento_transporte?: string
  eta?: ISODate
  fecha_arribo?: ISODate
  fecha_nacionalizacion?: ISODate
  fecha_recepcion_almacen?: ISODate
  peso_bruto_kg?: number
  flete_usd?: number
  status: EstadoImportacion
  observaciones?: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Costos de Importación ────────────────────────────────────────

export type TipoCosto =
  | 'Flete internacional'
  | 'Seguro'
  | 'Aduanas'
  | 'Agente de aduana'
  | 'Transporte local'
  | 'Gastos portuarios'
  | 'Almacenaje'
  | 'IGV'
  | 'Percepción'
  | 'Otros gastos'

export type CriterioDistribucion = 'peso' | 'valor' | 'cantidad' | 'manual'

export interface CostoImportacion {
  id: UUID
  importacion_id: UUID
  tipo_costo: TipoCosto
  descripcion?: string
  moneda: Currency
  monto: number
  tipo_cambio?: number
  monto_usd: number
  criterio_distribucion: CriterioDistribucion
  documento_adjunto?: string
  fecha: ISODate
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Facturas de Venta ────────────────────────────────────────────

export type EstadoFactura =
  | 'Pendiente de emisión'
  | 'Emitida'
  | 'Enviada al cliente'
  | 'Pendiente de pago'
  | 'Pagada parcial'
  | 'Pagada total'
  | 'Vencida'
  | 'Anulada'
  | 'Nota de crédito emitida'

export interface FacturaVenta {
  id: UUID
  operacion_id: UUID
  operacion?: Operacion
  num_factura: string
  status: EstadoFactura
  fecha_emision?: ISODate
  fecha_inicio?: ISODate
  fecha_prometida_pago?: ISODate
  fecha_pago?: ISODate
  categoria_forma_pago?: string
  forma_pago?: string
  dias_cobranza?: number
  moneda: Currency
  monto_total_sin_igv: number
  factor_igv?: number
  tc_usd_sol?: number
  producto_crm?: string
  notas?: string
  entidad_financiera?: string
  categoria_operacion?: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export interface PagoFactura {
  id: UUID
  factura_id: UUID
  fecha_pago: ISODate
  monto: number
  moneda: Currency
  referencia?: string
  entidad_financiera?: string
  usuario_id: UUID
  created_at: ISOTimestamp
}

// ─── Almacén ──────────────────────────────────────────────────────

export interface Almacen {
  id: UUID
  nombre: string
  codigo: string
  direccion?: string
  responsable_id?: UUID
  activo: boolean
  created_at: ISOTimestamp
}

export type TipoMovimientoAlmacen = 'entrada' | 'salida' | 'ajuste' | 'devolucion'

export interface AlmacenMovimiento {
  id: UUID
  almacen_id: UUID
  producto_codigo: string
  tipo: TipoMovimientoAlmacen
  cantidad: number
  stock_anterior: number
  stock_final: number
  documento_referencia?: string
  documento_tipo?: string
  operacion_id?: UUID
  recepcion_id?: UUID
  despacho_id?: UUID
  usuario_id: UUID
  comentario?: string
  created_at: ISOTimestamp
}

export type EstadoRecepcion = 'Pendiente' | 'Recibido parcial' | 'Recibido completo' | 'Observado'
export type ConformidadRecepcion = 'Conforme' | 'Observado' | 'Rechazado'

export interface Recepcion {
  id: UUID
  operacion_id?: UUID
  operacion?: Operacion
  importacion_id?: UUID
  orden_compra_id?: UUID
  almacen_id: UUID
  num_oc?: string
  item_oc?: string
  item_op?: string
  codigo_comercial: string
  descripcion: string
  cantidad_esperada: number
  cantidad_recibida: number
  unidad_medida: string
  estado: EstadoRecepcion
  conf_almacen?: ConformidadRecepcion
  motivo_conf_almacen?: string
  conf_servicio?: ConformidadRecepcion
  motivo_conf_servicio?: string
  fecha_recepcion?: ISODate
  fecha_mercaderia_revisada?: ISODate
  erp_inta_entrada?: string
  notas?: string
  usuario_id: UUID
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export type EstadoDespacho = 'Preparando' | 'En transporte' | 'Entregado' | 'Observado' | 'Anulado'

export interface Despacho {
  id: UUID
  operacion_id: UUID
  operacion?: Operacion
  factura_id?: UUID
  almacen_id: UUID
  codigo_comercial: string
  descripcion: string
  cantidad: number
  unidad_medida: string
  distrito_despacho?: string
  fecha_despacho?: ISODate
  erp_inta_salida?: string
  estado: EstadoDespacho
  notas?: string
  usuario_id: UUID
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Guías de Remisión ────────────────────────────────────────────

export type EstadoGuia = 'Emitida' | 'En transporte' | 'Entregada' | 'Anulada'

export interface GuiaRemision {
  id: UUID
  operacion_id?: UUID
  despacho_id?: UUID
  numero_guia: string
  fecha_emision?: ISODate
  fecha_despacho?: ISODate
  transportista?: string
  placa?: string
  conductor?: string
  distrito_destino?: string
  direccion_destino?: string
  estado: EstadoGuia
  documento_pdf?: string
  observaciones?: string
  usuario_id: UUID
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

export type ConformidadEntrega = 'Conforme' | 'Observado' | 'Rechazado'

export interface ConfirmacionEntrega {
  id: UUID
  despacho_id: UUID
  guia_id?: UUID
  fecha_confirmacion: ISODate
  recibido_por?: string
  conformidad: ConformidadEntrega
  motivo_observacion?: string
  firma_evidencia?: string
  fotos_adjuntas?: string[]
  usuario_id: UUID
  created_at: ISOTimestamp
}

// ─── Documentos Adjuntos ──────────────────────────────────────────

export type TipoDocumento =
  | 'OC cliente'
  | 'Cotización proveedor'
  | 'Confirmación proveedor'
  | 'Factura proveedor'
  | 'Commercial Invoice'
  | 'Packing List'
  | 'Documento de transporte'
  | 'BL / AWB / tracking'
  | 'Guía de remisión'
  | 'Factura de venta'
  | 'Evidencia de entrega'
  | 'Comprobante de pago'
  | 'Documentos de aduanas'
  | 'Otro'

export type EntidadTipo =
  | 'operacion'
  | 'orden_compra_local'
  | 'orden_compra_importacion'
  | 'importacion'
  | 'factura'
  | 'recepcion'
  | 'despacho'
  | 'guia'

export interface DocumentoAdjunto {
  id: UUID
  entidad_tipo: EntidadTipo
  entidad_id: UUID
  tipo_documento: TipoDocumento
  nombre_archivo: string
  url_storage: string
  tamanio_bytes?: number
  mime_type?: string
  usuario_id: UUID
  usuario?: Profile
  created_at: ISOTimestamp
}

// ─── Historial de Eventos ─────────────────────────────────────────

export interface HistorialEvento {
  id: UUID
  entidad_tipo: EntidadTipo
  entidad_id: UUID
  usuario_id: UUID
  usuario?: Profile
  accion: string
  valor_anterior?: string
  valor_nuevo?: string
  comentario?: string
  created_at: ISOTimestamp
}

// ─── Comentarios ──────────────────────────────────────────────────

export interface Comentario {
  id: UUID
  entidad_tipo: EntidadTipo
  entidad_id: UUID
  usuario_id: UUID
  usuario?: Profile
  texto: string
  created_at: ISOTimestamp
  updated_at: ISOTimestamp
}

// ─── Filters / Pagination ─────────────────────────────────────────

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface SortParams {
  field: string
  direction: 'asc' | 'desc'
}

export interface OperacionFilters {
  estado?: EstadoOPCI
  cliente_id?: UUID
  vendedor1_id?: UUID
  fecha_desde?: ISODate
  fecha_hasta?: ISODate
  search?: string
}

export interface ImportacionFilters {
  status?: EstadoImportacion
  incoterm?: string
  tipo_embarque?: string
  search?: string
}

export interface FacturaFilters {
  status?: EstadoFactura
  vencidas?: boolean
  fecha_desde?: ISODate
  fecha_hasta?: ISODate
  search?: string
}

// ─── Dashboard stats ──────────────────────────────────────────────

export interface DashboardStats {
  operaciones_activas: number
  importaciones_en_transito: number
  importaciones_en_aduanas: number
  importaciones_pendientes_costeo: number
  facturas_vencidas: number
  pedidos_pendientes_despacho: number
  productos_pendientes_recepcion: number
  alertas_eta_proxima: number
}
