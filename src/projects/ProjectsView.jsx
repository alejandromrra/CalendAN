import { useState } from 'react'
import { FolderPlus, Search } from 'lucide-react'
import Folder from './Folder'
import ProjectDetail from './ProjectDetail'
import Modal from '../components/Modal'
import ColorPicker from '../components/ColorPicker'
import { uid } from '../lib/store'
import { normalizeUrl } from './utils'

export default function ProjectsView({ projects, upsert, remove }) {
  const [openId, setOpenId] = useState(null)
  const [creating, setCreating] = useState(false)
  const [q, setQ] = useState('')

  const open = projects.find((p) => p.id === openId)
  if (open) return <ProjectDetail project={open} onChange={upsert} onBack={() => setOpenId(null)} onDelete={() => { remove(open.id); setOpenId(null) }} />

  const list = projects
    .filter((p) => (p.name + ' ' + (p.description || '')).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden px-4 pb-[calc(env(safe-area-inset-bottom)+90px)] pt-3 sm:px-8 sm:pb-10 sm:pt-5">
      <header className="mb-8 flex flex-wrap items-center gap-3 sm:mb-10">
        <div className="mr-auto">
          <h1 className="text-[28px] font-bold tracking-tight sm:text-2xl sm:font-semibold">Proyectos</h1>
          <p className="hidden text-sm text-ink-400 sm:block">Ideas, diseños y apps en marcha.</p>
        </div>
        <button
          className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500 text-white shadow-md shadow-brand-500/30 active:scale-95 sm:hidden"
          onClick={() => setCreating(true)}
          aria-label="Nuevo proyecto"
        >
          <FolderPlus size={18} />
        </button>
        <div className="relative w-full sm:w-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar" className="input h-10 w-full rounded-xl border-0 bg-ink-200/50 pl-9 dark:bg-ink-800 sm:h-9 sm:w-56 sm:border sm:bg-white dark:sm:bg-ink-900" />
        </div>
        <button className="btn-primary hidden sm:inline-flex" onClick={() => setCreating(true)}>
          <FolderPlus size={16} /> Nuevo
        </button>
      </header>

      <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4 xl:grid-cols-5">
        {list.map((p) => <Folder key={p.id} project={p} onOpen={() => setOpenId(p.id)} />)}
        <button onClick={() => setCreating(true)} className="group flex flex-col items-center">
          <div className="flex aspect-[5/4] w-full items-center justify-center rounded-2xl border-2 border-dashed border-ink-200 text-ink-300 transition group-hover:border-brand-400 group-hover:text-brand-500 dark:border-ink-700 dark:text-ink-600">
            <FolderPlus size={28} strokeWidth={1.5} />
          </div>
          <div className="mt-3 text-sm font-medium text-ink-400">Nueva carpeta</div>
        </button>
      </div>

      <NewProject
        open={creating}
        onClose={() => setCreating(false)}
        onCreate={(p) => { upsert(p); setCreating(false); setOpenId(p.id) }}
      />
    </div>
  )
}

function NewProject({ open, onClose, onCreate }) {
  const blank = { name: '', description: '', github: '', url: '', color: 'brand' }
  const [f, setF] = useState(blank)
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e })
  const submit = (e) => {
    e?.preventDefault()
    if (!f.name.trim()) return
    onCreate({
      id: uid(),
      ...f,
      name: f.name.trim(),
      github: f.github ? normalizeUrl(f.github) : '',
      url: f.url ? normalizeUrl(f.url) : '',
      report: '',
      items: [],
      createdAt: Date.now(),
    })
    setF(blank)
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nuevo proyecto"
      primary={{ label: 'Crear', onClick: submit, disabled: !f.name.trim() }}
    >
      <form onSubmit={submit} className="space-y-4">
        <input autoFocus value={f.name} onChange={set('name')} placeholder="Nombre del proyecto" className="w-full bg-transparent text-2xl font-semibold tracking-tight outline-none placeholder:text-ink-300 dark:placeholder:text-ink-600" />
        <div>
          <label className="label">Descripción</label>
          <textarea rows={2} className="input h-auto py-2.5" value={f.description} onChange={set('description')} placeholder="¿De qué va?" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">GitHub</label>
            <input className="input" value={f.github} onChange={set('github')} placeholder="github.com/usuario/repo" />
          </div>
          <div>
            <label className="label">Web / demo</label>
            <input className="input" value={f.url} onChange={set('url')} placeholder="miapp.com" />
          </div>
        </div>
        <div>
          <label className="label">Color de la carpeta</label>
          <ColorPicker value={f.color} onChange={set('color')} />
        </div>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
