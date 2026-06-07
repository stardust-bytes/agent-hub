import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'cyber-bg':     '#000000',
        'cyber-dark':   '#111111',
        'cyber-status': '#161616',
        'cyber-accent': '#3B82F6',
        'cyber-green':  '#22C55E',
        'cyber-blue':   '#3B82F6',
      },
      fontFamily: {
        mono: ['monospace'],
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
