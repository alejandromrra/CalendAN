import { CalendarDays, FolderClosed, Moon, Settings, Sun } from 'lucide-react'
import { LogoMark } from './Logo'

const NAV = [
  { id: 'calendar', label: 'Calendario', icon: CalendarDays },
  { id: 'projects', label: 'Proyectos', icon: FolderClosed },
  { id: 'settings', label: 'Ajustes', icon: Settings },
]

export default function Sidebar({ view, setView, theme, toggleTheme, children }) {
  return (
    <>
      {/* Escritorio */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-200/70 bg-white/60 px-4 py-5 backdrop-blur-xl dark:border-ink-800 dark:bg-ink-900/40 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <LogoMark className="h-9 w-9 shadow-md shadow-brand-500/30 rounded-[11px]" />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">CalendAN</div>
            <div className="text-xs text-ink-400">Calendario & Proyectos</div>
          </div>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                view === id
                  ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                  : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </button>
          ))}
        </nav>
        <div className="mt-6 flex-1 overflow-y-auto">{children}</div>
        <button onClick={toggleTheme} className="btn-ghost mt-4 justify-start px-3">
          {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        </button>
      </aside>

      {/* Móvil: barra de pestañas estilo iOS */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 border-t border-ink-200/60 bg-white/85 pt-1.5 backdrop-blur-xl dark:border-ink-800 dark:bg-ink-900/85 md:hidden">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex flex-col items-center gap-1 text-[10px] font-medium transition ${view === id ? 'text-brand-500' : 'text-ink-400'}`}
          >
            <Icon size={24} strokeWidth={view === id ? 2.1 : 1.7} />
            {label}
          </button>
        ))}
      </nav>
    </>
  )
}
