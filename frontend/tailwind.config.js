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
        brand: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        }
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
};
