/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        sand: {
          50: '#f4f7f5',
          100: '#e6ece8',
          200: '#d2ddd6',
          300: '#b3c4b9',
          400: '#8da69a',
          500: '#6e8a7e',
          600: '#587266',
          700: '#475c53',
          800: '#374840',
          900: '#2a3731',
          950: '#161e1a',
        },
        profit: {
          DEFAULT: '#2d8a5e',
          light: '#3aab75',
        },
        loss: {
          DEFAULT: '#b83a3a',
          light: '#d04848',
        },
        accent: {
          DEFAULT: '#4a9072',
          light: '#5fb88e',
          dark: '#367a5c',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'number-pop': 'numberPop 0.3s ease-out',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        numberPop: { '0%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.05)' }, '100%': { transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
