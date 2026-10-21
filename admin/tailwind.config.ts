import type { Config } from 'tailwindcss'

// Dizayn tokenlari CSS o'zgaruvchilar orqali (src/styles/tailwind.css) - yorug'/qorong'i mavzu uchun.
const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: token('primary-50'),
          100: token('primary-100'),
          200: token('primary-200'),
          500: token('primary-500'),
          600: token('primary-600'),
          700: token('primary-700'),
        },
        surface: token('surface'),
        'surface-muted': token('surface-muted'),
        page: token('page'),
        border: token('border'),
        fg: token('fg'),
        'fg-muted': token('fg-muted'),
        danger: { DEFAULT: token('danger'), soft: token('danger-soft') },
        success: { DEFAULT: token('success'), soft: token('success-soft') },
        warning: { DEFAULT: token('warning'), soft: token('warning-soft') },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem' },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.04), 0 1px 3px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
} satisfies Config
