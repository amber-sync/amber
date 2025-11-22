/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
      extend: {
        fontFamily: {
          sans: ['Inter', 'sans-serif'],
        },
        animation: {
          'heartbeat': 'heartbeat 2s infinite',
          'progress-pulse': 'progress-pulse 2s linear infinite',
        },
        keyframes: {
          heartbeat: {
            '0%, 100%': { transform: 'scale(1)', opacity: '1' },
            '50%': { transform: 'scale(1.1)', opacity: '0.9' },
          },
          'progress-pulse': {
            '0%': { transform: 'translateX(-100%)' },
            '100%': { transform: 'translateX(100%)' }
          }
        }
      },
  },
  plugins: [],
}
