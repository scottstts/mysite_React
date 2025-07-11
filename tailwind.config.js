/* eslint-env node */
/** @type {import('tailwindcss').Config} */
/* global module */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  corePlugins: { preflight: false },
  safelist: ['fade-in', 'fade-out', { pattern: /^tns-,^embla/ }],
  theme: {
    extend: {
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out both',
        'fade-out': 'fadeOut 0.6s ease-out both',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeOut: { from: { opacity: '1' }, to: { opacity: '0' } },
      },
    },
  },
  plugins: [],
};
