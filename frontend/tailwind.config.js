/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    './public/**/*.html',
  ],
  theme: {
    extend: {
      fontFamily: {
        comic: ['"ComicNeue"', 'cursive'], // <-- local font key
      },
    },
  },
  plugins: [],
}