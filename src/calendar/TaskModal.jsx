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
      footer={
        <>
          {task?.id && (
            <button className="btn-ghost mr-auto text-rose-500 hover:bg-rose-500/10" onClick={() => onDelete(task.id)}>
              <Trash2 size={16} /> Eliminar
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={submit} disabled={!f.title.trim()}>Guardar</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <input
          autoFocus
          value={f.title}
          onChange={set('title')}
          placeholder="Añade un título"
          className="w-full border-0 bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-ink-300 dark:placeholder:text-ink-600"
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-1">
            <label className="label">Día</label>
            <input type="date" className="input" value={f.date} onChange={set('date')} />
          </div>
          {!f.allDay && (
            <>
              <div>
                <label className="label">Inicio</label>
                <input type="time" className="input" value={f.startTime} onChange={set('startTime')} />
              </div>
              <div>
                <label className="label">Fin</label>
                <input type="time" className="input" value={f.endTime} onChange={set('endTime')} />
              </div>
            </>
          )}
        </div>

        <label className="flex cursor-pointer items-center gap-3 text-sm">
          <input type="checkbox" checked={f.allDay} onChange={set('allDay')} className="h-4 w-4 accent-brand-500" />
          Todo el día
        </label>

        <div>
          <label className="label">Notas</label>
          <textarea rows={3} className="input h-auto py-2.5" value={f.description} onChange={set('description')} placeholder="Detalles, enlaces…" />
        </div>

        <div>
          <label className="label flex items-center gap-1.5"><BellRing size={12} /> Aviso</label>
          <select className="input" value={f.reminder} onChange={set('reminder')}>
            {REMINDERS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
          </select>
          {!whatsappReady && f.reminder !== 'none' && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              No tienes WhatsApp ni notificaciones activadas. Ve a Ajustes para activarlos.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="label">Color</label>
            <ColorPicker value={f.color} onChange={set('color')} />
          </div>
          {task?.id && (
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={f.done} onChange={set('done')} className="h-4 w-4 accent-brand-500" />
              Hecha
            </label>
          )}
        </div>
      </form>
    </Modal>
  )
}
