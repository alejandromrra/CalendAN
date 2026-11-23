// Ajustes: en ordenador, secciones a la izquierda (estilo Preferencias de macOS);
// en móvil, lista agrupada que abre cada sección (estilo Ajustes de iOS).
import { useEffect, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Bell, Check, ChevronLeft, ChevronRight, CloudUpload, Copy, Info, KeyRound, LogOut, MessageCircle, Monitor, Moon,
  MoreHorizontal, Palette, Pipette, Send, Share, Shield, SquarePlus, Sun, Trash2, UserPlus, UserRound, Users,
} from 'lucide-react'
import { LogoMark } from './Logo'
import Modal from './Modal'
import { api, getServer, isDesktop, logout } from '../lib/api'
import { importLegacyData, localLegacyData } from '../lib/store'
import { disablePush, enablePush, pushState } from '../lib/push'
import { autostartEnabled, canNotify, setAutostart } from '../lib/desktop'
import { PRESETS } from '../lib/accent'
import useIsMobile from '../lib/useIsMobile'

const SECTIONS = [
  { id: 'account', label: 'Cuenta', icon: UserRound, tint: 'bg-brand-500' },
  { id: 'appearance', label: 'Apariencia', icon: Palette, tint: 'bg-violet-500' },
  { id: 'notifications', label: 'Notificaciones', icon: Bell, tint: 'bg-rose-500' },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, tint: 'bg-emerald-500' },
  { id: 'users', label: 'Usuarios', icon: Users, tint: 'bg-sky-500', admin: true },
  { id: 'about', label: 'Acerca de', icon: Info, tint: 'bg-ink-500' },
]

