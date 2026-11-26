import { useCallback, useEffect, useRef, useState } from 'react'
import { api, onUnauthorized } from './api'
import { subscribe } from './live'

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

// Preferencias de este dispositivo (tema, vista…)
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
    } catch {}
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
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), setTheme]
}

// Usuario con sesión iniciada: undefined = comprobando, null = sin sesión
export function useSession() {
  const [user, setUser] = useState(undefined)
  const refresh = useCallback(() => api('/api/auth/me').then(setUser).catch(() => setUser(null)), [])
  useEffect(() => {
    refresh()
    return onUnauthorized(() => setUser(null))
  }, [refresh])
  return [user, setUser, refresh]
}

// Escucha los cambios hechos desde otros dispositivos
function useLiveReload(kind, reload) {
  const ref = useRef(reload)
  ref.current = reload
  useEffect(() => {
    const off = subscribe('change', (what) => what === kind && ref.current())
    const onFocus = () => ref.current()
    window.addEventListener('focus', onFocus)
    return () => { off(); window.removeEventListener('focus', onFocus) }
  }, [kind])
}

// En la API "sin aviso" es null; en la interfaz es 'none'
const taskIn = (t) => ({ ...t, reminder: t.reminder ?? 'none' })
const taskOut = (t) => ({ ...t, reminder: t.reminder === 'none' ? null : Number(t.reminder) })

export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    api('/api/tasks').then((l) => { setTasks(l.map(taskIn)); setError(null) }).catch((e) => setError(e.message))
  }, [])
  useEffect(reload, [reload])
  useLiveReload('tasks', reload)

  const upsert = async (task) => {
    setTasks((list) => [...list.filter((t) => t.id !== task.id), task])
    try {
      const saved = await api(`/api/tasks/${task.id}`, { method: 'PUT', body: taskOut(task) })
      setTasks((list) => list.map((t) => (t.id === saved.id ? taskIn(saved) : t)))
    } catch (e) {
      setError(e.message)
      reload()
    }
  }
  const remove = async (id) => {
    setTasks((list) => list.filter((t) => t.id !== id))
    await api(`/api/tasks/${id}`, { method: 'DELETE' }).catch((e) => { setError(e.message); reload() })
  }
  return { tasks, upsert, remove, error }
}

// Lista de tareas pendientes (sección Tareas)
export function useTodos() {
  const [todos, setTodos] = useState(null)
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    api('/api/todos').then((l) => { setTodos(l); setError(null) }).catch((e) => setError(e.message))
  }, [])
  useEffect(reload, [reload])
  useLiveReload('todos', reload)

  const upsert = async (todo) => {
    const next = { ...todo, createdAt: todo.createdAt || Date.now(), doneAt: todo.done ? todo.doneAt || Date.now() : null }
    setTodos((list) => [...(list || []).filter((t) => t.id !== todo.id), next])
    try {
      const saved = await api(`/api/todos/${todo.id}`, { method: 'PUT', body: next })
      setTodos((list) => (list || []).map((t) => (t.id === saved.id ? saved : t)))
    } catch (e) {
      setError(e.message)
      reload()
    }
  }
  const remove = async (id) => {
    setTodos((list) => (list || []).filter((t) => t.id !== id))
    await api(`/api/todos/${id}`, { method: 'DELETE' }).catch((e) => { setError(e.message); reload() })
  }
  const clearDone = async () => {
    setTodos((list) => (list || []).filter((t) => !t.done))
    await api('/api/todos', { method: 'DELETE' }).catch((e) => { setError(e.message); reload() })
  }
  return { todos, upsert, remove, clearDone, error }
}

export function useProjects() {
  const [projects, setProjects] = useState([])
  const [error, setError] = useState(null)

  const reload = useCallback(() => {
    api('/api/projects').then((l) => { setProjects(l); setError(null) }).catch((e) => setError(e.message))
  }, [])
  useEffect(reload, [reload])
  useLiveReload('projects', reload)

  const upsert = async (p) => {
    const next = { ...p, updatedAt: Date.now(), createdAt: p.createdAt || Date.now() }
    setProjects((list) => [next, ...list.filter((x) => x.id !== p.id)])
    try {
      const saved = await api(`/api/projects/${p.id}`, { method: 'PUT', body: next })
      setProjects((list) => list.map((x) => (x.id === saved.id ? saved : x)))
    } catch (e) {
      setError(e.message)
      reload()
    }
  }
  const remove = async (id) => {
    setProjects((list) => list.filter((p) => p.id !== id))
    await api(`/api/projects/${id}`, { method: 'DELETE' }).catch((e) => { setError(e.message); reload() })
  }
  return { projects, upsert, remove, error }
}

// Datos de la versión anterior, que se guardaban solo en el navegador
export function localLegacyData() {
  try {
    const tasks = JSON.parse(localStorage.getItem('an:tasks') || '[]')
    const projects = JSON.parse(localStorage.getItem('an:projects') || '[]')
    return tasks.length || projects.length ? { tasks, projects } : null
  } catch {
    return null
  }
}

export async function importLegacyData({ tasks, projects }) {
  for (const t of tasks) await api(`/api/tasks/${t.id}`, { method: 'PUT', body: taskOut(t) })
  for (const p of projects) await api(`/api/projects/${p.id}`, { method: 'PUT', body: p })
  localStorage.setItem('an:legacy-backup', JSON.stringify({ tasks, projects }))
  localStorage.removeItem('an:tasks')
  localStorage.removeItem('an:projects')
}

// Comprime imágenes antes de subirlas
export function compressImage(file, max = 2000) {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || ['image/svg+xml', 'image/gif'].includes(file.type)) return resolve(file)
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      c.toBlob((b) => resolve(b && b.size < file.size ? b : file), 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}
