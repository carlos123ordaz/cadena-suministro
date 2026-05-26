-- =============================================================================
-- CadenaSuministro — Migration 003: Seed Data
-- =============================================================================
-- UUID legend (all chars must be 0-9 or a-f):
--   almacen    : a1b2c3d4-e5f6-7890-abcd-ef1234567890
--   clientes   : c000000x-...  (c is valid hex)
--   proveedores: d000000x-...  (d is valid hex, replaces p)
--   productos  : e000000x-...  (e is valid hex, replaces pr)
--   operaciones: 0a00000x-...  (replaces op)
--   op_items   : 0b00000x-...  (replaces oi)
--   importacion: 1b00000x-...  (replaces im)
--   facturas   : fa00000x-...  (replaces fv)

-- ---------------------------------------------------------------------------
-- app_configuracion
-- ---------------------------------------------------------------------------
INSERT INTO public.app_configuracion (clave, valor) VALUES
  ('correlativo_opci_inicio', '1'),
  ('empresa',                 ''),
  ('ruc',                     ''),
  ('ciudad',                  ''),
  ('moneda_base',             'USD');

-- ---------------------------------------------------------------------------
-- parametros_lista
-- ---------------------------------------------------------------------------
INSERT INTO public.parametros_lista (tipo, valor, orden) VALUES
  ('categoria_forma_pago', 'Anticipo/Contado',  1),
  ('categoria_forma_pago', 'Anticipo/Crédito',  2),
  ('categoria_forma_pago', 'Crédito',            3),
  ('categoria_forma_pago', 'Demo',               4),
  ('categoria_forma_pago', 'Garantía',           5),
  ('forma_pago', 'Contado',                               1),
  ('forma_pago', 'Transferencia anticipada',              2),
  ('forma_pago', '30% anticipo + 70% contraentrega',     3),
  ('forma_pago', '50% anticipo + 50% contraentrega',     4),
  ('forma_pago', 'Crédito 15 días',                       5),
  ('forma_pago', 'Crédito 30 días',                       6),
  ('forma_pago', 'Crédito 45 días',                       7),
  ('forma_pago', 'Crédito 60 días',                       8),
  ('forma_pago', 'Crédito 90 días',                       9),
  ('forma_pago', 'Carta de crédito',                     10);

INSERT INTO public.parametros_lista (tipo, valor, orden, activo) VALUES
  ('unidad_medida', 'UND',   1,  true),
  ('unidad_medida', 'KG',    2,  true),
  ('unidad_medida', 'M',     3,  true),
  ('unidad_medida', 'M2',    4,  true),
  ('unidad_medida', 'M3',    5,  true),
  ('unidad_medida', 'L',     6,  true),
  ('unidad_medida', 'GLN',   7,  true),
  ('unidad_medida', 'PAR',   8,  true),
  ('unidad_medida', 'SET',   9,  true),
  ('unidad_medida', 'CAJA',  10, true),
  ('unidad_medida', 'ROLLO', 11, true),
  ('unidad_medida', 'HRS',   12, true),
  ('unidad_medida', 'TON',   13, true),
  ('unidad_medida', 'PZA',   14, true),
  ('unidad_medida', 'BOL',   15, true),
  ('unidad_medida', 'JGO',   16, true),
  ('unidad_medida', 'GLB',   17, true),
  ('unidad_medida', 'MLL',   18, true)
ON CONFLICT DO NOTHING;
-- ---------------------------------------------------------------------------
-- almacenes
-- ---------------------------------------------------------------------------
INSERT INTO public.almacenes (id, nombre, codigo, direccion, activo) VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'San Pedrito', 'SPD-01', 'Av. Separadora Industrial 1450, Ate Vitarte, Lima', TRUE),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567891', 'Cora',        'ACL-01', 'Av. Separadora Industrial 1450, Ate Vitarte, Lima', TRUE);