export default function SettingsView(props) {
  const { user } = props
  const mobile = useIsMobile()
  const sections = SECTIONS.filter((s) => !s.admin || user.isAdmin)
  const [section, setSection] = useState(mobile ? null : 'account')
  const current = sections.find((s) => s.id === section)

  useEffect(() => {
    if (!mobile && !section) setSection('account')
  }, [mobile, section])

  const content = current && <Section id={current.id} {...props} />

  if (mobile) {
    if (current) {
      return (
        <div className="h-full overflow-y-auto overflow-x-hidden bg-ink-50 pb-[calc(env(safe-area-inset-bottom)+90px)] dark:bg-ink-950">
          <div className="sticky top-0 z-20 grid grid-cols-[1fr_auto_1fr] items-center bg-ink-50/85 px-2 py-2.5 backdrop-blur-xl dark:bg-ink-950/85">
            <button onClick={() => setSection(null)} className="flex items-center gap-0.5 justify-self-start px-1 text-[17px] text-brand-500">
              <ChevronLeft size={22} /> Ajustes
            </button>
            <h1 className="text-[17px] font-semibold">{current.label}</h1>
            <span />
          </div>
          <div className="px-4 pt-3">{content}</div>
        </div>
      )
    }
    return (
      <div className="h-full overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+90px)] pt-3">
        <h1 className="mb-5 text-[28px] font-bold tracking-tight">Ajustes</h1>
        <button onClick={() => setSection('account')} className="mb-6 flex w-full items-center gap-3.5 rounded-2xl bg-white p-4 text-left ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
          <Avatar user={user} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[17px] font-semibold">{user.name || user.email}</div>
            <div className="truncate text-sm text-ink-400">{user.email}</div>
          </div>
          <ChevronRight size={18} className="text-ink-300" />
        </button>
        <Group>
          {sections.filter((s) => s.id !== 'account').map((s) => (
            <Row key={s.id} icon={s.icon} tint={s.tint} label={s.label} onClick={() => setSection(s.id)} chevron />
          ))}
        </Group>
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-ink-200/70 px-3 py-6 dark:border-ink-800">
        <h1 className="mb-5 px-3 text-xl font-semibold tracking-tight">Ajustes</h1>
        <button
          onClick={() => setSection('account')}
          className={`mb-4 flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition ${section === 'account' ? 'bg-white shadow-sm ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800' : 'hover:bg-ink-100 dark:hover:bg-ink-800/60'}`}
        >
          <Avatar user={user} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{user.name || user.email}</div>
            <div className="truncate text-xs text-ink-400">{user.email}</div>
          </div>
        </button>
        <nav className="space-y-0.5">
          {sections.filter((s) => s.id !== 'account').map((s) => {
            const Icon = s.icon
            const on = section === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-sm transition ${on ? 'bg-brand-500 text-brand-fg' : 'hover:bg-ink-100 dark:hover:bg-ink-800/60'}`}
              >
                <span className={`flex h-6 w-6 items-center justify-center rounded-md text-white ${s.tint} ${on ? 'ring-1 ring-white/40' : ''}`}>
                  <Icon size={14} strokeWidth={2.2} />
                </span>
                {s.label}
              </button>
            )
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-8 py-8">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">{current?.label}</h2>
          {content}
        </div>
      </main>
    </div>
  )
}

function Section({ id, ...props }) {
  switch (id) {
    case 'account': return <AccountSection {...props} />
    case 'appearance': return <AppearanceSection {...props} />
    case 'notifications': return isDesktop ? <DesktopNotifications /> : <PushNotifications />
    case 'whatsapp': return <WhatsAppSection />
    case 'users': return <UsersSection me={props.user} />
    case 'about': return <AboutSection />
    default: return null
  }
}

// ---------------------------------------------------------------- piezas comunes

function Group({ title, footer, children }) {
  return (
    <section className="mb-7">
      {title && <h3 className="mb-2 px-4 text-[13px] font-medium uppercase tracking-wide text-ink-400">{title}</h3>}
      <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-200/70 dark:divide-ink-800 dark:bg-ink-900 dark:ring-ink-800">
        {children}
      </div>
      {footer && <div className="mt-2 px-4 text-[13px] leading-relaxed text-ink-400">{footer}</div>}
    </section>
  )
}

function Row({ icon: Icon, tint, label, detail, children, onClick, chevron, danger, disabled }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-[52px] w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] transition disabled:opacity-50 sm:min-h-[48px] sm:text-sm ${onClick ? 'hover:bg-ink-50 active:bg-ink-100 dark:hover:bg-ink-800/50 dark:active:bg-ink-800' : ''}`}
    >
      {Icon && (
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white ${tint || 'bg-ink-400'}`}>
          <Icon size={16} strokeWidth={2.1} />
        </span>
      )}
      <span className={`min-w-0 flex-1 truncate ${danger ? 'font-medium text-rose-500' : onClick && !chevron && !Icon ? 'font-medium text-brand-500' : ''}`}>{label}</span>
      {detail != null && <span className="max-w-[55%] truncate text-ink-400">{detail}</span>}
      {children}
      {chevron && <ChevronRight size={17} className="shrink-0 text-ink-300 dark:text-ink-600" />}
    </Tag>
  )
}

function Switch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-emerald-500' : 'bg-ink-200 dark:bg-ink-700'}`}
    >
      <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}

function Status({ ok, children }) {
  return (
    <span className={`flex items-center gap-1.5 text-sm ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-ink-400'}`}>
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-ink-300 dark:bg-ink-600'}`} />
      {children}
    </span>
  )
}

function Msg({ s }) {
  if (s?.ok) return <p className="-mt-4 mb-6 px-4 text-sm text-emerald-600 dark:text-emerald-400">{s.ok}</p>
  if (s?.error) return <p className="-mt-4 mb-6 px-4 text-sm text-rose-500">{s.error}</p>
  return null
}

export function Avatar({ user, size = 'md' }) {
  const initials = (user.name || user.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  const cls = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }[size]
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 font-semibold text-brand-fg ${cls}`}>
      {initials}
    </span>
  )
}

const TextRow = ({ label, ...input }) => (
  <label className="flex min-h-[52px] items-center gap-3 px-4 text-[15px] sm:min-h-[48px] sm:text-sm">
    <span className="w-28 shrink-0 text-ink-500">{label}</span>
    <input {...input} className="min-w-0 flex-1 bg-transparent py-3 text-right text-base outline-none placeholder:text-ink-300 sm:text-sm dark:placeholder:text-ink-600" />
  </label>
)

// ---------------------------------------------------------------- Cuenta

function AccountSection({ user, setUser, onLogout }) {
  const [name, setName] = useState(user.name || '')
  const [pwOpen, setPwOpen] = useState(false)

  const saveName = async () => {
    if (name.trim() === (user.name || '')) return
    setUser(await api('/api/account', { method: 'PUT', body: { name } }))
  }

  return (
    <>
      <div className="mb-7 flex flex-col items-center gap-2 text-center">
        <Avatar user={{ ...user, name }} size="xl" />
        <div className="mt-1 text-xl font-semibold tracking-tight">{name || user.email}</div>
        <div className="flex items-center gap-2 text-sm text-ink-400">
          {user.email}
          {user.isAdmin && <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-600 dark:text-brand-300">Administrador</span>}
        </div>
      </div>

      <LegacyImport />

      <Group title="Perfil">
        <TextRow label="Nombre" value={name} placeholder="Tu nombre" onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()} />
        <Row label="Email" detail={user.email} />
      </Group>

      <Group title="Seguridad" footer="Al cambiar la contraseña se cerrará la sesión en tus otros dispositivos.">
        <Row icon={KeyRound} tint="bg-amber-500" label="Cambiar contraseña" onClick={() => setPwOpen(true)} chevron />
      </Group>

      <Group>
        <Row icon={LogOut} tint="bg-rose-500" label="Cerrar sesión" danger onClick={async () => { await disablePush().catch(() => {}); await logout(); onLogout() }} />
      </Group>

      <PasswordModal open={pwOpen} onClose={() => setPwOpen(false)} />
    </>
  )
}

function PasswordModal({ open, onClose }) {
  const [f, setF] = useState({ current: '', new: '', repeat: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setF({ current: '', new: '', repeat: '' }); setMsg(null) } }, [open])
  const mismatch = f.repeat && f.new !== f.repeat
  const save = async () => {
    setBusy(true)
    try {
      await api('/api/account/password', { method: 'PUT', body: { current: f.current, new: f.new } })
      onClose()
    } catch (e) {
      setMsg(e.message)
    }
    setBusy(false)
  }
  return (
    <Modal open={open} onClose={onClose} title="Cambiar contraseña"
      primary={{ label: 'Guardar', onClick: save, disabled: busy || !f.current || f.new.length < 8 || f.new !== f.repeat }}>
      <div className="space-y-3">
        <input type="password" autoComplete="current-password" className="input" placeholder="Contraseña actual" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
        <input type="password" autoComplete="new-password" className="input" placeholder="Nueva contraseña (mínimo 8 caracteres)" value={f.new} onChange={(e) => setF({ ...f, new: e.target.value })} />
        <input type="password" autoComplete="new-password" className="input" placeholder="Repite la nueva contraseña" value={f.repeat} onChange={(e) => setF({ ...f, repeat: e.target.value })} />
        {mismatch && <p className="text-sm text-amber-600">Las contraseñas no coinciden</p>}
        {msg && <p className="text-sm text-rose-500">{msg}</p>}
      </div>
    </Modal>
  )
}

function LegacyImport() {
  const [data, setData] = useState(localLegacyData)
  const [state, setState] = useState(null)
  if (!data && !state?.ok) return null
  const run = async () => {
    setState({ loading: true })
    try {
      await importLegacyData(data)
      setData(null)
      setState({ ok: 'Datos importados.' })
    } catch (e) {
      setState({ error: e.message })
    }
  }
  return (
    <Group
      title="Datos de la versión anterior"
      footer={data ? `Este navegador tiene ${data.tasks.length} tareas y ${data.projects.length} proyectos guardados de antes.` : null}
    >
      {data ? (
        <Row icon={CloudUpload} tint="bg-brand-500" label={state?.loading ? 'Importando…' : 'Importar a mi cuenta'} onClick={run} disabled={state?.loading} />
      ) : (
        <Row label={state.ok} />
      )}
      {state?.error && <Row label={state.error} danger />}
    </Group>
  )
}

// ---------------------------------------------------------------- Apariencia

function AppearanceSection({ theme, setTheme, accent, setAccent }) {
  const custom = !PRESETS.some(([, h]) => h === accent)
  return (
    <>
      <Group title="Tema" footer="El tema se guarda en cada dispositivo.">
        <div className="grid grid-cols-2 gap-3 p-4">
          {[['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]].map(([k, l, Icon]) => (
            <button key={k} onClick={() => setTheme(k)} className="group text-center">
              <div className={`overflow-hidden rounded-xl ring-2 transition ${theme === k ? 'ring-brand-500' : 'ring-ink-200 group-hover:ring-ink-300 dark:ring-ink-700'}`}>
                <ThemePreview dark={k === 'dark'} />
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-sm font-medium">
                <Icon size={14} /> {l}
              </div>
            </button>
          ))}
        </div>
      </Group>

      <Group title="Color de la app" footer="Se aplica en todos tus dispositivos.">
        <div className="grid grid-cols-5 gap-3 p-4 sm:grid-cols-10">
          {PRESETS.map(([name, hex]) => (
            <button key={hex} title={name} aria-label={name} onClick={() => setAccent(hex)} className="flex flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-ink-900 ${accent === hex ? 'ring-2 ring-ink-900 dark:ring-white' : 'hover:scale-110'}`}
                style={{ background: hex }}
              >
                {accent === hex && <Check size={16} className="text-white" strokeWidth={3} />}
              </span>
              <span className="text-[10px] text-ink-400">{name}</span>
            </button>
          ))}
          <label title="Personalizado" className="flex cursor-pointer flex-col items-center gap-1.5">
            <span
              className={`relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-offset-2 ring-offset-white transition dark:ring-offset-ink-900 ${custom ? 'ring-2 ring-ink-900 dark:ring-white' : 'hover:scale-110'}`}
              style={{ background: custom ? accent : 'conic-gradient(#f43f5e, #f59e0b, #22c55e, #0ea5e9, #6366f1, #d946ef, #f43f5e)' }}
            >
              <Pipette size={15} className="text-white drop-shadow" />
              <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Color personalizado" />
            </span>
            <span className="text-[10px] text-ink-400">Otro</span>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
          <span className="text-xs text-ink-400">Vista previa</span>
          <span className="btn-primary h-8 text-xs">Botón</span>
          <span className="rounded-full bg-brand-500/10 px-2.5 py-1 text-xs font-medium text-brand-600 dark:text-brand-300">Etiqueta</span>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-brand-fg">23</span>
        </div>
      </Group>
    </>
  )
}

