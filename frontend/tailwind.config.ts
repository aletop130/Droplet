import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./store/**/*.{ts,tsx}",
    "./types/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-unbounded)", "Unbounded", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "ui-monospace", "monospace"]
      },
      fontSize: {
        display: ["clamp(2.4rem,4vw,4.9rem)", { lineHeight: "0.98", letterSpacing: "-0.05em" }],
        h1: ["clamp(2rem,3.2vw,3.5rem)", { lineHeight: "1.02", letterSpacing: "-0.05em" }],
        h2: ["clamp(1.35rem,2vw,2.1rem)", { lineHeight: "1.04", letterSpacing: "-0.04em" }],
        body: ["0.98rem", { lineHeight: "1.7" }],
        data: ["0.8rem", { lineHeight: "1.4", letterSpacing: "-0.02em" }]
      },
      boxShadow: {
        glass: "0 30px 80px rgba(0,0,0,0.34)"
      }
    }
  },
  plugins: [
    ({ addUtilities }: any) => {
      addUtilities({
        ".text-display": {
          fontFamily: 'var(--font-unbounded), "Unbounded", ui-sans-serif, system-ui, sans-serif',
          letterSpacing: "-0.04em"
        },
        ".text-h1": {
          fontFamily: 'var(--font-unbounded), "Unbounded", ui-sans-serif, system-ui, sans-serif',
          fontSize: "clamp(2rem,3.2vw,3.5rem)",
          lineHeight: "1.02",
          letterSpacing: "-0.05em"
        },
        ".text-h2": {
          fontFamily: 'var(--font-unbounded), "Unbounded", ui-sans-serif, system-ui, sans-serif',
          fontSize: "clamp(1.35rem,2vw,2.1rem)",
          lineHeight: "1.04",
          letterSpacing: "-0.04em"
        },
        ".text-body": {
          fontSize: "0.98rem",
          lineHeight: "1.7",
          color: "var(--text-md)"
        },
        ".text-data": {
          fontFamily: 'var(--font-jetbrains), "JetBrains Mono", ui-monospace, monospace',
          fontSize: "0.8rem",
          letterSpacing: "-0.02em"
        },
        ".glass-card": {
          position: "relative",
          overflow: "hidden",
          border: "1px solid transparent",
          borderRadius: "1.4rem",
          background:
            "linear-gradient(var(--glass-fill), var(--glass-fill)) padding-box, var(--stroke-gradient-soft) border-box",
          backdropFilter: "blur(var(--blur-glass))",
          boxShadow: "0 30px 80px rgba(0,0,0,0.34)"
        },
        ".liquid-button": {
          position: "relative",
          overflow: "hidden",
          border: "1px solid rgba(75,214,255,0.28)",
          background:
            "radial-gradient(circle at 30% 20%, rgba(216,244,255,0.32), transparent 36%), linear-gradient(135deg, rgba(75,214,255,0.22), rgba(47,144,255,0.12)), rgba(8,18,34,0.56)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.14), 0 14px 30px rgba(12,28,56,0.32)"
        }
      })
    }
  ]
}

export default config
