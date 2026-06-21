import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // GitHub-light palette. Kept as a safety net so any stray legacy
        // `cyber-*` class still resolves to a sensible light value.
        'cyber-bg':          '#ffffff',
        'cyber-dark':        '#f6f8fa',
        'cyber-status':      '#f6f8fa',
        'cyber-modal-bg':    '#ffffff',
        'cyber-accent':      '#0969da',
        'cyber-green':       '#1a7f37',
        'cyber-blue':        '#0969da',
        'cyber-muted':       '#656d76',
        'cyber-text':        '#1f2328',
        'cyber-orange':      '#9a6700',
        'cyber-cyan':        '#0969da',
        'cyber-link':        '#0969da',
        'cyber-code-red':    '#cf222e',
        'cyber-code-bg':     '#f6f8fa',
        'cyber-code-border': '#d0d7de',
        'cyber-code-text':   '#1f2328',
        'cyber-border':      '#d0d7de',
        'cyber-row':         '#f6f8fa',
        'cyber-blockquote':  '#656d76',
        // GitHub Primer accent ramp, addressable as `gh-*` for intent.
        'gh-canvas':         '#ffffff',
        'gh-inset':          '#f6f8fa',
        'gh-border':         '#d0d7de',
        'gh-border-muted':   '#d8dee4',
        'gh-fg':             '#1f2328',
        'gh-muted':          '#656d76',
        'gh-accent':         '#0969da',
        'gh-accent-emphasis':'#0969da',
        'gh-success':        '#1a7f37',
        'gh-attention':      '#9a6700',
        'gh-danger':         '#cf222e',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"Noto Sans"',
          'Helvetica', 'Arial', 'sans-serif', '"Apple Color Emoji"', '"Segoe UI Emoji"',
        ],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', '"Courier New"', 'monospace'],
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
