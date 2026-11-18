import { useEffect, useState } from 'react'
import { CloudOff } from 'lucide-react'
import Sidebar from './components/Sidebar'
import SettingsView from './components/SettingsView'
import LoginView from './components/LoginView'
import { LogoMark } from './components/Logo'
import CalendarView, { MiniCalendar, Upcoming } from './calendar/CalendarView'
import TaskModal from './calendar/TaskModal'
import ProjectsView from './projects/ProjectsView'
import { api } from './lib/api'
import { useLocalState, useProjects, useSession, useTasks, useTheme } from './lib/store'

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [authed, setAuthed] = useSession()

  if (authed === null)
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <LogoMark className="h-12 w-12 animate-pulse rounded-[14px]" />
      </div>
    )
  if (!authed) return <LoginView onDone={() => setAuthed(true)} />
  return <Shell theme={theme} toggleTheme={toggleTheme} onLogout={() => setAuthed(false)} />
}

function Shell({ theme, toggleTheme, onLogout }) {
  const [view, setView] = useLocalState('an:view', 'calendar')
  const [mode, setMode] = useLocalState('an:calmode', 'week')
  const [cursor, setCursor] = useState(new Date())
  const [navKey, setNavKey] = useState(0)
  const go = (v) => { setView(v); setNavKey((k) => k + 1) }
  const [editing, setEditing] = useState(null)
  const { tasks, upsert, remove, error: taskError } = useTasks()
  const projects = useProjects()
  const [whatsappReady, setWhatsappReady] = useState(true)

  useEffect(() => {
    Promise.all([api('/api/settings/whatsapp'), api('/api/push')])
      .then(([w, p]) => setWhatsappReady(w.configured || p.devices > 0))
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
          <CalendarView tasks={tasks} cursor={cursor} setCursor={setCursor} mode={mode} setMode={setMode} onCreate={create} onEdit={setEditing} />
        )}
        {view === 'projects' && <ProjectsView key={navKey} {...projects} />}
        {view === 'settings' && <SettingsView onLogout={onLogout} />}

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
