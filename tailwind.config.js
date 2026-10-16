/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'bai': ['"Bai Jamjuree"', 'sans-serif'],
        'cinzel': ['"Cinzel"', 'serif'],
        'noto-thai': ['"Noto Sans Thai"', 'sans-serif'],
        'chakra': ['"Chakra Petch"', 'sans-serif'],
        'kanit': ['"Kanit"', 'sans-serif'],
      },
      colors: {
        'game-bg': '#0d0b08',
        'game-surface': '#131316',
        'game-card': '#1c1c21',
        'game-border': '#2e2e38',
      }
    },
  },
  plugins: [],
}
