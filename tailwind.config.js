/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Color corporativo AN — índigo eléctrico
        brand: {
          50: '#eef0ff',
          100: '#e0e3ff',
          200: '#c6cbff',
          300: '#a3a8ff',
          400: '#7f7cfb',
          500: '#635bf5',
          600: '#5340e9',
          700: '#4632cd',
          800: '#3a2ba6',
          900: '#322a83',
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
