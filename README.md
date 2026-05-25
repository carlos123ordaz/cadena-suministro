# CadenaSuministro · OPCI Suite

Sistema de gestión de la cadena de suministro desarrollado para operaciones de importación y compras locales en el mercado peruano.

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 18 + TypeScript |
| Build | Vite 5 |
| Routing | React Router v6 |
| Base de datos / Auth | Supabase (PostgreSQL) |
| Estilos | TailwindCSS + CSS custom properties |

## Módulos

### Operación
- **Operaciones OPCI** — Orden maestra del proceso. Correlativo auto-generado (`OPCI-YYYY-NNN`). Vincula clientes, vendedores, ítems y todos los documentos derivados.
- **Compras Locales** — Órdenes de compra a proveedores locales (OCL). Ítems vinculados a OPCI para trazabilidad completa.
- **Importaciones** — Grupos de importación con OCI por proveedor. Incluye costeo (flete, aduana, seguro) y cálculo de costo unitario real.
- **Costos Importación** — Registro y análisis de costos asociados a cada importación.

### Logística
- **Almacén** — Gestión de recepciones, stock en tiempo real y kardex de movimientos. Despachos con descuento automático de stock.
- **Guías y Despachos** — Guías de remisión (documento SUNAT) vinculadas a despachos. Flujo de estados: Borrador → En transporte → Entregada. Confirmaciones de entrega con conformidad del cliente.

### Comercial
- **Facturación** — Facturas de venta vinculadas a OPCIs. Registro de pagos, seguimiento de cobranza, alertas de vencimiento.
- **Clientes** — Directorio de clientes directos y finales. Búsqueda por razón social o RUC.
- **Proveedores** — Catálogo de proveedores locales e internacionales.
- **Productos** — Catálogo unificado de productos físicos, servicios y proyectos. Clasificación por clase / subclase / subsubclase.

### Análisis
- **Reportes** — KPIs de ventas, importaciones, almacén y cumplimiento de proveedores.
- **Configuración** — Gestión de usuarios (solo Administrador), roles, perfil y parámetros del sistema.

## Flujo principal

```
OPCI → Compra (local o importación) → Recepción → Stock/Kardex → Despacho → Guía de Remisión → Confirmación de entrega
```

Cada paso reduce el stock y genera trazabilidad completa desde el pedido del cliente hasta la entrega final.

## Requisitos previos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)

## Configuración

1. Clona el repositorio e instala dependencias:

```bash
git clone <repo-url>
cd web
npm install
```

2. Crea el archivo `.env.local` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
VITE_SUPABASE_ANON_KEY=<tu-anon-key>
```

3. Crea la base de datos ejecutando las migraciones en Supabase SQL Editor en orden:

```
supabase/migrations/001_schema.sql   — Tablas y triggers
supabase/migrations/002_rls.sql      — Row Level Security
supabase/migrations/003_seed.sql     — Datos iniciales (opcional)
```

4. Levanta el servidor de desarrollo:

```bash
npm run dev
```

## Scripts disponibles

```bash
npm run dev       # Servidor de desarrollo (Vite HMR)
npm run build     # Build de producción (tsc + vite build)
npm run preview   # Preview del build de producción
npm run lint      # Linting con ESLint
```

## Roles de usuario

| Rol | Acceso |
|-----|--------|
| Administrador | Acceso total. Gestión de usuarios. |
| Ventas | Crear y editar OPCIs. |
| Compras Locales | Gestionar OCL. |
| Importaciones | Gestionar OCI y costos. |
| Almacen | Recepciones, despachos, guías. |
| Facturacion | Facturas y pagos. |
| Gerencia | Solo lectura + reportes. |
| Lectura | Solo lectura. |

Los usuarios marcados como **vendedor** aparecen en el selector de Vendedor 1 / Vendedor 2 / Líder al crear una OPCI.

## Estructura del proyecto

```
src/
├── components/
│   ├── layout/        # Sidebar, Topbar
│   └── ui/            # Componentes reutilizables (Card, Modal, DataTable, Badge…)
├── context/           # AuthContext (Supabase session + profile)
├── lib/               # supabase client, utils
├── pages/             # Una carpeta por módulo
├── services/          # Capa de acceso a datos (Supabase queries)
└── types/             # Tipos TypeScript compartidos
supabase/
└── migrations/        # SQL de schema, RLS y datos de demo
```
