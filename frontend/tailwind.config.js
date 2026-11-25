/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#07090e',
          900: '#0c1017',
          850: '#111622',
          800: '#161c2c',
          700: '#232b40',
          600: '#323d57',
        },
        brand: {
          500: '#3b82f6',
          600: '#2563eb',
          cyan: '#06b6d4',
        },
        trade: {
          buy: '#10b981',
          buySoft: '#064e3b',
          sell: '#ef4444',
          sellSoft: '#7f1d1d',
          neutral: '#94a3b8',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
