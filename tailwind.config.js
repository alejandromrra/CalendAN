/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Color corporativo AN — índigo eléctrico
        // Color principal editable: los valores vienen de variables CSS (src/lib/accent.js)
        brand: {
          ...Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((k) => [k, `rgb(var(--brand-${k}) / <alpha-value>)`])),
          fg: 'rgb(var(--brand-fg) / <alpha-value>)',
        },
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#dcdce0',
          300: '#bdbdc4',
          400: '#8e8e98',
          500: '#6b6b75',
          600: '#4d4d55',
          700: '#36363c',
          800: '#232327',
          850: '#1b1b1e',
          900: '#141416',
          950: '#0c0c0d',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,.04), 0 8px 24px -8px rgba(0,0,0,.08)',
        lift: '0 2px 4px rgba(0,0,0,.06), 0 24px 48px -16px rgba(0,0,0,.18)',
      },
    },
  },
  plugins: [],
}
