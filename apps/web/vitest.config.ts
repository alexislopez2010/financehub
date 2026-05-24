import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, '.') }
  },
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    css: false,
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      include: ['lib/finance/**/*.ts'],
      exclude: ['lib/finance/**/*.test.ts', 'lib/finance/types.ts'],
      thresholds: {
        lines: 98,
        branches: 95,
        functions: 100,
        statements: 98
      }
    }
  }
})
