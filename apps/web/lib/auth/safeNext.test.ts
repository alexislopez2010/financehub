import { describe, it, expect } from 'vitest'
import { safeNextPath } from './safeNext'

describe('safeNextPath', () => {
  describe('allows same-origin relative paths', () => {
    it('passes a simple path', () => {
      expect(safeNextPath('/ledger')).toBe('/ledger')
    })

    it('passes a path with query params', () => {
      expect(safeNextPath('/ledger?account=Citibank&start=2026-01-01')).toBe(
        '/ledger?account=Citibank&start=2026-01-01'
      )
    })

    it('passes the root path', () => {
      expect(safeNextPath('/')).toBe('/')
    })

    it('trims leading/trailing whitespace', () => {
      expect(safeNextPath('  /plan  ')).toBe('/plan')
    })
  })

  describe('rejects open-redirect attempts', () => {
    it('rejects absolute http URLs', () => {
      expect(safeNextPath('https://evil.com')).toBe('/')
    })

    it('rejects absolute http URLs (no tls)', () => {
      expect(safeNextPath('http://evil.com/login')).toBe('/')
    })

    it('rejects protocol-relative URLs', () => {
      expect(safeNextPath('//evil.com')).toBe('/')
    })

    it('rejects backslash-escaped host tricks', () => {
      expect(safeNextPath('/\\evil.com')).toBe('/')
      expect(safeNextPath('/\\/evil.com')).toBe('/')
    })

    it('rejects javascript: scheme', () => {
      expect(safeNextPath('javascript:alert(1)')).toBe('/')
    })

    it('rejects data: scheme', () => {
      expect(safeNextPath('data:text/html,<script>')).toBe('/')
    })

    it('rejects a bare hostname', () => {
      expect(safeNextPath('evil.com')).toBe('/')
    })
  })

  describe('edge cases', () => {
    it('falls back on null', () => {
      expect(safeNextPath(null)).toBe('/')
    })

    it('falls back on undefined', () => {
      expect(safeNextPath(undefined)).toBe('/')
    })

    it('falls back on empty string', () => {
      expect(safeNextPath('')).toBe('/')
    })

    it('falls back on whitespace-only', () => {
      expect(safeNextPath('   ')).toBe('/')
    })

    it('honors a custom fallback', () => {
      expect(safeNextPath('https://evil.com', '/login')).toBe('/login')
    })
  })
})
