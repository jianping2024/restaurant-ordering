import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "rgb(var(--color-brand-bg) / <alpha-value>)",
          card: "rgb(var(--color-brand-card) / <alpha-value>)",
          gold: "rgb(var(--color-brand-gold) / <alpha-value>)",
          "gold-light": "rgb(var(--color-brand-gold-light) / <alpha-value>)",
          "gold-dark": "rgb(var(--color-brand-gold-dark) / <alpha-value>)",
          muted: "rgb(var(--color-brand-muted) / <alpha-value>)",
          border: "rgb(var(--color-brand-border) / <alpha-value>)",
          text: "rgb(var(--color-brand-text) / <alpha-value>)",
          "text-muted": "rgb(var(--color-brand-text-muted) / <alpha-value>)",
        },
      },
      fontFamily: {
        heading: ["var(--font-cormorant)", "serif"],
        body: ["var(--font-jost)", "sans-serif"],
      },
      maxWidth: {
        mobile: "430px",
      },
    },
  },
  plugins: [],
};
export default config;
