import { useState } from 'react'
import { CheckCircle2, CircleAlert, MessageCircle, Send } from 'lucide-react'
import { LogoMark } from './Logo'

export default function SettingsView({ server, refreshHealth }) {
  const [state, setState] = useState(null)
  const [form, setForm] = useState({ phone: '', apikey: '' })
  const [saving, setSaving] = useState(null)
  const wa = server.whatsapp

  const saveConfig = async (e) => {
    e.preventDefault()
    setSaving({ loading: true })
    try {
      const r = await fetch('/api/whatsapp/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await r.json()
      setSaving(r.ok ? { ok: 'Guardado. Pulsa «Enviar mensaje de prueba».' } : { error: j.error })
      if (r.ok) setForm({ phone: '', apikey: '' })
    } catch {
      setSaving({ error: 'No se puede conectar con el servidor.' })
    }
    refreshHealth()
  }

  const test = async () => {
    setState({ loading: true })
    try {
      const r = await fetch('/api/whatsapp/test', { method: 'POST' })
      const j = await r.json()
      setState(r.ok ? { ok: 'Mensaje enviado. Revisa tu WhatsApp.' } : { error: j.error })
    } catch {
      setState({ error: 'No se puede conectar con el servidor.' })
    }
    refreshHealth()
  }

  return (
    <div className="h-full overflow-y-auto px-5 pb-28 pt-5 sm:px-8">
      <h1 className="mb-8 text-xl font-semibold tracking-tight sm:text-2xl">Ajustes</h1>

      <div className="max-w-2xl space-y-6">
        <section className="card p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500"><MessageCircle size={20} /></div>
            <div>
              <h2 className="font-semibold tracking-tight">Avisos por WhatsApp</h2>
              <p className="text-sm text-ink-400">Te escribimos a tu móvil cuando llega la hora de cada tarea.</p>
            </div>
          </div>

          <Status ok={server.online} label="Servidor de recordatorios" detail={server.online ? 'Conectado' : 'Desconectado — ejecuta npm run dev'} />
          <Status ok={!!wa?.configured} label="WhatsApp" detail={wa?.configured ? `${wa.provider} → ${wa.phone}` : 'Sin configurar'} />

          <form onSubmit={saveConfig} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label className="label">Tu número</label>
              <input className="input" inputMode="tel" placeholder="+34 600 000 000" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <label className="label">Apikey de CallMeBot</label>
              <input className="input" placeholder="1234567" value={form.apikey} onChange={(e) => setForm({ ...form, apikey: e.target.value })} />
            </div>
            <button className="btn-outline h-10" disabled={!server.online || !form.phone || !form.apikey || saving?.loading}>
              {wa?.configured ? 'Cambiar' : 'Guardar'}
            </button>
          </form>
          {saving?.ok && <p className="mt-2 text-sm text-emerald-600">{saving.ok}</p>}
          {saving?.error && <p className="mt-2 text-sm text-rose-500">{saving.error}</p>}

          <button className="btn-primary mt-5" onClick={test} disabled={!wa?.configured || state?.loading}>
            <Send size={15} /> {state?.loading ? 'Enviando…' : 'Enviar mensaje de prueba'}
          </button>
          {state?.ok && <p className="mt-3 text-sm text-emerald-600">{state.ok}</p>}
          {state?.error && <p className="mt-3 text-sm text-rose-500">{state.error}</p>}

          <details className="mt-6 rounded-xl bg-ink-50 p-4 text-sm dark:bg-ink-800/50" open={!wa?.configured}>
            <summary className="cursor-pointer font-medium">Cómo activarlo (2 minutos, gratis)</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-ink-600 dark:text-ink-300">
              <li>Guarda en tus contactos el número de <b>CallMeBot</b> que aparece en <a className="text-brand-500 underline" href="https://www.callmebot.com/blog/free-api-whatsapp-messages/" target="_blank" rel="noreferrer">su web</a>.</li>
              <li>Envíale por WhatsApp: <code className="rounded bg-ink-200/60 px-1 dark:bg-ink-700">I allow callmebot to send me messages</code></li>
              <li>Te responderá con tu <b>apikey</b>.</li>
              <li>Pega tu número y la apikey arriba, pulsa «Guardar» y luego «Enviar mensaje de prueba».</li>
            </ol>
            <p className="mt-3 text-xs text-ink-400">¿Prefieres la API oficial? Pon <code>WHATSAPP_PROVIDER=twilio</code> y tus credenciales de Twilio.</p>
          </details>
        </section>

        <section className="card flex items-center gap-4 p-6">
          <LogoMark className="h-12 w-12 rounded-[14px]" />
          <div>
            <div className="font-semibold">AN</div>
            <div className="text-sm text-ink-400">Tus datos se guardan en este navegador. Las tareas se copian al servidor para poder avisarte.</div>
          </div>
        </section>
      </div>
    </div>
  )
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
