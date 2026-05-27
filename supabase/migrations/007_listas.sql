-- =============================================================================
-- Migration 007: Listas desplegables y función de estado OC por recepción
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Países de embarque / origen y ciudades de embarque (desde Excel OCI)
-- ---------------------------------------------------------------------------
INSERT INTO public.parametros_lista (tipo, valor, orden) VALUES
  -- Países de embarque
  ('pais_embarque', 'Alemania',        1),
  ('pais_embarque', 'Australia',       2),
  ('pais_embarque', 'Austria',         3),
  ('pais_embarque', 'Brasil',          4),
  ('pais_embarque', 'Canada',          5),
  ('pais_embarque', 'Chile',           6),
  ('pais_embarque', 'China',           7),
  ('pais_embarque', 'Corea del Sur',   8),
  ('pais_embarque', 'Dinamarca',       9),
  ('pais_embarque', 'Ecuador',         10),
  ('pais_embarque', 'España',          11),
  ('pais_embarque', 'Finlandia',       12),
  ('pais_embarque', 'Francia',         13),
  ('pais_embarque', 'Holanda',         14),
  ('pais_embarque', 'Hungria',         15),
  ('pais_embarque', 'India',           16),
  ('pais_embarque', 'Italia',          17),
  ('pais_embarque', 'Japon',           18),
  ('pais_embarque', 'Noruega',         19),
  ('pais_embarque', 'Paises Bajos',    20),
  ('pais_embarque', 'Republica Checa', 21),
  ('pais_embarque', 'Singapur',        22),
  ('pais_embarque', 'Sudafrica',       23),
  ('pais_embarque', 'Suecia',          24),
  ('pais_embarque', 'Suiza',           25),
  ('pais_embarque', 'Taiwan',          26),
  ('pais_embarque', 'Turquia',         27),
  ('pais_embarque', 'UK',              28),
  ('pais_embarque', 'USA',             29),

  -- Países de origen (misma lista + códigos usados)
  ('pais_origen', 'Alemania',        1),
  ('pais_origen', 'Australia',       2),
  ('pais_origen', 'Austria',         3),
  ('pais_origen', 'Brasil',          4),
  ('pais_origen', 'Canada',          5),
  ('pais_origen', 'Chile',           6),
  ('pais_origen', 'China',           7),
  ('pais_origen', 'Corea del Sur',   8),
  ('pais_origen', 'Dinamarca',       9),
  ('pais_origen', 'Ecuador',         10),
  ('pais_origen', 'España',          11),
  ('pais_origen', 'Finlandia',       12),
  ('pais_origen', 'Francia',         13),
  ('pais_origen', 'Holanda',         14),
  ('pais_origen', 'Hungria',         15),
  ('pais_origen', 'India',           16),
  ('pais_origen', 'Italia',          17),
  ('pais_origen', 'Japon',           18),
  ('pais_origen', 'Noruega',         19),
  ('pais_origen', 'Paises Bajos',    20),
  ('pais_origen', 'Republica Checa', 21),
  ('pais_origen', 'Singapur',        22),
  ('pais_origen', 'Sudafrica',       23),
  ('pais_origen', 'Suecia',          24),
  ('pais_origen', 'Suiza',           25),
  ('pais_origen', 'Taiwan',          26),
  ('pais_origen', 'Turquia',         27),
  ('pais_origen', 'UK',              28),
  ('pais_origen', 'USA',             29),

  -- Ciudades de embarque
  ('ciudad_embarque', 'Adana',             1),
  ('ciudad_embarque', 'Alberta',           2),
  ('ciudad_embarque', 'Alleroed',          3),
  ('ciudad_embarque', 'Ambernath',         4),
  ('ciudad_embarque', 'Baldwinsville',     5),
  ('ciudad_embarque', 'Bangalore',         6),
  ('ciudad_embarque', 'Barcelona',         7),
  ('ciudad_embarque', 'Bath',              8),
  ('ciudad_embarque', 'Bergamo',           9),
  ('ciudad_embarque', 'Berlin',            10),
  ('ciudad_embarque', 'Bezrucoba',         11),
  ('ciudad_embarque', 'Bremen',            12),
  ('ciudad_embarque', 'Bremerhaven',       13),
  ('ciudad_embarque', 'Brisbane',          14),
  ('ciudad_embarque', 'Caldicot',          15),
  ('ciudad_embarque', 'Cernay',            16),
  ('ciudad_embarque', 'Charlotte',         17),
  ('ciudad_embarque', 'Chungju',           18),
  ('ciudad_embarque', 'Colonia',           19),
  ('ciudad_embarque', 'Columbiana',        20),
  ('ciudad_embarque', 'Concord',           21),
  ('ciudad_embarque', 'Coswig',            22),
  ('ciudad_embarque', 'Crosweill',         23),
  ('ciudad_embarque', 'Dallas',            24),
  ('ciudad_embarque', 'Deeside',           25),
  ('ciudad_embarque', 'Eagan',             26),
  ('ciudad_embarque', 'Falun',             27),
  ('ciudad_embarque', 'Frankfurt am Main', 28),
  ('ciudad_embarque', 'Gastonia',          29),
  ('ciudad_embarque', 'Gerlingen',         30),
  ('ciudad_embarque', 'Gipuzkoa',          31),
  ('ciudad_embarque', 'Greenwood',         32),
  ('ciudad_embarque', 'Ham Luke',          33),
  ('ciudad_embarque', 'Hamburgo',          34),
  ('ciudad_embarque', 'Harahan',           35),
  ('ciudad_embarque', 'Heath Hayes',       36),
  ('ciudad_embarque', 'Hemet',             37),
  ('ciudad_embarque', 'Hertford',          38),
  ('ciudad_embarque', 'Holland',           39),
  ('ciudad_embarque', 'Horgau',            40),
  ('ciudad_embarque', 'Houston',           41),
  ('ciudad_embarque', 'Incheon',           42),
  ('ciudad_embarque', 'Jiaxing',           43),
  ('ciudad_embarque', 'Koblach',           44),
  ('ciudad_embarque', 'Kouvola',           45),
  ('ciudad_embarque', 'Langenbrettach',    46),
  ('ciudad_embarque', 'Lappeenranta',      47),
  ('ciudad_embarque', 'Laredo',            48),
  ('ciudad_embarque', 'Leeds',             49),
  ('ciudad_embarque', 'Linthicum',         50),
  ('ciudad_embarque', 'Los Angeles',       51),
  ('ciudad_embarque', 'Losser',            52),
  ('ciudad_embarque', 'Lumberton',         53),
  ('ciudad_embarque', 'Madrid',            54),
  ('ciudad_embarque', 'Mc Moordrecht',     55),
  ('ciudad_embarque', 'Miami',             56),
  ('ciudad_embarque', 'Missouri',          57),
  ('ciudad_embarque', 'Moordrecht',        58),
  ('ciudad_embarque', 'Mullheim',          59),
  ('ciudad_embarque', 'Neustadt',          60),
  ('ciudad_embarque', 'New York',          61),
  ('ciudad_embarque', 'North Little Rock', 62),
  ('ciudad_embarque', 'Oslo',              63),
  ('ciudad_embarque', 'Ostfildern',        64),
  ('ciudad_embarque', 'Peabody',           65),
  ('ciudad_embarque', 'Pensilvania',       66),
  ('ciudad_embarque', 'Pietarsaari',       67),
  ('ciudad_embarque', 'Port Talbot',       68),
  ('ciudad_embarque', 'Quito',             69),
  ('ciudad_embarque', 'Randburg',          70),
  ('ciudad_embarque', 'Ravenna',           71),
  ('ciudad_embarque', 'Rochester',         72),
  ('ciudad_embarque', 'Saint-Louis',       73),
  ('ciudad_embarque', 'Santiago de Chile', 74),
  ('ciudad_embarque', 'Seelze',            75),
  ('ciudad_embarque', 'Shaanxii',          76),
  ('ciudad_embarque', 'Shangai',           77),
  ('ciudad_embarque', 'Shrewsbury',        78),
  ('ciudad_embarque', 'Sorocaba',          79),
  ('ciudad_embarque', 'Staffordshire',     80),
  ('ciudad_embarque', 'Strongsville',      81),
  ('ciudad_embarque', 'Suzhou',            82),
  ('ciudad_embarque', 'Tewksbury',         83),
  ('ciudad_embarque', 'Texas',             84),
  ('ciudad_embarque', 'Tolosa',            85),
  ('ciudad_embarque', 'Tomball',           86),
  ('ciudad_embarque', 'Uelzen',            87),
  ('ciudad_embarque', 'Vantaa',            88),
  ('ciudad_embarque', 'Vineland',          89),
  ('ciudad_embarque', 'Vista',             90),
  ('ciudad_embarque', 'Vlotho',            91),
  ('ciudad_embarque', 'Wallingford',       92),
  ('ciudad_embarque', 'Weil am Rhein',     93),
  ('ciudad_embarque', 'Wenden',            94)
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2. Función para actualizar estado de OC cuando se reciben ítems
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.actualizar_estado_oc_por_recepcion(p_orden_compra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tipo           text;
  v_total_esperado numeric;
  v_total_recibido numeric;
  v_new_status     text;
BEGIN
  -- Obtener tipo de OC
  SELECT tipo INTO v_tipo FROM public.ordenes_compra WHERE id = p_orden_compra_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Sumar cantidades esperadas
  SELECT COALESCE(SUM(cantidad), 0) INTO v_total_esperado
  FROM public.orden_compra_items
  WHERE orden_compra_id = p_orden_compra_id;

  -- Sumar cantidades recibidas
  SELECT COALESCE(SUM(cantidad_recibida), 0) INTO v_total_recibido
  FROM public.recepciones
  WHERE orden_compra_id = p_orden_compra_id;

  IF v_total_recibido <= 0 THEN
    RETURN; -- No cambiar si no hay nada recibido
  END IF;

  IF v_tipo = 'Local' THEN
    IF v_total_recibido >= v_total_esperado THEN
      v_new_status := 'Recibido completo';
    ELSE
      v_new_status := 'Recibido parcial';
    END IF;
  ELSE -- Importacion
    IF v_total_recibido >= v_total_esperado THEN
      v_new_status := 'Recibida en almacén';
    ELSE
      v_new_status := 'En traslado a almacén';
    END IF;
  END IF;

  UPDATE public.ordenes_compra
  SET status = v_new_status, updated_at = now()
  WHERE id = p_orden_compra_id
    AND status NOT IN ('Cerrado', 'Anulado', 'Cerrada', 'Anulada');
END;
$$;
