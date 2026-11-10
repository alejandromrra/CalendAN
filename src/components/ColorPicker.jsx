import { COLORS, colorKeys } from '../lib/colors'

export default function ColorPicker({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {colorKeys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`h-7 w-7 rounded-full ${COLORS[k].dot} ring-offset-2 ring-offset-white transition dark:ring-offset-ink-900 ${value === k ? 'ring-2 ring-ink-900 dark:ring-white' : 'hover:scale-110'}`}
          aria-label={k}
        />
      ))}
    </div>
  )
}
