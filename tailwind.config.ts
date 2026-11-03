import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        raised: "var(--raised)",
        line: "var(--line)",
        text: "var(--text)",
        muted: "var(--muted)",
        ember: { DEFAULT: "var(--ember)", soft: "var(--ember-soft)" },
        acme: "var(--acme)",
        cfi: "var(--cfi)",
        spice: "var(--spice)",
        ok: "var(--ok)",
        warn: "var(--warn)",
        bad: "var(--bad)",
      },
      fontFamily: {
        head: ["var(--font-head)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.9" },
          "100%": { transform: "scale(1.8)", opacity: "0" },
        },
        fadeUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        flicker: {
          "0%,100%": { transform: "scaleY(1)", opacity: "1" },
          "50%": { transform: "scaleY(1.05)", opacity: "0.92" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.8s ease-out infinite",
        fadeUp: "fadeUp 0.45s ease-out both",
        flicker: "flicker 2.4s ease-in-out infinite",
        slideIn: "slideIn 0.3s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
