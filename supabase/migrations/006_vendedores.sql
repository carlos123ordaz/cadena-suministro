-- =============================================================================
-- CadenaSuministro — Migration 006: Vendedores
-- Inserta 39 vendedores en auth.users con contraseña 1234567.
-- El trigger on_auth_user_created auto-crea sus filas en public.profiles.
-- Email: inicial_nombre + apellido_paterno + @corsusa.com
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- auth.users — un registro por vendedor
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (
  instance_id, id, aud, role,
  email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) VALUES

-- 1  David Rejas S.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'drejas@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"David Rejas S.","rol":"Ventas"}', NOW(), NOW()),

-- 2  Gianella Belleza Z.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'gbelleza@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Gianella Belleza Z.","rol":"Ventas"}', NOW(), NOW()),

-- 3  Lino Castro V.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'lcastro@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Lino Castro V.","rol":"Ventas"}', NOW(), NOW()),

-- 4  Jesus Alvarado M.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'jalvarado@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Jesus Alvarado M.","rol":"Ventas"}', NOW(), NOW()),

-- 5  Yovany Barrera C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'ybarrera@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Yovany Barrera C.","rol":"Ventas"}', NOW(), NOW()),

-- 6  Katherine Llerena C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'kllerena@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Katherine Llerena C.","rol":"Ventas"}', NOW(), NOW()),

-- 7  Juan Romero G.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'jromero@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Juan Romero G.","rol":"Ventas"}', NOW(), NOW()),

-- 8  Sergio Villena M.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'svillena@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Sergio Villena M.","rol":"Ventas"}', NOW(), NOW()),

-- 9  Shyla Quiroz C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'squiroz@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Shyla Quiroz C.","rol":"Ventas"}', NOW(), NOW()),

-- 10 Dialine Fernandez A.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'dfernandez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Dialine Fernandez A.","rol":"Ventas"}', NOW(), NOW()),

-- 11 Omar Rodriguez B.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'orodriguez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Omar Rodriguez B.","rol":"Ventas"}', NOW(), NOW()),

-- 12 Alexandra Cruz C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'acruz@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Alexandra Cruz C.","rol":"Ventas"}', NOW(), NOW()),

-- 13 Alberto Gutierrez G.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'agutierrez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Alberto Gutierrez G.","rol":"Ventas"}', NOW(), NOW()),

-- 14 Martin Jordan C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'mjordan@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Martin Jordan C.","rol":"Ventas"}', NOW(), NOW()),

-- 15 Fredy Huaman R.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'fhuaman@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Fredy Huaman R.","rol":"Ventas"}', NOW(), NOW()),

-- 16 Marco Reyna C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'mreyna@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Marco Reyna C.","rol":"Ventas"}', NOW(), NOW()),

-- 17 Leonardo Nuñez T.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'lnunez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Leonardo Nuñez T.","rol":"Ventas"}', NOW(), NOW()),

-- 18 Betty Galvez J.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'bgalvez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Betty Galvez J.","rol":"Ventas"}', NOW(), NOW()),

-- 19 Yerson Juarez V.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'yjuarez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Yerson Juarez V.","rol":"Ventas"}', NOW(), NOW()),

-- 20 Rosario Calle E.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'rcalle@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Rosario Calle E.","rol":"Ventas"}', NOW(), NOW()),

-- 21 Roberto Ñaupa C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'rnaupa@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Roberto Ñaupa C.","rol":"Ventas"}', NOW(), NOW()),

-- 22 Paolo Marcas G.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'pmarcas@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Paolo Marcas G.","rol":"Ventas"}', NOW(), NOW()),

-- 23 Juan Jiménez L.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'jjimenez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Juan Jiménez L.","rol":"Ventas"}', NOW(), NOW()),

-- 24 Fernando Gomez D.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'fgomez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Fernando Gomez D.","rol":"Ventas"}', NOW(), NOW()),

-- 25 Fernanda Huayra Q.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'fhuayra@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Fernanda Huayra Q.","rol":"Ventas"}', NOW(), NOW()),

