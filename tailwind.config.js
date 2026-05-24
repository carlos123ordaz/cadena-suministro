/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontSize: {
        '2xs': ['10px', '14px'],
        xs: ['11px', '15px'],
        sm: ['12px', '17px'],
        base: ['13px', '19px'],
        md: ['14px', '20px'],
        lg: ['15px', '22px'],
        xl: ['16px', '24px'],
        '2xl': ['18px', '26px'],
        '3xl': ['20px', '28px'],
        '4xl': ['24px', '32px'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)',
        card:  '0 4px 12px rgba(15,23,42,0.08), 0 1px 3px rgba(15,23,42,0.04)',
        modal: '0 16px 40px rgba(15,23,42,0.16), 0 4px 12px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
}
