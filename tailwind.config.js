/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#021e19",
          lime: "#c8e05b",
          offwhite: "#f4ece6",
          gray: "#a6a797"
        }
      }
    }
  },
  plugins: []
};
