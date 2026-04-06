import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: "hsl(var(--card))",
        "card-foreground": "hsl(var(--card-foreground))",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))"
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))"
        }
      },
      borderRadius: {
        xl: "1.25rem",
        "2xl": "1.75rem"
      },
      boxShadow: {
        ambient: "0 24px 60px rgba(73, 59, 33, 0.12)"
      },
      fontFamily: {
        sans: ["'Avenir Next'", "Avenir", "'Helvetica Neue'", "ui-sans-serif", "sans-serif"],
        display: ["Iowan Old Style", "Palatino", "Georgia", "serif"]
      },
      backgroundImage: {
        "olive-glow":
          "radial-gradient(circle at top, rgba(176, 150, 92, 0.12), transparent 28%), radial-gradient(circle at 80% 10%, rgba(109, 120, 81, 0.1), transparent 30%)"
      }
    }
  },
  plugins: []
};

export default config;