-- ---------------------------------------------------------------------------
-- clientes (3 Peruvian industrial companies)
-- ---------------------------------------------------------------------------
INSERT INTO public.clientes (id, ruc, razon_social, nombre_comercial, ciudad, sector, contacto_nombre, contacto_email, contacto_telefono, activo)
VALUES
  (
    'c0000001-0000-0000-0000-000000000001',
    '20100070970',
    'ALICORP S.A.A.',
    'Alicorp',
    'Lima',
    'Alimentos y Consumo Masivo',
    'Rodrigo Mendoza Torres',
    'r.mendoza@alicorp.com.pe',
    '+51 1 3150800',
    TRUE
  ),
  (
    'c0000002-0000-0000-0000-000000000002',
    '20552284969',
    'SOCIEDAD MINERA CERRO VERDE S.A.A.',
    'Cerro Verde',
    'Arequipa',
    'Minería',
    'Claudia Quispe Mamani',
    'c.quispe@cverde.com.pe',
    '+51 54 283300',
    TRUE
  ),
  (
    'c0000003-0000-0000-0000-000000000003',
    '20419026809',
    'GLORIA S.A.',
    'Gloria',
    'Lima',
    'Lácteos e Industria Alimentaria',
    'Fernando Salinas Vera',
    'f.salinas@gloria.com.pe',
    '+51 1 2138000',
    TRUE
  );

-- ---------------------------------------------------------------------------
-- proveedores (2 local, 2 import)
-- ---------------------------------------------------------------------------
INSERT INTO public.proveedores (id, ruc_nro_doc, razon_social, tipo, pais, ciudad, contacto_nombre, contacto_email, moneda_habitual, activo)
VALUES
  (
    'd0000001-0000-0000-0000-000000000001',
    '20512528458',
    'MAQUINARIAS Y SUMINISTROS INDUSTRIALES S.A.C.',
    'Local',
    'Perú',
    'Lima',
    'Jorge Villanueva Castro',
    'j.villanueva@msi.com.pe',
    'PEN',
    TRUE
  ),
  (
    'd0000002-0000-0000-0000-000000000002',
    '20602345671',
    'REPUESTOS TÉCNICOS DEL PERÚ E.I.R.L.',
    'Local',
    'Perú',
    'Callao',
    'Ana Flores Ríos',
    'a.flores@repuestostecnicos.pe',
    'USD',
    TRUE
  ),
  (
    'd0000003-0000-0000-0000-000000000003',
    'DE-376492810',
    'SCHAEFFLER AG',
    'Importacion',
    'Alemania',
    'Herzogenaurach',
    'Klaus Weber',
    'k.weber@schaeffler.com',
    'EUR',
    TRUE
  ),
  (
    'd0000004-0000-0000-0000-000000000004',
    'CN-91440300MA5FCXXX',
    'NINGBO BAIDE AUTOMATION EQUIPMENT CO., LTD.',
    'Importacion',
    'China',
    'Ningbo',
    'Li Wei',
    'liwei@baide-auto.cn',
    'USD',
    TRUE
  );

-- ---------------------------------------------------------------------------
-- productos (5 industrial parts)
-- ---------------------------------------------------------------------------
INSERT INTO public.productos (id, codigo_comercial, descripcion, unidad_medida, precio_referencial, moneda_ref, activo)
VALUES
  (
    'e0000001-0000-0000-0000-000000000001',
    'ROD-FAG-6205-2RS',
    'Rodamiento de bola FAG 6205-2RS1 — diámetro interior 25 mm, diámetro exterior 52 mm, ancho 15 mm, sellado doble',
    'UN',
    18.5000,
    'USD',
    TRUE
  ),
  (
    'e0000002-0000-0000-0000-000000000002',
    'COR-REX-B-B60',
    'Correa en V tipo B60 REXNORD — longitud exterior 1575 mm, sección 17×11 mm, resistente a aceites',
    'UN',
    12.8000,
    'USD',
    TRUE
  ),
  (
    'e0000003-0000-0000-0000-000000000003',
    'SEN-PROX-NPN-M18',
    'Sensor de proximidad inductivo NPN M18 — rango de detección 8 mm, IP67, cable 2 m, 10–30 VDC',
    'UN',
    45.0000,
    'USD',
    TRUE
  ),
  (
    'e0000004-0000-0000-0000-000000000004',
    'VAL-SOL-2P-DN25-24VDC',
    'Válvula solenoide 2/2 vías DN25 — cuerpo de acero inoxidable 316L, 24 VDC, presión máx 16 bar, fluido agua/aire',
    'UN',
    132.0000,
    'USD',
    TRUE
  ),
  (
    'e0000005-0000-0000-0000-000000000005',
    'ENG-SEW-DRE90L4',
    'Motorreductor SEW-EURODRIVE DRE90L4 — 1.5 kW, 380 V, 50 Hz, relación 1:25, eje sólido Ø 28 mm, brida B5',
    'UN',
    890.0000,
    'USD',
    TRUE
  );

