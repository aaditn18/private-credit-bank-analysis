/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        destructive: "var(--destructive)",
        card: "var(--card)",
        popover: "var(--popover)",
      },
    },
  },
  plugins: [],
}