function ThemePreview({ dark }) {
  const bg = dark ? 'bg-ink-950' : 'bg-ink-50'
  const card = dark ? 'bg-ink-800' : 'bg-white'
  const line = dark ? 'bg-ink-700' : 'bg-ink-200'
  return (
    <div className={`flex h-24 gap-1.5 p-2 ${bg}`}>
      <div className={`w-1/4 space-y-1 rounded-md p-1.5 ${card}`}>
        <div className="h-1.5 w-3/4 rounded bg-brand-500" />
        <div className={`h-1.5 rounded ${line}`} />
        <div className={`h-1.5 rounded ${line}`} />
      </div>
      <div className={`flex-1 space-y-1.5 rounded-md p-1.5 ${card}`}>
        <div className={`h-2 w-1/2 rounded ${line}`} />
        <div className="h-4 w-2/3 rounded bg-brand-500/25" />
        <div className={`h-4 w-1/2 rounded ${line}`} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Notificaciones

function PushNotifications() {
  const [state, setState] = useState(null)
  const [devices, setDevices] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    setState(await pushState().catch(() => 'unsupported'))
    api('/api/push').then((r) => setDevices(r.devices + (r.desktops || 0))).catch(() => {})
  }
  useEffect(() => { refresh() }, [])

  const run = (fn, ok) => async () => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      if (ok) setMsg({ ok })
    } catch (e) {
      setMsg({ error: e.message })
    }
    setBusy(false)
    refresh()
  }

  const label = { on: 'Activadas', off: 'Desactivadas', denied: 'Bloqueadas', install: 'Instala la app', unsupported: 'No compatible' }[state] || 'Comprobando…'

  return (
    <>
      <Group
        title="Este dispositivo"
        footer={
          state === 'denied'
            ? 'Las has bloqueado. Actívalas en los ajustes del sistema (en iPhone: Ajustes → Notificaciones → CalendAN).'
            : state === 'unsupported'
              ? 'Este navegador no admite notificaciones.'
              : 'Te avisamos de tus tareas aunque no tengas la app abierta.'
        }
      >
        <Row icon={Bell} tint="bg-rose-500" label="Notificaciones">
          {state === 'on' || state === 'off' ? (
            <Switch checked={state === 'on'} disabled={busy} onChange={(v) => run(v ? enablePush : disablePush, v ? 'Notificaciones activadas.' : null)()} />
          ) : (
            <Status ok={false}>{label}</Status>
          )}
        </Row>
        {state === 'on' && <Row label="Enviar notificación de prueba" onClick={run(() => api('/api/push/test', { method: 'POST' }), 'Enviada. Debería llegarte en unos segundos.')} disabled={busy} />}
      </Group>
      <Msg s={msg} />

      {state === 'install' && (
        <Group title="Instalar en el iPhone">
          <Row label={<>1. Abre esta página en <b>Safari</b></>} />
          <Row label={<>2. Toca <Share size={15} className="inline align-[-2px] text-brand-500" /> <b>Compartir</b></>} />
          <Row label={<>3. Elige <SquarePlus size={15} className="inline align-[-2px] text-brand-500" /> <b>Añadir a pantalla de inicio</b></>} />
          <Row label={<>4. Abre <b>CalendAN</b> desde el icono y vuelve aquí</>} />
        </Group>
      )}

      {devices != null && (
        <Group>
          <Row icon={Monitor} tint="bg-ink-500" label="Dispositivos con notificaciones" detail={devices} />
        </Group>
      )}
    </>
  )
}

