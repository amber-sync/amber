/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'], // Support both class and data-attribute if needed, but we'll mainly use classes on html/body
  theme: {
    extend: {
      colors: {
        layer: {
          1: 'var(--bg-layer-1)',
          2: 'var(--bg-layer-2)',
          3: 'var(--bg-layer-3)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        border: {
          base: 'var(--border-base)',
          highlight: 'var(--border-highlight)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          secondary: 'var(--accent-secondary)',
          text: 'var(--accent-text)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'heartbeat': 'heartbeat 2s infinite',
        'progress-pulse': 'progress-pulse 2s linear infinite',
        'fade-in': 'fade-in 0.4s ease-out',
      },
      keyframes: {
        heartbeat: {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.9' },
        },
        'progress-pulse': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        }
      }
    },
  },
  plugins: [],
}
