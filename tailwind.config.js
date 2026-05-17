/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        sentinel: { DEFAULT: "#1a2b4a", light: "#2d4a7a" },
      },
    },
  },
  plugins: [],
};
