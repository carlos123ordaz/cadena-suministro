-- =============================================================================
-- CadenaSuministro — Migration 002: Row Level Security
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Helper: get the rol of the currently authenticated user
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_user_rol()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM public.profiles WHERE id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedores           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operaciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacion_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orden_compra_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importaciones         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacion_costos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_venta        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_factura         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almacenes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.almacen_movimientos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recepciones           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despachos             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guias_remision        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.confirmaciones_entrega ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos_adjuntos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.historial_eventos     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comentarios           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_fecha_historial  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagos_factura              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacion_item_notas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra_notas       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_configuracion          ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- app_configuracion
-- ---------------------------------------------------------------------------
CREATE POLICY "app_config_select"
  ON public.app_configuracion FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "app_config_write_admin"
  ON public.app_configuracion FOR ALL
  TO authenticated
  USING (get_user_rol() = 'Administrador')
  WITH CHECK (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_admin_all"
  ON public.profiles FOR ALL
  TO authenticated
  USING (get_user_rol() = 'Administrador')
  WITH CHECK (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------------
CREATE POLICY "clientes_select"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "clientes_insert"
  ON public.clientes FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "clientes_update"
  ON public.clientes FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Ventas','Administrador'))
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "clientes_delete"
  ON public.clientes FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- proveedores
-- ---------------------------------------------------------------------------
CREATE POLICY "proveedores_select"
  ON public.proveedores FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "proveedores_insert"
  ON public.proveedores FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "proveedores_update"
  ON public.proveedores FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Ventas','Administrador'))
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "proveedores_delete"
  ON public.proveedores FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------------------
CREATE POLICY "productos_select"
  ON public.productos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "productos_insert"
  ON public.productos FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "productos_update"
  ON public.productos FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Ventas','Administrador'))
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "productos_delete"
  ON public.productos FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- operaciones
-- ---------------------------------------------------------------------------
CREATE POLICY "operaciones_select"
  ON public.operaciones FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "operaciones_insert"
  ON public.operaciones FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "operaciones_update"
  ON public.operaciones FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Ventas','Compras Locales','Importaciones','Administrador'))
  WITH CHECK (get_user_rol() IN ('Ventas','Compras Locales','Importaciones','Administrador'));

CREATE POLICY "operaciones_delete"
  ON public.operaciones FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- operacion_items
-- ---------------------------------------------------------------------------
CREATE POLICY "op_items_select"
  ON public.operacion_items FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "op_items_insert"
  ON public.operacion_items FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "op_items_update"
  ON public.operacion_items FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Ventas','Compras Locales','Importaciones','Administrador'))
  WITH CHECK (get_user_rol() IN ('Ventas','Compras Locales','Importaciones','Administrador'));

CREATE POLICY "op_items_delete"
  ON public.operacion_items FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- ordenes_compra
-- ---------------------------------------------------------------------------
CREATE POLICY "oc_select"
  ON public.ordenes_compra FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "oc_insert"
  ON public.ordenes_compra FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'));

CREATE POLICY "oc_update"
  ON public.ordenes_compra FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'))
  WITH CHECK (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'));

CREATE POLICY "oc_delete"
  ON public.ordenes_compra FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- orden_compra_items
-- ---------------------------------------------------------------------------
CREATE POLICY "oc_items_select"
  ON public.orden_compra_items FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "oc_items_insert"
  ON public.orden_compra_items FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'));

CREATE POLICY "oc_items_update"
  ON public.orden_compra_items FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'))
  WITH CHECK (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'));

CREATE POLICY "oc_items_delete"
  ON public.orden_compra_items FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- importaciones
-- ---------------------------------------------------------------------------
CREATE POLICY "importaciones_select"
  ON public.importaciones FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "importaciones_insert"
  ON public.importaciones FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Importaciones','Administrador'));

CREATE POLICY "importaciones_update"
  ON public.importaciones FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Importaciones','Administrador'))
  WITH CHECK (get_user_rol() IN ('Importaciones','Administrador'));

CREATE POLICY "importaciones_delete"
  ON public.importaciones FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- importacion_costos
-- ---------------------------------------------------------------------------
CREATE POLICY "imp_costos_select"
  ON public.importacion_costos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "imp_costos_insert"
  ON public.importacion_costos FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Importaciones','Administrador'));

CREATE POLICY "imp_costos_update"
  ON public.importacion_costos FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Importaciones','Administrador'))
  WITH CHECK (get_user_rol() IN ('Importaciones','Administrador'));

CREATE POLICY "imp_costos_delete"
  ON public.importacion_costos FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- facturas_venta
-- ---------------------------------------------------------------------------
CREATE POLICY "fv_select"
  ON public.facturas_venta FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "fv_insert"
  ON public.facturas_venta FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Facturacion','Administrador'));

CREATE POLICY "fv_update"
  ON public.facturas_venta FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Facturacion','Administrador'))
  WITH CHECK (get_user_rol() IN ('Facturacion','Administrador'));

CREATE POLICY "fv_delete"
  ON public.facturas_venta FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- pagos_factura
-- ---------------------------------------------------------------------------
CREATE POLICY "pagos_select"
  ON public.pagos_factura FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "pagos_insert"
  ON public.pagos_factura FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Facturacion','Administrador'));

CREATE POLICY "pagos_update"
  ON public.pagos_factura FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Facturacion','Administrador'))
  WITH CHECK (get_user_rol() IN ('Facturacion','Administrador'));

CREATE POLICY "pagos_delete"
  ON public.pagos_factura FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- almacenes
-- ---------------------------------------------------------------------------
CREATE POLICY "almacenes_select"
  ON public.almacenes FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "almacenes_insert"
  ON public.almacenes FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "almacenes_update"
  ON public.almacenes FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "almacenes_delete"
  ON public.almacenes FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- almacen_stock
-- ---------------------------------------------------------------------------
ALTER TABLE public.almacen_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "almacen_stock_select"
  ON public.almacen_stock FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "almacen_stock_insert"
  ON public.almacen_stock FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "almacen_stock_update"
  ON public.almacen_stock FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

-- ---------------------------------------------------------------------------
-- almacen_movimientos
-- ---------------------------------------------------------------------------
CREATE POLICY "am_select"
  ON public.almacen_movimientos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "am_insert"
  ON public.almacen_movimientos FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "am_update"
  ON public.almacen_movimientos FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

-- ---------------------------------------------------------------------------
-- recepciones
-- ---------------------------------------------------------------------------
CREATE POLICY "recepciones_select"
  ON public.recepciones FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "recepciones_insert"
  ON public.recepciones FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "recepciones_update"
  ON public.recepciones FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

-- ---------------------------------------------------------------------------
-- despachos
-- ---------------------------------------------------------------------------
CREATE POLICY "despachos_select"
  ON public.despachos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "despachos_insert"
  ON public.despachos FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "despachos_update"
  ON public.despachos FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

-- ---------------------------------------------------------------------------
-- guias_remision
-- ---------------------------------------------------------------------------
CREATE POLICY "guias_select"
  ON public.guias_remision FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "guias_insert"
  ON public.guias_remision FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "guias_update"
  ON public.guias_remision FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

-- ---------------------------------------------------------------------------
-- confirmaciones_entrega
-- ---------------------------------------------------------------------------
CREATE POLICY "conf_entrega_select"
  ON public.confirmaciones_entrega FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "conf_entrega_insert"
  ON public.confirmaciones_entrega FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

CREATE POLICY "conf_entrega_update"
  ON public.confirmaciones_entrega FOR UPDATE
  TO authenticated
  USING (get_user_rol() IN ('Almacen','Administrador'))
  WITH CHECK (get_user_rol() IN ('Almacen','Administrador'));

-- ---------------------------------------------------------------------------
-- documentos_adjuntos
-- ---------------------------------------------------------------------------
CREATE POLICY "docs_select"
  ON public.documentos_adjuntos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "docs_insert_own"
  ON public.documentos_adjuntos FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "docs_delete_owner_or_admin"
  ON public.documentos_adjuntos FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- historial_eventos
-- ---------------------------------------------------------------------------
CREATE POLICY "historial_select"
  ON public.historial_eventos FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "historial_insert"
  ON public.historial_eventos FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- No UPDATE or DELETE policies — historial is append-only.

-- ---------------------------------------------------------------------------
-- comentarios
-- ---------------------------------------------------------------------------
CREATE POLICY "comentarios_select"
  ON public.comentarios FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "comentarios_insert_own"
  ON public.comentarios FOR INSERT
  TO authenticated
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "comentarios_update_own"
  ON public.comentarios FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

CREATE POLICY "comentarios_delete_admin"
  ON public.comentarios FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- proveedor_fecha_historial
-- ---------------------------------------------------------------------------
CREATE POLICY "pfh_select"
  ON public.proveedor_fecha_historial FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "pfh_insert"
  ON public.proveedor_fecha_historial FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'));

CREATE POLICY "pfh_delete"
  ON public.proveedor_fecha_historial FOR DELETE
  TO authenticated
  USING (get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- operacion_item_notas
-- ---------------------------------------------------------------------------
CREATE POLICY "op_item_notas_select"
  ON public.operacion_item_notas FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "op_item_notas_insert"
  ON public.operacion_item_notas FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Ventas','Administrador'));

CREATE POLICY "op_item_notas_update"
  ON public.operacion_item_notas FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'Administrador')
  WITH CHECK (usuario_id = auth.uid() OR get_user_rol() = 'Administrador');

CREATE POLICY "op_item_notas_delete"
  ON public.operacion_item_notas FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'Administrador');

-- ---------------------------------------------------------------------------
-- ordenes_compra_notas
-- ---------------------------------------------------------------------------
CREATE POLICY "oc_notas_select"
  ON public.ordenes_compra_notas FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "oc_notas_insert"
  ON public.ordenes_compra_notas FOR INSERT
  TO authenticated
  WITH CHECK (get_user_rol() IN ('Compras Locales','Importaciones','Administrador'));

CREATE POLICY "oc_notas_update"
  ON public.ordenes_compra_notas FOR UPDATE
  TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'Administrador')
  WITH CHECK (usuario_id = auth.uid() OR get_user_rol() = 'Administrador');

CREATE POLICY "oc_notas_delete"
  ON public.ordenes_compra_notas FOR DELETE
  TO authenticated
  USING (usuario_id = auth.uid() OR get_user_rol() = 'Administrador');
