// Una sola conexión en tiempo real con el servidor para toda la app.
import { eventsUrl, isDesktop } from './api'

const handlers = { change: new Set(), reminder: new Set() }
let source = null
let retry = null

function connect() {
  clearTimeout(retry)
  source?.close()
  // En escritorio va con token en la dirección; las cookies solo hacen falta en la web
  source = new EventSource(eventsUrl(), { withCredentials: !isDesktop })
  source.addEventListener('change', (e) => handlers.change.forEach((fn) => fn(e.data)))
  source.addEventListener('reminder', (e) => {
    let data = {}
    try { data = JSON.parse(e.data) } catch {}
    handlers.reminder.forEach((fn) => fn(data))
  })
  // Si se corta (sin internet, servidor reiniciado…) se reconecta solo
  source.onerror = () => {
    if (source.readyState === EventSource.CLOSED) retry = setTimeout(connect, 5000)
  }
}

export function subscribe(type, fn) {
  handlers[type].add(fn)
  if (!source) connect()
  return () => {
    handlers[type].delete(fn)
    if (!handlers.change.size && !handlers.reminder.size) { source?.close(); source = null }
  }
}

export function reconnect() {
  if (source) connect()
}
