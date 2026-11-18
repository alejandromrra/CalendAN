import { useEffect } from 'react'
import { X } from 'lucide-react'
import useIsMobile from '../lib/useIsMobile'

/**
 * Ventana modal.
 * - Escritorio: diálogo centrado con botones abajo.
 * - Móvil: hoja a pantalla casi completa estilo iOS, con «Cancelar» y la acción
 *   principal arriba (así el teclado nunca tapa el botón de guardar).
 * `variant="alert"` es un aviso pequeño centrado también en móvil.
 */
export default function Modal({ open, onClose, title, children, primary, extra, size = 'md', variant = 'sheet' }) {
  const mobile = useIsMobile()
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null

  const primaryBtn = primary && (
    <button
      className={primary.danger ? 'btn bg-rose-500 text-white hover:bg-rose-600' : 'btn-primary'}
      onClick={primary.onClick}
      disabled={primary.disabled}
    >
      {primary.label}
    </button>
  )

  if (mobile && variant === 'sheet') {
    return (
      <div className="fixed inset-0 z-50">
        <div className="absolute inset-0 animate-fade bg-ink-950/40" onClick={onClose} />
        <div className="absolute inset-x-0 bottom-0 top-[calc(env(safe-area-inset-top)+10px)] flex animate-sheet flex-col overflow-hidden rounded-t-[22px] bg-ink-50 shadow-lift dark:bg-ink-900">
          <div className="mx-auto mt-2 h-1 w-9 rounded-full bg-ink-300 dark:bg-ink-700" />
          <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-2.5">
            <button className="justify-self-start py-1 text-[17px] text-brand-500" onClick={onClose}>Cancelar</button>
            <h3 className="text-[17px] font-semibold">{title}</h3>
            {primary ? (
              <button
                className={`justify-self-end py-1 text-[17px] font-semibold disabled:opacity-35 ${primary.danger ? 'text-rose-500' : 'text-brand-500'}`}
                onClick={primary.onClick}
                disabled={primary.disabled}
              >
                {primary.label}
              </button>
            ) : <span />}
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] pt-2">
            {children}
            {extra && <div className="mt-6">{extra}</div>}
          </div>
        </div>
      </div>
    )
  }

  const w = variant === 'alert' ? 'max-w-sm' : { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 animate-fade bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${w} animate-pop overflow-hidden rounded-3xl bg-white shadow-lift dark:bg-ink-900`}>
        <div className="flex items-center justify-between px-6 pt-5">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        {(primary || extra) && (
          <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-6 py-4 dark:border-ink-800">
            {extra && <div className="mr-auto">{extra}</div>}
            <button className="btn-ghost" onClick={onClose}>Cancelar</button>
            {primaryBtn}
          </div>
        )}
      </div>
    </div>
  )
}
