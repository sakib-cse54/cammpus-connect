/** @type {import('tailwindcss').Config} */

// Pine: the CampusConnect brand ink. Replaces Tailwind's blue/indigo so every
// existing `blue-*` utility picks up the brand without per-page rewrites.
const pine = {
  50: '#EEF5F1',
  100: '#D6E8DE',
  200: '#AED1BE',
  300: '#7DB497',
  400: '#4F9371',
  500: '#2F7756',
  600: '#225F44',
  700: '#1B4D38',
  800: '#163F2F',
  900: '#12352A',
  950: '#0A2019'
};

// Stone: neutrals with a faint green cast so greys sit with the brand ink.
const stone = {
  50: '#F6F7F4',
  100: '#ECEEEA',
  200: '#DDE1DA',
  300: '#C3C9C0',
  400: '#939B91',
  500: '#687066',
  600: '#4E554D',
  700: '#3A403A',
  800: '#262B27',
  900: '#1A1E1B',
  950: '#0F1311'
};

// Marigold: the single warm accent, used sparingly (seat counts, highlights).
const marigold = {
  50: '#FDF6E9',
  100: '#FAE9C8',
  200: '#F4D190',
  300: '#EDB65A',
  400: '#E3A23B',
  500: '#CC8422',
  600: '#A8661A',
  700: '#834D18',
  800: '#5F3814',
  900: '#3E250E'
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        blue: pine,
        indigo: pine,
        slate: stone,
        marigold,
        brand: {
          ...pine,
          navy: pine[900],
          dark: stone[950],
          ash: stone[50],
          border: stone[200],
          emerald: '#15803D',
          amber: marigold[500],
          rose: '#BE123C'
        },
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: stone[50],
          muted: stone[100],
          border: stone[200],
          dark: stone[950]
        }
      },
      fontFamily: {
        sans: ['Figtree', '"Hind Siliguri"', '"Noto Sans Bengali"', 'system-ui', '-apple-system', '"Segoe UI"', 'Roboto', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'Figtree', '"Hind Siliguri"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace']
      },
      fontSize: {
        // Raise the floor: 12px text was too small across dashboards and tables.
        xs: ['0.8125rem', { lineHeight: '1.25rem' }],
        sm: ['0.9375rem', { lineHeight: '1.4rem' }]
      },
      boxShadow: {
        subtle: '0 1px 2px 0 rgba(15, 19, 17, 0.05)',
        card: '0 1px 2px 0 rgba(15, 19, 17, 0.06), 0 0 0 1px rgba(15, 19, 17, 0.04)',
        elevation: '0 10px 24px -12px rgba(18, 53, 42, 0.28)',
        modal: '0 24px 48px -16px rgba(10, 32, 25, 0.35)',
        academic: '0 0 0 1px rgba(15, 19, 17, 0.08)'
      },
      // Softer corners everywhere: existing rounded-lg/xl utilities get rounder.
      borderRadius: {
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.375rem'
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)'
      },
      transitionDuration: {
        DEFAULT: '220ms'
      },
      maxWidth: {
        page: '78rem'
      }
    },
  },
  plugins: [],
}
