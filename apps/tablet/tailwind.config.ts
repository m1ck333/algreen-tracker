import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#2e7d32',
          600: '#2e7d32',
          700: '#1b5e20',
          800: '#1b5e20',
          900: '#0d3d0f',
        },
      },
      fontSize: {
        'tablet-sm': '1rem',
        'tablet-base': '1.125rem',
        'tablet-lg': '1.375rem',
        'tablet-xl': '1.75rem',
        'tablet-2xl': '2.25rem',
      },
      spacing: {
        'touch': '48px',
      },
    },
  },
  plugins: [],
} satisfies Config;
