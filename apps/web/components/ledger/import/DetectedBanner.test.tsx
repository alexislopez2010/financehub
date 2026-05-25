import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DetectedBanner, formatRange } from './DetectedBanner'

describe('formatRange', () => {
  it('omits year when the dates share a year', () => {
    expect(formatRange('2026-04-12', '2026-05-21')).toBe('Apr 12 – May 21, 2026')
  })

  it('includes year on both sides when years differ', () => {
    expect(formatRange('2025-12-30', '2026-01-05')).toBe('Dec 30, 2025 – Jan 5, 2026')
  })

  it('falls back to ISO when input is unparseable', () => {
    expect(formatRange('not-a-date', '2026-05-21')).toBe('not-a-date – 2026-05-21')
  })
})

describe('<DetectedBanner>', () => {
  it('renders adapter name, plural row count, and date range', () => {
    render(
      <DetectedBanner
        adapterName="Chase"
        rowCount={47}
        dateRange={{ start: '2026-04-12', end: '2026-05-21' }}
      />
    )
    expect(screen.getByText('Chase')).toBeInTheDocument()
    expect(screen.getByText('47 rows')).toBeInTheDocument()
    expect(screen.getByText('Apr 12 – May 21, 2026')).toBeInTheDocument()
  })

  it('uses singular row label when count is 1', () => {
    render(
      <DetectedBanner
        adapterName="Capital One"
        rowCount={1}
        dateRange={{ start: '2026-04-12', end: '2026-04-12' }}
      />
    )
    expect(screen.getByText('1 row')).toBeInTheDocument()
  })
})