function DesktopNotifications() {
  const [perm, setPerm] = useState(null)
  const [auto, setAuto] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    canNotify().then(setPerm).catch(() => setPerm(false))
    autostartEnabled().then(setAuto).catch(() => setAuto(false))
  }, [])

  const test = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api('/api/push/test', { method: 'POST' })
      setMsg({ ok: 'Enviada. Debería aparecer en unos segundos.' })
    } catch (e) {
      setMsg({ error: e.message })
    }
    setBusy(false)
  }

  return (
    <>
      <Group title="Escritorio" footer="CalendAN sigue en la bandeja del sistema al cerrar la ventana y te avisa de tus tareas.">
        <Row icon={Bell} tint="bg-rose-500" label="Notificaciones">
          <Status ok={!!perm}>{perm == null ? 'Comprobando…' : perm ? 'Permitidas' : 'Bloqueadas en el sistema'}</Status>
        </Row>
        <Row icon={Monitor} tint="bg-ink-500" label="Abrir al iniciar el ordenador">
          <Switch checked={auto} disabled={auto == null} onChange={async (v) => { try { await setAutostart(v); setAuto(v) } catch (e) { setMsg({ error: e.message }) } }} />
        </Row>
        <Row label="Enviar notificación de prueba" onClick={test} disabled={busy} />
      </Group>
      <Msg s={msg} />
    </>
  )
}

