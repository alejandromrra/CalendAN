import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'
import Sidebar from './components/Sidebar'
import SettingsView from './components/SettingsView'
import LoginView from './components/LoginView'
import { LogoMark } from './components/Logo'
import CalendarView, { MiniCalendar, Upcoming } from './calendar/CalendarView'
import TaskModal from './calendar/TaskModal'
import ProjectsView from './projects/ProjectsView'
import { api, isDesktop } from './lib/api'
import { subscribe } from './lib/live'
import { firstRunSetup, notifyNative } from './lib/desktop'
import { DEFAULT_ACCENT, applyAccent, cachedAccent } from './lib/accent'
import { useLocalState, useProjects, useSession, useTasks, useTheme } from './lib/store'

export default function App() {
  const [theme, toggleTheme, setTheme] = useTheme()
  const [user, setUser, refreshUser] = useSession()

  if (user === undefined)
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <LogoMark className="h-12 w-12 animate-pulse rounded-[14px]" />
      </div>
    )
  if (!user) return <LoginView onDone={refreshUser} />
  // key: al cambiar de cuenta se vuelve a montar todo con los datos del nuevo usuario
  return <Shell key={user.id} user={user} setUser={setUser} theme={theme} toggleTheme={toggleTheme} setTheme={setTheme} onLogout={() => setUser(null)} />
}

function Shell({ user, setUser, theme, toggleTheme, setTheme, onLogout }) {
  const [view, setView] = useLocalState('an:view', 'calendar')
  const [mode, setMode] = useLocalState('an:calmode', 'week')
  const [cursor, setCursor] = useState(new Date())
  const [navKey, setNavKey] = useState(0)
  const go = (v) => { setView(v); setNavKey((k) => k + 1) }
  const [editing, setEditing] = useState(null)
  const { tasks, upsert, remove, error: taskError } = useTasks()
  const projects = useProjects()
  const [whatsappReady, setWhatsappReady] = useState(true)
  const [accent, setAccentState] = useState(cachedAccent)

  // Color principal: se guarda en el servidor y se sincroniza entre dispositivos
  useEffect(() => {
    const load = () =>
      api('/api/settings/appearance')
        .then((r) => { const a = r.accent || DEFAULT_ACCENT; applyAccent(a); setAccentState(a) })
        .catch(() => {})
    load()
    return subscribe('change', (what) => what === 'settings' && load())
  }, [])
  const setAccent = (hex) => {
    applyAccent(hex)
    setAccentState(hex)
    api('/api/settings/appearance', { method: 'PUT', body: { accent: hex } }).catch(() => {})
  }

  // App de escritorio: los avisos llegan en directo y se muestran como notificación nativa
  useEffect(() => {
    if (!isDesktop) return
    firstRunSetup()
    return subscribe('reminder', notifyNative)
  }, [])

  useEffect(() => {
    Promise.all([api('/api/settings/whatsapp'), api('/api/push')])
      .then(([w, p]) => setWhatsappReady(w.configured || p.devices > 0 || isDesktop))
      .catch(() => {})
  }, [view])

  const create = (start) => setEditing({ start: start.toISOString(), end: new Date(start.getTime() + 3600_000).toISOString(), reminder: 0 })
  const syncError = taskError || projects.error

  return (
    <div className="pt-safe flex h-[100dvh] overflow-hidden">
      <Sidebar view={view} setView={go} theme={theme} toggleTheme={toggleTheme}>
        {view === 'calendar' && (
          <>
            <MiniCalendar cursor={cursor} setCursor={setCursor} tasks={tasks} />
            <Upcoming tasks={tasks} onEdit={setEditing} />
          </>
        )}
      </Sidebar>

      <main className="relative min-w-0 flex-1">
        {view === 'calendar' && (
          <CalendarView tasks={tasks} cursor={cursor} setCursor={setCursor} mode={mode} setMode={setMode} onCreate={create} onEdit={setEditing} onToggle={(t) => upsert({ ...t, done: !t.done })} />
        )}
        {view === 'projects' && <ProjectsView key={navKey} {...projects} />}
        {view === 'settings' && <SettingsView user={user} setUser={setUser} onLogout={onLogout} theme={theme} setTheme={setTheme} accent={accent} setAccent={setAccent} />}

        {syncError && (
          <div className="absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 animate-pop items-center gap-2 rounded-full bg-ink-900 px-4 py-2 text-sm text-white shadow-lift dark:bg-white dark:text-ink-900 md:bottom-6">
            <CloudOff size={15} /> {syncError}
          </div>
        )}
      </main>

      <TaskModal
        open={!!editing}
        task={editing}
        whatsappReady={whatsappReady}
        onClose={() => setEditing(null)}
        onSave={(t) => { upsert(t); setEditing(null) }}
        onDelete={(id) => { remove(id); setEditing(null) }}
      />
    </div>
  )
}
