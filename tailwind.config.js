/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/app/**/*.{ts,tsx,jsx,js,mdx}",
    "./src/components/**/*.{ts,tsx,jsx,js,mdx}",
    "./src/pages/**/*.{ts,tsx,jsx,js,mdx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        text: {
          DEFAULT: "hsl(var(--ink))",
          placeholder: "hsl(var(--muted-ink))",
          darkUI: "hsl(var(--paper))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        /* Surfaces and the semantic colours (src/styles/tokens.css) */
        paper: "hsl(var(--paper) / <alpha-value>)",
        well: "hsl(var(--well) / <alpha-value>)",
        hairline: "hsl(var(--hairline) / <alpha-value>)",
        ink: {
          DEFAULT: "hsl(var(--ink) / <alpha-value>)",
          2: "hsl(var(--ink-2) / <alpha-value>)",
          muted: "hsl(var(--muted-ink) / <alpha-value>)",
        },
        info: {
          DEFAULT: "hsl(var(--blue) / <alpha-value>)",
          soft: "hsl(var(--blue-soft) / <alpha-value>)",
        },
        ok: {
          DEFAULT: "hsl(var(--sage) / <alpha-value>)",
          soft: "hsl(var(--sage-soft) / <alpha-value>)",
          line: "hsl(var(--sage-line) / <alpha-value>)",
        },
        flag: {
          DEFAULT: "hsl(var(--amber) / <alpha-value>)",
          soft: "hsl(var(--amber-soft) / <alpha-value>)",
          line: "hsl(var(--amber-line) / <alpha-value>)",
        },
        critical: {
          DEFAULT: "hsl(var(--red) / <alpha-value>)",
          soft: "hsl(var(--red-soft) / <alpha-value>)",
          line: "hsl(var(--red-line) / <alpha-value>)",
        },
        surface: {
          0: "hsl(var(--card) / <alpha-value>)",
          1: "hsl(var(--card) / <alpha-value>)",
          2: "hsl(var(--well) / <alpha-value>)",
          3: "hsl(var(--hairline) / <alpha-value>)",
        },
        /* Older names, now on the palette */
        glass: "hsl(var(--card))",
        glassHover: "hsl(var(--well))",
        neon: "hsl(var(--blue) / <alpha-value>)",
        "custom-blue-teal": "hsl(var(--blue) / <alpha-value>)",
        lavenderBg: "hsl(var(--paper))",
        sidebar: "hsl(var(--card) / <alpha-value>)",
        "sidebar-border": "hsl(var(--hairline))",
        "sidebar-ring": "hsl(var(--blue))",
        "sidebar-accent": "hsl(var(--well))",
        "sidebar-accent-foreground": "hsl(var(--ink))",
        "sidebar-foreground": "hsl(var(--ink))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        card: "var(--radius-lg)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        "step--1": "var(--step--1)",
        "step-0": "var(--step-0)",
        "step-1": "var(--step-1)",
        "step-2": "var(--step-2)",
        "step-3": "var(--step-3)",
      },
      boxShadow: {
        card: "0 1px 0 hsl(var(--hairline))",
        "card-dark": "0 1px 0 hsl(var(--hairline))",
        "inner-glow": "none",
        float: "0 1px 0 hsl(var(--hairline)), 0 24px 48px -24px hsl(var(--ink) / 0.35)",
      },
      backdropBlur: {
        none: '0',
        sm: '4px',
        DEFAULT: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
        '2xl': '40px',
        '3xl': '64px',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in-down": {
          "0%": { opacity: "0", transform: "translateY(-8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
        "gradient": {
          "0%": { "background-position": "0% 50%" },
          "50%": { "background-position": "100% 50%" },
          "100%": { "background-position": "0% 50%" },
        },
        "badge-pulse": {
          "0%": { transform: "scale(1)", opacity: "0.08" },
          "70%": { transform: "scale(1.6)", opacity: "0" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        "specular-flash": {
          "0%": { opacity: "0.15", transform: "scale(0.8)" },
          "100%": { opacity: "0", transform: "scale(1.8)" },
        },
        "conic-spin": {
          "from": { "transform": "rotate(0turn)" },
          "to": { "transform": "rotate(1turn)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in-down": "fade-in-down 0.12s ease-out forwards",
        "pulse-slow": "pulse-slow 6s ease-in-out infinite",
        "gradient": "gradient 45s ease infinite",
        "badge-pulse": "badge-pulse 2s linear 8s infinite",
        "specular-flash": "specular-flash 180ms ease-out",
        "conic-spin": "conic-spin 4s linear infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    function ({ addUtilities, addVariant }) {
      const newUtilities = {
        '.frost-frame': {
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.12), var(--tw-shadow)',
        },
        '.glass-dense': {
          'background-color': 'rgba(255,255,255,0.15)',
        },
      }
      addUtilities(newUtilities, ['responsive', 'hover', 'dark'])
      addVariant('mobile-card', "@media (max-width: theme('screens.sm'))")
    }
  ],
}; 