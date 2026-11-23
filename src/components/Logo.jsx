// Logo AN: la "A" es una V invertida (Λ) y la "N" va girada (И), con trazo grueso y redondeado.
export const LOGO_PATHS = ['M9.75 42.5 L19 21.5 L28.25 42.5', 'M35.75 21.5 V42.5 L54.25 21.5 V42.5']

const Glyph = ({ stroke = '#fff' }) => (
  <g fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
    {LOGO_PATHS.map((d) => <path key={d} d={d} />)}
  </g>
)

export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label="AN">
      <defs>
        <linearGradient id="an-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a2a2d" />
          <stop offset="1" stopColor="#0a0a0b" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#an-g)" />
      {/* Borde sutil para que se distinga sobre fondos oscuros */}
      <rect x=".5" y=".5" width="63" height="63" rx="17.5" fill="none" stroke="#fff" strokeOpacity=".14" />
      <Glyph />
    </svg>
  )
}

export function LogoType({ className = 'h-5' }) {
  return (
    <svg viewBox="6 18 52 28" className={className} aria-label="AN">
      <Glyph stroke="currentColor" />
    </svg>
  )
}
