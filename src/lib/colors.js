// Paleta para tareas y carpetas. "brand" es el color corporativo.
export const COLORS = {
  brand: { dot: 'bg-brand-500', soft: 'bg-brand-500/10 text-brand-700 dark:text-brand-300', bar: 'border-brand-500', hex: '#635bf5', hex2: '#8b85ff' },
  sky: { dot: 'bg-sky-500', soft: 'bg-sky-500/10 text-sky-700 dark:text-sky-300', bar: 'border-sky-500', hex: '#0ea5e9', hex2: '#5ccbf7' },
  emerald: { dot: 'bg-emerald-500', soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', bar: 'border-emerald-500', hex: '#10b981', hex2: '#5ad8ab' },
  amber: { dot: 'bg-amber-500', soft: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', bar: 'border-amber-500', hex: '#f59e0b', hex2: '#fbc65a' },
  rose: { dot: 'bg-rose-500', soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300', bar: 'border-rose-500', hex: '#f43f5e', hex2: '#fb7f93' },
  graphite: { dot: 'bg-ink-500', soft: 'bg-ink-500/10 text-ink-700 dark:text-ink-300', bar: 'border-ink-500', hex: '#6b6b75', hex2: '#9b9ba5' },
}
export const colorKeys = Object.keys(COLORS)
export const color = (k) => COLORS[k] || COLORS.brand
