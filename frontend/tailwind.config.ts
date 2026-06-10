import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        'cyber-bg':          '#1e1e1e',
        'cyber-dark':        '#111111',
        'cyber-status':      '#161616',
        'cyber-modal-bg':    '#282828',
        'cyber-accent':      '#3B82F6',
        'cyber-green':       '#22C55E',
        'cyber-blue':        '#3B82F6',
        'cyber-muted':       '#888888',
        'cyber-text':        '#EEEEEE',
        'cyber-orange':      '#FFA500',
        'cyber-cyan':        '#00d4ff',
        'cyber-link':        '#58a6ff',
        'cyber-code-red':    '#f08383',
        'cyber-code-bg':     '#0d1117',
        'cyber-code-border': '#30363d',
        'cyber-code-text':   '#e6edf3',
        'cyber-border':      '#30363d',
        'cyber-row':         '#161b22',
        'cyber-blockquote':  '#8b949e',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        'dot-pulse': {
          '0%, 100%': { opacity: '0.2' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
      },
      width: {
        '100': '25rem',
        '120': '30rem',
      },
      maxWidth: {
        '60rem': '60rem',
      },
    },
  },
  plugins: [],
} satisfies Config
