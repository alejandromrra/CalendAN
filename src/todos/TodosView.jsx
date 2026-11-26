// Sección Tareas: lista de cosas por hacer con prioridades y resumen diario por WhatsApp.
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowUp, Check, CheckCheck, Flag, ListChecks, MessageCircle, Send, Sun, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '../lib/api'
import { uid } from '../lib/store'

export const PRIORITIES = [
  { v: 3, label: 'Alta', dot: 'bg-rose-500', border: 'border-rose-500', text: 'text-rose-600 dark:text-rose-400', soft: 'bg-rose-500/10', emoji: '🔴' },
  { v: 2, label: 'Media', dot: 'bg-amber-500', border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400', soft: 'bg-amber-500/10', emoji: '🟠' },
  { v: 1, label: 'Baja', dot: 'bg-sky-500', border: 'border-sky-500', text: 'text-sky-600 dark:text-sky-400', soft: 'bg-sky-500/10', emoji: '🔵' },
  { v: 0, label: 'Sin prioridad', dot: 'bg-ink-300 dark:bg-ink-600', border: 'border-ink-300 dark:border-ink-600', text: 'text-ink-400', soft: 'bg-ink-500/10', emoji: '⚪' },
]
const prio = (v) => PRIORITIES.find((p) => p.v === v) || PRIORITIES[3]

export default function TodosView({ todos, upsert, remove, clearDone, user }) {
  const [tab, setTab] = useState('pending')
  const [editing, setEditing] = useState(null)
  const list = todos || []

  const pending = useMemo(() => list.filter((t) => !t.done).sort((a, b) => b.priority - a.priority || a.createdAt - b.createdAt), [list])
  const done = useMemo(() => list.filter((t) => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)), [list])
  const startOfToday = new Date().setHours(0, 0, 0, 0)
  const doneToday = done.filter((t) => (t.doneAt || 0) >= startOfToday).length

  const toggle = (t) => upsert({ ...t, done: !t.done })

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+96px)] pt-3 sm:px-8 sm:pb-12 sm:pt-5">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-8">
        <div className="min-w-0">
          <header className="mb-5">
            <h1 className="text-[28px] font-bold tracking-tight sm:text-2xl sm:font-semibold">Tareas</h1>
            <p className="text-sm text-ink-400">
              {todos == null ? 'Cargando…' : `${pending.length} ${pending.length === 1 ? 'pendiente' : 'pendientes'} · ${doneToday} ${doneToday === 1 ? 'completada' : 'completadas'} hoy`}
            </p>
          </header>

          <QuickAdd onAdd={(title, priority) => upsert({ id: uid(), title, notes: '', priority, done: false })} />

          <div className="mb-5 mt-6 grid grid-cols-2 rounded-xl bg-ink-200/60 p-0.5 dark:bg-ink-800 sm:inline-grid sm:w-72">
            {[['pending', 'Pendientes', pending.length], ['done', 'Completadas', done.length]].map(([k, l, n]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`flex items-center justify-center gap-1.5 rounded-[10px] py-1.5 text-[13px] font-semibold transition ${tab === k ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-600 dark:text-white' : 'text-ink-500'}`}
              >
                {l}
                <span className="text-[11px] font-medium opacity-60">{n}</span>
              </button>
            ))}
          </div>

          {tab === 'pending' && (
            pending.length === 0 ? (
              <Empty
                icon={CheckCheck}
                title={todos == null ? 'Cargando…' : '¡Todo hecho!'}
                text={todos == null ? '' : 'No tienes tareas pendientes. Añade una arriba.'}
              />
            ) : (
              <div className="space-y-6">
                {PRIORITIES.map((p) => {
                  const items = pending.filter((t) => t.priority === p.v)
                  if (!items.length) return null
                  return (
                    <section key={p.v}>
                      <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-400">
                        <span className={`h-2 w-2 rounded-full ${p.dot}`} /> {p.label}
                        <span className="font-medium normal-case opacity-70">{items.length}</span>
                      </h2>
                      <div className="space-y-2">
                        {items.map((t) => <TodoRow key={t.id} t={t} onToggle={toggle} onEdit={setEditing} />)}
                      </div>
                    </section>
                  )
                })}
              </div>
            )
          )}

          {tab === 'done' && (
            done.length === 0 ? (
              <Empty icon={ListChecks} title="Nada completado todavía" text="Las tareas que marques aparecerán aquí." />
            ) : (
              <>
                <div className="space-y-2">
                  {done.map((t) => <TodoRow key={t.id} t={t} onToggle={toggle} onEdit={setEditing} />)}
                </div>
                <button onClick={clearDone} className="btn mx-auto mt-5 flex text-rose-500 hover:bg-rose-500/10">
                  <Trash2 size={15} /> Borrar completadas
                </button>
              </>
            )
          )}
        </div>

        <aside className="grid gap-5 md:grid-cols-2 md:items-start lg:sticky lg:top-5 lg:grid-cols-1 lg:self-start">
          <ProgressCard pending={pending} doneToday={doneToday} />
          <DigestCard pending={pending} user={user} />
        </aside>
      </div>

      <EditModal todo={editing} onClose={() => setEditing(null)} onSave={(t) => { upsert(t); setEditing(null) }} onDelete={(id) => { remove(id); setEditing(null) }} />
    </div>
  )
}

