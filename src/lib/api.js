// Cliente de la API del servidor AN. La sesión va en una cookie (web) o en un token (apps).
const TOKEN_KEY = 'an:token'

export const getToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
const setToken = (t) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY) } catch {}
}

const listeners = new Set()
export const onUnauthorized = (fn) => (listeners.add(fn), () => listeners.delete(fn))

export async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const token = getToken()
  const res = await fetch(path, {
    method,
    credentials: 'include',
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

export async function login(password) {
  const device = navigator.userAgent.slice(0, 100)
  const r = await api('/api/auth/login', { method: 'POST', body: { password, device } })
  setToken(r.token)
}

export async function logout() {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
  setToken(null)
}

export async function uploadImage(blob) {
  return api('/api/files', { method: 'POST', raw: blob, headers: { 'Content-Type': blob.type || 'image/jpeg' } })
}
