-- =============================================================================
-- CadenaSuministro — 006: Demo Data — Verificación del flujo completo
-- =============================================================================
--
-- ESCENARIO A  (importación en curso)
--   OPCI-00000001 — Cerro Verde — Sensores + Válvulas — USD 4,820
--   Complementa el seed 003: agrega OC importación, ítems y costos logísticos.
--   Estado actual: "En tránsito" → llegará a almacén en ETA 2026-06-05
--
-- ESCENARIO B  (compra local cerrada — flujo 100 % completo)
--   OPCI-00000002 — ALICORP Lima — Rodamientos + Correas — USD 1,309
--   Cubre todos los módulos:
--     Operación → OC Local → Recepción → Almacén → Factura → Pago
--     → Despacho → Guía de remisión → Confirmación de entrega
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECCIÓN A — Complementar importación OPCI-00000001
-- ---------------------------------------------------------------------------

-- A1: Orden de compra de importación
INSERT INTO public.ordenes_compra (
  id, operacion_id, proveedor_id, tipo, importacion_id,
  num_oc, fecha_oc, fecha_inicio,
  categoria_forma_pago, forma_pago,
  status, moneda, monto_total, t_e_semanas,
  num_cotizacion_proveedor, fecha_ofrecida,
  num_confirmacion_proveedor,
  num_invoice, num_item_invoice, fecha_invoice,
  tipo_embarque, pais_embarque, ciudad_embarque, pais_origen,
  num_doc_transporte, eta,
  peso_bruto_kgs, flete_usd, notas
) VALUES (
  '0c000002-0000-0000-0000-000000000002',
  '0a000001-0000-0000-0000-000000000001',            -- OPCI-00000001
  'd0000004-0000-0000-0000-000000000004',            -- NINGBO BAIDE
  'Importacion',
  '1b000001-0000-0000-0000-000000000001',            -- IMP-2026-011
  'OC-IMP-2026-0011',
  '2026-04-12',
  '2026-04-12',
  'T/T Advance',
  '30% anticipo, 70% contra BL',
  'En tránsito',
  'USD',
  4820.00,
  7,
  'QUOT-BAIDE-2026-0034',
  '2026-05-05',
  'CONF-BAIDE-2026-0034',
  'INV-BAIDE-2026-0112', 'ITEMS-1-2',
  '2026-05-10',
  'Aéreo', 'China', 'Ningbo', 'China',
  'MAWB-125-67834920',
  '2026-06-05',
  87.50, 620.00,
  'Embarque urgente — cliente espera entrega antes del 10-Jun-2026'
);

-- A2: Ítems de la OC de importación
INSERT INTO public.orden_compra_items (
  id, orden_compra_id, operacion_id, operacion_item_id,
  item_oc, item_op, codigo_comercial, descripcion,
  cantidad, unidad_medida, moneda, pcu1, monto_total
) VALUES
  (
    '0c000021-0000-0000-0000-000000000001',
    '0c000002-0000-0000-0000-000000000002',
    '0a000001-0000-0000-0000-000000000001',
    '0b000001-0000-0000-0000-000000000001',
    '01', '01',
    'SEN-PROX-NPN-M18',
    'Sensor de proximidad inductivo NPN M18 — rango 8 mm, IP67, 10–30 VDC',
    40, 'UN', 'USD', 35.25, 1410.00
  ),
  (
    '0c000021-0000-0000-0000-000000000002',
    '0c000002-0000-0000-0000-000000000002',
    '0a000001-0000-0000-0000-000000000001',
    '0b000002-0000-0000-0000-000000000002',
    '02', '02',
    'VAL-SOL-2P-DN25-24VDC',
    'Válvula solenoide 2/2 vías DN25 — 316L, 24 VDC, 16 bar',
    20, 'UN', 'USD', 84.00, 1680.00
  );

