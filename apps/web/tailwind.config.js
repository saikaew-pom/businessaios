/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // OS Redesign warm identity (docs/OS_REDESIGN_MASTER_PLAN.md §4.2) —
        // replaces the electric-blue palette. Kept the token NAME `primary`
        // (hundreds of existing bg-primary-*/text-primary-* usages across
        // the app) and only changed its VALUES, rather than a sitewide
        // rename to `accent` — same reasoning as `dark` below.
        primary: {
          50: '#fdf3ed',
          100: '#fbe4d6',
          200: '#f6c7a9',
          300: '#efa87c',
          400: '#e88856',
          500: '#e06a3a',   // coral — the one accent color per screen (commitment 4.2)
          600: '#c4551f',   // hover/pressed
          700: '#9e441a',
          800: '#7a3416',
          900: '#57250f',
          950: '#331608',
        },
        // Full 50-950 neutral scale, re-hued warm (cream/ink) instead of
        // cool blue-gray — same light-at-50 → dark-at-950 direction as
        // before, so every existing `dark-50`..`dark-950` usage across the
        // app keeps working, it just now matches the warm identity instead
        // of clashing with it. Token NAME kept for the same reason as
        // `primary` above: renaming would touch every component file.
        dark: {
          50: '#fbf5ee',   // cream — page background in light mode
          100: '#f2e8d9',  // sand — card/subtle background
          200: '#e6d8c4',  // line — borders in light mode
          300: '#d3c0a3',
          400: '#a8927a',
          500: '#7d6b57',
          600: '#6b5d4f',  // ink-soft — secondary text
          700: '#4a3f35',
          800: '#251e17',  // paper — card/surface background in dark mode
          900: '#1b1611',  // darkest background (dark mode page bg)
          950: '#100d0a',
        },
        // Secondary accent — "AI ทำให้" cards/tags, kept semantically apart
        // from `primary` (the one accent per screen, per commitment 4.2)
        // so a suggestion chip never competes visually with a real CTA.
        sage: {
          50: '#eef4ed',
          100: '#e4ede0',
          400: '#7fa07d',
          600: '#5f8161',
          800: '#3c5a3e',
        },
        // Semantic aliases over Tailwind's own green/amber/red/blue scales —
        // the app already used those directly (bg-green-50 etc.) ad hoc; these
        // give the same colors a named, intentional meaning instead.
        success: { 50: '#f0fdf4', 100: '#dcfce7', 600: '#16a34a', 700: '#15803d' },
        warning: { 50: '#fffbeb', 100: '#fef3c7', 600: '#d97706', 700: '#b45309' },
        danger: { 50: '#fef2f2', 100: '#fee2e2', 600: '#dc2626', 700: '#b91c1c' },
        info: { 50: '#eff6ff', 100: '#dbeafe', 600: '#2563eb', 700: '#1d4ed8' },
      },
      fontFamily: {
        // Noto Sans Thai first — this app is Thai-primary (commitment 4.1),
        // and Inter has zero Thai glyphs. Previously `sans` (the default
        // body font, per app.css) listed Inter first, so Thai text only got
        // Noto Sans Thai where something explicitly added `:lang(th)`/`.thai`
        // — everywhere else it silently fell back past Inter to the
        // browser's own generic Thai font, not the one actually loaded.
        sans: ['Noto Sans Thai', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Noto Sans Thai', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideUp: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