-- 26 Janeth Quico D.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'jquico@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Janeth Quico D.","rol":"Ventas"}', NOW(), NOW()),

-- 27 Solange Alvarado H.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'salvarado@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Solange Alvarado H.","rol":"Ventas"}', NOW(), NOW()),

-- 28 Gregory Rodriguez P.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'grodriguez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Gregory Rodriguez P.","rol":"Ventas"}', NOW(), NOW()),

-- 29 Jean Pierre Lucero
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'jlucero@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Jean Pierre Lucero","rol":"Ventas"}', NOW(), NOW()),

-- 30 Brandon Coronado CH.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'bcoronado@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Brandon Coronado CH.","rol":"Ventas"}', NOW(), NOW()),

-- 31 Frank Aire V.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'faire@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Frank Aire V.","rol":"Ventas"}', NOW(), NOW()),

-- 32 Miguel Sayas V.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'msayas@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Miguel Sayas V.","rol":"Ventas"}', NOW(), NOW()),

-- 33 Yanina Vásquez V.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'yvasquez@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Yanina Vásquez V.","rol":"Ventas"}', NOW(), NOW()),

-- 34 Gerlys Timoteo A.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'gtimoteo@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Gerlys Timoteo A.","rol":"Ventas"}', NOW(), NOW()),

-- 35 Alex Lazo C.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'alazo@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Alex Lazo C.","rol":"Ventas"}', NOW(), NOW()),

-- 36 Juan Cornejo
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'jcornejo@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Juan Cornejo","rol":"Ventas"}', NOW(), NOW()),

-- 37 Brayan Caballero P.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'bcaballero@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Brayan Caballero P.","rol":"Ventas"}', NOW(), NOW()),

-- 38 Omar Belli H.
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'obelli@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Omar Belli H.","rol":"Ventas"}', NOW(), NOW()),

-- 39 Cristopher Sobrado
('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
 'csobrado@corsusa.com', crypt('1234567', gen_salt('bf')), NOW(),
 '{"provider":"email","providers":["email"]}',
 '{"nombre_completo":"Cristopher Sobrado","rol":"Ventas"}', NOW(), NOW());

-- ---------------------------------------------------------------------------
-- Marcar es_vendedor = TRUE en todos los perfiles recién creados
-- ---------------------------------------------------------------------------
UPDATE public.profiles
SET es_vendedor = TRUE
WHERE email IN (
  'drejas@corsusa.com',
  'gbelleza@corsusa.com',
  'lcastro@corsusa.com',
  'jalvarado@corsusa.com',
  'ybarrera@corsusa.com',
  'kllerena@corsusa.com',
  'jromero@corsusa.com',
  'svillena@corsusa.com',
  'squiroz@corsusa.com',
  'dfernandez@corsusa.com',
  'orodriguez@corsusa.com',
  'acruz@corsusa.com',
  'agutierrez@corsusa.com',
  'mjordan@corsusa.com',
  'fhuaman@corsusa.com',
  'mreyna@corsusa.com',
  'lnunez@corsusa.com',
  'bgalvez@corsusa.com',
  'yjuarez@corsusa.com',
  'rcalle@corsusa.com',
  'rnaupa@corsusa.com',
  'pmarcas@corsusa.com',
  'jjimenez@corsusa.com',
  'fgomez@corsusa.com',
  'fhuayra@corsusa.com',
  'jquico@corsusa.com',
  'salvarado@corsusa.com',
  'grodriguez@corsusa.com',
  'jlucero@corsusa.com',
  'bcoronado@corsusa.com',
  'faire@corsusa.com',
  'msayas@corsusa.com',
  'yvasquez@corsusa.com',
  'gtimoteo@corsusa.com',
  'alazo@corsusa.com',
  'jcornejo@corsusa.com',
  'bcaballero@corsusa.com',
  'obelli@corsusa.com',
  'csobrado@corsusa.com'
);
