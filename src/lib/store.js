import { useCallback, useEffect, useState } from 'react'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? JSON.parse(raw) : typeof initial === 'function' ? initial() : initial
    } catch {
      return typeof initial === 'function' ? initial() : initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch (e) {
      console.warn('No se pudo guardar en localStorage', e)
    }
  }, [key, value])
  return [value, setValue]
}

export function useTheme() {
  const [theme, setTheme] = useLocalState('an:theme', () =>
    matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
  )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}

// Tareas: se guardan en local y se sincronizan con el servidor de recordatorios
export function useTasks() {
  const [tasks, setTasks] = useLocalState('an:tasks', [])
  const [server, setServer] = useState({ online: false, whatsapp: null })

  const refreshHealth = useCallback(async () => {
    try {
      const r = await fetch('/api/health')
      const j = await r.json()
      setServer({ online: true, whatsapp: j.whatsapp })
    } catch {
      setServer({ online: false, whatsapp: null })
    }
  }, [])

  useEffect(() => {
    refreshHealth()
  }, [refreshHealth])

  useEffect(() => {
    if (!server.online) return
    const t = setTimeout(() => {
      fetch('/api/tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tasks),
      }).catch(() => {})
    }, 400)
    return () => clearTimeout(t)
  }, [tasks, server.online])

  const upsert = (task) =>
    setTasks((list) => {
      const i = list.findIndex((t) => t.id === task.id)
      if (i === -1) return [...list, task]
      const copy = [...list]
      copy[i] = task
      return copy
    })
  const remove = (id) => setTasks((list) => list.filter((t) => t.id !== id))

  return { tasks, upsert, remove, server, refreshHealth }
}

export function useProjects() {
  const [projects, setProjects] = useLocalState('an:projects', seedProjects)
  const upsert = (p) =>
    setProjects((list) => {
      const next = { ...p, updatedAt: Date.now() }
      const i = list.findIndex((x) => x.id === p.id)
      if (i === -1) return [next, ...list]
      const copy = [...list]
      copy[i] = next
      return copy
    })
  const remove = (id) => setProjects((list) => list.filter((p) => p.id !== id))
  return { projects, upsert, remove }
}

function seedProjects() {
  return [
    {
      id: uid(),
      name: 'AN Calendar',
      color: 'brand',
      description: 'Calendario minimalista con recordatorios por WhatsApp y espacio de proyectos.',
      report:
        '## Objetivo\nUn único lugar para organizar el día y guardar ideas.\n\n## Stack\nReact · Tailwind CSS · Node',
      github: 'https://github.com/alejandromrra/CalendAN',
      url: '',
      items: [
        { id: uid(), type: 'note', title: 'Ideas', content: '• Vista semanal\n• Recordatorios\n• Carpetas estilo Apple', createdAt: Date.now() },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]
}

// Comprime imágenes antes de guardarlas (localStorage tiene ~5MB)
export function fileToDataUrl(file, max = 1400) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      if (!file.type.startsWith('image/') || file.type === 'image/svg+xml' || file.type === 'image/gif') {
        return resolve(reader.result)
      }
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
