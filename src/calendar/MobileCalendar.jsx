// Calendario pensado para el móvil: tira semanal + día, mes con lista y agenda.
import { useMemo, useRef } from 'react'
import {
  addDays, addMonths, addWeeks, format, isSameDay, isSameMonth, isToday, isTomorrow, startOfDay, startOfMonth,
  startOfWeek, subDays, subMonths, subWeeks,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { BellRing, Check, Plus } from 'lucide-react'
import { color } from '../lib/colors'
import { useLocalState } from '../lib/store'
import { LogoMark } from '../components/Logo'
import { TimeGrid, cap, tasksOn, wk } from './CalendarView'

export default function MobileCalendar({ tasks, cursor, setCursor, onCreate, onEdit, onToggle }) {
  const [mode, setMode] = useLocalState('an:mobilemode', 'day')

  const newAt = () => {
    const now = new Date()
    const s = new Date(cursor)
    if (isSameDay(cursor, now)) s.setHours(now.getHours() + 1, 0, 0, 0)
    else s.setHours(9, 0, 0, 0)
    onCreate(s)
  }

  return (
    <div className="flex h-full flex-col">
      <header className="px-5 pb-3 pt-3">
        <div className="flex items-end justify-between">
          <h1 className="text-[28px] font-bold leading-none tracking-tight">
            {cap(format(cursor, 'MMMM', { locale: es }))}
            <span className="ml-2 text-[28px] font-bold text-ink-300 dark:text-ink-600">{format(cursor, 'yyyy')}</span>
          </h1>
          {!isToday(cursor) && (
            <button onClick={() => setCursor(new Date())} className="rounded-full bg-brand-500/10 px-3 py-1 text-sm font-semibold text-brand-600 dark:text-brand-300">
              Hoy
            </button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 rounded-xl bg-ink-200/60 p-0.5 dark:bg-ink-800">
          {[['day', 'Día'], ['month', 'Mes'], ['agenda', 'Agenda']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setMode(k)}
              className={`rounded-[10px] py-1.5 text-[13px] font-semibold transition ${mode === k ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-600 dark:text-white' : 'text-ink-500'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="min-h-0 flex-1">
        {mode === 'day' && <DayView tasks={tasks} cursor={cursor} setCursor={setCursor} onCreate={onCreate} onEdit={onEdit} />}
        {mode === 'month' && <MonthView tasks={tasks} cursor={cursor} setCursor={setCursor} onEdit={onEdit} onToggle={onToggle} />}
        {mode === 'agenda' && <Agenda tasks={tasks} onEdit={onEdit} onToggle={onToggle} />}
      </div>

      <button
        onClick={newAt}
        aria-label="Nueva tarea"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+76px)] right-5 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500 text-brand-fg shadow-xl shadow-brand-500/40 transition active:scale-95"
      >
        <Plus size={26} strokeWidth={2.2} />
      </button>
    </div>
  )
}

// Detecta deslizar a izquierda/derecha
function useSwipe(onLeft, onRight) {
  const start = useRef(null)
  return {
    onTouchStart: (e) => { start.current = [e.touches[0].clientX, e.touches[0].clientY] },
    onTouchEnd: (e) => {
      if (!start.current) return
      const dx = e.changedTouches[0].clientX - start.current[0]
      const dy = e.changedTouches[0].clientY - start.current[1]
      start.current = null
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onLeft : onRight)()
    },
  }
}

const dayKey = (d) => format(d, 'yyyy-MM-dd')

// ---------------------------------------------------------------- Día

function DayView({ tasks, cursor, setCursor, onCreate, onEdit }) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(cursor, wk), i)), [cursor])
  const busy = useMemo(() => new Set(tasks.map((t) => dayKey(new Date(t.start)))), [tasks])
  const allDay = tasksOn(tasks, cursor).filter((t) => t.allDay)
  const stripSwipe = useSwipe(() => setCursor(addWeeks(cursor, 1)), () => setCursor(subWeeks(cursor, 1)))
  const daySwipe = useSwipe(() => setCursor(addDays(cursor, 1)), () => setCursor(subDays(cursor, 1)))

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7 px-3" {...stripSwipe}>
        {days.map((d) => {
          const sel = isSameDay(d, cursor)
          return (
            <button key={d} onClick={() => setCursor(d)} className="flex flex-col items-center gap-1 py-1">
              <span className={`text-[11px] font-semibold uppercase ${isToday(d) && !sel ? 'text-brand-500' : 'text-ink-400'}`}>
                {'LMXJVSD'[(d.getDay() + 6) % 7]}
              </span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-[17px] transition ${
                  sel ? 'bg-brand-500 font-semibold text-brand-fg shadow-md shadow-brand-500/30' : isToday(d) ? 'font-semibold text-brand-500' : ''
                }`}
              >
                {format(d, 'd')}
              </span>
              <span className={`h-1 w-1 rounded-full ${busy.has(dayKey(d)) && !sel ? 'bg-ink-300 dark:bg-ink-600' : 'bg-transparent'}`} />
            </button>
          )
        })}
      </div>

      <div className="px-5 pb-2 pt-1 text-sm font-medium text-ink-500">
        {cap(format(cursor, "EEEE, d 'de' MMMM", { locale: es }))}
      </div>

      {allDay.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pb-2">
          {allDay.map((t) => (
            <button key={t.id} onClick={() => onEdit(t)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold text-white ${color(t.color).dot} ${t.done ? 'opacity-50 line-through' : ''}`}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <div className="mx-3 mb-[calc(env(safe-area-inset-bottom)+68px)] flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink-200/70 bg-white dark:border-ink-800 dark:bg-ink-900" {...daySwipe}>
        <TimeGrid days={[cursor]} tasks={tasks} onCreate={onCreate} onEdit={onEdit} hideHeader />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Mes

function MonthView({ tasks, cursor, setCursor, onEdit, onToggle }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), wk)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cursor])
  const byDay = useMemo(() => {
    const m = new Map()
    for (const t of tasks) {
      const k = dayKey(new Date(t.start))
      m.set(k, [...(m.get(k) || []), t])
    }
    return m
  }, [tasks])
  const swipe = useSwipe(() => setCursor(startOfMonth(addMonths(cursor, 1))), () => setCursor(startOfMonth(subMonths(cursor, 1))))
  const list = tasksOn(tasks, cursor)

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden pb-[calc(env(safe-area-inset-bottom)+150px)]">
      <div className="px-3" {...swipe}>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-400">
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} className="py-1.5">{d}</span>)}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const sel = isSameDay(d, cursor)
            const dots = (byDay.get(dayKey(d)) || []).slice(0, 3)
            const out = !isSameMonth(d, cursor)
            return (
              <button key={d} onClick={() => setCursor(d)} className="flex h-12 flex-col items-center gap-0.5 pt-1">
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[16px] ${
                    sel ? 'bg-brand-500 font-semibold text-brand-fg' : isToday(d) ? 'font-semibold text-brand-500' : out ? 'text-ink-300 dark:text-ink-700' : ''
                  }`}
                >
                  {format(d, 'd')}
                </span>
                <span className="flex h-1.5 gap-0.5">
                  {dots.map((t) => <span key={t.id} className={`h-1 w-1 rounded-full ${color(t.color).dot} ${out ? 'opacity-40' : ''}`} />)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-3 border-t border-ink-200/70 px-4 pt-4 dark:border-ink-800">
        <div className="mb-2 px-1 text-sm font-semibold text-ink-500">{dayTitle(cursor)}</div>
        {list.length ? (
          <div className="space-y-2">{list.map((t) => <TaskCard key={t.id} t={t} onEdit={onEdit} onToggle={onToggle} />)}</div>
        ) : (
          <p className="px-1 py-6 text-center text-sm text-ink-400">Nada planeado</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Agenda

function Agenda({ tasks, onEdit, onToggle }) {
  const groups = useMemo(() => {
    const from = startOfDay(new Date())
    const m = new Map()
    tasks
      .filter((t) => new Date(t.start) >= from)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .forEach((t) => {
        const k = dayKey(new Date(t.start))
        m.set(k, [...(m.get(k) || []), t])
      })
    return [...m.entries()]
  }, [tasks])

  if (!groups.length)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 pb-32 text-center">
        <LogoMark className="h-12 w-12 rounded-[14px] opacity-30 grayscale" />
        <p className="text-sm text-ink-400">No tienes nada pendiente.<br />Toca + para añadir una tarea.</p>
      </div>
    )

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+150px)]">
      {groups.map(([k, list]) => (
        <section key={k} className="mb-5">
          <div className="sticky top-0 z-10 -mx-4 bg-ink-50/90 px-5 py-1.5 text-sm font-semibold text-ink-500 backdrop-blur dark:bg-ink-950/90">
            {dayTitle(new Date(list[0].start))}
          </div>
          <div className="mt-1 space-y-2">{list.map((t) => <TaskCard key={t.id} t={t} onEdit={onEdit} onToggle={onToggle} />)}</div>
        </section>
      ))}
    </div>
  )
}

function dayTitle(d) {
  if (isToday(d)) return 'Hoy'
  if (isTomorrow(d)) return 'Mañana'
  return cap(format(d, "EEEE, d 'de' MMMM", { locale: es }))
}

export function TaskCard({ t, onEdit, onToggle }) {
  const c = color(t.color)
  const s = new Date(t.start)
  const e = new Date(t.end || s)
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-[0_1px_2px_rgba(0,0,0,.04)] dark:bg-ink-900 ${t.done ? 'opacity-60' : ''}`}>
      <button
        onClick={() => onToggle(t)}
        aria-label={t.done ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${t.done ? `${c.dot} border-transparent text-white` : 'border-ink-300 dark:border-ink-600'}`}
      >
        {t.done && <Check size={14} strokeWidth={3} />}
      </button>
      <button onClick={() => onEdit(t)} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-[15px] font-medium ${t.done ? 'line-through' : ''}`}>{t.title}</div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-400">
          {t.allDay ? 'Todo el día' : `${format(s, 'HH:mm')} – ${format(e, 'HH:mm')}`}
          {t.reminder !== 'none' && !t.done && <BellRing size={11} />}
        </div>
      </button>
      <span className={`h-8 w-1 shrink-0 rounded-full ${c.dot}`} />
    </div>
  )
}
