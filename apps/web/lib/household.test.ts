import { describe, it, expect } from 'vitest'
import { LOPEZ_HOUSEHOLD_ID } from './household'

describe('LOPEZ_HOUSEHOLD_ID', () => {
  it('matches the seeded household uuid', () => {
    expect(LOPEZ_HOUSEHOLD_ID).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('is a valid uuid v4-shaped string', () => {
    expect(LOPEZ_HOUSEHOLD_ID).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })
})
