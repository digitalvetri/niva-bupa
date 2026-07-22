import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        border: "var(--border)",
        fg: "var(--fg)",
        "fg-muted": "var(--fg-muted)",
        "fg-subtle": "var(--fg-subtle)",
        primary: "var(--primary)",
        "primary-fg": "var(--primary-fg)",
        won: "var(--won)",
        pending: "var(--pending)",
        action: "var(--action)",
        review: "var(--review)",
        "chart-logged": "var(--chart-logged)",
        "chart-issued": "var(--chart-issued)",
      },
      borderColor: { DEFAULT: "var(--border)" },
      borderRadius: { xl: "0.875rem" },
      keyframes: {
        "pulse-ring": {
          "0%,100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: { "pulse-ring": "pulse-ring 1.6s ease-in-out infinite" },
    },
  },
  plugins: [],
};
export default config;