-- ---------------------------------------------------------------------------
-- operacion (1 row — En importación)
-- ---------------------------------------------------------------------------
INSERT INTO public.operaciones (
  id, correlativo_opci, fecha_recepcion, fecha_inicio,
  cliente_id, numero_op, moneda, monto_total_sin_igv,
  numero_referencia_cliente, forma_pago, cliente_final_id,
  u_bruta_coti, estado
)
VALUES (
  '0a000001-0000-0000-0000-000000000001',
  'OPCI-00000001',
  '2026-04-10',
  '2026-04-11',
  'c0000002-0000-0000-0000-000000000002',
  'CV-2026-0312',
  'USD',
  4820.00,
  'OC-CVERDE-2026-0312',
  '30 días neto',
  'c0000002-0000-0000-0000-000000000002',
  0.2200,
  'En importación'
);

-- ---------------------------------------------------------------------------
-- operacion_items (2 items for the operacion above)
-- ---------------------------------------------------------------------------
INSERT INTO public.operacion_items (id, operacion_id, item_op, codigo_comercial, descripcion, cantidad, unidad_medida, moneda, precio_unitario, monto_total, estado)
VALUES
  (
    '0b000001-0000-0000-0000-000000000001',
    '0a000001-0000-0000-0000-000000000001',
    '01',
    'SEN-PROX-NPN-M18',
    'Sensor de proximidad inductivo NPN M18 — rango de detección 8 mm, IP67, cable 2 m, 10–30 VDC',
    40,
    'UN',
    'USD',
    55.5000,
    2220.00,
    'En importación'
  ),
  (
    '0b000002-0000-0000-0000-000000000002',
    '0a000001-0000-0000-0000-000000000001',
    '02',
    'VAL-SOL-2P-DN25-24VDC',
    'Válvula solenoide 2/2 vías DN25 — cuerpo de acero inoxidable 316L, 24 VDC, presión máx 16 bar, fluido agua/aire',
    20,
    'UN',
    'USD',
    130.0000,
    2600.00,
    'En importación'
  );

-- ---------------------------------------------------------------------------
-- importacion (1 group linked to the operacion)
-- ---------------------------------------------------------------------------
INSERT INTO public.importaciones (
  id, grupo_importacion, operador_logistico, incoterm,
  tipo_embarque, pais_embarque, ciudad_embarque, pais_origen,
  numero_documento_transporte, eta, peso_bruto_kg, flete_usd, status
)
VALUES (
  '1b000001-0000-0000-0000-000000000001',
  'IMP-2026-011',
  'DHL Global Forwarding',
  'CIF',
  'Aéreo',
  'China',
  'Ningbo',
  'China',
  'MAWB-125-67834920',
  '2026-06-05',
  87.50,
  620.00,
  'En tránsito'
);

-- ---------------------------------------------------------------------------
-- factura_venta (1 factura for the operacion)
-- ---------------------------------------------------------------------------
INSERT INTO public.facturas_venta (
  id, operacion_id, num_factura, status,
  fecha_emision, fecha_prometida_pago,
  categoria_forma_pago, forma_pago, dias_cobranza,
  moneda, monto_total_sin_igv, factor_igv, tc_usd_sol,
  producto_crm, categoria_operacion
)
VALUES (
  'fa000001-0000-0000-0000-000000000001',
  '0a000001-0000-0000-0000-000000000001',
  'F001-00004821',
  'Pendiente de emisión',
  NULL,
  '2026-07-15',
  'Crédito',
  '30 días neto',
  30,
  'USD',
  4820.00,
  1.18,
  3.7200,
  'Sensores y Automatización',
  'Importación'
);
