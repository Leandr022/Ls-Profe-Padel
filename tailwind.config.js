/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0c1220',
          panel: '#141b2d',
          card: '#161f34',
          border: '#232c42',
        },
        brand: {
          DEFAULT: '#3b82f6',
          dark: '#1d4ed8',
          light: '#7dd3fc',
          2: '#8b5cf6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl2: '1.1rem',
      },
    },
  },
  plugins: [],
}
