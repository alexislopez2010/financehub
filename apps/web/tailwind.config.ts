import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        rule: 'var(--color-rule)',
        accent: 'var(--color-accent)',
        warn: 'var(--color-warn)',
        brand: 'var(--color-brand)'
      },
      fontFamily: {
        system: 'var(--font-system)'
      }
    }
  },
  plugins: []
}

export default config