// ---------------------------------------------------------------- WhatsApp

function WhatsAppSection() {
  const [wa, setWa] = useState(null)
  const [form, setForm] = useState({ phone: '', apikey: '' })
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/settings/whatsapp').then(setWa).catch(() => setWa({ configured: false }))
  }, [])

  const save = async (e) => {
    e?.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      setWa(await api('/api/settings/whatsapp', { method: 'PUT', body: form }))
      setForm({ phone: '', apikey: '' })
      setMsg({ ok: 'Guardado.' })
    } catch (err) {
      setMsg({ error: err.message })
    }
    setBusy(false)
  }

  const test = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api('/api/whatsapp/test', { method: 'POST' })
      setMsg({ ok: 'Mensaje enviado. Revisa tu WhatsApp.' })
    } catch (err) {
      setMsg({ error: err.message })
    }
    setBusy(false)
  }

  return (
    <>
      <Group footer="Te escribimos a tu móvil cuando llega la hora de cada tarea.">
        <Row icon={MessageCircle} tint="bg-emerald-500" label="WhatsApp">
          <Status ok={!!wa?.configured}>{wa == null ? 'Comprobando…' : wa.configured ? wa.phone : 'Sin configurar'}</Status>
        </Row>
        {wa?.configured && <Row label="Enviar mensaje de prueba" onClick={test} disabled={busy} />}
      </Group>
      <Msg s={msg} />

      <form onSubmit={save}>
        <Group title={wa?.configured ? 'Cambiar número o apikey' : 'Configurar'}>
          <TextRow label="Número" inputMode="tel" placeholder="+34 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextRow label="Apikey" placeholder="1234567" value={form.apikey} onChange={(e) => setForm({ ...form, apikey: e.target.value })} />
          <Row label="Guardar" onClick={save} disabled={busy || !form.phone || !form.apikey} />
        </Group>
      </form>

      <Group title="Cómo conseguir la apikey (gratis)">
        <div className="space-y-2 px-4 py-3.5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">
          <p>1. Guarda en tus contactos el número de <b>CallMeBot</b> que aparece en <a className="text-brand-500 underline" href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">su web</a>.</p>
          <p>2. Envíale por WhatsApp el mensaje de activación que indica la web.</p>
          <p>3. Te responderá con tu <b>apikey</b>: pégala arriba junto a tu número.</p>
        </div>
      </Group>
    </>
  )
}

