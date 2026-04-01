import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "var(--surface)",
        panel: "var(--panel)",
        line: "var(--line)",
        accent: "var(--accent)",
      },
      fontFamily: {
        heading: ["Space Grotesk", "Segoe UI", "sans-serif"],
        body: ["IBM Plex Sans", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 28px rgba(60, 180, 255, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