-- A3: Costos de importación — IMP-2026-011
INSERT INTO public.importacion_costos (
  id, importacion_id, tipo_costo, descripcion,
  moneda, monto, tipo_cambio, monto_usd,
  criterio_distribucion, fecha
) VALUES
  (
    '1c000001-0000-0000-0000-000000000001',
    '1b000001-0000-0000-0000-000000000001',
    'Flete internacional',
    'DHL Global Forwarding — cargo aéreo Ningbo–Lima (87.5 kg)',
    'USD', 620.00, 1.0000, 620.00,
    'peso',
    '2026-05-12'
  ),
  (
    '1c000002-0000-0000-0000-000000000002',
    '1b000001-0000-0000-0000-000000000001',
    'Aduanas',
    'Derechos arancelarios 6 % CIF + ISC — partidas 8536.90 y 8481.20',
    'PEN', 1390.50, 3.7200, 373.79,
    'valor',
    '2026-06-07'
  ),
  (
    '1c000003-0000-0000-0000-000000000003',
    '1b000001-0000-0000-0000-000000000001',
    'Agente de aduana',
    'Honorarios + gastos operativos — Agencia Aduanera Andina S.A.C.',
    'PEN', 650.00, 3.7200, 174.73,
    'valor',
    '2026-06-07'
  ),
  (
    '1c000004-0000-0000-0000-000000000004',
    '1b000001-0000-0000-0000-000000000001',
    'Transporte local',
    'Traslado aeropuerto Jorge Chávez → Almacén ACL-01 (Ate Vitarte)',
    'PEN', 380.00, 3.7200, 102.15,
    'peso',
    '2026-06-08'
  );


-- =============================================================================
-- SECCIÓN B — Flujo local completo: OPCI-00000002 (CERRADA)
-- =============================================================================

-- B1: Operación
INSERT INTO public.operaciones (
  id, correlativo_opci, fecha_recepcion, fecha_inicio,
  cliente_id, cliente_final_id,
  numero_op, moneda, monto_total_sin_igv,
  numero_referencia_cliente, forma_pago,
  u_bruta_coti, estado
) VALUES (
  '0a000002-0000-0000-0000-000000000002',
  'OPCI-00000002',
  '2026-04-15',
  '2026-04-16',
  'c0000001-0000-0000-0000-000000000001',   -- ALICORP
  'c0000001-0000-0000-0000-000000000001',
  'ALC-2026-0501',
  'USD',
  1309.00,
  'OC-ALC-2026-0501',
  '30 días neto',
  0.2500,
  'Cerrada'
);

-- B2: Ítems de la operación
INSERT INTO public.operacion_items (
  id, operacion_id, item_op,
  codigo_comercial, descripcion,
  cantidad, unidad_medida, moneda, precio_unitario, monto_total,
  tipo_negocio, sub_tipo_negocio, sub_tipo_negocio_2, estado
) VALUES
  (
    '0b000003-0000-0000-0000-000000000003',
    '0a000002-0000-0000-0000-000000000002',
    '01',
    'ROD-FAG-6205-2RS',
    'Rodamiento de bola FAG 6205-2RS1 — Ø25×52×15 mm, sellado doble',
    50, 'UN', 'USD', 18.50, 925.00,
    'Venta', 'Local', 'Stock', 'Despachado'
  ),
  (
    '0b000004-0000-0000-0000-000000000004',
    '0a000002-0000-0000-0000-000000000002',
    '02',
    'COR-REX-B-B60',
    'Correa en V tipo B60 REXNORD — 1575 mm ext., sección 17×11 mm',
    30, 'UN', 'USD', 12.80, 384.00,
    'Venta', 'Local', 'Stock', 'Despachado'
  );

-- B3: Orden de compra local
INSERT INTO public.ordenes_compra (
  id, operacion_id, proveedor_id, tipo,
  num_oc, fecha_oc, fecha_inicio,
  categoria_forma_pago, forma_pago,
  status, moneda, monto_total, t_e_semanas,
  num_cotizacion_proveedor, fecha_ofrecida,
  num_confirmacion_proveedor,
  numero_factura_proveedor, fecha_factura_prov
) VALUES (
  '0c000001-0000-0000-0000-000000000001',
  '0a000002-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000001',   -- MSI Perú
  'Local',
  'OC-LOCAL-2026-0042',
  '2026-04-17',
  '2026-04-17',
  'Crédito',
  '30 días neto',
  'Recibido completo',
  'USD',
  995.00,    -- costo proveedor (margen ~24 %)
  1,
  'COT-MSI-2026-0189',
  '2026-04-24',
  'CONF-MSI-2026-0189',
  'FAC-MSI-2026-4821',
  '2026-04-25'
);

