/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: 'rgb(var(--color-bg-950, 9 10 15) / <alpha-value>)',
          900: 'rgb(var(--color-bg-900, 15 17 23) / <alpha-value>)',
          850: 'rgb(var(--color-bg-850, 21 24 33) / <alpha-value>)',
          800: 'rgb(var(--color-bg-800, 27 31 43) / <alpha-value>)',
          750: 'rgb(var(--color-bg-750, 35 40 56) / <alpha-value>)',
          700: 'rgb(var(--color-bg-700, 44 51 71) / <alpha-value>)',
          600: 'rgb(var(--color-bg-600, 61 70 97) / <alpha-value>)',
        },
        slate: {
          50: 'rgb(var(--color-slate-50, 248 250 252) / <alpha-value>)',
          100: 'rgb(var(--color-slate-100, 241 245 249) / <alpha-value>)',
          200: 'rgb(var(--color-slate-200, 226 232 240) / <alpha-value>)',
          300: 'rgb(var(--color-slate-300, 203 213 225) / <alpha-value>)',
          400: 'rgb(var(--color-slate-400, 148 163 184) / <alpha-value>)',
          500: 'rgb(var(--color-slate-500, 100 116 139) / <alpha-value>)',
          600: 'rgb(var(--color-slate-600, 71 85 105) / <alpha-value>)',
          700: 'rgb(var(--color-slate-700, 51 65 85) / <alpha-value>)',
          800: 'rgb(var(--color-slate-800, 30 41 59) / <alpha-value>)',
          900: 'rgb(var(--color-slate-900, 15 23 42) / <alpha-value>)',
          950: 'rgb(var(--color-slate-950, 2 6 23) / <alpha-value>)',
        },
        brand: {
          300: 'rgb(var(--brand-500, 0 208 132) / 0.7)',
          400: 'rgb(var(--brand-500, 0 208 132) / 0.85)',
          500: 'rgb(var(--brand-500, 0 208 132) / <alpha-value>)',
          600: 'rgb(var(--brand-600, 0 176 112) / <alpha-value>)',
          accent: 'rgb(var(--brand-accent, 59 130 246) / <alpha-value>)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
