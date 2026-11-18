import { Globe, StickyNote, FileText } from 'lucide-react'
import Github from '../components/GithubIcon'
import { color } from '../lib/colors'
import { assetUrl } from '../lib/api'
import { githubRepo, screenshotUrl } from './utils'

// Carpeta estilo macOS con "hojas" asomando que muestran el contenido real del proyecto
export default function Folder({ project, onOpen }) {
  const c = color(project.color)
  const previews = collectPreviews(project).slice(0, 3)
  const count = (project.items?.length || 0) + (project.github ? 1 : 0) + (project.url ? 1 : 0) + (project.report ? 1 : 0)

  const poses = [
    'left-[10%] -rotate-[6deg] group-hover:-translate-y-[22%] group-hover:-translate-x-[6%] group-hover:-rotate-[10deg]',
    'left-[24%] rotate-[1deg] group-hover:-translate-y-[30%] group-hover:rotate-0',
    'left-[38%] rotate-[7deg] group-hover:-translate-y-[20%] group-hover:translate-x-[6%] group-hover:rotate-[11deg]',
  ]

  return (
    <button onClick={onOpen} className="group flex w-full flex-col items-center text-center outline-none">
      <div className="relative aspect-[5/4] w-full [perspective:900px]">
        {/* Trasera con pestaña */}
        <svg viewBox="0 0 200 160" preserveAspectRatio="none" className="absolute inset-0 h-full w-full brightness-[.88] drop-shadow-[0_10px_18px_rgba(0,0,0,.12)]">
          <defs>
            <linearGradient id={`back-${project.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.hex2} />
              <stop offset="1" stopColor={c.hex} />
            </linearGradient>
          </defs>
          <path
            d="M14 8 H66 C74 8 77 11 81 16 L85 21 H186 Q198 21 198 33 V146 Q198 158 186 158 H14 Q2 158 2 146 V20 Q2 8 14 8 Z"
            fill={`url(#back-${project.id})`}
          />
          <path d="M14 8 H66 C74 8 77 11 81 16 L85 21 H186 Q198 21 198 33" fill="none" stroke="white" strokeOpacity=".35" strokeWidth="1" />
        </svg>

        {/* Hojas */}
        {previews.map((p, i) => (
          <div
            key={i}
            className={`absolute top-[13%] h-[62%] w-[50%] origin-bottom overflow-hidden rounded-md bg-white shadow-[0_2px_8px_rgba(0,0,0,.15)] ring-1 ring-black/5 transition-all duration-500 ease-[cubic-bezier(.2,.9,.3,1.2)] dark:bg-ink-100 ${poses[i]}`}
            style={{ zIndex: 1 + i }}
          >
            <Paper p={p} />
          </div>
        ))}
        {previews.length === 0 && (
          <div className="absolute left-[18%] top-[14%] h-[56%] w-[64%] -rotate-2 rounded-md bg-white/90 shadow ring-1 ring-black/5 transition-transform duration-500 group-hover:-translate-y-[18%] dark:bg-ink-100">
            <div className="space-y-1.5 p-3">
              <div className="h-1.5 w-2/3 rounded bg-ink-200" />
              <div className="h-1.5 w-1/2 rounded bg-ink-200" />
            </div>
          </div>
        )}

        {/* Frontal */}
        <div
          className="absolute inset-x-[1%] bottom-0 top-[42%] z-10 origin-bottom rounded-[12px] transition-transform duration-500 ease-[cubic-bezier(.2,.9,.3,1)] [transform-style:preserve-3d] group-hover:[transform:rotateX(-22deg)]"
          style={{
            background: `linear-gradient(180deg, ${c.hex2}f2 0%, ${c.hex}f7 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.55), inset 0 -10px 24px rgba(0,0,0,.08), 0 -2px 10px rgba(0,0,0,.08)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div className="absolute inset-x-[30%] bottom-[18%] h-[3px] rounded-full bg-white/25" />
        </div>
      </div>

      <div className="mt-3 max-w-full">
        <div className="truncate text-sm font-semibold tracking-tight">{project.name}</div>
        <div className="text-xs text-ink-400">{count} {count === 1 ? 'elemento' : 'elementos'}</div>
      </div>
    </button>
  )
}

export function collectPreviews(project) {
  const out = []
  const items = [...(project.items || [])].reverse()
  if (project.url) out.push({ type: 'site', url: project.url })
  for (const it of items) if (it.type === 'image') out.push({ type: 'image', src: it.content })
  if (project.github) out.push({ type: 'github', url: project.github })
  if (project.report) out.push({ type: 'report', text: project.report, title: project.name })
  for (const it of items) if (it.type === 'note') out.push({ type: 'note', title: it.title, text: it.content })
  for (const it of items) if (it.type === 'link') out.push({ type: 'link', title: it.title, url: it.content })
  return out
}

function Paper({ p }) {
  if (p.type === 'image') return <img src={assetUrl(p.src)} alt="" className="h-full w-full object-cover" />
  if (p.type === 'site')
    return (
      <div className="flex h-full flex-col">
        <div className="flex h-3 items-center gap-0.5 bg-ink-100 px-1">
          <span className="h-1 w-1 rounded-full bg-rose-400" /><span className="h-1 w-1 rounded-full bg-amber-400" /><span className="h-1 w-1 rounded-full bg-emerald-400" />
        </div>
        <div className="relative flex-1 bg-ink-50">
          <Globe className="absolute inset-0 m-auto text-ink-300" size={18} />
          <img src={screenshotUrl(p.url, 600)} alt="" loading="lazy" className="relative h-full w-full object-cover object-top" onError={(e) => (e.currentTarget.style.display = 'none')} />
        </div>
      </div>
    )
  if (p.type === 'github') {
    const r = githubRepo(p.url)
    return (
      <div className="relative h-full bg-ink-900">
        <Github className="absolute inset-0 m-auto text-white/40" size={20} />
        {r && <img src={`https://opengraph.githubassets.com/1/${r.owner}/${r.repo}`} alt="" loading="lazy" className="relative h-full w-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />}
      </div>
    )
  }
  const Icon = p.type === 'report' ? FileText : p.type === 'note' ? StickyNote : Globe
  return (
    <div className={`h-full p-2.5 text-left ${p.type === 'note' ? 'bg-amber-50' : 'bg-white'}`}>
      <div className="mb-1 flex items-center gap-1 text-[8px] font-semibold text-ink-700">
        <Icon size={8} /> <span className="truncate">{p.title || 'Sin título'}</span>
      </div>
      <p className="line-clamp-[8] whitespace-pre-line text-[6.5px] leading-[1.45] text-ink-500">{(p.text || p.url || '').replace(/[#*]/g, '')}</p>
    </div>
  )
}