-- B4: Ítems de la OC local
INSERT INTO public.orden_compra_items (
  id, orden_compra_id, operacion_id, operacion_item_id,
  item_oc, item_op, codigo_comercial, descripcion,
  cantidad, unidad_medida, moneda, pcu1, monto_total
) VALUES
  (
    '0c000011-0000-0000-0000-000000000001',
    '0c000001-0000-0000-0000-000000000001',
    '0a000002-0000-0000-0000-000000000002',
    '0b000003-0000-0000-0000-000000000003',
    '01', '01',
    'ROD-FAG-6205-2RS',
    'Rodamiento de bola FAG 6205-2RS1 — Ø25×52×15 mm, sellado doble',
    50, 'UN', 'USD', 14.20, 710.00
  ),
  (
    '0c000011-0000-0000-0000-000000000002',
    '0c000001-0000-0000-0000-000000000001',
    '0a000002-0000-0000-0000-000000000002',
    '0b000004-0000-0000-0000-000000000004',
    '02', '02',
    'COR-REX-B-B60',
    'Correa en V tipo B60 REXNORD — 1575 mm ext., sección 17×11 mm',
    30, 'UN', 'USD', 9.50, 285.00
  );

-- B5: Recepciones en almacén
INSERT INTO public.recepciones (
  id, operacion_id, orden_compra_id, almacen_id,
  num_oc, item_oc, item_op,
  codigo_comercial, descripcion,
  cantidad_esperada, cantidad_recibida, unidad_medida,
  conf_almacen, fecha_recepcion, erp_inta_entrada, estado
) VALUES
  (
    '0e000001-0000-0000-0000-000000000001',
    '0a000002-0000-0000-0000-000000000002',
    '0c000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'OC-LOCAL-2026-0042', '01', '01',
    'ROD-FAG-6205-2RS',
    'Rodamiento de bola FAG 6205-2RS1 — Ø25×52×15 mm, sellado doble',
    50, 50, 'UN',
    'Conforme', '2026-04-25', 'INTA-2026-00312', 'Recibido completo'
  ),
  (
    '0e000002-0000-0000-0000-000000000002',
    '0a000002-0000-0000-0000-000000000002',
    '0c000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'OC-LOCAL-2026-0042', '02', '02',
    'COR-REX-B-B60',
    'Correa en V tipo B60 REXNORD — 1575 mm ext., sección 17×11 mm',
    30, 30, 'UN',
    'Conforme', '2026-04-25', 'INTA-2026-00313', 'Recibido completo'
  );

-- B6: Movimientos de almacén — ENTRADAS (por recepción)
INSERT INTO public.almacen_movimientos (
  id, almacen_id, producto_codigo, tipo,
  cantidad, stock_anterior, stock_final,
  documento_referencia, documento_tipo,
  operacion_id, recepcion_id
) VALUES
  (
    '0f000001-0000-0000-0000-000000000001',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'ROD-FAG-6205-2RS', 'entrada',
    50, 0, 50,
    'OC-LOCAL-2026-0042', 'recepcion',
    '0a000002-0000-0000-0000-000000000002',
    '0e000001-0000-0000-0000-000000000001'
  ),
  (
    '0f000002-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'COR-REX-B-B60', 'entrada',
    30, 0, 30,
    'OC-LOCAL-2026-0042', 'recepcion',
    '0a000002-0000-0000-0000-000000000002',
    '0e000002-0000-0000-0000-000000000002'
  );

-- B7: Factura de venta
INSERT INTO public.facturas_venta (
  id, operacion_id, num_factura, status,
  fecha_emision, fecha_inicio, fecha_prometida_pago, fecha_pago,
  categoria_forma_pago, forma_pago, dias_cobranza,
  moneda, monto_total_sin_igv, factor_igv, tc_usd_sol,
  producto_crm, categoria_operacion
) VALUES (
  'fa000002-0000-0000-0000-000000000002',
  '0a000002-0000-0000-0000-000000000002',
  'F001-00004822',
  'Pagada total',
  '2026-04-28',
  '2026-04-28',
  '2026-05-28',
  '2026-05-20',
  'Crédito',
  '30 días neto',
  30,
  'USD',
  1309.00,
  1.18,
  3.7100,
  'Rodamientos y Transmisión',
  'Compra Local'
);

-- B8: Pago de la factura (pago anticipado — 8 días antes del vencimiento)
INSERT INTO public.pagos_factura (
  id, factura_id, fecha_pago, monto, moneda, referencia, entidad_financiera
) VALUES (
  '0d000001-0000-0000-0000-000000000001',
  'fa000002-0000-0000-0000-000000000002',
  '2026-05-20',
  1309.00, 'USD',
  'OP-BCP-2026-052001',
  'BCP'
);

