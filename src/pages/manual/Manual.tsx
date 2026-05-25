export function Manual() {
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Manual de uso</h1>
          <div className="page-sub">Flujo completo de la cadena de suministro</div>
        </div>
      </div>

      {/* Flow overview */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32, overflowX: 'auto', paddingBottom: 8 }}>
        {[
          { step: '1', label: 'OPCI', color: 'var(--accent)' },
          { step: '2', label: 'Compras', color: 'var(--accent-2)' },
          { step: '3', label: 'Recepción', color: 'var(--ok)' },
          { step: '4', label: 'Almacén', color: 'var(--teal)' },
          { step: '5', label: 'Despacho', color: 'var(--warn)' },
          { step: '6', label: 'Guía', color: 'var(--violet)' },
          { step: '7', label: 'Entrega', color: 'var(--ok)' },
        ].map((s, i, arr) => (
          <div key={s.step} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: s.color,
                color: '#fff', fontWeight: 700, fontSize: 15,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{s.step}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < arr.length - 1 && (
              <div style={{ width: 40, height: 2, background: 'var(--border)', margin: '0 4px', marginBottom: 16 }} />
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Step 1 */}
        <Section
          num="1" color="var(--accent)" title="Operación OPCI — El pedido del cliente"
          module="Operaciones OPCI" path="/operaciones"
          who="Ventas / Comercial"
        >
          <p>Todo comienza cuando un cliente solicita productos o servicios. Se crea una <strong>Operación OPCI</strong> que actúa como la orden maestra del proceso.</p>
          <Steps steps={[
            'Ve a Operaciones OPCI → "Nueva OPCI".',
            'Llena los datos del cliente, vendedor, y fecha de recepción del pedido.',
            'Agrega los ítems del pedido: código comercial, descripción, cantidad, precio unitario y tipo de negocio (Importación / Local / Servicio).',
            'Cambia el estado a "Recibida" cuando el pedido esté confirmado.',
          ]} />
          <Note>El correlativo OPCI (ej. OPCI-2026-001) es el número de referencia que viaja por todo el flujo y vincula compras, recepciones y despachos.</Note>
        </Section>

        {/* Step 2 */}
        <Section
          num="2" color="var(--accent-2)" title="Compras — Adquirir los productos"
          module="Compras Locales / Importaciones" path="/compras-locales"
          who="Compras Locales / Importaciones"
        >
          <p>Una vez creada la OPCI, el área de compras genera las órdenes para adquirir los productos.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
            <SubCard title="Compra Local (OCL)" color="var(--accent-2)">
              <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Para productos disponibles en proveedores locales (Perú).</p>
              <Steps steps={[
                'Ve a Compras Locales → "Nueva OC".',
                'Selecciona el proveedor, ingresa N° OC, fecha y monto.',
                'Agrega los ítems. Al agregar cada ítem, busca la OPCI que lo origina para vincularlos.',
                'Actualiza el estado conforme avance (Cotizado → OC emitida → Confirmado → Recibido).',
              ]} />
            </SubCard>
            <SubCard title="Importación (OCI)" color="var(--accent)">
              <p style={{ fontSize: 12.5, color: 'var(--text-2)' }}>Para productos importados del exterior.</p>
              <Steps steps={[
                'Ve a Importaciones → "Nueva importación".',
                'Dentro de la importación, crea las OCI (órdenes de compra de importación) por proveedor.',
                'Agrega ítems a cada OCI vinculándolos a la OPCI.',
                'Registra costos (flete, aduana, seguro) en la pestaña "Costeo".',
              ]} />
            </SubCard>
          </div>
          <Note>En los ítems de compra puedes vincular cada línea al ítem exacto de la OPCI usando el buscador de OPCI. Esto permite trazabilidad completa.</Note>
        </Section>

        {/* Step 3 */}
        <Section
          num="3" color="var(--ok)" title="Recepción — Los productos llegan al almacén"
          module="Almacén → Recepciones" path="/almacen"
          who="Almacén"
        >
          <p>Cuando los productos llegan físicamente a las instalaciones, se registra la recepción.</p>
          <Steps steps={[
            'Ve a Almacén → pestaña "Recepciones" → "Registrar recepción".',
            'Selecciona el almacén y la Orden de Compra correspondiente.',
            'El sistema carga automáticamente los ítems de la OC.',
            'Ingresa la cantidad realmente recibida por cada ítem.',
            'Indica la conformidad (Conforme / Observado / Rechazado) y el N° de entrada ERP si aplica.',
            'Al confirmar, el stock del almacén se actualiza automáticamente y se registra un movimiento en el Kardex.',
          ]} />
          <Note>Si la recepción es "Observado" o "Rechazado", documenta el motivo. Esto genera evidencia para reclamos al proveedor.</Note>
        </Section>

        {/* Step 4 */}
        <Section
          num="4" color="var(--teal)" title="Almacén — Control de stock"
          module="Almacén → Stock / Kardex" path="/almacen"
          who="Almacén"
        >
          <p>Después de recepcionar los productos, están disponibles en el stock del almacén.</p>
          <Steps steps={[
            'La pestaña "Stock" muestra el inventario actual por producto.',
            'La pestaña "Kardex" muestra el historial completo de movimientos (entradas y salidas) con trazabilidad.',
            'Busca por código de producto para ver el kardex específico de un artículo.',
          ]} />
          <Note>El stock se actualiza automáticamente con cada recepción y cada despacho. No hay que actualizarlo manualmente.</Note>
        </Section>

        {/* Step 5 */}
        <Section
          num="5" color="var(--warn)" title="Despacho — Preparar y enviar al cliente"
          module="Almacén → Despachos" path="/almacen"
          who="Almacén / Logística"
        >
          <p>Cuando los productos están listos para ser entregados al cliente, se registra el despacho.</p>
          <Steps steps={[
            'Ve a Almacén → pestaña "Despachos" → "Registrar despacho".',
            'Busca la OPCI asociada y el producto a despachar.',
            'Ingresa la cantidad, unidad de medida, distrito y fecha de despacho.',
            'Al confirmar, el stock se descuenta automáticamente y se registra la salida en el Kardex.',
            'Al finalizar, el sistema te preguntará si deseas emitir la Guía de Remisión en ese momento.',
          ]} />
          <Note>Un mismo despacho puede tener varios ítems. Si despachas productos de una misma OPCI en la misma fecha, puedes agruparlos en un solo registro.</Note>
        </Section>

        {/* Step 6 */}
        <Section
          num="6" color="var(--violet)" title="Guía de Remisión — Documento legal del transporte"
          module="Guías y Despachos" path="/guias"
          who="Almacén / Logística"
        >
          <p>La Guía de Remisión es el documento exigido por SUNAT que acompaña la mercadería durante el transporte.</p>
          <Steps steps={[
            'Puedes crearla al momento de registrar el despacho (el sistema lo pregunta automáticamente).',
            'O ve a Guías y Despachos → "Nueva guía".',
            'Selecciona el despacho al que corresponde — el distrito y fecha se pre-llenan automáticamente.',
            'Completa los datos del transporte: transportista, placa, conductor y dirección de destino.',
            'Cambia el estado a "En transporte" cuando el vehículo salga, y "Entregada" cuando llegue.',
          ]} />
          <Note>El N° de Guía (ej. GR-2026-001) debe coincidir con el número impreso en el documento físico emitido en el sistema ERP o manualmente.</Note>
        </Section>

        {/* Step 7 */}
        <Section
          num="7" color="var(--ok)" title="Confirmación de entrega — El cliente recibe"
          module="Guías y Despachos → Confirmaciones" path="/guias"
          who="Logística / Ventas"
        >
          <p>El último paso es registrar que el cliente recibió la mercadería conforme.</p>
          <Steps steps={[
            'Ve a Guías y Despachos → pestaña "Confirmaciones" → "Registrar confirmación".',
            'Selecciona el despacho correspondiente.',
            'Ingresa la fecha, el nombre de quien recibió y la conformidad.',
            'Si hay observaciones o rechazos, documenta el motivo.',
          ]} />
          <Note>Con la confirmación de entrega registrada, el ciclo de ese pedido queda cerrado y auditable de principio a fin.</Note>
        </Section>

        {/* Modules reference */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginTop: 8 }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 700 }}>Módulos de soporte</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { title: 'Facturación', desc: 'Gestión de facturas de venta vinculadas a las OPCIs.' },
              { title: 'Costos Importación', desc: 'Registro de fletes, aduanas y otros costos para calcular el costo unitario real.' },
              { title: 'Clientes', desc: 'Catálogo de clientes directos y clientes finales.' },
              { title: 'Proveedores', desc: 'Catálogo de proveedores locales e internacionales.' },
              { title: 'Catálogo (Productos)', desc: 'Productos físicos, servicios y proyectos con clasificación por clase/subclase.' },
              { title: 'Reportes', desc: 'Indicadores y reportes de gestión de la cadena de suministro.' },
            ].map(m => (
              <div key={m.title} style={{ padding: '10px 12px', background: 'var(--panel-2)', borderRadius: 6, border: '1px solid var(--border-soft)' }}>
                <div style={{ fontWeight: 600, fontSize: 12.5, marginBottom: 4 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{m.desc}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────

function Section({ num, color, title, module, path, who, children }: {
  num: string; color: string; title: string; module: string; path: string; who: string; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--panel-2)' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: color, color: '#fff', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: color }}>{module}</span>
            <span style={{ margin: '0 6px', color: 'var(--border)' }}>·</span>
            <span>Responsable: {who}</span>
          </div>
        </div>
      </div>
      <div style={{ padding: '16px 20px', fontSize: 13, lineHeight: 1.7, color: 'var(--text-1)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {children}
      </div>
    </div>
  )
}

function SubCard({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--panel-2)', border: `1px solid ${color}30`, borderRadius: 6, padding: '10px 12px' }}>
      <div style={{ fontWeight: 600, fontSize: 12.5, color, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  )
}

function Steps({ steps }: { steps: string[] }) {
  return (
    <ol style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 4 }}>
      {steps.map((s, i) => (
        <li key={i} style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>{s}</li>
      ))}
    </ol>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--accent-soft)', borderRadius: 6, padding: '7px 12px', fontSize: 12, color: 'var(--text-2)', borderLeft: '3px solid var(--accent)' }}>
      <strong style={{ color: 'var(--accent)' }}>Nota: </strong>{children}
    </div>
  )
}
