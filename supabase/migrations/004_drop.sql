 -- Eliminar triggers primero                                                                                                                                                     
  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
                                                                                                                                                                                   
  -- Eliminar todas las tablas en orden (respetando FK)     
  DROP TABLE IF EXISTS public.ordenes_compra_notas CASCADE;
  DROP TABLE IF EXISTS public.operacion_item_notas CASCADE;
  DROP TABLE IF EXISTS public.confirmaciones_entrega CASCADE;
  DROP TABLE IF EXISTS public.guias_remision CASCADE;
  DROP TABLE IF EXISTS public.despachos CASCADE;
  DROP TABLE IF EXISTS public.almacen_stock CASCADE;
  DROP TABLE IF EXISTS public.almacen_movimientos CASCADE;
  DROP TABLE IF EXISTS public.recepciones CASCADE;
  DROP TABLE IF EXISTS public.pagos_factura CASCADE;
  DROP TABLE IF EXISTS public.facturas_venta CASCADE;
  DROP TABLE IF EXISTS public.importacion_costos CASCADE;
  DROP TABLE IF EXISTS public.proveedor_fecha_historial CASCADE;
  DROP TABLE IF EXISTS public.orden_compra_items CASCADE;
  DROP TABLE IF EXISTS public.ordenes_compra CASCADE;
  DROP TABLE IF EXISTS public.operacion_items CASCADE;
  DROP TABLE IF EXISTS public.operaciones CASCADE;
  DROP TABLE IF EXISTS public.importaciones CASCADE;
  DROP TABLE IF EXISTS public.almacenes CASCADE;
  DROP TABLE IF EXISTS public.documentos_adjuntos CASCADE;
  DROP TABLE IF EXISTS public.historial_eventos CASCADE;
  DROP TABLE IF EXISTS public.comentarios CASCADE;
  DROP TABLE IF EXISTS public.productos CASCADE;
  DROP TABLE IF EXISTS public.proveedores CASCADE;
  DROP TABLE IF EXISTS public.clientes CASCADE;
  DROP TABLE IF EXISTS public.profiles CASCADE;
  DROP TABLE IF EXISTS public.app_configuracion CASCADE;

  -- Eliminar funciones
  DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
  DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
  DROP FUNCTION IF EXISTS public.get_user_rol() CASCADE;