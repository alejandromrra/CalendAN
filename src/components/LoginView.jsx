import { useState } from 'react'
import { ArrowRight, Lock } from 'lucide-react'
import { LogoMark } from './Logo'
import { login } from '../lib/api'

export default function LoginView({ onDone }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(password)
      onDone()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
      <form onSubmit={submit} className="relative w-full max-w-sm animate-pop text-center">
        <LogoMark className="mx-auto mb-6 h-16 w-16 rounded-[20px] shadow-xl shadow-brand-500/30" />
        <h1 className="text-2xl font-semibold tracking-tight">Bienvenido</h1>
        <p className="mb-8 mt-1 text-sm text-ink-400">Introduce tu contraseña para continuar</p>
        <div className="relative">
          <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            className="input h-12 pl-10 pr-14 text-base"
          />
          <button
            disabled={!password || loading}
            className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg bg-brand-500 text-white transition hover:bg-brand-600 disabled:opacity-40"
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
