import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { BellRing, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import ColorPicker from '../components/ColorPicker'
import { uid } from '../lib/store'

export const REMINDERS = [
  { v: 'none', l: 'Sin aviso' },
  { v: 0, l: 'A la hora de la tarea' },
  { v: 5, l: '5 minutos antes' },
  { v: 15, l: '15 minutos antes' },
  { v: 30, l: '30 minutos antes' },
  { v: 60, l: '1 hora antes' },
  { v: 1440, l: '1 día antes' },
]

const toLocal = (d) => ({ date: format(d, 'yyyy-MM-dd'), time: format(d, 'HH:mm') })

export default function TaskModal({ open, task, onClose, onSave, onDelete, whatsappReady }) {
  const [f, setF] = useState(null)

  useEffect(() => {
    if (!open || !task) return
    const s = new Date(task.start)
    const e = new Date(task.end || s.getTime() + 3600_000)
    setF({
      title: task.title || '',
      description: task.description || '',
      color: task.color || 'brand',
      allDay: !!task.allDay,
      reminder: task.reminder ?? 0,
      done: !!task.done,
      date: toLocal(s).date,
      startTime: toLocal(s).time,
      endTime: toLocal(e).time,
    })
  }, [open, task])

  if (!f) return null
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e })

  const submit = (e) => {
    e?.preventDefault()
    if (!f.title.trim()) return
    const start = new Date(`${f.date}T${f.allDay ? '09:00' : f.startTime}`)
    let end = new Date(`${f.date}T${f.allDay ? '10:00' : f.endTime}`)
    if (end <= start) end = new Date(start.getTime() + 30 * 60_000)
    onSave({
      id: task.id || uid(),
      title: f.title.trim(),
      description: f.description.trim(),
      color: f.color,
      allDay: f.allDay,
      reminder: f.reminder === 'none' ? 'none' : Number(f.reminder),
      done: f.done,
      start: start.toISOString(),
      end: end.toISOString(),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task?.id ? 'Editar tarea' : 'Nueva tarea'}
      primary={{ label: 'Guardar', onClick: submit, disabled: !f.title.trim() }}
      extra={
        task?.id && (
          <button className="btn w-full text-rose-500 hover:bg-rose-500/10 sm:w-auto" onClick={() => onDelete(task.id)}>
            <Trash2 size={16} /> Eliminar tarea
          </button>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Group>
          <input
            autoFocus={!task?.id}
            value={f.title}
            onChange={set('title')}
            placeholder="Título"
            enterKeyHint="done"
            className="w-full bg-transparent px-4 py-3.5 text-lg font-semibold tracking-tight outline-none placeholder:font-medium placeholder:text-ink-300 dark:placeholder:text-ink-600"
          />
          <textarea
            rows={2}
            value={f.description}
            onChange={set('description')}
            placeholder="Notas"
            className="block w-full resize-none bg-transparent px-4 py-3 text-base outline-none placeholder:text-ink-400 sm:text-sm"
          />
        </Group>

        <Group>
          <Row label="Todo el día">
            <Switch checked={f.allDay} onChange={(v) => setF({ ...f, allDay: v })} />
          </Row>
          <Row label="Día">
            <input type="date" className="native-field" value={f.date} onChange={set('date')} />
          </Row>
          {!f.allDay && (
            <>
              <Row label="Empieza">
                <input type="time" className="native-field" value={f.startTime} onChange={set('startTime')} />
              </Row>
              <Row label="Termina">
                <input type="time" className="native-field" value={f.endTime} onChange={set('endTime')} />
              </Row>
            </>
          )}
        </Group>

        <Group>
          <Row label={<span className="flex items-center gap-2"><BellRing size={16} className="text-ink-400" /> Aviso</span>}>
            <select className="native-field max-w-[60%] pr-1 text-right" value={f.reminder} onChange={set('reminder')}>
              {REMINDERS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Row>
          <div className="px-4 py-3.5">
            <ColorPicker value={f.color} onChange={set('color')} />
          </div>
          {task?.id && (
            <Row label="Hecha">
              <Switch checked={f.done} onChange={(v) => setF({ ...f, done: v })} />
            </Row>
          )}
        </Group>

        {!whatsappReady && f.reminder !== 'none' && (
          <p className="px-1 text-xs text-amber-600 dark:text-amber-400">
            No tienes WhatsApp ni notificaciones activadas. Ve a Ajustes para activarlos.
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function Group({ children }) {
  return (
    <div className="divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white dark:divide-ink-800 dark:bg-ink-850 sm:border sm:border-ink-200/70 sm:dark:border-ink-800">
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-3 px-4 py-2">
      <span className="text-base sm:text-sm">{label}</span>
      {children}
    </div>
  )
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-500' : 'bg-ink-200 dark:bg-ink-700'}`}
    >
      <span className={`absolute left-[2px] top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
    </button>
  )
}
