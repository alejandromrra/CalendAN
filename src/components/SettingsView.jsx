import { useEffect, useState } from 'react'
import { Bell, CheckCircle2, Moon, Sun, CircleAlert, CloudUpload, LogOut, MessageCircle, Send, Share, SquarePlus } from 'lucide-react'
import { LogoMark } from './Logo'
import { api, getServer, isDesktop, logout } from '../lib/api'
import { autostartEnabled, canNotify, setAutostart } from '../lib/desktop'
import { importLegacyData, localLegacyData } from '../lib/store'
import { disablePush, enablePush, pushState } from '../lib/push'

export default function SettingsView({ onLogout, theme, setTheme }) {
  const [wa, setWa] = useState(null)
  const [form, setForm] = useState({ phone: '', apikey: '' })
  const [saving, setSaving] = useState(null)
  const [testing, setTesting] = useState(null)

  useEffect(() => {
    api('/api/settings/whatsapp').then(setWa).catch(() => setWa({ configured: false }))
  }, [])

  const save = async (e) => {
    e.preventDefault()
    setSaving({ loading: true })
    try {
      setWa(await api('/api/settings/whatsapp', { method: 'PUT', body: form }))
      setForm({ phone: '', apikey: '' })
      setSaving({ ok: 'Guardado. Pulsa «Enviar mensaje de prueba».' })
    } catch (err) {
      setSaving({ error: err.message })
    }
  }

  const test = async () => {
    setTesting({ loading: true })
    try {
      await api('/api/whatsapp/test', { method: 'POST' })
      setTesting({ ok: 'Mensaje enviado. Revisa tu WhatsApp.' })
    } catch (err) {
      setTesting({ error: err.message })
    }
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+90px)] pt-3 sm:px-8 sm:pb-12 sm:pt-5">
      <h1 className="mb-6 text-[28px] font-bold tracking-tight sm:mb-8 sm:text-2xl sm:font-semibold">Ajustes</h1>

      <div className="max-w-2xl space-y-6">
        <LegacyImport />

        <section className="card flex items-center justify-between gap-4 p-5 md:hidden">
          <span className="font-semibold tracking-tight">Apariencia</span>
          <div className="grid grid-cols-2 rounded-xl bg-ink-100 p-0.5 dark:bg-ink-800">
            {[['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]].map(([k, l, Icon]) => (
              <button
                key={k}
                onClick={() => setTheme(k)}
                className={`flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition ${theme === k ? 'bg-white shadow-sm dark:bg-ink-600' : 'text-ink-500'}`}
              >
                <Icon size={15} /> {l}
              </button>
            ))}
          </div>
        </section>

        {isDesktop ? <DesktopCard /> : <PushCard />}

        <section className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><MessageCircle size={20} /></div>
            <div>
              <h2 className="font-semibold tracking-tight">Avisos por WhatsApp</h2>
              <p className="text-sm text-ink-400">Te escribimos a tu móvil cuando llega la hora de cada tarea.</p>
            </div>
          </div>

          <Status ok={!!wa?.configured} label="WhatsApp" detail={wa == null ? 'Comprobando…' : wa.configured ? `CallMeBot → ${wa.phone}` : 'Sin configurar'} />

          <form onSubmit={save} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="label">Tu número</label>
              <input className="input" inputMode="tel" placeholder="+34 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Apikey de CallMeBot</label>
              <input className="input" placeholder="1234567" value={form.apikey} onChange={(e) => setForm({ ...form, apikey: e.target.value })} />
            </div>
            <button className="btn-outline h-10" disabled={!form.phone || !form.apikey || saving?.loading}>
              {wa?.configured ? 'Cambiar' : 'Guardar'}
            </button>
          </form>
          <Msg s={saving} />

          <button className="btn-primary mt-5" onClick={test} disabled={!wa?.configured || testing?.loading}>
            <Send size={15} /> {testing?.loading ? 'Enviando…' : 'Enviar mensaje de prueba'}
          </button>
          <Msg s={testing} />

          <details className="mt-6 rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/50" open={wa && !wa.configured}>
            <summary className="cursor-pointer font-medium">Cómo conseguir la apikey (gratis)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-600 dark:text-ink-300">
              <li>Guarda en tus contactos el número de <b>CallMeBot</b> que aparece en <a className="text-brand-500 underline" href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">su web</a>.</li>
              <li>Envíale por WhatsApp el mensaje de activación que indica la web.</li>
              <li>Te responderá con tu <b>apikey</b>: pégala arriba junto a tu número.</li>
            </ol>
          </details>
        </section>

        <section className="card flex flex-wrap items-center gap-4 p-6">
          <LogoMark className="h-12 w-12 rounded-[14px]" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">CalendAN</div>
            <div className="text-sm text-ink-400">Tus datos se guardan en tu servidor y se sincronizan entre todos tus dispositivos.</div>
          </div>
          <button className="btn-outline" onClick={async () => { await disablePush().catch(() => {}); await logout(); onLogout() }}>
            <LogOut size={15} /> Cerrar sesión
          </button>
        </section>
      </div>
    </div>
  )
}

