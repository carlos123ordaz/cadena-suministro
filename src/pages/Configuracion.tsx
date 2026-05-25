import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { Icon } from '@/components/ui/Icon'
import { Modal } from '@/components/ui/Modal'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { getAppConfig, setAppConfig } from '@/services/configuracion.service'
import type { Profile } from '@/types'

const TABS = [
  { id: 'perfil',    label: 'Perfil' },
  { id: 'sistema',  label: 'Sistema' },
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'roles',    label: 'Roles y permisos' },
]

const ROLES = ['Administrador', 'Ventas', 'Compras Locales', 'Importaciones', 'Almacen', 'Facturacion', 'Gerencia', 'Lectura']

export function Configuracion() {
  const { profile } = useAuth()
  const [tab, setTab] = useState('perfil')

  // ── Perfil editable ───────────────────────────────────────────────────
  const [perfilForm, setPerfilForm] = useState({ nombre_completo: '', iniciales: '' })
  const [perfilSaving, setPerfilSaving] = useState(false)
  const [perfilMsg, setPerfilMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (tab === 'perfil' && profile) {
      setPerfilForm({ nombre_completo: profile.nombre_completo ?? '', iniciales: profile.iniciales ?? '' })
      setPerfilMsg(null)
    }
  }, [tab, profile])

  async function savePerfil() {
    if (!profile) return
    setPerfilSaving(true)
    setPerfilMsg(null)
    const { error } = await supabase
      .from('profiles')
      .update({ nombre_completo: perfilForm.nombre_completo, iniciales: perfilForm.iniciales })
      .eq('id', profile.id)
    setPerfilSaving(false)
    setPerfilMsg(error ? { ok: false, text: 'Error al guardar.' } : { ok: true, text: 'Perfil actualizado correctamente.' })
  }

  // ── Sistema params ────────────────────────────────────────────────────
  const [sistemaForm, setSistemaForm] = useState({ empresa: '', ruc: '', ciudad: '', moneda_base: '' })
  const [sistemaSaving, setSistemaSaving] = useState(false)
  const [sistemaMsg, setSistemaMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // ── Numeración ────────────────────────────────────────────────────────
  const [opciInicio, setOpciInicio] = useState('')
  const [opciInicioSaving, setOpciInicioSaving] = useState(false)
  const [opciInicioMsg, setOpciInicioMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (tab !== 'sistema') return
    Promise.all([
      getAppConfig('correlativo_opci_inicio'),
      getAppConfig('empresa'),
      getAppConfig('ruc'),
      getAppConfig('ciudad'),
      getAppConfig('moneda_base'),
    ]).then(([inicio, empresa, ruc, ciudad, moneda_base]) => {
      setOpciInicio(inicio ?? '1')
      setSistemaForm({ empresa: empresa ?? '', ruc: ruc ?? '', ciudad: ciudad ?? '', moneda_base: moneda_base ?? '' })
    })
  }, [tab])

  async function saveSistema() {
    setSistemaSaving(true)
    setSistemaMsg(null)
    const entries: [string, string][] = [
      ['empresa', sistemaForm.empresa],
      ['ruc', sistemaForm.ruc],
      ['ciudad', sistemaForm.ciudad],
      ['moneda_base', sistemaForm.moneda_base],
    ]
    const results = await Promise.all(entries.map(([key, val]) => setAppConfig(key, val)))
    const anyError = results.some(r => r.error)
    setSistemaSaving(false)
    setSistemaMsg(anyError
      ? { ok: false, text: 'Error al guardar algunos parámetros.' }
      : { ok: true, text: 'Parámetros de empresa guardados.' })
  }

  async function saveOpciInicio() {
    const n = parseInt(opciInicio, 10)
    if (!opciInicio || isNaN(n) || n < 1) {
      setOpciInicioMsg({ ok: false, text: 'Debe ser un número entero mayor a 0.' })
      return
    }
    setOpciInicioSaving(true)
    setOpciInicioMsg(null)
    const { error } = await setAppConfig('correlativo_opci_inicio', String(n))
    setOpciInicioSaving(false)
    setOpciInicioMsg(error
      ? { ok: false, text: 'Error al guardar.' }
      : { ok: true, text: `Guardado. Próximo correlativo: OPCI-${String(n).padStart(8, '0')}` }
    )
  }

  // ── Usuarios ──────────────────────────────────────────────────────────
  const isAdmin = profile?.rol === 'Administrador'

  const [users, setUsers] = useState<Profile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userSearch, setUserSearch] = useState('')

  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', nombre_completo: '', rol: 'Ventas', password: '', es_vendedor: false })
  const [inviteSaving, setInviteSaving] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)

  const [showEditUser, setShowEditUser] = useState(false)
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editUserForm, setEditUserForm] = useState({ nombre_completo: '', rol: 'Ventas', es_vendedor: false, activo: true })
  const [editUserSaving, setEditUserSaving] = useState(false)

  useEffect(() => {
    if (tab !== 'usuarios') return
    setLoadingUsers(true)
    supabase.from('profiles').select('*').order('nombre_completo')
      .then(({ data }) => { setUsers((data ?? []) as Profile[]); setLoadingUsers(false) })
  }, [tab])

  async function handleInvite() {
    if (!inviteForm.email || !inviteForm.nombre_completo || !inviteForm.password) {
      setInviteError('Correo, nombre completo y contraseña son obligatorios.')
      return
    }
    if (inviteForm.password.length < 6) {
      setInviteError('La contraseña debe tener al menos 6 caracteres.')
      return
    }
    setInviteSaving(true)
    setInviteError(null)
    const { data: authData, error } = await supabase.auth.signUp({
      email: inviteForm.email,
      password: inviteForm.password,
      options: {
        data: { nombre_completo: inviteForm.nombre_completo, rol: inviteForm.rol },
      },
    })
    if (!error && authData.user && inviteForm.es_vendedor) {
      await supabase.from('profiles').update({ es_vendedor: true }).eq('id', authData.user.id)
    }
    setInviteSaving(false)
    if (error) { setInviteError(error.message); return }
    setInviteSuccess(true)
    setInviteForm({ email: '', nombre_completo: '', rol: 'Ventas', password: '', es_vendedor: false })
    const { data } = await supabase.from('profiles').select('*').order('nombre_completo')
    setUsers((data ?? []) as Profile[])
  }

  function closeInvite() {
    setShowInvite(false)
    setInviteError(null)
    setInviteSuccess(false)
  }

  function openEditUser(u: Profile) {
    setEditingUser(u)
    setEditUserForm({ nombre_completo: u.nombre_completo, rol: u.rol, es_vendedor: u.es_vendedor, activo: u.activo })
    setShowEditUser(true)
  }

  async function handleEditUser() {
    if (!editingUser) return
    setEditUserSaving(true)
    await supabase.from('profiles').update({
      nombre_completo: editUserForm.nombre_completo,
      rol: editUserForm.rol,
      es_vendedor: editUserForm.es_vendedor,
      activo: editUserForm.activo,
    }).eq('id', editingUser.id)
    setEditUserSaving(false)
    setShowEditUser(false)
    setEditingUser(null)
    const { data } = await supabase.from('profiles').select('*').order('nombre_completo')
    setUsers((data ?? []) as Profile[])
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Configuración</h1>
          <div className="page-sub">Gestión del sistema, usuarios y preferencias</div>
        </div>
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === 'perfil' && (
        <Card title="Mi perfil" icon="users">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 24, maxWidth: 700 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <div className="avatar" style={{ width: 72, height: 72, fontSize: 24 }}>
                {perfilForm.iniciales || profile?.iniciales || '??'}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{perfilForm.nombre_completo || profile?.nombre_completo}</div>
                <div className="tiny">{profile?.email}</div>
                <div className="badge info" style={{ marginTop: 6 }}>{profile?.rol}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="form-field">
                <label className="form-label">Nombre completo</label>
                <input
                  className="input"
                  value={perfilForm.nombre_completo}
                  onChange={e => { setPerfilForm(f => ({ ...f, nombre_completo: e.target.value })); setPerfilMsg(null) }}
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Correo</label>
                <input className="input" value={profile?.email ?? ''} style={{ width: '100%' }} readOnly />
              </div>
              <div className="form-field">
                <label className="form-label">Iniciales</label>
                <input
                  className="input"
                  value={perfilForm.iniciales}
                  onChange={e => { setPerfilForm(f => ({ ...f, iniciales: e.target.value.toUpperCase().slice(0, 3) })); setPerfilMsg(null) }}
                  style={{ width: '100%' }}
                  maxLength={3}
                  placeholder="Máx. 3 caracteres"
                />
              </div>
              <div className="form-field">
                <label className="form-label">Rol asignado</label>
                <input className="input" value={profile?.rol ?? ''} style={{ width: '100%' }} readOnly />
              </div>
              {perfilMsg && (
                <div style={{ fontSize: 12.5, color: perfilMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>
                  {perfilMsg.ok ? '✓ ' : '✗ '}{perfilMsg.text}
                </div>
              )}
              <div style={{ marginTop: 4 }}>
                <button className="btn primary sm" onClick={savePerfil} disabled={perfilSaving || !perfilForm.nombre_completo}>
                  {perfilSaving ? 'Guardando…' : 'Guardar cambios'}
                </button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {tab === 'sistema' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Parámetros generales" icon="cog">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, maxWidth: 700 }}>
              <div className="form-field">
                <label className="form-label">Empresa</label>
                <input className="input" value={sistemaForm.empresa} onChange={e => { setSistemaForm(f => ({ ...f, empresa: e.target.value })); setSistemaMsg(null) }} placeholder="Nombre de la empresa" style={{ width: '100%' }} />
              </div>
              <div className="form-field">
                <label className="form-label">RUC</label>
                <input className="input" value={sistemaForm.ruc} onChange={e => { setSistemaForm(f => ({ ...f, ruc: e.target.value })); setSistemaMsg(null) }} placeholder="20xxxxxxxxx" style={{ width: '100%' }} />
              </div>
              <div className="form-field">
                <label className="form-label">Ciudad</label>
                <input className="input" value={sistemaForm.ciudad} onChange={e => { setSistemaForm(f => ({ ...f, ciudad: e.target.value })); setSistemaMsg(null) }} placeholder="Lima" style={{ width: '100%' }} />
              </div>
              <div className="form-field">
                <label className="form-label">Moneda base</label>
                <select className="select" value={sistemaForm.moneda_base} onChange={e => { setSistemaForm(f => ({ ...f, moneda_base: e.target.value })); setSistemaMsg(null) }} style={{ width: '100%' }}>
                  <option value="">— Seleccionar —</option>
                  <option value="USD">USD – Dólar</option>
                  <option value="PEN">PEN – Sol</option>
                  <option value="EUR">EUR – Euro</option>
                </select>
              </div>
            </div>
            {sistemaMsg && (
              <div style={{ marginTop: 10, fontSize: 12.5, color: sistemaMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>
                {sistemaMsg.ok ? '✓ ' : '✗ '}{sistemaMsg.text}
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <button className="btn primary sm" onClick={saveSistema} disabled={sistemaSaving}>
                {sistemaSaving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </Card>

          <Card title="Numeración automática" icon="tag">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500 }}>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>
                  Correlativo OPCI
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10 }}>
                  Formato: <span className="mono">OPCI-00000001</span>. El sistema usa el mayor entre este inicio y el último correlativo registrado.
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div className="form-field" style={{ margin: 0 }}>
                    <label className="form-label">Empezar desde el número</label>
                    <input
                      type="number"
                      className="input"
                      value={opciInicio}
                      onChange={e => { setOpciInicio(e.target.value); setOpciInicioMsg(null) }}
                      min="1"
                      step="1"
                      style={{ width: 160, fontFamily: 'var(--font-mono)' }}
                      placeholder="1"
                    />
                  </div>
                  <button className="btn primary sm" onClick={saveOpciInicio} disabled={opciInicioSaving}>
                    {opciInicioSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
                {opciInicioMsg && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: opciInicioMsg.ok ? 'var(--ok)' : 'var(--bad)' }}>
                    {opciInicioMsg.ok ? '✓ ' : '✗ '}{opciInicioMsg.text}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {tab === 'usuarios' && (
        <Card title="Usuarios del sistema" icon="users" padding={false}>
          <div className="table-toolbar">
            <div className="input-wrap">
              <Icon name="search" size={13} className="ico" />
              <input className="input with-ico" placeholder="Buscar usuario…" style={{ width: 240 }} value={userSearch} onChange={e => setUserSearch(e.target.value)} />
            </div>
            <div className="spacer" />
            {isAdmin && (
              <button className="btn primary sm" onClick={() => setShowInvite(true)}>
                <Icon name="plus" size={13} /> Crear usuario
              </button>
            )}
          </div>

          {loadingUsers ? (
            <div className="loading-row" style={{ padding: 40 }}>
              <Icon name="spinner" size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ marginLeft: 8 }}>Cargando usuarios…</span>
            </div>
          ) : users.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
              <Icon name="users" size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>Sin usuarios registrados</div>
            </div>
          ) : (
            <div style={{ padding: '0 0 8px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Nombre', 'Correo', 'Iniciales', 'Rol', 'Vendedor', ''].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text-3)', fontSize: 11.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.filter(u => !userSearch || u.nombre_completo?.toLowerCase().includes(userSearch.toLowerCase()) || u.email?.toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 14px', fontWeight: 500 }}>
                        {u.nombre_completo}
                        {u.id === profile?.id && <span className="tiny muted" style={{ marginLeft: 6 }}>Tú</span>}
                      </td>
                      <td style={{ padding: '9px 14px', color: 'var(--text-2)' }}>{u.email}</td>
                      <td style={{ padding: '9px 14px' }}>
                        <span className="avatar" style={{ width: 24, height: 24, fontSize: 9 }}>{u.iniciales}</span>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        <Badge tone="info">{u.rol}</Badge>
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {u.es_vendedor
                          ? <Badge tone="ok">Sí</Badge>
                          : <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {isAdmin && (
                          <button className="btn ghost xs" onClick={() => openEditUser(u)}>
                            <Icon name="edit" size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {tab === 'roles' && (
        <Card title="Roles y permisos" icon="cog">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 800 }}>
            {[
              { rol: 'Administrador',    permisos: 'Acceso total al sistema. Puede crear, editar, eliminar en todos los módulos.' },
              { rol: 'Ventas',           permisos: 'Crear y editar Operaciones OPCI. Ver estado general de importaciones y almacén.' },
              { rol: 'Compras Locales',  permisos: 'Gestionar órdenes de compra locales (OCL). Ver OPCI relacionadas.' },
              { rol: 'Importaciones',    permisos: 'Gestionar OCI, grupos de importación y costos. Ver OPCI.' },
              { rol: 'Almacen',          permisos: 'Registrar recepciones, despachos y guías de remisión. Ver kardex y stock.' },
              { rol: 'Facturacion',      permisos: 'Emitir facturas y registrar pagos. Ver cobranza pendiente.' },
              { rol: 'Gerencia',         permisos: 'Acceso de solo lectura a todos los módulos. Ver reportes y rentabilidad.' },
              { rol: 'Lectura',          permisos: 'Solo lectura. Sin capacidad de crear ni editar registros.' },
            ].map(r => (
              <div key={r.rol} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--panel-2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                <span className="badge violet" style={{ flexShrink: 0, marginTop: 1 }}>{r.rol}</span>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{r.permisos}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Modal: Crear usuario */}
      <Modal open={showInvite} onClose={closeInvite} title="Crear usuario" size="sm"
        footer={
          inviteSuccess ? (
            <button className="btn primary" onClick={closeInvite}>Cerrar</button>
          ) : (
            <>
              <button className="btn" onClick={closeInvite}>Cancelar</button>
              <button className="btn primary" onClick={handleInvite} disabled={inviteSaving || !inviteForm.email || !inviteForm.nombre_completo || !inviteForm.password}>
                {inviteSaving ? 'Creando…' : 'Crear usuario'}
              </button>
            </>
          )
        }>
        {inviteSuccess ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <Icon name="check" size={32} style={{ color: 'var(--ok)', display: 'block', margin: '0 auto 12px' }} />
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Usuario creado correctamente</div>
            <div className="tiny muted">El usuario ya puede iniciar sesión con las credenciales proporcionadas.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {inviteError && (
              <div style={{ background: 'var(--bad-soft)', border: '1px solid var(--bad)', borderRadius: 6, padding: '8px 12px', fontSize: 12.5, color: 'var(--bad)' }}>
                {inviteError}
              </div>
            )}
            <div className="form-field">
              <label className="form-label">Nombre completo *</label>
              <input className="input" value={inviteForm.nombre_completo} onChange={e => setInviteForm(f => ({ ...f, nombre_completo: e.target.value }))} style={{ width: '100%' }} placeholder="Juan Pérez" />
            </div>
            <div className="form-field">
              <label className="form-label">Correo electrónico *</label>
              <input type="email" className="input" value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))} style={{ width: '100%' }} placeholder="juan@empresa.com" />
            </div>
            <div className="form-field">
              <label className="form-label">Rol</label>
              <select className="select" value={inviteForm.rol} onChange={e => setInviteForm(f => ({ ...f, rol: e.target.value }))} style={{ width: '100%' }}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label className="form-label">Contraseña temporal *</label>
              <input type="password" className="input" value={inviteForm.password} onChange={e => setInviteForm(f => ({ ...f, password: e.target.value }))} style={{ width: '100%' }} placeholder="Mín. 6 caracteres" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={inviteForm.es_vendedor} onChange={e => setInviteForm(f => ({ ...f, es_vendedor: e.target.checked }))} />
              Es vendedor
            </label>
          </div>
        )}
      </Modal>

      {/* Modal: Editar usuario */}
      <Modal open={showEditUser} onClose={() => { setShowEditUser(false); setEditingUser(null) }} title="Editar usuario" size="sm"
        footer={
          <>
            <button className="btn" onClick={() => { setShowEditUser(false); setEditingUser(null) }}>Cancelar</button>
            <button className="btn primary" onClick={handleEditUser} disabled={editUserSaving || !editUserForm.nombre_completo}>
              {editUserSaving ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-field">
            <label className="form-label">Nombre completo</label>
            <input className="input" value={editUserForm.nombre_completo} onChange={e => setEditUserForm(f => ({ ...f, nombre_completo: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div className="form-field">
            <label className="form-label">Rol</label>
            <select className="select" value={editUserForm.rol} onChange={e => setEditUserForm(f => ({ ...f, rol: e.target.value }))} style={{ width: '100%' }}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={editUserForm.es_vendedor} onChange={e => setEditUserForm(f => ({ ...f, es_vendedor: e.target.checked }))} />
            Es vendedor
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={editUserForm.activo} onChange={e => setEditUserForm(f => ({ ...f, activo: e.target.checked }))} />
            Usuario activo
          </label>
        </div>
      </Modal>
    </div>
  )
}
