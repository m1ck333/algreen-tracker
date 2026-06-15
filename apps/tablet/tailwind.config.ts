import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e6f4ff',
          100: '#bae0ff',
          200: '#91caff',
          300: '#69b1ff',
          400: '#4096ff',
          500: '#1677ff',
          600: '#0958d9',
          700: '#003eb3',
          800: '#002c8c',
          900: '#001d66',
        },
      },
      fontSize: {
        'tablet-xs': '0.875rem',
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
