import { useState } from 'react'
import Sidebar from './components/Sidebar'
import SettingsView from './components/SettingsView'
import CalendarView, { MiniCalendar, Upcoming } from './calendar/CalendarView'
import TaskModal from './calendar/TaskModal'
import ProjectsView from './projects/ProjectsView'
import { useLocalState, useProjects, useTasks, useTheme } from './lib/store'

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [view, setView] = useLocalState('an:view', 'calendar')
  const [mode, setMode] = useLocalState('an:calmode', 'week')
  const [cursor, setCursor] = useState(new Date())
  const [navKey, setNavKey] = useState(0)
  const go = (v) => { setView(v); setNavKey((k) => k + 1) }
  const [editing, setEditing] = useState(null)
  const { tasks, upsert, remove, server, refreshHealth } = useTasks()
  const projects = useProjects()

  const create = (start) => setEditing({ start: start.toISOString(), end: new Date(start.getTime() + 3600_000).toISOString(), reminder: 0 })

  return (
    <div className="flex h-[100dvh] overflow-hidden">
      <Sidebar view={view} setView={go} theme={theme} toggleTheme={toggleTheme}>
        {view === 'calendar' && (
          <>
            <MiniCalendar cursor={cursor} setCursor={setCursor} tasks={tasks} />
            <Upcoming tasks={tasks} onEdit={setEditing} />
          </>
        )}
      </Sidebar>

      <main className="min-w-0 flex-1">
        {view === 'calendar' && (
          <CalendarView tasks={tasks} cursor={cursor} setCursor={setCursor} mode={mode} setMode={setMode} onCreate={create} onEdit={setEditing} />
        )}
        {view === 'projects' && <ProjectsView key={navKey} {...projects} />}
        {view === 'settings' && <SettingsView server={server} refreshHealth={refreshHealth} />}
      </main>

      <TaskModal
        open={!!editing}
        task={editing}
        whatsappReady={!!server.whatsapp?.configured}
        onClose={() => setEditing(null)}
        onSave={(t) => { upsert(t); setEditing(null) }}
        onDelete={(id) => { remove(id); setEditing(null) }}
      />
    </div>
  )
}
