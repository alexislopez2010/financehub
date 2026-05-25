import { describe, it, expect } from 'vitest'
import { buildLead } from './headline'
import type { BriefingKpis } from './kpis'

function mkKpis(thisMonthNet: number, cash: number, debt: number): BriefingKpis {
  return {
    thisMonthNet,
    cash,
    debt,
    savingsRate: 0,
    burnRate30Day: 0,
    monthsOfRunway: 99
  }
}

describe('buildLead', () => {
  describe('headline', () => {
    it('generates "Net worth, up X.X%" headline when net > 0 and pct >= 0.05', () => {
      // net=500, cash=5000, debt=5000 → denom=10000, pct=5%
      const kpis = mkKpis(500, 5000, 5000)
      const { headline } = buildLead({ kpis })
      expect(headline).toMatch(/Net worth, up \d+\.\d+% this month\./)
    })

    it('calculates percentage correctly: net/( cash+debt)*100', () => {
      const kpis = mkKpis(1000, 8000, 2000)  // 1000/10000 = 10%
      const { headline } = buildLead({ kpis })
      expect(headline).toContain('10.0%')
    })

    it('falls back to "Up $X" when percentage is very small (<0.05)', () => {
      // net=1, cash=100000, debt=100000 → pct=0.0005% — tiny
      const kpis = mkKpis(1, 100000, 100000)
      const { headline } = buildLead({ kpis })
      expect(headline).toMatch(/^Up \$1 this month\.$/)
    })

    it('generates "Net cash flow down $X" when net < 0', () => {
      const kpis = mkKpis(-350, 3000, 1000)
      const { headline } = buildLead({ kpis })
      expect(headline).toBe('Net cash flow down $350 this month.')
    })

    it('generates "Held steady" when net === 0', () => {
      const kpis = mkKpis(0, 2000, 500)
      const { headline } = buildLead({ kpis })
      expect(headline).toBe('Held steady this month.')
    })

    it('uses the custom thisMonthLabel when provided', () => {
      const kpis = mkKpis(0, 1000, 0)
      const { headline } = buildLead({ kpis, thisMonthLabel: 'in May' })
      expect(headline).toBe('Held steady in May.')
    })

    it('falls back to "Up $X" when denom is zero (no cash or debt) but net > 0', () => {
      const kpis = mkKpis(200, 0, 0)  // denom=0, pct=0 → fallback
      const { headline } = buildLead({ kpis })
      expect(headline).toMatch(/^Up \$200 this month\.$/)
    })
  })

  describe('standfirst', () => {
    it('always includes cash and debt in standfirst', () => {
      const kpis = mkKpis(0, 5000, 1000)
      const { standfirst } = buildLead({ kpis })
      expect(standfirst).toContain('Cash $5,000')
      expect(standfirst).toContain('debt $1,000')
    })

    it('formats large numbers with commas', () => {
      const kpis = mkKpis(0, 125000, 45000)
      const { standfirst } = buildLead({ kpis })
      expect(standfirst).toContain('Cash $125,000')
      expect(standfirst).toContain('debt $45,000')
    })

    it('includes comparison sentence when prevMonthNet diff > $100', () => {
      const kpis = mkKpis(500, 3000, 1000)
      const { standfirst } = buildLead({ kpis, prevMonthNet: 200 })
      // diff = 500 - 200 = 300 > 100
      expect(standfirst).toContain("That's $300 better than last month.")
    })

    it('says "worse" when current month is lower than prev by > $100', () => {
      const kpis = mkKpis(100, 3000, 1000)
      const { standfirst } = buildLead({ kpis, prevMonthNet: 500 })
      // diff = 100 - 500 = -400
      expect(standfirst).toContain("That's $400 worse than last month.")
    })

    it('does not include comparison sentence when diff <= $100', () => {
      const kpis = mkKpis(300, 3000, 1000)
      const { standfirst } = buildLead({ kpis, prevMonthNet: 250 })
      // diff = 50 — below threshold
      expect(standfirst).not.toContain('better than last month')
      expect(standfirst).not.toContain('worse than last month')
    })

    it('does not include comparison sentence when diff is exactly $100', () => {
      const kpis = mkKpis(300, 3000, 1000)
      const { standfirst } = buildLead({ kpis, prevMonthNet: 200 })
      // diff = 100 — not strictly >100
      expect(standfirst).not.toContain('better than last month')
    })

    it('does not include comparison sentence when prevMonthNet is null', () => {
      const kpis = mkKpis(500, 3000, 1000)
      const { standfirst } = buildLead({ kpis, prevMonthNet: null })
      expect(standfirst).not.toContain('last month')
    })

    it('does not include comparison sentence when prevMonthNet is undefined', () => {
      const kpis = mkKpis(500, 3000, 1000)
      const { standfirst } = buildLead({ kpis })
      expect(standfirst).not.toContain('last month')
    })

    it('standfirst is joined with a space when comparison is included', () => {
      const kpis = mkKpis(500, 3000, 1000)
      const { standfirst } = buildLead({ kpis, prevMonthNet: 200 })
      // Should have comparison sentence followed by cash·debt sentence
      expect(standfirst).toMatch(/That's .+ better than last month\. Cash \$/)
    })
  })
})
