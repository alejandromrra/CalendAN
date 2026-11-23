import { useState } from 'react'
import { ArrowRight, AtSign, Globe, Lock } from 'lucide-react'
import { LogoMark } from './Logo'
import { getServer, isDesktop, login, setServer } from '../lib/api'

export default function LoginView({ onDone }) {
  const [server, setServerInput] = useState(getServer())
  const [email, setEmail] = useState(() => { try { return localStorage.getItem('an:last-email') || '' } catch { return '' } })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      if (isDesktop) setServerInput(await setServer(server))
      await login(email, password)
      try { localStorage.setItem('an:last-email', email.trim()) } catch {}
      onDone()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const ready = email.trim() && password && (!isDesktop || server.trim())

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-sm animate-pop text-center">
        <LogoMark className="mx-auto mb-6 h-16 w-16 rounded-[20px] shadow-xl shadow-black/25" />
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
        <p className="mb-8 mt-1 text-sm text-ink-400">
          {isDesktop ? 'Conecta con tu servidor de CalendAN' : 'Inicia sesión para continuar'}
        </p>

        {isDesktop && (
          <div className="relative mb-3">
            <Globe size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="url"
              autoFocus={!server}
              value={server}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="tu-servidor.easypanel.host"
              className="input h-12 pl-10 text-base"
              aria-label="Dirección del servidor"
            />
          </div>
        )}

        <div className="relative mb-3">
          <AtSign size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            autoFocus={!isDesktop || !!server ? !email : false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="input h-12 pl-10 text-base"
            aria-label="Email"
          />
        </div>

        <div className="relative">
          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="password"
            autoFocus={!!email && (!isDesktop || !!server)}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="input h-12 pl-10 pr-14 text-base"
          />
          <button
            disabled={!ready || loading}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-brand-500 text-brand-fg transition hover:bg-brand-600 disabled:opacity-40"
            aria-label="Entrar"
          >
            <ArrowRight size={17} className={loading ? 'animate-pulse' : ''} />
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-rose-500">{error}</p>}
      </form>
    </div>
  )
}
