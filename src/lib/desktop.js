// Funciones que solo existen en la app de escritorio (Tauri).
import { isDesktop } from './api'

export async function canNotify() {
  if (!isDesktop) return false
  const n = await import('@tauri-apps/plugin-notification')
  if (await n.isPermissionGranted()) return true
  return (await n.requestPermission()) === 'granted'
}

export async function notifyNative({ title, body }) {
  if (!(await canNotify())) return
  const n = await import('@tauri-apps/plugin-notification')
  n.sendNotification({ title: title || 'CalendAN', body: body || '' })
}

export async function autostartEnabled() {
  const a = await import('@tauri-apps/plugin-autostart')
  return a.isEnabled()
}

export async function setAutostart(on) {
  const a = await import('@tauri-apps/plugin-autostart')
  return on ? a.enable() : a.disable()
}

// La primera vez se activa el arranque con el ordenador, para que los avisos lleguen siempre
export async function firstRunSetup() {
  if (!isDesktop) return
  try {
    if (!localStorage.getItem('an:desktop-init')) {
      await setAutostart(true)
      localStorage.setItem('an:desktop-init', '1')
    }
  } catch {}
  canNotify().catch(() => {})
}
