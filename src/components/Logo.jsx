// Logo AN: la "A" es una V invertida (Λ) y la "N" va espejada (И), en el mismo trazo.
export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-label="AN">
      <defs>
        <linearGradient id="an-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7f7cfb" />
          <stop offset="1" stopColor="#5340e9" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#an-g)" />
      <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 45 L20.5 19 L30 45" />
        <path d="M36 19 V45 L53 19 V45" />
      </g>
    </svg>
  )
}

export function LogoType({ className = 'h-5' }) {
  return (
    <svg viewBox="0 0 54 30" className={className} aria-label="AN">
      <g fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 27 L12.5 3 L22 27" />
        <path d="M30 3 V27 L51 3 V27" />
      </g>
    </svg>
  )
}
