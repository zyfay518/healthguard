module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './App.tsx',
    './index.tsx',
    './components/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  safelist: [
    {
      pattern: /(bg|text|border)-(green|blue|red|orange|indigo|yellow|cyan|gray|purple)-(50|100|400|500|600)/,
      variants: ['group-hover'],
    },
    {
      pattern: /bg-(green|blue|red|orange|indigo|yellow|cyan|gray|purple)-900\/(10|20)/,
      variants: ['dark'],
    },
    {
      pattern: /text-(green|blue|yellow|orange|red|gray)-400/,
      variants: ['dark'],
    },
    'fill-current',
    'animate-in',
    'fade-in',
    'slide-in-from-top-2',
    'slide-in-from-bottom',
    'fade-in-up',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7b00ff',
        'primary-light': '#c084fc',
        'primary-dark': '#6a00db',
        'background-light': '#f7f5f8',
        'background-dark': '#190f23',
      },
      fontFamily: {
        display: ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        sans: ['Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      boxShadow: {
        glow: '0 0 0 4px rgba(123, 0, 255, 0.15)',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries'),
  ],
};
