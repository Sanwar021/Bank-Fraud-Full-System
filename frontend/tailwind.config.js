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
          500: '#2061AE', // Official Bank Asia Corporate Primary Blue
          600: '#184e91',
          700: '#143e74',
          800: '#10315c',
          900: '#0c2343',
          950: '#07152b',
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
      },
      boxShadow: {
        'zen': '0 10px 25px -5px rgba(32, 97, 174, 0.2), 0 8px 10px -6px rgba(32, 97, 174, 0.1)',
        'zen-lg': '0 20px 35px -10px rgba(32, 97, 174, 0.35)',
        'zen-dark': '0 10px 30px -5px rgba(9, 11, 40, 0.8)',
      }
    },
  },
  plugins: [],
}