// ---------------------------------------------------------------- Usuarios (solo administrador)

function UsersSection({ me }) {
  const [list, setList] = useState(null)
  const [creating, setCreating] = useState(false)
  const [reset, setReset] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [created, setCreated] = useState(null)
  const [msg, setMsg] = useState(null)

  const load = () => api('/api/users').then(setList).catch((e) => setMsg({ error: e.message }))
  useEffect(() => { load() }, [])

  const del = async () => {
    try {
      await api(`/api/users/${confirmDel.id}`, { method: 'DELETE' })
      setConfirmDel(null)
      load()
    } catch (e) {
      setMsg({ error: e.message })
    }
  }

  return (
    <>
      <Group title={list ? `${list.length} ${list.length === 1 ? 'cuenta' : 'cuentas'}` : 'Cuentas'} footer="Solo tú, como administrador, puedes crear cuentas. Cada persona tiene sus propias tareas, proyectos y avisos.">
        {list?.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3">
            <Avatar user={u} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-[15px] font-medium sm:text-sm">
                <span className="truncate">{u.name || u.email}</span>
                {u.isAdmin && <Shield size={13} className="shrink-0 text-brand-500" />}
                {u.id === me.id && <span className="text-xs font-normal text-ink-400">(tú)</span>}
              </div>
              <div className="truncate text-xs text-ink-400">
                {u.email} · {u.tasks} tareas · {u.projects} proyectos
                {u.lastSeen ? ` · activo ${formatDistanceToNow(new Date(u.lastSeen), { locale: es, addSuffix: true })}` : ' · sin entrar aún'}
              </div>
            </div>
            <UserMenu
              items={[
                { icon: KeyRound, label: 'Cambiar contraseña', onClick: () => setReset(u) },
                ...(u.id !== me.id ? [{ icon: Trash2, label: 'Eliminar cuenta', danger: true, onClick: () => setConfirmDel(u) }] : []),
              ]}
            />
          </div>
        ))}
        <Row icon={UserPlus} tint="bg-sky-500" label="Añadir usuario" onClick={() => setCreating(true)} />
      </Group>
      <Msg s={msg} />

      <NewUserModal open={creating} onClose={() => setCreating(false)} onCreated={(c) => { setCreating(false); setCreated(c); load() }} />
      <ResetModal user={reset} onClose={() => setReset(null)} onDone={(c) => { setReset(null); setCreated(c) }} />
      <CredentialsModal data={created} onClose={() => setCreated(null)} />
      <Modal open={!!confirmDel} onClose={() => setConfirmDel(null)} title="¿Eliminar cuenta?" variant="alert" primary={{ label: 'Eliminar', onClick: del, danger: true }}>
        <p className="text-sm text-ink-500">Se borrará la cuenta de «{confirmDel?.name || confirmDel?.email}» con todas sus tareas, proyectos e imágenes. No se puede deshacer.</p>
      </Modal>
    </>
  )
}

