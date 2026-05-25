'use client'

import { Masthead } from '@/components/ui/Masthead'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { KpiStone } from '@/components/ui/KpiStone'
import { RulerList, type RulerListItem } from '@/components/ui/RulerList'
import { Sparkline } from '@/components/charts/Sparkline'
import {
  FIXTURE_KPIS,
  FIXTURE_COMING_DUE,
  FIXTURE_FORECAST_POINTS,
  FIXTURE_NOTABLE,
  FIXTURE_LEAD,
  FIXTURE_TODAY_LABEL
} from './fixtures'

function formatUSD(n: number): string {
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  })
}

export function BriefingEditorial() {
  const dueItems: ReadonlyArray<RulerListItem> = FIXTURE_COMING_DUE.map(item => ({
    key: item.billId,
    label: (
      <span>
        <span className="text-muted tabular-nums mr-2 text-[11px]">+{item.daysUntil}d</span>
        {item.name}
      </span>
    ),
    value: formatUSD(item.amount)
  }))

  const dueTotal = FIXTURE_COMING_DUE.reduce((s, x) => s + x.amount, 0)
  const forecastEnd =
    FIXTURE_FORECAST_POINTS[FIXTURE_FORECAST_POINTS.length - 1] ?? FIXTURE_KPIS.cash
  const net = FIXTURE_KPIS.thisMonthNet

  return (
    <article className="space-y-8 p-6 bg-bg rounded-2xl">
      <Masthead volume="VOL. III · BRIEFING" date={FIXTURE_TODAY_LABEL} />

      <div className="space-y-3">
        <SectionLabel>The Headline</SectionLabel>
        <Headline>{FIXTURE_LEAD.headline}</Headline>
        <Standfirst>{FIXTURE_LEAD.standfirst}</Standfirst>
      </div>

      <div className="grid grid-cols-3 gap-4 border-t border-b border-rule py-4">
        <KpiStone label="Cash" value={formatUSD(FIXTURE_KPIS.cash)} />
        <KpiStone label="Debt" value={formatUSD(FIXTURE_KPIS.debt)} />
        <KpiStone
          label="This Month"
          value={(net >= 0 ? '+' : '−') + formatUSD(Math.abs(net))}
          caption={net >= 0 ? 'net positive' : 'net negative'}
          tone={net > 0 ? 'positive' : net < 0 ? 'negative' : 'neutral'}
        />
      </div>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Coming Due — 14 days</SectionLabel>
          <span className="text-[11px] italic text-muted">{formatUSD(dueTotal)} total</span>
        </div>
        <RulerList items={dueItems} />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>30-Day Forecast</SectionLabel>
          <span className="text-[11px] italic text-muted">ends {formatUSD(forecastEnd)}</span>
        </div>
        <Sparkline
          points={FIXTURE_FORECAST_POINTS}
          baseline={FIXTURE_KPIS.cash}
          label="Projected cash balance over the next 30 days"
        />
      </section>

      <section className="space-y-3 border-t border-rule pt-6">
        <SectionLabel>Notable</SectionLabel>
        <div className="space-y-3">
          {FIXTURE_NOTABLE.map((c, i) => (
            <p key={i} className="text-sm leading-relaxed">
              <strong className="text-ink">{c.lead}</strong>{' '}
              <span className="text-muted">{c.body}</span>
            </p>
          ))}
        </div>
      </section>
    </article>
  )
}
