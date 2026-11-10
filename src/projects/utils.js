export function githubRepo(url) {
  const m = /github\.com\/([^/\s]+)\/([^/\s#?]+)/i.exec(url || '')
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, '') } : null
}

export function normalizeUrl(u) {
  const s = (u || '').trim()
  if (!s) return ''
  return /^https?:\/\//i.test(s) ? s : `https://${s}`
}

// Captura de la web para los previews de las carpetas (servicio público thum.io)
export const screenshotUrl = (url, width = 1200) =>
  `https://image.thum.io/get/width/${width}/crop/${Math.round(width * 0.75)}/${normalizeUrl(url)}`

export const hostOf = (u) => {
  try {
    return new URL(normalizeUrl(u)).host
  } catch {
    return u
  }
}

// Markdown mínimo para el informe: títulos, listas, negrita, cursiva, enlaces y código
export function renderMarkdown(md = '') {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const inline = (s) =>
    esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
  const out = []
  let list = false
  for (const line of md.split('\n')) {
    const li = /^\s*[-*•]\s+(.*)/.exec(line)
    if (li) {
      if (!list) { out.push('<ul>'); list = true }
      out.push(`<li>${inline(li[1])}</li>`)
      continue
    }
    if (list) { out.push('</ul>'); list = false }
    const h = /^(#{1,3})\s+(.*)/.exec(line)
    if (h) out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`)
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`)
  }
  if (list) out.push('</ul>')
  return out.join('')
}
