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
          // "Ivory & Wine" — warm ivory paper neutrals separated by tone + soft
          // shadow (never hard outlines), with a single deep-wine accent. An
          // editorial florist-atelier palette: warm, premium, restrained.
          50: '#f8f6f2', // app / workspace ground — warm ivory paper
          100: '#efeae1', // subtle warm fill / hover
          200: '#e7e2d9', // hairline borders (low contrast on purpose)
          500: '#a24956', // wine, light — secondary accent / active tint
          600: '#7a2e3b', // primary action — deep wine
          700: '#5c2029', // deep wine — wordmark / strong accents
          rose: '#c98b93', // dusty rose (decorative)
          clay: '#b07c66', // warm clay (decorative)
          ink: '#211d1b', // espresso near-black
        },
      },
      boxShadow: {
        // A restrained elevation scale — soft, cool-neutral, never a hard ring.
        soft: '0 1px 2px rgba(28,30,34,0.06)',
        panel: '0 1px 3px rgba(28,30,34,0.07), 0 1px 2px rgba(28,30,34,0.05)',
        pop: '0 10px 30px -10px rgba(28,30,34,0.22), 0 2px 8px -2px rgba(28,30,34,0.10)',
        canvas: '0 2px 6px rgba(28,30,34,0.06), 0 24px 56px -28px rgba(28,30,34,0.24)',
      },
    },
  },
  plugins: [],
}
