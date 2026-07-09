/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        bloom: {
          50: '#faf7f2',
          100: '#f3ede2',
          200: '#e5dcc9',
          500: '#8a9a7b',
          600: '#6f8161',
          700: '#586950',
          rose: '#c98a94',
          clay: '#b0715f',
          ink: '#2f2a26',
        },
      },
    },
  },
  plugins: [],
}
