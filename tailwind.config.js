/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        sage: '#E9EFED',
        brand: {
          50:  '#f0fdf6',
          100: '#dcfce9',
          200: '#bbf7d3',
          300: '#86efb0',
          400: '#4ade80',
          500: '#22c55e',
          600: '#1B6C42',
          700: '#155A35',
          800: '#166534',
          900: '#14532d',
        },
      },
      fontFamily: {
        sans:     ['Inter', 'system-ui', 'sans-serif'],
        serif:    ['Playfair Display', 'Georgia', 'serif'],
        mono:     ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
}
