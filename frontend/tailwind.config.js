/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        surface: {
          950: '#0a0e1a',
          900: '#0f1629',
          800: '#161d35',
          700: '#1e2744',
          600: '#2a3456',
        },
        accent: {
          cyan: '#06d6a0',
          blue: '#118ab2',
          orange: '#ff9f1c',
          red: '#ef476f',
          purple: '#7b2ff7',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(6, 214, 160, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(6, 214, 160, 0.6)' },
        },
      },
    },
  },
  plugins: [],
};
