/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', "system-ui", "sans-serif"],
        body:    ['"Inter"', "system-ui", "sans-serif"],
        mono:    ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        ink:    "#0b1220",
        bg:     "#0f1729",
        panel:  "#152038",
        border: "#22304f",
        text:   "#e6ecf6",
        muted:  "#7d8aa6",

        ok:       "#34d399",
        warn:     "#fbbf24",
        critical: "#f43f5e",
        accent:   "#7dd3fc",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(125, 211, 252, 0.15), 0 8px 32px rgba(125,211,252,.08)",
      },
      keyframes: {
        pulseDot: {
          "0%, 100%": { opacity: "0.6", transform: "scale(1)" },
          "50%":      { opacity: "1",   transform: "scale(1.25)" },
        },
      },
      animation: {
        pulseDot: "pulseDot 1.4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