-- B9: Despachos (uno por línea de producto)
INSERT INTO public.despachos (
  id, operacion_id, factura_id, almacen_id,
  codigo_comercial, descripcion,
  cantidad, unidad_medida,
  distrito_despacho, fecha_despacho, erp_inta_salida, estado
) VALUES
  (
    'de000001-0000-0000-0000-000000000001',
    '0a000002-0000-0000-0000-000000000002',
    'fa000002-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'ROD-FAG-6205-2RS',
    'Rodamiento de bola FAG 6205-2RS1 — Ø25×52×15 mm, sellado doble',
    50, 'UN',
    'La Victoria', '2026-04-30', 'INTS-2026-00198', 'Entregado'
  ),
  (
    'de000002-0000-0000-0000-000000000002',
    '0a000002-0000-0000-0000-000000000002',
    'fa000002-0000-0000-0000-000000000002',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'COR-REX-B-B60',
    'Correa en V tipo B60 REXNORD — 1575 mm ext., sección 17×11 mm',
    30, 'UN',
    'La Victoria', '2026-04-30', 'INTS-2026-00199', 'Entregado'
  );

-- B10: Movimientos de almacén — SALIDAS (por despacho)
INSERT INTO public.almacen_movimientos (
  id, almacen_id, producto_codigo, tipo,
  cantidad, stock_anterior, stock_final,
  documento_referencia, documento_tipo,
  operacion_id, despacho_id
) VALUES
  (
    '0f000003-0000-0000-0000-000000000003',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'ROD-FAG-6205-2RS', 'salida',
    50, 50, 0,
    'de000001-0000-0000-0000-000000000001', 'despacho',
    '0a000002-0000-0000-0000-000000000002',
    'de000001-0000-0000-0000-000000000001'
  ),
  (
    '0f000004-0000-0000-0000-000000000004',
    'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    'COR-REX-B-B60', 'salida',
    30, 30, 0,
    'de000002-0000-0000-0000-000000000002', 'despacho',
    '0a000002-0000-0000-0000-000000000002',
    'de000002-0000-0000-0000-000000000002'
  );

-- B11: Stock actual — net 0 tras recepción y despacho completos
INSERT INTO public.almacen_stock (almacen_id, producto_codigo, cantidad)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'ROD-FAG-6205-2RS', 0),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'COR-REX-B-B60',   0)
ON CONFLICT (almacen_id, producto_codigo)
  DO UPDATE SET cantidad = EXCLUDED.cantidad, updated_at = NOW();

-- B12: Guía de remisión
INSERT INTO public.guias_remision (
  id, operacion_id, despacho_id,
  numero_guia, fecha_emision, fecha_despacho,
  transportista, placa, conductor,
  distrito_destino, direccion_destino,
  estado
) VALUES (
  '9a000001-0000-0000-0000-000000000001',
  '0a000002-0000-0000-0000-000000000002',
  'de000001-0000-0000-0000-000000000001',
  'GR-2026-0042',
  '2026-04-30',
  '2026-04-30',
  'Transportes Ríos S.A.C.',
  'B8K-924',
  'Julio César Ríos Paredes',
  'La Victoria',
  'Av. Arriola 123, La Victoria, Lima',
  'Entregada'
);

-- B13: Confirmación de entrega
INSERT INTO public.confirmaciones_entrega (
  id, despacho_id, guia_id,
  fecha_confirmacion, recibido_por, conformidad
) VALUES (
  '9b000001-0000-0000-0000-000000000001',
  'de000001-0000-0000-0000-000000000001',
  '9a000001-0000-0000-0000-000000000001',
  '2026-04-30',
  'Rodrigo Mendoza Torres',
  'Conforme'
);

-- =============================================================================
-- FIN — resumen de lo que debe verse en cada módulo
-- =============================================================================
-- /operaciones        → 2 OPCIs: OPCI-00000001 (En importación) | OPCI-00000002 (Cerrada)
-- /compras-locales    → OC-LOCAL-2026-0042 (Recibido completo, proveedor MSI)
-- /importaciones      → IMP-2026-011 (En tránsito, DHL, ETA 2026-06-05)
-- /costos             → 4 costos para IMP-2026-011 (flete, aduanas, agente, transporte local)
-- /almacen            → 4 movimientos (2 entradas + 2 salidas); stock ROD/COR = 0
-- /facturacion        → F001-00004821 (Pendiente emisión) | F001-00004822 (Pagada total)
-- /guias              → GR-2026-0042 (Entregada) | 2 despachos Entregados
-- =============================================================================
