import type { Config } from 'tailwindcss'

function token(name: string) {
  return `rgb(var(--${name}) / <alpha-value>)`
}

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        background: token('background'),
        surface: token('surface'),
        muted: token('muted'),
        elevated: token('elevated'),
        border: token('border'),
        input: token('input'),
        ring: token('ring'),
        foreground: token('foreground'),
        'muted-foreground': token('muted-foreground'),
        primary: token('primary'),
        'primary-foreground': token('primary-foreground'),
        success: token('success'),
        warning: token('warning'),
        danger: token('danger'),
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'SFMono-Regular', '"Courier New"', 'monospace'],
      },
      keyframes: {
        blink: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0' } },
        'dot-pulse': { '0%, 100%': { opacity: '0.2' }, '50%': { opacity: '1' } },
      },
      animation: {
        blink: 'blink 1s step-end infinite',
        'dot-pulse': 'dot-pulse 1.2s ease-in-out infinite',
      },
      width: { '100': '25rem', '120': '30rem' },
      maxWidth: { '60rem': '60rem' },
    },
  },
  plugins: [],
} satisfies Config
