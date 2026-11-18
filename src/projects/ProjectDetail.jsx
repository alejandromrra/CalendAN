import { useRef, useState } from 'react'
import {
  ArrowLeft, ExternalLink, Eye, Globe, ImagePlus, Link2, Monitor, Pencil, RotateCw, Smartphone,
  StickyNote, Trash2, X,
} from 'lucide-react'
import ColorPicker from '../components/ColorPicker'
import Github from '../components/GithubIcon'
import Modal from '../components/Modal'
import { color } from '../lib/colors'
import { compressImage, uid } from '../lib/store'
import { uploadImage } from '../lib/api'
import { githubRepo, hostOf, normalizeUrl, renderMarkdown, screenshotUrl } from './utils'

export default function ProjectDetail({ project, onChange, onBack, onDelete }) {
  const c = color(project.color)
  const set = (patch) => onChange({ ...project, ...patch })
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="h-full overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+90px)] sm:pb-12">
      {/* Cabecera */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[.14] dark:opacity-25" style={{ background: `radial-gradient(80% 120% at 0% 0%, ${c.hex}, transparent 60%)` }} />
        <div className="relative px-5 pt-5 sm:px-8">
          <div className="mb-6 flex items-center gap-2">
            <button onClick={onBack} className="btn-ghost -ml-3"><ArrowLeft size={16} /> Proyectos</button>
            <div className="ml-auto flex gap-1">
              <button className="icon-btn" onClick={() => setEditing(true)} title="Editar"><Pencil size={16} /></button>
              <button className="icon-btn hover:text-rose-500" onClick={() => setConfirm(true)} title="Eliminar"><Trash2 size={16} /></button>
            </div>
          </div>
          <div className="flex items-start gap-4 pb-8">
            <MiniFolder hex={c.hex} hex2={c.hex2} />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.name}</h1>
              {project.description && <p className="mt-1 max-w-2xl text-ink-500 dark:text-ink-400">{project.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {project.github && (
                  <a href={project.github} target="_blank" rel="noreferrer" className="btn-outline h-8 text-xs"><Github size={14} /> {githubRepo(project.github) ? `${githubRepo(project.github).owner}/${githubRepo(project.github).repo}` : 'GitHub'}</a>
                )}
                {project.url && (
                  <a href={project.url} target="_blank" rel="noreferrer" className="btn-outline h-8 text-xs"><Globe size={14} /> {hostOf(project.url)}</a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-8 px-5 sm:px-8">
        {project.url ? <LivePreview url={project.url} /> : (
          <button onClick={() => setEditing(true)} className="card flex w-full items-center justify-center gap-2 border-dashed py-10 text-sm text-ink-400 transition hover:text-brand-500">
            <Monitor size={18} /> Añade la URL de tu app para ver el preview en vivo
          </button>
        )}

        <div className="grid gap-8 lg:grid-cols-5">
          <Report className={project.github ? 'lg:col-span-3' : 'lg:col-span-5'} value={project.report || ''} onChange={(report) => set({ report })} />
          {project.github && <GithubCard className="lg:col-span-2" url={project.github} />}
        </div>

        <Items project={project} set={set} />
      </div>

      <EditProject open={editing} project={project} onClose={() => setEditing(false)} onSave={(p) => { onChange(p); setEditing(false) }} />
      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Eliminar proyecto?" variant="alert"
        primary={{ label: 'Eliminar', onClick: onDelete, danger: true }}>
        <p className="text-sm text-ink-500">Se borrará «{project.name}» y todo su contenido.</p>
      </Modal>
    </div>
  )
}

function MiniFolder({ hex, hex2 }) {
  return (
    <svg viewBox="0 0 64 52" className="h-14 w-16 shrink-0 drop-shadow-md">
      <path d="M6 2 H22 C25 2 26 3 27.5 5 L29 7 H58 Q62 7 62 11 V46 Q62 50 58 50 H6 Q2 50 2 46 V6 Q2 2 6 2 Z" fill={hex} />
      <rect x="2" y="14" width="60" height="36" rx="4" fill={hex2} />
      <rect x="2" y="14" width="60" height="36" rx="4" fill="url(#mf)" />
      <defs><linearGradient id="mf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".25" /><stop offset="1" stopColor="#000" stopOpacity=".05" /></linearGradient></defs>
    </svg>
  )
}

// ---------- Preview en vivo ----------

function LivePreview({ url }) {
  const [device, setDevice] = useState('desktop')
  const [mode, setMode] = useState('live')
  const [key, setKey] = useState(0)
  return (
    <section>
      <SectionTitle icon={Eye} title="Preview">
        <div className="flex rounded-xl bg-ink-100 p-1 dark:bg-ink-800">
          {[['live', 'En vivo'], ['shot', 'Captura']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded-lg px-2.5 py-1 text-xs font-medium ${mode === k ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500'}`}>{l}</button>
          ))}
        </div>
        <div className="hidden rounded-xl bg-ink-100 p-1 dark:bg-ink-800 sm:flex">
          <button onClick={() => setDevice('desktop')} className={`rounded-lg p-1.5 ${device === 'desktop' ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500'}`}><Monitor size={14} /></button>
          <button onClick={() => setDevice('mobile')} className={`rounded-lg p-1.5 ${device === 'mobile' ? 'bg-white shadow-sm dark:bg-ink-700' : 'text-ink-500'}`}><Smartphone size={14} /></button>
        </div>
      </SectionTitle>

      <div className={`mx-auto overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lift transition-all duration-500 dark:border-ink-700 dark:bg-ink-900 ${device === 'mobile' ? 'max-w-[390px] rounded-[2rem]' : 'max-w-full'}`}>
        <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-850">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex h-7 min-w-0 max-w-md flex-1 items-center justify-center gap-1.5 truncate rounded-lg bg-white px-3 text-xs text-ink-500 dark:bg-ink-800">
            <Globe size={12} className="shrink-0" /> <span className="truncate">{hostOf(url)}</span>
          </div>
          <button className="icon-btn h-7 w-7" onClick={() => setKey((k) => k + 1)} title="Recargar"><RotateCw size={14} /></button>
          <a className="icon-btn h-7 w-7" href={url} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={14} /></a>
        </div>
        <div className={`relative bg-white ${device === 'mobile' ? 'h-[680px]' : 'h-[60vh] min-h-[420px]'}`}>
          {mode === 'live' ? (
            <iframe key={key} src={url} title="preview" className="h-full w-full" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" loading="lazy" />
          ) : (
            <img src={screenshotUrl(url, device === 'mobile' ? 600 : 1400)} alt="Captura" className="h-full w-full object-cover object-top" />
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-xs text-ink-400">¿Se ve en blanco? Algunas webs bloquean ser embebidas: usa «Captura».</p>
    </section>
  )
}

// ---------- Informe ----------

function Report({ value, onChange, className }) {
  const [edit, setEdit] = useState(!value)
  return (
    <section className={className}>
      <SectionTitle icon={StickyNote} title="Informe">
        <button className="btn-ghost h-8 text-xs" onClick={() => setEdit(!edit)}>{edit ? <><Eye size={14} /> Ver</> : <><Pencil size={14} /> Editar</>}</button>
      </SectionTitle>
      <div className="card min-h-[220px] p-5">
        {edit ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={'## Idea\nDescribe la app, objetivos, funcionalidades…\n\n- Usa listas\n- **negrita**, [enlaces](https://…)'}
            className="h-full min-h-[260px] w-full resize-y bg-transparent font-mono text-[13px] leading-relaxed outline-none placeholder:text-ink-300 dark:placeholder:text-ink-600"
          />
        ) : (
          <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
        )}
      </div>
    </section>
  )
}

function GithubCard({ url, className }) {
  const r = githubRepo(url)
  return (
    <section className={className}>
      <SectionTitle icon={Github} title="Repositorio" />
      <a href={url} target="_blank" rel="noreferrer" className="card group block overflow-hidden transition hover:shadow-lift">
        {r && <img src={`https://opengraph.githubassets.com/1/${r.owner}/${r.repo}`} alt="" className="aspect-[2/1] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />}
        <div className="flex items-center gap-2 p-4 text-sm font-medium">
          <Github size={16} /> {r ? `${r.owner}/${r.repo}` : url}
          <ExternalLink size={14} className="ml-auto text-ink-400" />
        </div>
      </a>
    </section>
  )
}

// ---------- Elementos: diseños, notas, enlaces ----------

function Items({ project, set }) {
  const fileRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [draft, setDraft] = useState(null) // { type, title, content, id? }
  const items = project.items || []

  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState(null)
  const addFiles = async (files) => {
    const imgs = [...files].filter((f) => f.type.startsWith('image/'))
    if (!imgs.length) return
    setUploading(imgs.length)
    setUploadError(null)
    const next = []
    for (const f of imgs) {
      try {
        const { url } = await uploadImage(await compressImage(f))
        next.push({ id: uid(), type: 'image', title: f.name.replace(/\.[^.]+$/, ''), content: url, createdAt: Date.now() })
      } catch (e) {
        setUploadError(`No se pudo subir «${f.name}»: ${e.message}`)
      }
      setUploading((n) => n - 1)
    }
    if (next.length) set({ items: [...items, ...next] })
  }
  const saveDraft = () => {
    if (!draft.content?.trim() && !draft.title?.trim()) return setDraft(null)
    const it = { ...draft, content: draft.type === 'link' ? normalizeUrl(draft.content) : draft.content, id: draft.id || uid(), createdAt: draft.createdAt || Date.now() }
    set({ items: draft.id ? items.map((x) => (x.id === it.id ? it : x)) : [...items, it] })
    setDraft(null)
  }
  const del = (id) => set({ items: items.filter((x) => x.id !== id) })

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files) }}
    >
      <SectionTitle icon={ImagePlus} title="Diseños y archivos">
        <button className="btn-ghost h-8 text-xs" onClick={() => fileRef.current.click()}><ImagePlus size={14} /> Imagen</button>
        <button className="btn-ghost h-8 text-xs" onClick={() => setDraft({ type: 'note', title: '', content: '' })}><StickyNote size={14} /> Nota</button>
        <button className="btn-ghost h-8 text-xs" onClick={() => setDraft({ type: 'link', title: '', content: '' })}><Link2 size={14} /> Enlace</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </SectionTitle>

      <div className={`grid grid-cols-2 gap-4 rounded-2xl transition sm:grid-cols-3 lg:grid-cols-4 ${drag ? 'bg-brand-500/5 ring-2 ring-dashed ring-brand-400' : ''}`}>
        {items.map((it) => (
          <div key={it.id} className="card group relative overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
            <button className="absolute right-2 top-2 z-10 hidden h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur group-hover:flex" onClick={() => del(it.id)}><X size={14} /></button>
            {it.type === 'image' && (
              <button onClick={() => setLightbox(it)} className="block w-full">
                <img src={it.content} alt={it.title} className="aspect-[4/3] w-full object-cover" />
                <div className="truncate px-3 py-2 text-left text-xs font-medium">{it.title}</div>
              </button>
            )}
            {it.type === 'note' && (
              <button onClick={() => setDraft(it)} className="flex aspect-[4/3] w-full flex-col bg-amber-50/70 p-4 text-left dark:bg-amber-400/5">
                <div className="mb-1 text-sm font-semibold">{it.title || 'Nota'}</div>
                <p className="line-clamp-5 whitespace-pre-line text-xs text-ink-500 dark:text-ink-400">{it.content}</p>
              </button>
            )}
            {it.type === 'link' && (
              <a href={it.content} target="_blank" rel="noreferrer" className="block">
                <div className="relative aspect-[4/3] bg-ink-100 dark:bg-ink-800">
                  <Globe size={22} className="absolute inset-0 m-auto text-ink-300" />
                  <img src={screenshotUrl(it.content, 600)} alt="" loading="lazy" className="relative h-full w-full object-cover object-top" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
                <div className="truncate px-3 py-2 text-xs font-medium">{it.title || hostOf(it.content)}</div>
              </a>
            )}
          </div>
        ))}
        <button onClick={() => fileRef.current.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ink-200 text-xs text-ink-400 transition hover:border-brand-400 hover:text-brand-500 dark:border-ink-700">
          <ImagePlus size={22} strokeWidth={1.5} className={uploading ? 'animate-pulse' : ''} />
          {uploading ? `Subiendo ${uploading}…` : 'Arrastra tus diseños aquí'}
        </button>
      </div>
      {uploadError && <p className="mt-3 text-sm text-rose-500">{uploadError}</p>}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.type === 'link' ? 'Enlace' : 'Nota'}
        primary={{ label: 'Guardar', onClick: saveDraft }}>
        {draft && (
          <div className="space-y-3">
            <input autoFocus className="input" placeholder="Título" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            {draft.type === 'link'
              ? <input className="input" placeholder="https://…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
              : <textarea rows={8} className="input h-auto py-2.5" placeholder="Escribe tu idea…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />}
          </div>
        )}
      </Modal>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex animate-fade items-center justify-center bg-ink-950/80 p-6 backdrop-blur" onClick={() => setLightbox(null)}>
          <img src={lightbox.content} alt="" className="max-h-full max-w-full animate-pop rounded-xl shadow-2xl" />
        </div>
      )}
    </section>
  )
}

