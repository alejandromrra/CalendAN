import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div className="absolute inset-0 animate-fade bg-ink-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${w} animate-pop overflow-hidden rounded-t-3xl bg-white shadow-lift dark:bg-ink-900 sm:rounded-3xl`}>
        <div className="flex items-center justify-between px-6 pt-5">
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          <button className="icon-btn -mr-2" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-6 py-4 dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  )
}
