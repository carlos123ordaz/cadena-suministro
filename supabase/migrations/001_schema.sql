-- =============================================================================
-- CadenaSuministro — Migration 001: Schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- updated_at trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Auth hook: create profile on user sign-up
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre_completo, iniciales, rol)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre_completo', split_part(NEW.email, '@', 1)),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'nombre_completo', split_part(NEW.email, '@', 1)), 2)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'Lectura')
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               TEXT,
  nombre_completo     TEXT,
  iniciales           TEXT,
  avatar_url          TEXT,
  rol                 TEXT CHECK (rol IN (
                        'Administrador','Ventas','Compras Locales','Importaciones',
                        'Almacen','Facturacion','Gerencia','Lectura'
                      )),
  es_vendedor         BOOLEAN DEFAULT FALSE,
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- app_configuracion (parámetros del sistema)
-- ---------------------------------------------------------------------------
CREATE TABLE public.app_configuracion (
  clave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_app_configuracion_updated_at
  BEFORE UPDATE ON public.app_configuracion
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------------------
CREATE TABLE public.clientes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruc                 TEXT UNIQUE,
  razon_social        TEXT NOT NULL,
  nombre_comercial    TEXT,
  ciudad              TEXT,
  sector              TEXT,
  contacto_nombre     TEXT,
  contacto_email      TEXT,
  contacto_telefono   TEXT,
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- proveedores
-- ---------------------------------------------------------------------------
CREATE TABLE public.proveedores (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruc_nro_doc         TEXT,
  razon_social        TEXT NOT NULL,
  tipo                TEXT CHECK (tipo IN ('Local','Importacion')),
  pais                TEXT,
  ciudad              TEXT,
  contacto_nombre     TEXT,
  contacto_email      TEXT,
  moneda_habitual     TEXT,
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_proveedores_updated_at
  BEFORE UPDATE ON public.proveedores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------------------
CREATE TABLE public.productos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_comercial    TEXT UNIQUE NOT NULL,
  descripcion         TEXT NOT NULL,
  tipo                TEXT NOT NULL DEFAULT 'Producto' CHECK (tipo IN ('Producto','Servicio','Proyecto')),
  clase               TEXT,
  subclase            TEXT,
  subsubclase         TEXT,
  unidad_medida       TEXT,
  marca               TEXT,
  codigo_erp          TEXT,
  precio_referencial  NUMERIC(14,4),
  moneda_ref          TEXT DEFAULT 'USD',
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_productos_updated_at
  BEFORE UPDATE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- operaciones
-- ---------------------------------------------------------------------------
CREATE TABLE public.operaciones (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correlativo_opci                TEXT UNIQUE NOT NULL,
  fecha_recepcion                 DATE NOT NULL,
  fecha_inicio                    DATE,
  fecha_procesamiento_vi          DATE,
  cliente_id                      UUID REFERENCES public.clientes(id),
  cliente_final_id                UUID REFERENCES public.clientes(id),
  cliente_proveedor               TEXT,
  numero_op                       TEXT,
  moneda                          TEXT DEFAULT 'USD',
  monto_total_sin_igv             NUMERIC(14,2),
  numero_referencia_cliente       TEXT,
  forma_pago                      TEXT,
  vendedor1_id                    UUID REFERENCES public.profiles(id),
  vendedor2_id                    UUID REFERENCES public.profiles(id),
  lider_id                        UUID REFERENCES public.profiles(id),
  u_bruta_coti                    NUMERIC(8,4),
  comision_compartida             TEXT,
  estado                          TEXT DEFAULT 'Borrador' CHECK (estado IN (
                                    'Borrador','Recibida','En evaluación',
                                    'En compra local','En importación',
                                    'Pendiente de recepción','Pendiente de facturación',
                                    'Facturada','Pendiente de despacho','Despachada',
                                    'Pendiente de cobranza','Cerrada','Observada','Anulada'
                                  )),
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operaciones_correlativo       ON public.operaciones (correlativo_opci);
CREATE INDEX idx_operaciones_estado            ON public.operaciones (estado);
CREATE INDEX idx_operaciones_cliente_id        ON public.operaciones (cliente_id);
CREATE INDEX idx_operaciones_cliente_final_id  ON public.operaciones (cliente_final_id);
CREATE INDEX idx_operaciones_fecha_recepcion   ON public.operaciones (fecha_recepcion);
CREATE INDEX idx_operaciones_vendedor1_id      ON public.operaciones (vendedor1_id);

CREATE TRIGGER trg_operaciones_updated_at
  BEFORE UPDATE ON public.operaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- operacion_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.operacion_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id          UUID REFERENCES public.operaciones(id) ON DELETE CASCADE,
  producto_id           UUID REFERENCES public.productos(id),
  item_op               TEXT,
  codigo_comercial      TEXT,
  descripcion           TEXT,
  cantidad              NUMERIC,
  unidad_medida         TEXT,
  moneda                TEXT,
  precio_unitario       NUMERIC(14,4),
  tc_usd                NUMERIC(8,4),
  monto_total           NUMERIC(14,2),
  tipo_negocio          TEXT CHECK (tipo_negocio IN ('Venta','Servicio')),
  sub_tipo_negocio      TEXT CHECK (sub_tipo_negocio IN ('Importación','Local','Servicio')),
  sub_tipo_negocio_2    TEXT CHECK (sub_tipo_negocio_2 IN (
                          'Backorder','Consumo Interno','Demo','Garantía','Stock','Venta Bajo Pedido'
                        )),
  fecha_req_cliente     DATE,
  requiere_armado       BOOLEAN DEFAULT FALSE,
  codigo_cliente        TEXT,
  num_deal              TEXT,
  centro_costo          TEXT,
  subcentro_costo       TEXT,
  sub_sub_centro_costo  TEXT,
  estado                TEXT DEFAULT 'Pendiente',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_op_items_operacion_id  ON public.operacion_items (operacion_id);
CREATE INDEX idx_op_items_producto_id   ON public.operacion_items (producto_id);

CREATE TRIGGER trg_operacion_items_updated_at
  BEFORE UPDATE ON public.operacion_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- operacion_item_notas
-- ---------------------------------------------------------------------------
CREATE TABLE public.operacion_item_notas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_item_id   UUID REFERENCES public.operacion_items(id) ON DELETE CASCADE,
  nota                TEXT NOT NULL,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_op_item_notas_item_id ON public.operacion_item_notas (operacion_item_id);

CREATE TRIGGER trg_operacion_item_notas_updated_at
  BEFORE UPDATE ON public.operacion_item_notas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- importaciones
-- ---------------------------------------------------------------------------
CREATE TABLE public.importaciones (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_importacion               TEXT UNIQUE NOT NULL,
  operador_logistico              TEXT,
  incoterm                        TEXT,
  tipo_embarque                   TEXT,
  pais_embarque                   TEXT,
  ciudad_embarque                 TEXT,
  pais_origen                     TEXT,
  numero_documento_transporte     TEXT,
  eta                             DATE,
  fecha_arribo                    DATE,
  fecha_nacionalizacion           DATE,
  fecha_recepcion_almacen         DATE,
  peso_bruto_kg                   NUMERIC(10,2),
  flete_usd                       NUMERIC(12,2),
  status                          TEXT DEFAULT 'Borrador',
  observaciones                   TEXT,
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_importaciones_grupo    ON public.importaciones (grupo_importacion);
CREATE INDEX idx_importaciones_status   ON public.importaciones (status);
CREATE INDEX idx_importaciones_eta      ON public.importaciones (eta);

CREATE TRIGGER trg_importaciones_updated_at
  BEFORE UPDATE ON public.importaciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- ordenes_compra
-- ---------------------------------------------------------------------------
CREATE TABLE public.ordenes_compra (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id                    UUID REFERENCES public.operaciones(id),
  proveedor_id                    UUID REFERENCES public.proveedores(id),
  tipo                            TEXT CHECK (tipo IN ('Local','Importacion')),
  importacion_id                  UUID REFERENCES public.importaciones(id),
  num_oc                          TEXT UNIQUE NOT NULL,
  fecha_oc                        DATE,
  fecha_inicio                    DATE,
  categoria_forma_pago            TEXT,
  forma_pago                      TEXT,
  status                          TEXT,
  moneda                          TEXT,
  monto_total                     NUMERIC(14,2),
  t_e_semanas                     INT,
  num_cotizacion_proveedor        TEXT,
  fecha_ofrecida                  DATE,
  num_confirmacion_proveedor      TEXT,
  fecha_factura_prov              DATE,
  numero_factura_proveedor        TEXT,
  fecha_invoice                   DATE,
  num_invoice                     TEXT,
  num_item_invoice                TEXT,
  tipo_embarque                   TEXT,
  pais_embarque                   TEXT,
  ciudad_embarque                 TEXT,
  pais_origen                     TEXT,
  num_doc_transporte              TEXT,
  eta                             DATE,
  peso_bruto_kgs                  NUMERIC(10,2),
  flete_usd                       NUMERIC(12,2),
  notas                           TEXT,
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oc_operacion_id    ON public.ordenes_compra (operacion_id);
CREATE INDEX idx_oc_proveedor_id    ON public.ordenes_compra (proveedor_id);
CREATE INDEX idx_oc_importacion_id  ON public.ordenes_compra (importacion_id);
CREATE INDEX idx_oc_num_oc          ON public.ordenes_compra (num_oc);
CREATE INDEX idx_oc_eta             ON public.ordenes_compra (eta);
CREATE INDEX idx_oc_status          ON public.ordenes_compra (status);
CREATE INDEX idx_oc_tipo            ON public.ordenes_compra (tipo);

CREATE TRIGGER trg_ordenes_compra_updated_at
  BEFORE UPDATE ON public.ordenes_compra
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- ordenes_compra_notas
-- ---------------------------------------------------------------------------
CREATE TABLE public.ordenes_compra_notas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id     UUID REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  nota                TEXT NOT NULL,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oc_notas_oc_id ON public.ordenes_compra_notas (orden_compra_id);

CREATE TRIGGER trg_oc_notas_updated_at
  BEFORE UPDATE ON public.ordenes_compra_notas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- orden_compra_items
-- ---------------------------------------------------------------------------
CREATE TABLE public.orden_compra_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id     UUID REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  producto_id         UUID REFERENCES public.productos(id),
  operacion_id        UUID REFERENCES public.operaciones(id),
  operacion_item_id   UUID REFERENCES public.operacion_items(id),
  item_oc             TEXT,
  item_op             TEXT,
  codigo_comercial    TEXT,
  descripcion         TEXT,
  cantidad            NUMERIC,
  unidad_medida       TEXT,
  moneda              TEXT,
  pcu1                NUMERIC(14,4),
  pcu2                NUMERIC(14,4),
  tc_usd              NUMERIC(8,4),
  monto_total         NUMERIC(14,2),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oci_producto_id      ON public.orden_compra_items (producto_id);
CREATE INDEX idx_oci_operacion_id     ON public.orden_compra_items (operacion_id);
CREATE INDEX idx_oci_op_item_id       ON public.orden_compra_items (operacion_item_id);

-- ---------------------------------------------------------------------------
-- proveedor_fecha_historial
-- ---------------------------------------------------------------------------
CREATE TABLE public.proveedor_fecha_historial (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id           UUID REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  fecha_prometida     DATE NOT NULL,
  tipo                TEXT CHECK (tipo IN ('inicial','actualizacion')),
  motivo              TEXT,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- importacion_costos
-- ---------------------------------------------------------------------------
CREATE TABLE public.importacion_costos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  importacion_id          UUID REFERENCES public.importaciones(id) ON DELETE CASCADE,
  tipo_costo              TEXT NOT NULL,
  descripcion             TEXT,
  moneda                  TEXT,
  monto                   NUMERIC(14,2),
  tipo_cambio             NUMERIC(8,4),
  monto_usd               NUMERIC(14,2),
  criterio_distribucion   TEXT DEFAULT 'valor',
  documento_adjunto       TEXT,
  fecha                   DATE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_importacion_costos_updated_at
  BEFORE UPDATE ON public.importacion_costos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- facturas_venta
-- ---------------------------------------------------------------------------
CREATE TABLE public.facturas_venta (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id            UUID REFERENCES public.operaciones(id),
  num_factura             TEXT UNIQUE NOT NULL,
  status                  TEXT DEFAULT 'Pendiente de emisión',
  fecha_emision           DATE,
  fecha_inicio            DATE,
  fecha_prometida_pago    DATE,
  fecha_pago              DATE,
  categoria_forma_pago    TEXT,
  forma_pago              TEXT,
  dias_cobranza           INT,
  moneda                  TEXT DEFAULT 'PEN',
  monto_total_sin_igv     NUMERIC(14,2),
  factor_igv              NUMERIC(5,4) DEFAULT 1.18,
  tc_usd_sol              NUMERIC(8,4),
  producto_crm            TEXT,
  notas                   TEXT,
  entidad_financiera      TEXT,
  categoria_operacion     TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fv_operacion_id        ON public.facturas_venta (operacion_id);
CREATE INDEX idx_fv_status              ON public.facturas_venta (status);
CREATE INDEX idx_fv_fecha_prom_pago     ON public.facturas_venta (fecha_prometida_pago);
CREATE INDEX idx_fv_num_factura         ON public.facturas_venta (num_factura);

CREATE TRIGGER trg_facturas_venta_updated_at
  BEFORE UPDATE ON public.facturas_venta
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- pagos_factura
-- ---------------------------------------------------------------------------
CREATE TABLE public.pagos_factura (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id          UUID REFERENCES public.facturas_venta(id) ON DELETE CASCADE,
  fecha_pago          DATE NOT NULL,
  monto               NUMERIC(14,2),
  moneda              TEXT,
  referencia          TEXT,
  entidad_financiera  TEXT,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- almacenes
-- ---------------------------------------------------------------------------
CREATE TABLE public.almacenes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  codigo              TEXT UNIQUE,
  direccion           TEXT,
  responsable_id      UUID REFERENCES public.profiles(id),
  activo              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- almacen_movimientos
-- ---------------------------------------------------------------------------
CREATE TABLE public.almacen_movimientos (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almacen_id              UUID REFERENCES public.almacenes(id),
  producto_codigo         TEXT NOT NULL,
  tipo                    TEXT CHECK (tipo IN ('entrada','salida','ajuste','devolucion')),
  cantidad                NUMERIC,
  stock_anterior          NUMERIC,
  stock_final             NUMERIC,
  documento_referencia    TEXT,
  documento_tipo          TEXT,
  operacion_id            UUID,
  recepcion_id            UUID,
  despacho_id             UUID,
  usuario_id              UUID REFERENCES public.profiles(id),
  comentario              TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_am_producto_codigo ON public.almacen_movimientos (producto_codigo);
CREATE INDEX idx_am_almacen_id      ON public.almacen_movimientos (almacen_id);
CREATE INDEX idx_am_tipo            ON public.almacen_movimientos (tipo);
CREATE INDEX idx_am_created_at      ON public.almacen_movimientos (created_at);

-- ---------------------------------------------------------------------------
-- almacen_stock
-- ---------------------------------------------------------------------------
CREATE TABLE public.almacen_stock (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  almacen_id      UUID NOT NULL REFERENCES public.almacenes(id) ON DELETE CASCADE,
  producto_codigo TEXT NOT NULL,
  cantidad        NUMERIC NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT almacen_stock_unique UNIQUE (almacen_id, producto_codigo)
);

CREATE INDEX idx_almacen_stock_almacen  ON public.almacen_stock (almacen_id);
CREATE INDEX idx_almacen_stock_producto ON public.almacen_stock (producto_codigo);

-- ---------------------------------------------------------------------------
-- recepciones
-- ---------------------------------------------------------------------------
CREATE TABLE public.recepciones (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id                UUID REFERENCES public.operaciones(id),
  importacion_id              UUID REFERENCES public.importaciones(id),
  orden_compra_id             UUID REFERENCES public.ordenes_compra(id),
  almacen_id                  UUID REFERENCES public.almacenes(id),
  num_oc                      TEXT,
  item_oc                     TEXT,
  item_op                     TEXT,
  codigo_comercial            TEXT,
  descripcion                 TEXT,
  cantidad_esperada           NUMERIC,
  cantidad_recibida           NUMERIC DEFAULT 0,
  unidad_medida               TEXT,
  estado                      TEXT DEFAULT 'Pendiente',
  conf_almacen                TEXT,
  motivo_conf_almacen         TEXT,
  conf_servicio               TEXT,
  motivo_conf_servicio        TEXT,
  fecha_recepcion             DATE,
  fecha_mercaderia_revisada   DATE,
  erp_inta_entrada            TEXT,
  notas                       TEXT,
  usuario_id                  UUID REFERENCES public.profiles(id),
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recepciones_operacion_id  ON public.recepciones (operacion_id);
CREATE INDEX idx_recepciones_importacion   ON public.recepciones (importacion_id);
CREATE INDEX idx_recepciones_estado        ON public.recepciones (estado);

CREATE TRIGGER trg_recepciones_updated_at
  BEFORE UPDATE ON public.recepciones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- despachos
-- ---------------------------------------------------------------------------
CREATE TABLE public.despachos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id        UUID REFERENCES public.operaciones(id),
  factura_id          UUID REFERENCES public.facturas_venta(id),
  almacen_id          UUID REFERENCES public.almacenes(id),
  codigo_comercial    TEXT,
  descripcion         TEXT,
  cantidad            NUMERIC,
  unidad_medida       TEXT,
  distrito_despacho   TEXT,
  fecha_despacho      DATE,
  erp_inta_salida     TEXT,
  estado              TEXT DEFAULT 'Preparando',
  notas               TEXT,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_despachos_operacion_id  ON public.despachos (operacion_id);
CREATE INDEX idx_despachos_estado        ON public.despachos (estado);
CREATE INDEX idx_despachos_fecha         ON public.despachos (fecha_despacho);

CREATE TRIGGER trg_despachos_updated_at
  BEFORE UPDATE ON public.despachos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ---------------------------------------------------------------------------
-- guias_remision
-- ---------------------------------------------------------------------------
CREATE TABLE public.guias_remision (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operacion_id        UUID REFERENCES public.operaciones(id),
  despacho_id         UUID REFERENCES public.despachos(id),
  numero_guia         TEXT UNIQUE NOT NULL,
  fecha_emision       DATE,
  fecha_despacho      DATE,
  transportista       TEXT,
  placa               TEXT,
  conductor           TEXT,
  distrito_destino    TEXT,
  direccion_destino   TEXT,
  estado              TEXT DEFAULT 'Emitida',
  documento_pdf       TEXT,
  observaciones       TEXT,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_guias_remision_updated_at
  BEFORE UPDATE ON public.guias_remision
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_guias_remision_operacion_id ON public.guias_remision (operacion_id);
CREATE INDEX idx_guias_remision_despacho_id  ON public.guias_remision (despacho_id);
CREATE INDEX idx_guias_remision_created_at   ON public.guias_remision (created_at DESC);

-- ---------------------------------------------------------------------------
-- confirmaciones_entrega
-- ---------------------------------------------------------------------------
CREATE TABLE public.confirmaciones_entrega (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despacho_id         UUID REFERENCES public.despachos(id) ON DELETE CASCADE,
  guia_id             UUID REFERENCES public.guias_remision(id),
  fecha_confirmacion  DATE NOT NULL,
  recibido_por        TEXT,
  conformidad         TEXT CHECK (conformidad IN ('Conforme','Observado','Rechazado')),
  motivo_observacion  TEXT,
  firma_evidencia     TEXT,
  fotos_adjuntas      TEXT[],
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_confirmaciones_despacho_id ON public.confirmaciones_entrega (despacho_id);
CREATE INDEX idx_confirmaciones_guia_id     ON public.confirmaciones_entrega (guia_id);

-- ---------------------------------------------------------------------------
-- documentos_adjuntos
-- ---------------------------------------------------------------------------
CREATE TABLE public.documentos_adjuntos (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo        TEXT NOT NULL,
  entidad_id          UUID NOT NULL,
  tipo_documento      TEXT,
  nombre_archivo      TEXT NOT NULL,
  url_storage         TEXT NOT NULL,
  tamanio_bytes       INT,
  mime_type           TEXT,
  usuario_id          UUID REFERENCES public.profiles(id),
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_docs_entidad ON public.documentos_adjuntos (entidad_tipo, entidad_id);

-- ---------------------------------------------------------------------------
-- historial_eventos
-- ---------------------------------------------------------------------------
CREATE TABLE public.historial_eventos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo    TEXT NOT NULL,
  entidad_id      UUID NOT NULL,
  usuario_id      UUID REFERENCES public.profiles(id),
  accion          TEXT NOT NULL,
  valor_anterior  TEXT,
  valor_nuevo     TEXT,
  comentario      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_historial_entidad    ON public.historial_eventos (entidad_tipo, entidad_id);
CREATE INDEX idx_historial_created_at ON public.historial_eventos (created_at);

-- ---------------------------------------------------------------------------
-- comentarios
-- ---------------------------------------------------------------------------
CREATE TABLE public.comentarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_tipo    TEXT NOT NULL,
  entidad_id      UUID NOT NULL,
  usuario_id      UUID REFERENCES public.profiles(id),
  texto           TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comentarios_entidad ON public.comentarios (entidad_tipo, entidad_id);

CREATE TRIGGER trg_comentarios_updated_at
  BEFORE UPDATE ON public.comentarios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
