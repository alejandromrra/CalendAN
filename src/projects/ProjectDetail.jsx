import { useEffect, useRef, useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ArrowUpRight, Bold, ChevronLeft, ExternalLink, FileText, Globe, Heading2, ImagePlus, Italic, Link2, List,
  Monitor, MoreHorizontal, Palette, Pencil, Plus, RotateCw, Smartphone, Sparkles, StickyNote, Trash2, X,
} from 'lucide-react'
import ColorPicker from '../components/ColorPicker'
import Github from '../components/GithubIcon'
import Modal from '../components/Modal'
import { color } from '../lib/colors'
import { compressImage, uid } from '../lib/store'
import { uploadImage } from '../lib/api'
import { githubRepo, hostOf, normalizeUrl, renderMarkdown, screenshotUrl } from './utils'

const TEMPLATE = `## Idea
Qué es y para quién.

## Problema que resuelve


## Funcionalidades
-
-

## Stack


## Próximos pasos
- `

// Guarda los cambios al dejar de escribir (y al salir), no en cada tecla
function useAutosave(value, save, delay = 700) {
  const [draft, setDraft] = useState(value)
  const dirty = useRef(false)
  const latest = useRef({ draft, save })
  latest.current = { draft, save }

  useEffect(() => {
    if (!dirty.current) setDraft(value)
  }, [value])
  useEffect(() => {
    if (!dirty.current) return
    const t = setTimeout(() => { dirty.current = false; save(draft) }, delay)
    return () => clearTimeout(t)
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (dirty.current) latest.current.save(latest.current.draft) }, [])

  const change = (v) => { dirty.current = true; setDraft(v) }
  const flush = () => { if (dirty.current) { dirty.current = false; save(draft) } }
  return [draft, change, flush]
}

