/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Headings use the same clean sans as body text. `font-brand` keeps
        // Fraunces exclusively for the Florafo logo lockup.
        display: ['Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        brand: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        bloom: {
          // "White & Deep Green" — a white ground with near-neutral (faint
          // green undertone) separators, and a single rich, solid deep-green
          // accent. Editorial and premium; the green carries the brand.
          50: '#ffffff', // app / workspace ground — white
          100: '#eef1ee', // subtle fill / hover (faint green-grey)
          200: '#dfe4df', // hairline borders (low contrast on purpose)
          500: '#5ba17e', // green, light — secondary accent / active tint
          600: '#2f8a62', // primary action — medium green
          700: '#216b4c', // deeper green — wordmark / strong accents / button hover
          rose: '#c98b93', // dusty rose (decorative)
          clay: '#b07c66', // warm clay (decorative)
          ink: '#1d211e', // near-black, faint green undertone
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
