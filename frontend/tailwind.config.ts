import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'cyber-bg':     '#000000',
        'cyber-dark':   '#141414',
        'cyber-accent': '#3B82F6',
        'cyber-border': 'rgba(59, 130, 246, 0.13)',
        'cyber-dim':    'rgba(59, 130, 246, 0.33)',
        'cyber-orange': '#FFA500',
        'cyber-green':  '#22C55E',
        'cyber-blue':   '#3B82F6',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
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