// ---------------------------------------------------------------- añadir

function QuickAdd({ onAdd }) {
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(0)
  const ref = useRef(null)
  const submit = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title.trim(), priority)
    setTitle('')
    ref.current?.focus()
  }
  return (
    <form onSubmit={submit} className="rounded-2xl bg-white p-2 ring-1 ring-ink-200/70 transition focus-within:ring-2 focus-within:ring-brand-500/40 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-2">
        <span className={`ml-2 h-5 w-5 shrink-0 rounded-full border-2 border-dashed ${prio(priority).border}`} />
        <input
          ref={ref}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Añadir una tarea…"
          enterKeyHint="done"
          className="min-w-0 flex-1 bg-transparent px-1 py-2 text-base outline-none placeholder:text-ink-400 sm:text-[15px]"
        />
        <button
          disabled={!title.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-brand-fg transition hover:bg-brand-600 disabled:opacity-30"
          aria-label="Añadir"
        >
          <ArrowUp size={18} strokeWidth={2.4} />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-ink-100 px-1.5 pt-2 dark:border-ink-800">
        <Flag size={13} className="mr-0.5 text-ink-400" />
        {PRIORITIES.map((p) => (
          <button
            key={p.v}
            type="button"
            onClick={() => setPriority(p.v)}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${priority === p.v ? `${p.soft} ${p.text} ring-1 ring-current` : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} />
            {p.v === 0 ? 'Ninguna' : p.label}
          </button>
        ))}
      </div>
    </form>
  )
}

// ---------------------------------------------------------------- fila

function TodoRow({ t, onToggle, onEdit }) {
  const p = prio(t.priority)
  const [leaving, setLeaving] = useState(false)
  const check = () => {
    if (t.done) return onToggle(t)
    setLeaving(true)
    setTimeout(() => onToggle(t), 380)
  }
  const checked = t.done || leaving
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl bg-white px-3.5 py-3 ring-1 ring-ink-200/70 transition-all duration-300 dark:bg-ink-900 dark:ring-ink-800 ${leaving ? 'translate-x-2 opacity-0' : ''}`}
    >
      <button
        onClick={check}
        aria-label={t.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${checked ? `${p.v ? p.dot : 'bg-ink-400'} border-transparent text-white` : `${p.border} hover:bg-ink-100 dark:hover:bg-ink-800`}`}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </button>
      <button onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-[15px] ${checked ? 'text-ink-400 line-through' : ''}`}>{t.title}</div>
        {(t.notes || t.done) && (
          <div className="truncate text-xs text-ink-400">
            {t.done && t.doneAt ? `Completada ${formatDistanceToNow(new Date(t.doneAt), { locale: es, addSuffix: true })}` : t.notes}
          </div>
        )}
      </button>
      {t.priority > 0 && !t.done && (
        <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline ${p.soft} ${p.text}`}>{p.label}</span>
      )}
    </div>
  )
}

