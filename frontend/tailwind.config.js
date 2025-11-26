/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f7ff',
          100: '#ebf0ff',
          200: '#d6e0ff',
          300: '#b3c5ff',
          400: '#8aa3ff',
          500: '#667eea',
          600: '#4c5fd5',
          700: '#3b4bb3',
          800: '#2d3a8c',
          900: '#1f2865',
        },
      },
      keyframes: {
        'ring-burst': {
          '0%': {
            transform: 'scale(1)',
            opacity: '0.8',
          },
          '50%': {
            opacity: '0.5',
          },
          '100%': {
            transform: 'scale(1.5)',
            opacity: '0',
          },
        },
      },
      animation: {
        'ring-burst': 'ring-burst 1.5s ease-out infinite',
      },
    },
  },
  plugins: [],
}
