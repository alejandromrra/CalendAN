// Servidor de recordatorios AN
// Guarda las tareas del calendario y envía un WhatsApp cuando llega su hora.
import 'dotenv/config'
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendWhatsApp, providerStatus, useSavedConfig, normalizePhone } from './whatsapp.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_FILE = path.join(__dirname, 'data.json')
const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid'
const PORT = Number(process.env.PORT) || 3001
const CHECK_EVERY_MS = 30_000
// Si el servidor estuvo apagado, no enviamos avisos con más de 1h de retraso
const MAX_LATE_MS = 60 * 60 * 1000

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))
  } catch {
    return { tasks: [], sent: {} }
  }
}
function save(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2))
}

let db = load()
db.sent ??= {}
db.config ??= {}
useSavedConfig(() => db.config)

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', (_req, res) => res.json({ ok: true, whatsapp: providerStatus() }))

app.get('/api/tasks', (_req, res) => res.json(db.tasks))

// El frontend envía la lista completa de tareas cada vez que cambia
app.put('/api/tasks', (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'Se esperaba un array' })
  db.tasks = req.body
  // Si cambia la hora de una tarea, se vuelve a poder avisar
  for (const key of Object.keys(db.sent)) {
    const [id, at] = key.split('@')
    const t = db.tasks.find((x) => x.id === id)
    if (!t || reminderAt(t)?.toISOString() !== at) delete db.sent[key]
  }
  save(db)
  res.json({ ok: true })
})

// Guardar número y apikey de CallMeBot desde Ajustes
app.put('/api/whatsapp/config', (req, res) => {
  const { phone, apikey } = req.body || {}
  if (!phone || !apikey) return res.status(400).json({ error: 'Faltan el número o la apikey' })
  db.config = { provider: 'callmebot', phone: normalizePhone(phone), apikey: String(apikey).trim() }
  save(db)
  res.json({ ok: true, whatsapp: providerStatus() })
})

app.post('/api/whatsapp/test', async (_req, res) => {
  try {
    await sendWhatsApp('✅ AN: las notificaciones de WhatsApp funcionan correctamente.')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- Scheduler -------------------------------------------------------------

function reminderAt(task) {
  if (!task.start || task.reminder === 'none' || task.reminder == null) return null
  const start = new Date(task.start)
  return new Date(start.getTime() - Number(task.reminder) * 60_000)
}

function formatMessage(task) {
  const start = new Date(task.start)
  const hora = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: TIMEZONE })
  const dia = start.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TIMEZONE })
  const lead = Number(task.reminder) > 0 ? `en ${Number(task.reminder)} min` : 'ahora'
  let msg = `⏰ *${task.title}* — ${lead}\n🗓 ${dia}, ${hora}`
  if (task.description) msg += `\n\n${task.description}`
  return msg
}

async function tick() {
  if (!providerStatus().configured) return
  const now = Date.now()
  for (const task of db.tasks) {
    if (task.done) continue
    const at = reminderAt(task)
    if (!at) continue
    const key = `${task.id}@${at.toISOString()}`
    if (db.sent[key]) continue
    const diff = now - at.getTime()
    if (diff < 0) continue
    db.sent[key] = new Date().toISOString()
    save(db)
    if (diff > MAX_LATE_MS) continue
    try {
      await sendWhatsApp(formatMessage(task))
      console.log(`[whatsapp] enviado: ${task.title}`)
    } catch (e) {
      console.error(`[whatsapp] error con "${task.title}":`, e.message)
      delete db.sent[key] // reintenta en el siguiente ciclo
      save(db)
    }
  }
}

setInterval(tick, CHECK_EVERY_MS)
tick()

// En producción sirve el frontend compilado
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.listen(PORT, () => {
  const s = providerStatus()
  console.log(`AN server en http://localhost:${PORT}`)
  console.log(`WhatsApp: ${s.configured ? `${s.provider} → ${s.phone}` : 'sin configurar (ver .env.example)'}`)
})