function Empty({ icon: Icon, title, text }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white px-6 py-14 text-center ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-500">
        <Icon size={22} />
      </div>
      <div className="font-semibold tracking-tight">{title}</div>
      {text && <p className="mt-1 text-sm text-ink-400">{text}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- columna lateral

function ProgressCard({ pending, doneToday }) {
  const total = pending.length + doneToday
  const pct = total ? Math.round((doneToday / total) * 100) : 0
  const R = 26
  const C = 2 * Math.PI * R
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
          <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" className="stroke-ink-100 dark:stroke-ink-800" />
          <circle cx="32" cy="32" r={R} fill="none" strokeWidth="7" strokeLinecap="round" className="stroke-brand-500 transition-all duration-700" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        </svg>
        <div>
          <div className="text-2xl font-semibold tracking-tight">{pct}%</div>
          <div className="text-sm text-ink-400">del día completado</div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {PRIORITIES.slice(0, 3).map((p) => (
          <div key={p.v} className="rounded-2xl bg-ink-50 py-2.5 dark:bg-ink-800/60">
            <div className="text-lg font-semibold">{pending.filter((t) => t.priority === p.v).length}</div>
            <div className={`flex items-center justify-center gap-1 text-[11px] ${p.text}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${p.dot}`} /> {p.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function digestText(pending, name) {
  const first = (name || '').split(' ')[0]
  const hello = first && !first.includes('@') ? `¡Buenos días, ${first}!` : '¡Buenos días!'
  return { hello, lines: pending.map((t) => `${prio(t.priority).emoji} ${t.title}`) }
}

function DigestCard({ pending, user }) {
  const [cfg, setCfg] = useState(null)
  const [wa, setWa] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/api/settings/digest').then(setCfg).catch(() => setCfg({ enabled: true, time: '08:00' }))
    api('/api/settings/whatsapp').then(setWa).catch(() => setWa({ configured: false }))
  }, [])

  const save = async (next) => {
    setCfg(next)
    try { await api('/api/settings/digest', { method: 'PUT', body: next }) } catch (e) { setMsg({ error: e.message }) }
  }
  const sendNow = async () => {
    setBusy(true)
    setMsg(null)
    try {
      await api('/api/digest/test', { method: 'POST' })
      setMsg({ ok: 'Enviado. Revisa tu WhatsApp.' })
    } catch (e) {
      setMsg({ error: e.message })
    }
    setBusy(false)
  }

  const { hello, lines } = digestText(pending, user?.name)
  const shown = lines.slice(0, 6)

  return (
    <div className="overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center gap-3 px-5 pt-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-white"><Sun size={18} /></span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold tracking-tight">Resumen diario</div>
          <div className="text-xs text-ink-400">Por WhatsApp con tus tareas pendientes</div>
        </div>
        {cfg && (
          <button
            role="switch"
            aria-checked={cfg.enabled}
            onClick={() => save({ ...cfg, enabled: !cfg.enabled })}
            className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${cfg.enabled ? 'bg-emerald-500' : 'bg-ink-200 dark:bg-ink-700'}`}
          >
            <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${cfg.enabled ? 'translate-x-5' : ''}`} />
          </button>
        )}
      </div>

      {cfg && (
        <div className={`mt-4 flex items-center justify-between border-y border-ink-100 px-5 py-2.5 text-sm dark:border-ink-800 ${cfg.enabled ? '' : 'opacity-50'}`}>
          <span className="text-ink-500">Cada día a las</span>
          <input
            type="time"
            value={cfg.time}
            disabled={!cfg.enabled}
            onChange={(e) => e.target.value && save({ ...cfg, time: e.target.value })}
            className="native-field"
          />
        </div>
      )}

      {/* Vista previa del mensaje, como una burbuja de WhatsApp */}
      <div className="bg-[#efeae2] px-4 py-4 dark:bg-[#0b141a]">
        <div className="relative ml-auto max-w-[92%] rounded-xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13px] leading-snug text-[#111b21] shadow-sm dark:bg-[#005c4b] dark:text-[#e9edef]">
          <p><b>☀️ {hello}</b></p>
          {lines.length ? (
            <>
              <p>Hoy toca hacer todo esto ({lines.length} {lines.length === 1 ? 'tarea' : 'tareas'}):</p>
              <div className="mt-1.5 space-y-0.5">
                {shown.map((l, i) => <p key={i} className="truncate">{l}</p>)}
                {lines.length > shown.length && <p className="opacity-60">… y {lines.length - shown.length} más</p>}
              </div>
              <p className="mt-1.5">¡A por ello! 💪</p>
            </>
          ) : (
            <p className="opacity-70">Sin tareas pendientes: ese día no se envía nada.</p>
          )}
          <div className="mt-0.5 text-right text-[10px] opacity-50">{cfg?.time || '08:00'}</div>
        </div>
      </div>

      <div className="px-5 py-4">
        {wa && !wa.configured ? (
          <p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
            <MessageCircle size={16} className="mt-0.5 shrink-0" />
            Configura tu WhatsApp en Ajustes para recibir el resumen.
          </p>
        ) : (
          <button className="btn-outline w-full" onClick={sendNow} disabled={busy || !lines.length}>
            <Send size={15} /> {busy ? 'Enviando…' : 'Enviar ahora'}
          </button>
        )}
        {msg?.ok && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{msg.ok}</p>}
        {msg?.error && <p className="mt-2 text-sm text-rose-500">{msg.error}</p>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- editar

function EditModal({ todo, onClose, onSave, onDelete }) {
  const [f, setF] = useState(null)
  useEffect(() => { if (todo) setF({ ...todo }) }, [todo])
  if (!todo || !f) return null
  const save = () => f.title.trim() && onSave({ ...f, title: f.title.trim() })
  return (
    <Modal
      open={!!todo}
      onClose={onClose}
      title="Tarea"
      primary={{ label: 'Guardar', onClick: save, disabled: !f.title.trim() }}
      extra={
        <button className="btn w-full text-rose-500 hover:bg-rose-500/10 sm:w-auto" onClick={() => onDelete(todo.id)}>
          <Trash2 size={16} /> Eliminar
        </button>
      }
    >
      <div className="space-y-4">
        <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white dark:divide-ink-800 dark:bg-ink-850 sm:border sm:border-ink-200/70 sm:dark:border-ink-800">
          <input
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Título"
            className="w-full bg-transparent px-4 py-3.5 text-lg font-semibold tracking-tight outline-none"
          />
          <textarea
            rows={3}
            value={f.notes}
            onChange={(e) => setF({ ...f, notes: e.target.value })}
            placeholder="Notas"
            className="block w-full resize-none bg-transparent px-4 py-3 text-base outline-none placeholder:text-ink-400 sm:text-sm"
          />
        </div>
        <div>
          <div className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-ink-400">Prioridad</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PRIORITIES.map((p) => (
              <button
                key={p.v}
                onClick={() => setF({ ...f, priority: p.v })}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ring-1 transition ${f.priority === p.v ? `${p.soft} ${p.text} ring-current` : 'bg-white ring-ink-200/70 hover:bg-ink-50 dark:bg-ink-850 dark:ring-ink-800'}`}
              >
                <span className={`h-2 w-2 rounded-full ${p.dot}`} /> {p.v === 0 ? 'Ninguna' : p.label}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={() => setF({ ...f, done: !f.done })}
          className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-left dark:bg-ink-850 sm:border sm:border-ink-200/70 sm:dark:border-ink-800"
        >
          <span className="text-base sm:text-sm">Completada</span>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${f.done ? 'border-transparent bg-emerald-500 text-white' : 'border-ink-300 dark:border-ink-600'}`}>
            {f.done && <Check size={14} strokeWidth={3} />}
          </span>
        </button>
      </div>
    </Modal>
  )
}
