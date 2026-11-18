import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDays, addMonths, addWeeks, differenceInMinutes, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, isToday, startOfDay, startOfMonth, startOfWeek, subDays, subMonths, subWeeks,
} from 'date-fns'
import { es } from 'date-fns/locale'
import { BellRing, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { color } from '../lib/colors'
import useIsMobile from '../lib/useIsMobile'
import MobileCalendar from './MobileCalendar'

export const HOUR = 56
export const wk = { weekStartsOn: 1, locale: es }
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

export default function CalendarView(props) {
  const mobile = useIsMobile()
  return mobile ? <MobileCalendar {...props} /> : <DesktopCalendar {...props} />
}

function DesktopCalendar({ tasks, cursor, setCursor, mode, setMode, onCreate, onEdit }) {
  const move = (dir) => {
    const fn = { month: [subMonths, addMonths], week: [subWeeks, addWeeks], day: [subDays, addDays] }[mode][dir > 0 ? 1 : 0]
    setCursor(fn(cursor, 1))
  }

  const title =
    mode === 'month'
      ? cap(format(cursor, 'MMMM yyyy', { locale: es }))
      : mode === 'week'
        ? weekTitle(cursor)
        : cap(format(cursor, "EEEE, d 'de' MMMM", { locale: es }))

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-8 sm:py-5">
        <h1 className="mr-2 text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        <div className="flex items-center">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight size={18} /></button>
        </div>
        <button className="btn-outline h-8 px-3 text-xs" onClick={() => setCursor(new Date())}>Hoy</button>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
            {[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([k, l]) => (
              <button
                key={k}
                onClick={() => setMode(k)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition ${mode === k ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 hover:text-ink-900 dark:hover:text-ink-100'}`}
              >
                {l}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={() => onCreate(defaultStart(cursor))}>
            <Plus size={16} /> <span className="hidden sm:inline">Nueva tarea</span>
          </button>
        </div>
      </header>

      <div className="min-h-0 flex-1 px-3 pb-24 sm:px-8 sm:pb-8">
        <div className="card flex h-full flex-col overflow-hidden shadow-soft">
          {mode === 'month' ? (
            <MonthGrid cursor={cursor} tasks={tasks} onCreate={onCreate} onEdit={onEdit} onPickDay={(d) => { setCursor(d); setMode('day') }} />
          ) : (
            <TimeGrid days={mode === 'week' ? weekDays(cursor) : [cursor]} tasks={tasks} onCreate={onCreate} onEdit={onEdit} />
          )}
        </div>
      </div>
    </div>
  )
}

function defaultStart(day) {
  const now = new Date()
  const d = isSameDay(day, now) ? now : day
  const s = new Date(d)
  s.setHours(isSameDay(day, now) ? now.getHours() + 1 : 9, 0, 0, 0)
  return s
}

function weekTitle(d) {
  const s = startOfWeek(d, wk)
  const e = endOfWeek(d, wk)
  if (isSameMonth(s, e)) return cap(format(s, 'MMMM yyyy', { locale: es }))
  return `${cap(format(s, 'MMM', { locale: es }))} – ${cap(format(e, 'MMM yyyy', { locale: es }))}`
}

const weekDays = (d) => eachDayOfInterval({ start: startOfWeek(d, wk), end: endOfWeek(d, wk) })

export const tasksOn = (tasks, day) =>
  tasks.filter((t) => isSameDay(new Date(t.start), day)).sort((a, b) => new Date(a.start) - new Date(b.start))

// ---------- Mes ----------

function MonthGrid({ cursor, tasks, onCreate, onEdit, onPickDay }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), wk)
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cursor])

  return (
    <>
      <div className="grid grid-cols-7 border-b border-ink-100 dark:border-ink-800">
        {days.slice(0, 7).map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-ink-400">
            {format(d, 'EEE', { locale: es })}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7 grid-rows-6">
        {days.map((d, i) => {
          const list = tasksOn(tasks, d)
          const out = !isSameMonth(d, cursor)
          return (
            <div
              key={d}
              onClick={() => onCreate(new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9))}
              className={`group relative min-h-[84px] cursor-pointer overflow-hidden border-ink-100 p-1.5 transition hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/30 ${i % 7 !== 6 ? 'border-r' : ''} ${i < 35 ? 'border-b' : ''}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); onPickDay(d) }}
                className={`mb-1 ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition ${
                  isToday(d) ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/40' : out ? 'text-ink-300 dark:text-ink-600' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-700'
                }`}
              >
                {format(d, 'd')}
              </button>
              <div className="space-y-0.5">
                {list.slice(0, 3).map((t) => <Chip key={t.id} t={t} onEdit={onEdit} />)}
                {list.length > 3 && (
                  <button onClick={(e) => { e.stopPropagation(); onPickDay(d) }} className="px-1.5 text-[11px] font-medium text-ink-400 hover:text-ink-700">
                    +{list.length - 3} más
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </>
  )
}

function Chip({ t, onEdit }) {
  const c = color(t.color)
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onEdit(t) }}
      className={`flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition hover:brightness-95 ${t.allDay ? `${c.dot} text-white` : 'hover:bg-ink-100 dark:hover:bg-ink-800'} ${t.done ? 'opacity-50 line-through' : ''}`}
    >
      {!t.allDay && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />}
      {!t.allDay && <span className="text-ink-400">{format(new Date(t.start), 'HH:mm')}</span>}
      <span className="truncate">{t.title}</span>
    </button>
  )
}

// ---------- Semana / Día ----------

function layout(list) {
  // Reparte en columnas las tareas que se solapan
  const items = list.map((t) => ({ t, s: new Date(t.start), e: new Date(t.end || new Date(t.start).getTime() + 3600_000) }))
  const groups = []
  let cur = []
  let maxEnd = 0
  for (const it of items) {
    if (cur.length && it.s >= maxEnd) { groups.push(cur); cur = []; maxEnd = 0 }
    cur.push(it)
    maxEnd = Math.max(maxEnd, it.e)
  }
  if (cur.length) groups.push(cur)
  const out = []
  for (const g of groups) {
    const cols = []
    for (const it of g) {
      let c = cols.findIndex((end) => end <= it.s)
      if (c === -1) { c = cols.length; cols.push(0) }
      cols[c] = it.e
      it.col = c
    }
    g.forEach((it) => out.push({ ...it, cols: cols.length }))
  }
  return out
}

export function TimeGrid({ days, tasks, onCreate, onEdit, hideHeader = false, scrollRef }) {
  const scroller = useRef(null)
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const i = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(i)
  }, [])
  useEffect(() => {
    const now = new Date()
    const target = days.some((d) => isSameDay(d, now)) ? now.getHours() - 1.5 : 7.5
    if (scroller.current) scroller.current.scrollTop = HOUR * Math.max(0, target)
    if (scrollRef) scrollRef.current = scroller.current
  }, [scrollRef, days.map(String).join()])

  const allDay = days.map((d) => tasksOn(tasks, d).filter((t) => t.allDay))
  const hasAllDay = allDay.some((l) => l.length)
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`

  return (
    <>
      <div className={`grid border-b border-ink-100 dark:border-ink-800 ${hideHeader ? 'hidden' : ''}`} style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map((d) => (
          <div key={d} className="flex flex-col items-center gap-0.5 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{format(d, 'EEE', { locale: es })}</span>
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold ${isToday(d) ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/40' : ''}`}>
              {format(d, 'd')}
            </span>
          </div>
        ))}
        {hasAllDay && (
          <>
            <div className="py-1 pr-2 text-right text-[10px] text-ink-400">todo el día</div>
            {allDay.map((l, i) => (
              <div key={i} className="space-y-0.5 border-l border-ink-100 p-1 dark:border-ink-800">
                {l.map((t) => <Chip key={t.id} t={t} onEdit={onEdit} />)}
              </div>
            ))}
          </>
        )}
      </div>

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="grid" style={{ gridTemplateColumns: cols, height: HOUR * 24 }}>
          <div className="relative">
            {Array.from({ length: 23 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-ink-400" style={{ top: HOUR * (h + 1) }}>
                {String(h + 1).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {days.map((d) => {
            const list = layout(tasksOn(tasks, d).filter((t) => !t.allDay))
            return (
              <div
                key={d}
                className="relative border-l border-ink-100 dark:border-ink-800"
                onClick={(e) => {
                  const y = e.clientY - e.currentTarget.getBoundingClientRect().top
                  const mins = Math.floor(y / HOUR * 2) * 30
                  const s = startOfDay(d)
                  s.setMinutes(mins)
                  onCreate(s)
                }}
              >
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-ink-100 dark:border-ink-800/70" style={{ top: HOUR * h }} />
                ))}
                {list.map(({ t, s, e, col, cols }) => {
                  const top = (differenceInMinutes(s, startOfDay(d)) / 60) * HOUR
                  const h = Math.max(22, (differenceInMinutes(e, s) / 60) * HOUR - 2)
                  const c = color(t.color)
                  return (
                    <button
                      key={t.id}
                      onClick={(ev) => { ev.stopPropagation(); onEdit(t) }}
                      className={`absolute overflow-hidden rounded-lg border-l-[3px] ${c.bar} ${c.soft} px-2 py-1 text-left text-xs backdrop-blur transition hover:shadow-soft ${t.done ? 'opacity-50' : ''}`}
                      style={{ top: top + 1, height: h, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                    >
                      <div className={`flex items-center gap-1 font-semibold ${t.done ? 'line-through' : ''}`}>
                        {t.done && <Check size={11} />}
                        <span className="truncate">{t.title}</span>
                        {t.reminder !== 'none' && !t.done && <BellRing size={10} className="ml-auto shrink-0 opacity-60" />}
                      </div>
                      {h > 34 && <div className="opacity-70">{format(s, 'HH:mm')} – {format(e, 'HH:mm')}</div>}
                    </button>
                  )
                })}
                {isSameDay(d, now) && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (differenceInMinutes(now, startOfDay(now)) / 60) * HOUR }}>
                    <div className="relative h-[2px] bg-brand-500">
                      <span className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-brand-500" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ---------- Barra lateral: mini calendario + próximas ----------

export function MiniCalendar({ cursor, setCursor, tasks }) {
  const [month, setMonth] = useState(startOfMonth(cursor))
  useEffect(() => setMonth(startOfMonth(cursor)), [cursor])
  const start = startOfWeek(month, wk)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const has = new Set(tasks.map((t) => format(new Date(t.start), 'yyyy-MM-dd')))
  return (
    <div className="px-1">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-sm font-semibold">{cap(format(month, 'MMMM yyyy', { locale: es }))}</span>
        <div className="flex">
          <button className="icon-btn h-7 w-7" onClick={() => setMonth(subMonths(month, 1))}><ChevronLeft size={15} /></button>
          <button className="icon-btn h-7 w-7" onClick={() => setMonth(addMonths(month, 1))}><ChevronRight size={15} /></button>
        </div>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-ink-400">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => <span key={d} className="py-1">{d}</span>)}
        {days.map((d) => {
          const sel = isSameDay(d, cursor)
          return (
            <button
              key={d}
              onClick={() => setCursor(d)}
              className={`relative mx-auto flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition ${
                sel ? 'bg-brand-500 font-semibold text-white' : isToday(d) ? 'font-semibold text-brand-500' : isSameMonth(d, month) ? 'text-ink-700 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800' : 'text-ink-300 dark:text-ink-600'
              }`}
            >
              {format(d, 'd')}
              {has.has(format(d, 'yyyy-MM-dd')) && !sel && <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-brand-400" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Upcoming({ tasks, onEdit }) {
  const now = Date.now()
  const list = tasks
    .filter((t) => !t.done && new Date(t.end || t.start).getTime() >= now)
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 5)
  return (
    <div className="mt-6 px-1">
      <div className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-ink-400">Próximas</div>
      {list.length === 0 && <p className="px-1 text-xs text-ink-400">Nada pendiente. Disfruta ✨</p>}
      <div className="space-y-1">
        {list.map((t) => (
          <button key={t.id} onClick={() => onEdit(t)} className="flex w-full items-start gap-2.5 rounded-xl px-2 py-1.5 text-left transition hover:bg-ink-100 dark:hover:bg-ink-800">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${color(t.color).dot}`} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{t.title}</span>
              <span className="block text-[11px] text-ink-400">
                {cap(format(new Date(t.start), t.allDay ? "EEE d MMM" : "EEE d MMM · HH:mm", { locale: es }))}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
