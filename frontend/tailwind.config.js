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
        // Bank Asia ZEN Signature Primary Corporate Blue Palette
        zen: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bce0fd',
          300: '#81c5fc',
          400: '#3da5f8',
          500: '#0f766e',
          600: '#0b625b',
          700: '#084c47',
          800: '#073b34',
          900: '#052f2a',
          950: '#03221e',
        },
        // Bank Asia ZEN Midnight Dark / Navy Palette
        zenNavy: {
          800: '#111b33',
          850: '#0d152a',
          900: '#090B28', // Official Bank Asia Dark Brand Tone
          950: '#050616',
        },
        // Bank Asia Signature Accent Red
        zenRed: {
          400: '#f87171',
          500: '#ED1C24', // Bank Asia Logo Accent Red
          600: '#D32F2F',
          700: '#b91c1c',
        },
        // Bank Asia Gold (Tier & Rewards)
        zenGold: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        // Backward-compatible tokens
        forest: {
          500: '#2061AE',
          600: '#184e91',
          700: '#143e74',
        },
        navy: {
          800: '#111b33',
          900: '#090B28',
          950: '#050616',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Georgia', 'Cambria', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'zen': '0 14px 30px -12px rgba(5, 47, 42, 0.34)',
        'zen-lg': '0 24px 50px -18px rgba(5, 47, 42, 0.42)',
        'zen-dark': '0 24px 60px -22px rgba(1, 18, 16, 0.72)',
      }
    },
  },
  plugins: [],
}