function SectionTitle({ icon: Icon, title, children }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h2 className="mr-auto flex items-center gap-2 text-sm font-semibold tracking-tight"><Icon size={16} className="text-ink-400" /> {title}</h2>
      {children}
    </div>
  )
}

function EditProject({ open, project, onClose, onSave }) {
  const [f, setF] = useState(project)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) { setPrevOpen(open); if (open) setF(project) }
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e })
  const save = () => onSave({ ...f, github: f.github ? normalizeUrl(f.github) : '', url: f.url ? normalizeUrl(f.url) : '' })
  return (
    <Modal open={open} onClose={onClose} title="Editar proyecto"
      primary={{ label: 'Guardar', onClick: save, disabled: !f.name?.trim() }}>
      <div className="space-y-4">
        <div><label className="label">Nombre</label><input className="input" value={f.name} onChange={set('name')} /></div>
        <div><label className="label">Descripción</label><textarea rows={2} className="input h-auto py-2.5" value={f.description} onChange={set('description')} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">GitHub</label><input className="input" value={f.github} onChange={set('github')} placeholder="github.com/usuario/repo" /></div>
          <div><label className="label">Web / demo</label><input className="input" value={f.url} onChange={set('url')} placeholder="miapp.com" /></div>
        </div>
        <div><label className="label">Color</label><ColorPicker value={f.color} onChange={set('color')} /></div>
      </div>
    </Modal>
  )
}
