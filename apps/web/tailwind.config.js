/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      colors: {
        // Electric Blue + White palette
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',   // electric blue
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Full 50-950 neutral scale — previously jumped straight from 200 to
        // 900 with nothing between, which is what forced every "dark mode"
        // attempt to invent one-off greys instead of reusing a real scale.
        dark: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0a0a0a',
          950: '#050505',
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
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Inter', 'system-ui', 'sans-serif'],
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
