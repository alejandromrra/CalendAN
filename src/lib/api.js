// Cliente de la API del servidor CalendAN.
// - Web: misma dirección que el servidor, sesión en cookie.
// - App de escritorio (Tauri): la interfaz va dentro de la app y habla con tu
//   servidor (dirección guardada) usando el token de sesión.
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const TOKEN_KEY = 'an:token'
const SERVER_KEY = 'an:server'
const read = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const write = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch {} }

export const getToken = () => read(TOKEN_KEY)
export const getServer = () => (isDesktop ? read(SERVER_KEY) || '' : '')
const base = () => getServer().replace(/\/+$/, '')

const listeners = new Set()
export const onUnauthorized = (fn) => (listeners.add(fn), () => listeners.delete(fn))

export async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  if (isDesktop && !getServer()) {
    listeners.forEach((fn) => fn())
    throw new Error('Configura la dirección de tu servidor')
  }
  const token = getToken()
  const res = await fetch(base() + path, {
    method,
    credentials: isDesktop ? 'omit' : 'include',
    headers: {
      ...(body !== undefined && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && !path.startsWith('/api/auth/login')) listeners.forEach((fn) => fn())
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`)
  return data
}

// Comprueba que la dirección es un servidor CalendAN y la guarda
export async function setServer(url) {
  let u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  let ok = false
  try {
    const r = await fetch(u + '/api/health')
    ok = r.ok && (await r.json()).ok === true
  } catch {}
  if (!ok) throw new Error('No se encuentra un servidor CalendAN en esa dirección')
  write(SERVER_KEY, u)
  return u
}

export async function login(email, password) {
  const device = (isDesktop ? 'Escritorio · ' : '') + navigator.userAgent.slice(0, 90)
  const r = await api('/api/auth/login', { method: 'POST', body: { email, password, device } })
  write(TOKEN_KEY, r.token)
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
  write(TOKEN_KEY, null)
}

export async function uploadImage(blob) {
  return api('/api/files', { method: 'POST', raw: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } })
}

// Dirección de una imagen guardada en el servidor ("/api/files/…")
export function assetUrl(src) {
  if (!isDesktop || !src || !src.startsWith('/api/')) return src
  return `${base()}${src}?token=${encodeURIComponent(getToken() || '')}`
}

export function eventsUrl() {
  if (!isDesktop) return '/api/events'
  return `${base()}/api/events?client=desktop&token=${encodeURIComponent(getToken() || '')}`
}