export default function ProjectDetail({ project, onChange, onBack, onDelete }) {
  const c = color(project.color)
  const ref = useRef(project)
  ref.current = project
  const set = (patch) => onChange({ ...ref.current, ...patch })

  const [tab, setTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const items = project.items || []

  const tabs = [
    ['overview', 'Resumen'],
    ['files', 'Diseños', items.length || null],
    ...(project.url ? [['preview', 'Preview']] : []),
  ]

  return (
    <div className="h-full overflow-y-auto pb-[calc(env(safe-area-inset-bottom)+90px)] sm:pb-16">
      {/* Fondo de color del proyecto */}
      <div className="pointer-events-none relative">
        <div className="absolute -top-40 left-[-10%] h-80 w-[70%] rounded-full opacity-25 blur-3xl dark:opacity-20" style={{ background: c.hex }} />
        <div className="absolute -top-32 right-[-5%] h-64 w-[40%] rounded-full opacity-15 blur-3xl dark:opacity-10" style={{ background: c.hex2 }} />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 sm:px-8">
        {/* Barra superior */}
        <div className="flex items-center justify-between pt-3 sm:pt-5">
          <button onClick={onBack} className="-ml-2 flex items-center gap-0.5 rounded-lg px-2 py-1.5 text-[15px] font-medium text-brand-500 transition hover:bg-brand-500/10">
            <ChevronLeft size={20} /> Proyectos
          </button>
          <Menu
            items={[
              { icon: Pencil, label: 'Editar enlaces y color', onClick: () => setEditing(true) },
              { icon: Trash2, label: 'Eliminar proyecto', danger: true, onClick: () => setConfirm(true) },
            ]}
          />
        </div>

        {/* Cabecera */}
        <header className="flex flex-col gap-4 pb-6 pt-4 sm:flex-row sm:items-start sm:gap-7 sm:pb-8 sm:pt-8">
          <FolderIcon hex={c.hex} hex2={c.hex2} />
          <div className="min-w-0 flex-1">
            <TitleInput value={project.name} onSave={(name) => name.trim() && set({ name: name.trim() })} />
            <DescriptionInput value={project.description || ''} onSave={(description) => set({ description })} />
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {project.github && (
                <Pill href={project.github} icon={<Github size={14} />}>
                  {githubRepo(project.github) ? `${githubRepo(project.github).owner}/${githubRepo(project.github).repo}` : 'GitHub'}
                </Pill>
              )}
              {project.url && <Pill href={project.url} icon={<Globe size={14} />}>{hostOf(project.url)}</Pill>}
              {(!project.github || !project.url) && (
                <button onClick={() => setEditing(true)} className="flex h-8 items-center gap-1.5 rounded-full border border-dashed border-ink-300 px-3 text-xs font-medium text-ink-500 transition hover:border-brand-400 hover:text-brand-500 dark:border-ink-700">
                  <Plus size={13} /> {!project.github && !project.url ? 'Añadir GitHub o web' : !project.github ? 'Añadir GitHub' : 'Añadir web'}
                </button>
              )}
              <span className="ml-1 text-xs text-ink-400">
                Editado {formatDistanceToNow(new Date(project.updatedAt || Date.now()), { locale: es, addSuffix: true })}
              </span>
            </div>
          </div>
        </header>

        {/* Pestañas */}
        <nav className="mb-6 border-b border-ink-200/70 dark:border-ink-800">
          <div className="flex gap-6">
            {tabs.map(([k, l, n]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative flex items-center gap-1.5 py-3 text-sm font-medium transition ${tab === k ? 'text-ink-900 dark:text-white' : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'}`}
              >
                {l}
                {n && <span className="rounded-full bg-ink-200/70 px-1.5 text-[11px] font-semibold text-ink-500 dark:bg-ink-800 dark:text-ink-400">{n}</span>}
                {tab === k && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full" style={{ background: c.hex }} />}
              </button>
            ))}
          </div>
        </nav>

        {tab === 'overview' && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Report value={project.report || ''} onSave={(report) => set({ report })} accent={c.hex} />
            <aside className="space-y-4">
              {project.url && <WebCard url={project.url} onOpen={() => setTab('preview')} />}
              {project.github && <GithubCard url={project.github} />}
              <DetailsCard project={project} onColor={(k) => set({ color: k })} onFiles={() => setTab('files')} />
            </aside>
          </div>
        )}
        {tab === 'files' && <Items project={project} set={set} />}
        {tab === 'preview' && project.url && <LivePreview url={project.url} />}
      </div>

      <EditProject open={editing} project={project} onClose={() => setEditing(false)} onSave={(p) => { onChange(p); setEditing(false) }} />
      <Modal open={confirm} onClose={() => setConfirm(false)} title="¿Eliminar proyecto?" variant="alert"
        primary={{ label: 'Eliminar', onClick: onDelete, danger: true }}>
        <p className="text-sm text-ink-500">Se borrará «{project.name}» y todo su contenido.</p>
      </Modal>
    </div>
  )
}

// ---------------------------------------------------------------- cabecera

function FolderIcon({ hex, hex2 }) {
  return (
    <div className="relative h-[60px] w-[74px] shrink-0 sm:h-[88px] sm:w-[108px]">
      <svg viewBox="0 0 108 88" className="absolute inset-0 h-full w-full drop-shadow-[0_8px_16px_rgba(0,0,0,.15)]">
        <path d="M10 4 H38 C43 4 45 6 48 10 L51 14 H98 Q104 14 104 20 V78 Q104 84 98 84 H10 Q4 84 4 78 V10 Q4 4 10 4 Z" fill={hex} style={{ filter: 'brightness(.88)' }} />
        <rect x="16" y="12" width="60" height="44" rx="4" fill="#fff" transform="rotate(-5 46 34)" opacity=".95" />
        <rect x="36" y="14" width="56" height="42" rx="4" fill="#fff" transform="rotate(6 64 35)" opacity=".85" />
      </svg>
      <div
        className="absolute inset-x-[3%] bottom-[4%] top-[40%] rounded-[10px]"
        style={{ background: `linear-gradient(180deg, ${hex2}, ${hex})`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)' }}
      />
    </div>
  )
}

function TitleInput({ value, onSave }) {
  const [v, change, flush] = useAutosave(value, onSave)
  return (
    <input
      value={v}
      onChange={(e) => change(e.target.value)}
      onBlur={flush}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="-mx-1.5 w-full rounded-lg bg-transparent px-1.5 text-[28px] font-bold tracking-tight outline-none transition focus:bg-ink-900/[.04] dark:focus:bg-white/[.06] [@media(hover:hover)]:hover:bg-ink-900/[.03] dark:[@media(hover:hover)]:hover:bg-white/[.04] sm:text-4xl"
      aria-label="Nombre del proyecto"
    />
  )
}

function DescriptionInput({ value, onSave }) {
  const [v, change, flush] = useAutosave(value, onSave)
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [v])
  return (
    <textarea
      ref={ref}
      rows={1}
      value={v}
      onChange={(e) => change(e.target.value)}
      onBlur={flush}
      placeholder="Añade una descripción…"
      className="-mx-1.5 mt-1 block w-full max-w-3xl resize-none overflow-hidden rounded-lg bg-transparent px-1.5 py-0.5 text-base leading-relaxed text-ink-500 outline-none transition placeholder:text-ink-300 hover:bg-ink-900/[.03] focus:bg-ink-900/[.04] dark:text-ink-400 dark:placeholder:text-ink-600 dark:hover:bg-white/[.04] dark:focus:bg-white/[.06] sm:text-[17px]"
    />
  )
}

function Pill({ href, icon, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex h-8 max-w-full items-center gap-1.5 rounded-full bg-white px-3 text-xs font-medium shadow-[0_1px_2px_rgba(0,0,0,.06)] ring-1 ring-ink-200/70 transition hover:ring-ink-300 dark:bg-ink-900 dark:ring-ink-800 dark:hover:ring-ink-700"
    >
      {icon}
      <span className="truncate">{children}</span>
      <ArrowUpRight size={13} className="text-ink-400 transition group-hover:-translate-y-px group-hover:translate-x-px" />
    </a>
  )
}

function Menu({ items }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button className="icon-btn" onClick={() => setOpen(!open)} aria-label="Más opciones"><MoreHorizontal size={20} /></button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-40 w-60 animate-pop overflow-hidden rounded-2xl bg-white/95 p-1.5 shadow-lift ring-1 ring-ink-200/70 backdrop-blur-xl dark:bg-ink-850/95 dark:ring-ink-800">
            {items.map(({ icon: Icon, label, danger, onClick }) => (
              <button
                key={label}
                onClick={() => { setOpen(false); onClick() }}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-ink-100 dark:hover:bg-ink-800 ${danger ? 'text-rose-500' : ''}`}
              >
                <Icon size={16} className={danger ? '' : 'text-ink-400'} /> {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- informe

function Report({ value, onSave, accent }) {
  const [draft, change, flush] = useAutosave(value, onSave)
  const [edit, setEdit] = useState(false)
  const ta = useRef(null)

  useEffect(() => {
    const el = ta.current
    if (el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 320) + 'px' }
  }, [draft, edit])

  const start = (text) => {
    if (text != null) change(text)
    setEdit(true)
    setTimeout(() => {
      const el = ta.current
      if (!el) return
      el.focus()
      // Con la plantilla, deja seleccionada la primera frase de ejemplo para escribir encima
      const hint = 'Qué es y para quién.'
      const i = (text ?? el.value).indexOf(hint)
      if (text === TEMPLATE && i >= 0) el.setSelectionRange(i, i + hint.length)
      else el.setSelectionRange(el.value.length, el.value.length)
    }, 30)
  }
  const done = () => { flush(); setEdit(false) }

  // Inserta formato alrededor de la selección
  const wrap = (before, after = before, placeholder = '') => {
    const el = ta.current
    const { selectionStart: s, selectionEnd: e } = el
    const sel = draft.slice(s, e) || placeholder
    change(draft.slice(0, s) + before + sel + after + draft.slice(e))
    setTimeout(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + sel.length) }, 0)
  }
  const linePrefix = (prefix) => {
    const el = ta.current
    const s = el.selectionStart
    const lineStart = draft.lastIndexOf('\n', s - 1) + 1
    change(draft.slice(0, lineStart) + prefix + draft.slice(lineStart))
    setTimeout(() => { el.focus(); el.setSelectionRange(s + prefix.length, s + prefix.length) }, 0)
  }

  if (!draft && !edit) {
    return (
      <section className="flex min-h-[320px] self-start flex-col items-center justify-center rounded-3xl bg-white px-6 py-12 text-center ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: accent + '1f', color: accent }}>
          <FileText size={22} />
        </div>
        <h3 className="text-base font-semibold tracking-tight">Cuenta de qué va el proyecto</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-400">La idea, el problema que resuelve, las funcionalidades, el stack… todo en un mismo sitio.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button className="btn-primary" onClick={() => start(TEMPLATE)}><Sparkles size={15} /> Usar plantilla</button>
          <button className="btn-outline" onClick={() => start('')}>Empezar en blanco</button>
        </div>
      </section>
    )
  }

  return (
    <section className="self-start overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-4 py-2.5 dark:border-ink-800 sm:px-6">
        <span className="flex items-center gap-2 text-sm font-semibold"><FileText size={15} className="text-ink-400" /> Informe</span>
        {edit ? (
          <div className="flex items-center gap-0.5">
            <ToolBtn onClick={() => linePrefix('## ')} label="Título"><Heading2 size={16} /></ToolBtn>
            <ToolBtn onClick={() => wrap('**', '**', 'texto')} label="Negrita"><Bold size={16} /></ToolBtn>
            <ToolBtn onClick={() => wrap('*', '*', 'texto')} label="Cursiva"><Italic size={16} /></ToolBtn>
            <ToolBtn onClick={() => linePrefix('- ')} label="Lista"><List size={16} /></ToolBtn>
            <ToolBtn onClick={() => wrap('[', '](https://)', 'enlace')} label="Enlace"><Link2 size={16} /></ToolBtn>
            <button onClick={done} className="ml-2 rounded-lg px-2.5 py-1 text-sm font-semibold text-brand-500 hover:bg-brand-500/10">Listo</button>
          </div>
        ) : (
          <button onClick={() => start()} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-medium text-ink-500 transition hover:bg-ink-100 dark:hover:bg-ink-800">
            <Pencil size={14} /> Editar
          </button>
        )}
      </div>
      {edit ? (
        <textarea
          ref={ta}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onBlur={flush}
          placeholder="Escribe aquí…"
          className="block w-full resize-none bg-transparent px-5 py-5 text-base leading-7 outline-none placeholder:text-ink-300 sm:px-8 sm:py-7 sm:text-[15px]"
        />
      ) : (
        <div className="md cursor-text px-5 py-5 sm:px-8 sm:py-7" onDoubleClick={() => start()} dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }} />
      )}
    </section>
  )
}

function ToolBtn({ onClick, label, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:hover:bg-ink-800 dark:hover:text-white"
    >
      {children}
    </button>
  )
}

// ---------------------------------------------------------------- tarjetas laterales

function WebCard({ url, onOpen }) {
  return (
    <button onClick={onOpen} className="group block w-full overflow-hidden rounded-3xl bg-white text-left ring-1 ring-ink-200/70 transition hover:shadow-lift dark:bg-ink-900 dark:ring-ink-800">
      <div className="relative aspect-[16/10] overflow-hidden bg-ink-100 dark:bg-ink-800">
        <Globe className="absolute inset-0 m-auto text-ink-300" size={26} />
        <img src={screenshotUrl(url, 800)} alt="" loading="lazy" className="relative h-full w-full object-cover object-top transition duration-500 group-hover:scale-[1.03]" onError={(e) => (e.currentTarget.style.display = 'none')} />
      </div>
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <Globe size={15} className="text-ink-400" />
        <span className="truncate font-medium">{hostOf(url)}</span>
        <span className="ml-auto text-xs font-medium text-brand-500">Ver preview</span>
      </div>
    </button>
  )
}

function GithubCard({ url }) {
  const r = githubRepo(url)
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group block overflow-hidden rounded-3xl bg-white ring-1 ring-ink-200/70 transition hover:shadow-lift dark:bg-ink-900 dark:ring-ink-800">
      {r && (
        <div className="relative aspect-[2/1] overflow-hidden bg-ink-900">
          <Github size={26} className="absolute inset-0 m-auto text-white/30" />
          <img src={`https://opengraph.githubassets.com/1/${r.owner}/${r.repo}`} alt="" loading="lazy" className="relative h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      )}
      <div className="flex items-center gap-2 px-4 py-3 text-sm">
        <Github size={15} />
        <span className="truncate font-medium">{r ? `${r.owner}/${r.repo}` : url}</span>
        <ExternalLink size={14} className="ml-auto shrink-0 text-ink-400" />
      </div>
    </a>
  )
}

function DetailsCard({ project, onColor, onFiles }) {
  const items = project.items || []
  const count = (t) => items.filter((i) => i.type === t).length
  const rows = [
    ['Imágenes', count('image')],
    ['Notas', count('note')],
    ['Enlaces', count('link')],
  ]
  return (
    <div className="rounded-3xl bg-white p-5 ring-1 ring-ink-200/70 dark:bg-ink-900 dark:ring-ink-800">
      <button onClick={onFiles} className="grid w-full grid-cols-3 gap-2 text-center">
        {rows.map(([l, n]) => (
          <div key={l} className="rounded-2xl bg-ink-50 py-3 transition hover:bg-ink-100 dark:bg-ink-800/60 dark:hover:bg-ink-800">
            <div className="text-xl font-semibold tracking-tight">{n}</div>
            <div className="text-[11px] text-ink-400">{l}</div>
          </div>
        ))}
      </button>
      <div className="mt-5 flex items-center gap-2 text-xs font-medium text-ink-400"><Palette size={13} /> Color de la carpeta</div>
      <div className="mt-2.5"><ColorPicker value={project.color} onChange={onColor} /></div>
      <div className="mt-5 border-t border-ink-100 pt-4 text-xs text-ink-400 dark:border-ink-800">
        Creado {formatDistanceToNow(new Date(project.createdAt || Date.now()), { locale: es, addSuffix: true })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- preview

function LivePreview({ url }) {
  const [device, setDevice] = useState('desktop')
  const [mode, setMode] = useState('live')
  const [key, setKey] = useState(0)
  const seg = 'flex rounded-xl bg-ink-200/60 p-0.5 dark:bg-ink-800'
  const segBtn = (on) => `rounded-[10px] px-3 py-1 text-xs font-semibold transition ${on ? 'bg-white shadow-sm dark:bg-ink-600' : 'text-ink-500'}`
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
        <div className={seg}>
          {[['live', 'En vivo'], ['shot', 'Captura']].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={segBtn(mode === k)}>{l}</button>
          ))}
        </div>
        <div className={`${seg} hidden sm:flex`}>
          <button onClick={() => setDevice('desktop')} className={segBtn(device === 'desktop')}><Monitor size={14} /></button>
          <button onClick={() => setDevice('mobile')} className={segBtn(device === 'mobile')}><Smartphone size={14} /></button>
        </div>
      </div>

      <div className={`mx-auto overflow-hidden border border-ink-200 bg-white shadow-lift transition-all duration-500 dark:border-ink-700 dark:bg-ink-900 ${device === 'mobile' ? 'max-w-[390px] rounded-[2.4rem] border-[6px] border-ink-900 dark:border-ink-700' : 'max-w-full rounded-2xl'}`}>
        <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-850">
          <div className="hidden gap-1.5 sm:flex">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" /><span className="h-3 w-3 rounded-full bg-[#febc2e]" /><span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="mx-auto flex h-7 min-w-0 max-w-md flex-1 items-center justify-center gap-1.5 truncate rounded-lg bg-white px-3 text-xs text-ink-500 dark:bg-ink-800">
            <Globe size={12} className="shrink-0" /> <span className="truncate">{hostOf(url)}</span>
          </div>
          <button className="icon-btn h-7 w-7" onClick={() => setKey((k) => k + 1)} title="Recargar"><RotateCw size={14} /></button>
          <a className="icon-btn h-7 w-7" href={url} target="_blank" rel="noreferrer" title="Abrir"><ExternalLink size={14} /></a>
        </div>
        <div className={`relative bg-white ${device === 'mobile' ? 'h-[680px]' : 'h-[65vh] min-h-[420px]'}`}>
          {mode === 'live' ? (
            <iframe key={key} src={url} title="preview" className="h-full w-full" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" loading="lazy" />
          ) : (
            <img src={screenshotUrl(url, device === 'mobile' ? 600 : 1400)} alt="Captura" className="h-full w-full object-cover object-top" />
          )}
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-ink-400">¿Se ve en blanco? Algunas webs no permiten mostrarse dentro de otra: usa «Captura».</p>
    </section>
  )
}

// ---------------------------------------------------------------- diseños, notas y enlaces

function Items({ project, set }) {
  const fileRef = useRef(null)
  const [drag, setDrag] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [draft, setDraft] = useState(null)
  const [uploading, setUploading] = useState(0)
  const [uploadError, setUploadError] = useState(null)
  const items = project.items || []

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
    if (next.length) set({ items: [...(project.items || []), ...next] })
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
      className="relative"
    >
      <div className="mb-5 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => fileRef.current.click()} disabled={uploading > 0}>
          <ImagePlus size={15} /> {uploading ? `Subiendo ${uploading}…` : 'Subir imágenes'}
        </button>
        <button className="btn-outline" onClick={() => setDraft({ type: 'note', title: '', content: '' })}><StickyNote size={15} /> Nota</button>
        <button className="btn-outline" onClick={() => setDraft({ type: 'link', title: '', content: '' })}><Link2 size={15} /> Enlace</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
      </div>
      {uploadError && <p className="mb-4 text-sm text-rose-500">{uploadError}</p>}

      {items.length === 0 ? (
        <button
          onClick={() => fileRef.current.click()}
          className="flex w-full flex-col items-center justify-center gap-3 rounded-3xl bg-white px-6 py-16 text-center ring-1 ring-ink-200/70 transition hover:ring-brand-400 dark:bg-ink-900 dark:ring-ink-800"
        >
          <div className="flex -space-x-3">
            <span className="h-12 w-10 -rotate-6 rounded-lg bg-ink-100 ring-2 ring-white dark:bg-ink-800 dark:ring-ink-900" />
            <span className="z-10 flex h-12 w-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500 ring-2 ring-white dark:ring-ink-900"><ImagePlus size={18} /></span>
            <span className="h-12 w-10 rotate-6 rounded-lg bg-ink-100 ring-2 ring-white dark:bg-ink-800 dark:ring-ink-900" />
          </div>
          <div className="text-base font-semibold tracking-tight">Guarda aquí tus diseños</div>
          <p className="max-w-xs text-sm text-ink-400">Arrastra capturas, mockups o bocetos, o pulsa para elegirlos. También puedes añadir notas y enlaces.</p>
        </button>
      ) : (
        <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">
          {items.map((it) => (
            <div key={it.id} className="group relative break-inside-avoid overflow-hidden rounded-2xl bg-white ring-1 ring-ink-200/70 transition hover:shadow-lift dark:bg-ink-900 dark:ring-ink-800">
              <button
                className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white opacity-0 backdrop-blur transition group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                onClick={() => del(it.id)}
                aria-label="Eliminar"
              >
                <X size={14} />
              </button>
              {it.type === 'image' && (
                <button onClick={() => setLightbox(it)} className="block w-full">
                  <img src={it.content} alt={it.title} loading="lazy" className="w-full" />
                  <div className="truncate px-3 py-2 text-left text-xs font-medium text-ink-500">{it.title}</div>
                </button>
              )}
              {it.type === 'note' && (
                <button onClick={() => setDraft(it)} className="block w-full bg-amber-50 p-4 text-left dark:bg-amber-300/[.07]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold"><StickyNote size={14} className="text-amber-500" /> {it.title || 'Nota'}</div>
                  <p className="line-clamp-[10] whitespace-pre-line text-[13px] leading-relaxed text-ink-600 dark:text-ink-300">{it.content}</p>
                </button>
              )}
              {it.type === 'link' && (
                <a href={it.content} target="_blank" rel="noreferrer" className="block">
                  <div className="relative aspect-[4/3] bg-ink-100 dark:bg-ink-800">
                    <Globe size={22} className="absolute inset-0 m-auto text-ink-300" />
                    <img src={screenshotUrl(it.content, 600)} alt="" loading="lazy" className="relative h-full w-full object-cover object-top" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium">
                    <Link2 size={12} className="shrink-0 text-ink-400" />
                    <span className="truncate">{it.title || hostOf(it.content)}</span>
                  </div>
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {drag && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl border-2 border-dashed border-brand-400 bg-brand-500/5 text-sm font-medium text-brand-500 backdrop-blur-[1px]">
          Suelta para subir
        </div>
      )}

      <Modal open={!!draft} onClose={() => setDraft(null)} title={draft?.type === 'link' ? 'Enlace' : 'Nota'}
        primary={{ label: 'Guardar', onClick: saveDraft }}>
        {draft && (
          <div className="space-y-3">
            <input autoFocus className="input" placeholder="Título" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            {draft.type === 'link'
              ? <input className="input" inputMode="url" placeholder="https://…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
              : <textarea rows={10} className="input h-auto py-2.5" placeholder="Escribe tu idea…" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />}
          </div>
        )}
      </Modal>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex animate-fade flex-col items-center justify-center gap-4 bg-ink-950/90 p-6 backdrop-blur" onClick={() => setLightbox(null)}>
          <img src={lightbox.content} alt="" className="max-h-[85%] max-w-full animate-pop rounded-xl shadow-2xl" />
          <div className="text-sm text-white/70">{lightbox.title}</div>
        </div>
      )}
    </section>
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
        <div><label className="label">GitHub</label><input className="input" inputMode="url" value={f.github} onChange={set('github')} placeholder="github.com/usuario/repo" /></div>
        <div><label className="label">Web / demo</label><input className="input" inputMode="url" value={f.url} onChange={set('url')} placeholder="miapp.com" /></div>
        <div><label className="label">Color</label><ColorPicker value={f.color} onChange={set('color')} /></div>
      </div>
    </Modal>
  )
}
