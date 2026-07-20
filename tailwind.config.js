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
          // Cool editorial: greige/stone neutrals separated by tone + soft
          // shadow (never hard outlines), with a single restrained accent.
          50: '#f4f4f2', // app / workspace ground — cool stone off-white
          100: '#eaebe8', // subtle fill / hover
          200: '#ddded9', // hairline borders (low contrast on purpose)
          500: '#7e8b82', // muted sage-slate — accent, light
          600: '#5c6b61', // primary action — deep muted sage-slate
          700: '#414b45', // deep accent — green-ink for headings / hero figures
          rose: '#bd8b90', // cooled dusty rose (decorative)
          clay: '#a5766a', // cooled clay (decorative)
          ink: '#26282b', // cool near-black
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
