// Color principal de la app (editable en Ajustes). Se aplica con variables CSS
// que usa Tailwind (brand-50 … brand-900) para que cambie todo a la vez.
export const DEFAULT_ACCENT = '#635bf5'

export const PRESETS = [
  ['Índigo', '#635bf5'],
  ['Azul', '#2f6fed'],
  ['Cielo', '#0ea5e9'],
  ['Turquesa', '#14b8a6'],
  ['Verde', '#22a06b'],
  ['Naranja', '#f97316'],
  ['Rojo', '#e5484d'],
  ['Rosa', '#e93d82'],
  ['Grafito', '#52525b'],
]

const hexToRgb = (hex) => {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t))
const toHex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('')

export const isHex = (v) => /^#[0-9a-f]{6}$/i.test(v || '')

// Escala de tonos a partir del color elegido (500)
export function palette(hex) {
  const base = hexToRgb(isHex(hex) ? hex : DEFAULT_ACCENT)
  const W = [255, 255, 255], K = [0, 0, 0]
  return {
    50: mix(base, W, 0.92), 100: mix(base, W, 0.85), 200: mix(base, W, 0.7), 300: mix(base, W, 0.48),
    400: mix(base, W, 0.22), 500: base, 600: mix(base, K, 0.12), 700: mix(base, K, 0.26),
    800: mix(base, K, 0.4), 900: mix(base, K, 0.55),
  }
}

// Texto blanco o negro según lo claro que sea el color
function foreground(rgb) {
  const [r, g, b] = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return L > 0.42 ? [17, 17, 19] : [255, 255, 255]
}

let current = DEFAULT_ACCENT
export const accentHex = () => current
export const accentHex2 = () => toHex(palette(current)[300])

export function applyAccent(hex) {
  current = isHex(hex) ? hex.toLowerCase() : DEFAULT_ACCENT
  const p = palette(current)
  const vars = Object.entries(p).map(([k, v]) => `--brand-${k}: ${v.join(' ')};`)
  vars.push(`--brand-fg: ${foreground(p[500]).join(' ')};`)
  const css = vars.join(' ')
  document.documentElement.style.cssText = css
  // Se guarda ya calculado para aplicarlo al instante al abrir la app (sin parpadeo)
  try { localStorage.setItem('an:accent', current); localStorage.setItem('an:accent-css', css) } catch {}
}

export function cachedAccent() {
  try { return localStorage.getItem('an:accent') || DEFAULT_ACCENT } catch { return DEFAULT_ACCENT }
}