function UserMenu({ items }) {
  // El menú se dibuja con posición fija para que no lo recorte el recuadro de la lista
  const [pos, setPos] = useState(null)
  const open = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const height = items.length * 44 + 12
    const below = window.innerHeight - r.bottom > height + 8
    setPos({ right: window.innerWidth - r.right, ...(below ? { top: r.bottom + 4 } : { bottom: window.innerHeight - r.top + 4 }) })
  }
  return (
    <>
      <button className="icon-btn h-8 w-8" onClick={(e) => (pos ? setPos(null) : open(e))} aria-label="Opciones"><MoreHorizontal size={18} /></button>
      {pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPos(null)} />
          <div style={pos} className="fixed z-50 w-56 animate-pop overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-lift ring-1 ring-ink-200/70 backdrop-blur-xl dark:bg-ink-850/95 dark:ring-ink-800">
            {items.map(({ icon: Icon, label, danger, onClick }) => (
              <button key={label} onClick={() => { setPos(null); onClick() }} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-ink-100 dark:hover:bg-ink-800 ${danger ? 'text-rose-500' : ''}`}>
                <Icon size={16} className={danger ? '' : 'text-ink-400'} /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}

// Contraseña aleatoria fácil de dictar (sin caracteres confusos)
function randomPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const a = crypto.getRandomValues(new Uint32Array(12))
  return [...a].map((n) => chars[n % chars.length]).join('').replace(/(.{4})(?!$)/g, '$1-')
}

function NewUserModal({ open, onClose, onCreated }) {
  const blank = () => ({ name: '', email: '', password: randomPassword(), isAdmin: false })
  const [f, setF] = useState(blank)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (open) { setF(blank()); setMsg(null) } }, [open])
  const save = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api('/api/users', { method: 'POST', body: { name: f.name, email: f.email, password: f.password, is_admin: f.isAdmin } })
      onCreated({ title: 'Cuenta creada', name: f.name || f.email, email: f.email.trim().toLowerCase(), password: f.password })
    } catch (e) {
      setMsg(e.message)
    }
    setBusy(false)
  }
  return (
    <Modal open={open} onClose={onClose} title="Nuevo usuario" primary={{ label: 'Crear', onClick: save, disabled: busy || !f.email.trim() || f.password.length < 8 }}>
      <div className="space-y-3">
        <input className="input" placeholder="Nombre" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="input" type="email" inputMode="email" autoCapitalize="none" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <div className="flex gap-2">
          <input className="input font-mono" placeholder="Contraseña" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <button type="button" className="btn-outline h-11 shrink-0 sm:h-10" onClick={() => setF({ ...f, password: randomPassword() })}>Generar</button>
        </div>
        <label className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5 text-sm dark:bg-ink-800/50">
          <span>
            <span className="font-medium">Administrador</span>
            <span className="block text-xs text-ink-400">Podrá crear y borrar cuentas</span>
          </span>
          <Switch checked={f.isAdmin} onChange={(v) => setF({ ...f, isAdmin: v })} />
        </label>
        {msg && <p className="text-sm text-rose-500">{msg}</p>}
      </div>
    </Modal>
  )
}

function ResetModal({ user, onClose, onDone }) {
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  useEffect(() => { if (user) { setPassword(randomPassword()); setMsg(null) } }, [user])
  const save = async () => {
    try {
      await api(`/api/users/${user.id}/password`, { method: 'PUT', body: { password } })
      onDone({ title: 'Contraseña cambiada', name: user.name || user.email, email: user.email, password })
    } catch (e) {
      setMsg(e.message)
    }
  }
  return (
    <Modal open={!!user} onClose={onClose} title="Cambiar contraseña" primary={{ label: 'Guardar', onClick: save, disabled: password.length < 8 }}>
      <p className="mb-3 text-sm text-ink-500">Nueva contraseña para <b>{user?.name || user?.email}</b>. Se cerrará la sesión en sus dispositivos.</p>
      <div className="flex gap-2">
        <input className="input font-mono" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="button" className="btn-outline h-11 shrink-0 sm:h-10" onClick={() => setPassword(randomPassword())}>Generar</button>
      </div>
      {msg && <p className="mt-3 text-sm text-rose-500">{msg}</p>}
    </Modal>
  )
}

function CredentialsModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => setCopied(false), [data])
  const text = data ? `CalendAN\nDirección: ${getServer() || location.origin}\nEmail: ${data.email}\nContraseña: ${data.password}` : ''
  return (
    <Modal open={!!data} onClose={onClose} title={data?.title} variant="alert" primary={{ label: 'Hecho', onClick: onClose }}>
      <p className="mb-3 text-sm text-ink-500">Pásale estos datos a {data?.name}. La contraseña no se volverá a mostrar.</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-ink-50 p-3 font-mono text-[13px] leading-relaxed dark:bg-ink-800/60">{text}</pre>
      <button
        className="btn-outline mt-3 w-full"
        onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true) } catch {} }}
      >
        {copied ? <><Check size={15} /> Copiado</> : <><Copy size={15} /> Copiar</>}
      </button>
    </Modal>
  )
}

// ---------------------------------------------------------------- Acerca de

function AboutSection() {
  return (
    <>
      <div className="mb-7 flex flex-col items-center gap-3 text-center">
        <LogoMark className="h-20 w-20 rounded-[22px] shadow-xl shadow-black/20" />
        <div>
          <div className="text-xl font-semibold tracking-tight">CalendAN</div>
          <div className="text-sm text-ink-400">Calendario & Proyectos</div>
        </div>
      </div>
      <Group>
        <Row label="Versión" detail="0.1.0" />
        <Row label="Servidor" detail={(getServer() || location.origin).replace(/^https?:\/\//, '')} />
        <Row label="Aplicación" detail={isDesktop ? 'Escritorio' : window.matchMedia('(display-mode: standalone)').matches ? 'Instalada' : 'Navegador'} />
      </Group>
    </>
  )
}
