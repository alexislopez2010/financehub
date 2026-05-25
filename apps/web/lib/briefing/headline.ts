import type { BriefingKpis } from './kpis'

export interface Lead {
  headline: string
  standfirst: string
}

/**
 * Builds a one-sentence editorial headline + a short standfirst summarising
 * the period's movement. No personalisation; just the numbers told plainly.
 */
export function buildLead(input: {
  kpis: BriefingKpis
  prevMonthNet?: number | null
  thisMonthLabel?: string
}): Lead {
  const label = input.thisMonthLabel ?? 'this month'
  const net = input.kpis.thisMonthNet
  const cash = input.kpis.cash
  const debt = input.kpis.debt

  let headline: string
  if (net > 0) {
    const denom = cash + debt
    const pct = denom > 0 ? (net / denom) * 100 : 0
    headline = pct >= 0.05
      ? `Net worth, up ${pct.toFixed(1)}% ${label}.`
      : `Up $${Math.abs(net).toFixed(0)} ${label}.`
  } else if (net < 0) {
    headline = `Net cash flow down $${Math.abs(net).toFixed(0)} ${label}.`
  } else {
    headline = `Held steady ${label}.`
  }

  const parts: string[] = []
  if (input.prevMonthNet != null) {
    const diff = net - input.prevMonthNet
    if (Math.abs(diff) > 100) {
      parts.push(
        diff > 0
          ? `That's $${diff.toFixed(0)} better than last month.`
          : `That's $${Math.abs(diff).toFixed(0)} worse than last month.`
      )
    }
  }
  parts.push(`Cash $${formatThousands(cash)} · debt $${formatThousands(debt)}.`)

  return { headline, standfirst: parts.join(' ') }
}

function formatThousands(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}