function DesktopCard() {
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

  const toggleAuto = async () => {
    try {
      await setAutostart(!auto)
      setAuto(!auto)
    } catch (e) {
      setMsg({ error: e.message })
    }
  }

  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Bell size={20} /></div>
        <div>
          <h2 className="font-semibold tracking-tight">Notificaciones de escritorio</h2>
          <p className="text-sm text-ink-400">CalendAN sigue en la bandeja del sistema al cerrar la ventana y te avisa de tus tareas.</p>
        </div>
      </div>

      <Status ok={!!perm} label="Notificaciones" detail={perm == null ? 'Comprobando…' : perm ? 'Permitidas' : 'Bloqueadas en el sistema'} />
      <div className="flex items-center justify-between border-t border-ink-100 py-3 text-sm dark:border-ink-800">
        <span className="font-medium">Abrir al iniciar el ordenador</span>
        <button
          role="switch"
          aria-checked={!!auto}
          onClick={toggleAuto}
          disabled={auto == null}
          className={`relative h-[26px] w-[44px] rounded-full transition-colors ${auto ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'}`}
        >
          <span className={`absolute left-[2px] top-[2px] h-[22px] w-[22px] rounded-full bg-white shadow transition-transform ${auto ? 'translate-x-[18px]' : ''}`} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-ink-100 py-3 text-sm dark:border-ink-800">
        <span className="font-medium">Servidor</span>
        <span className="truncate text-ink-500">{getServer().replace(/^https?:\/\//, '')}</span>
      </div>

      <button className="btn-primary mt-4" onClick={test} disabled={busy}>
        <Send size={15} /> Enviar notificación de prueba
      </button>
      <Msg s={msg} />
    </section>
  )
}

function PushCard() {
  const [state, setState] = useState(null)
  const [devices, setDevices] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    setState(await pushState().catch(() => 'unsupported'))
    api('/api/push').then((r) => setDevices(r.devices)).catch(() => {})
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

  return (
    <section className="card p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><Bell size={20} /></div>
        <div>
          <h2 className="font-semibold tracking-tight">Notificaciones</h2>
          <p className="text-sm text-ink-400">Recibe los avisos de tus tareas en este dispositivo.</p>
        </div>
      </div>

      <Status
        ok={state === 'on'}
        label="Este dispositivo"
        detail={{ on: 'Activadas', off: 'Desactivadas', denied: 'Bloqueadas', install: 'Instala la app primero', unsupported: 'No compatible' }[state] || 'Comprobando…'}
      />
      {devices != null && (
        <div className="flex items-center justify-between border-t border-ink-100 py-3 text-sm dark:border-ink-800">
          <span className="font-medium">Dispositivos con notificaciones</span>
          <span className="text-ink-500">{devices}</span>
        </div>
      )}

      {state === 'install' && (
        <div className="mt-4 rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/50">
          <p className="mb-3 font-medium">Para recibir notificaciones en el iPhone:</p>
          <ol className="space-y-2.5 text-ink-600 dark:text-ink-300">
            <li>1. Abre esta página en <b>Safari</b>.</li>
            <li>2. Toca <Share size={15} className="inline align-[-2px] text-brand-500" /> <b>Compartir</b>.</li>
            <li>3. Elige <SquarePlus size={15} className="inline align-[-2px] text-brand-500" /> <b>Añadir a pantalla de inicio</b>.</li>
            <li>4. Abre <b>CalendAN</b> desde el icono, inicia sesión y vuelve aquí.</li>
          </ol>
        </div>
      )}
      {state === 'denied' && (
        <p className="mt-3 text-sm text-ink-500">Las has bloqueado. Actívalas en los ajustes del sistema (en iPhone: Ajustes → Notificaciones → CalendAN).</p>
      )}
      {state === 'unsupported' && <p className="mt-3 text-sm text-ink-500">Este navegador no admite notificaciones push.</p>}

      <div className="mt-5 flex flex-wrap gap-2">
        {state === 'off' && (
          <button className="btn-primary" disabled={busy} onClick={run(enablePush, 'Notificaciones activadas en este dispositivo.')}>
            <Bell size={15} /> Activar notificaciones
          </button>
        )}
        {state === 'on' && (
          <>
            <button className="btn-primary" disabled={busy} onClick={run(() => api('/api/push/test', { method: 'POST' }), 'Enviada. Debería llegarte en unos segundos.')}>
              <Send size={15} /> Enviar notificación de prueba
            </button>
            <button className="btn-ghost" disabled={busy} onClick={run(disablePush)}>Desactivar</button>
          </>
        )}
      </div>
      <Msg s={msg} />
    </section>
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
      setState({ ok: 'Datos importados. Ya están disponibles en todos tus dispositivos.' })
    } catch (e) {
      setState({ error: e.message })
    }
  }
  return (
    <section className="card border-brand-300/60 bg-brand-500/[.04] p-6 dark:border-brand-500/30">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/10 text-brand-500"><CloudUpload size={20} /></div>
        <div className="flex-1">
          <h2 className="font-semibold tracking-tight">Datos de la versión anterior</h2>
          {data ? (
            <>
              <p className="text-sm text-ink-400">
                Este navegador tiene {data.tasks.length} tareas y {data.projects.length} proyectos guardados de antes. Súbelos al servidor para no perderlos.
              </p>
              <button className="btn-primary mt-4" onClick={run} disabled={state?.loading}>
                <CloudUpload size={15} /> {state?.loading ? 'Importando…' : 'Importar al servidor'}
              </button>
            </>
          ) : null}
          <Msg s={state} />
        </div>
      </div>
    </section>
  )
}

function Msg({ s }) {
  if (s?.ok) return <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{s.ok}</p>
  if (s?.error) return <p className="mt-3 text-sm text-rose-500">{s.error}</p>
  return null
}

function Status({ ok, label, detail }) {
  const Icon = ok ? CheckCircle2 : CircleAlert
  return (
    <div className="flex items-center justify-between border-t border-ink-100 py-3 text-sm dark:border-ink-800">
      <span className="font-medium">{label}</span>
      <span className={`flex items-center gap-1.5 ${ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
        <Icon size={15} /> {detail}
      </span>
    </div>
  )
}
