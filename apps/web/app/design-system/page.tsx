import { Masthead } from '@/components/ui/Masthead'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { KpiStone } from '@/components/ui/KpiStone'
import { RulerList, type RulerListItem } from '@/components/ui/RulerList'

// ─── Token metadata ───────────────────────────────────────────────────────────

interface Swatch {
  name: string
  varName: string
  description: string
}

const swatches: ReadonlyArray<Swatch> = [
  { name: 'bg',      varName: '--color-bg',      description: 'Page background' },
  { name: 'surface', varName: '--color-surface',  description: 'Card / panel surface' },
  { name: 'ink',     varName: '--color-ink',      description: 'Primary text' },
  { name: 'muted',   varName: '--color-muted',    description: 'Secondary / caption text' },
  { name: 'rule',    varName: '--color-rule',     description: 'Dividers + borders' },
  { name: 'accent',  varName: '--color-accent',   description: 'Positive delta / highlight' },
  { name: 'warn',    varName: '--color-warn',     description: 'Negative delta / alert' },
]

// ─── Coming-due list data ─────────────────────────────────────────────────────

const comingDue: ReadonlyArray<RulerListItem> = [
  { key: 'tucker-mortgage',  label: 'Tucker Mortgage — 5th',     value: '$2,847.00' },
  { key: 'firstenergy',      label: 'FirstEnergy — 7th',          value: '$183.42' },
  { key: 'nra',              label: 'NRA Membership — 10th',      value: '$45.00' },
  { key: 'anthropic-sub',    label: 'Anthropic Claude — 12th',    value: '$20.00' },
  { key: 'internet',         label: 'Internet (Spectrum) — 14th', value: '$74.99' },
]

const largePayments: ReadonlyArray<RulerListItem> = [
  { key: 'property-tax',  label: 'Property Tax (Q3)',        value: '$1,420.00' },
  { key: 'car-insurance', label: 'Auto Insurance (6-month)', value: '$892.00' },
]

// ─── Composition-frame helper ─────────────────────────────────────────────────

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <article
      aria-label="Briefing phone frame"
      className="
        w-full max-w-[380px] mx-auto
        bg-surface rounded-3xl
        px-5 py-6 space-y-5
        border border-rule
        shadow-[0_4px_24px_rgba(0,0,0,0.06)]
      "
    >
      {children}
    </article>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto space-y-16">

      {/* ── Page intro ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Design system</h1>
        <p className="text-[15px] text-muted max-w-prose">
          Editorial primitives + design tokens. Iterate here against realistic
          Lopez-household data before touching production surfaces. Both mobile
          and desktop compositions are shown side-by-side so breakpoint
          regressions are visible at a glance.
        </p>
      </div>

      {/* ── Tokens ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-tokens">
        <div id="lbl-tokens" className="mb-4">
          <SectionLabel>Color tokens</SectionLabel>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {swatches.map((s) => (
            <div key={s.name} className="flex flex-col gap-2">
              <div
                className="h-14 rounded-xl border"
                style={{
                  backgroundColor: `var(${s.varName})`,
                  borderColor: 'var(--color-rule)',
                }}
              />
              <div className="text-[11px] leading-tight">
                <div className="font-semibold text-ink">{s.name}</div>
                <div className="text-muted font-mono">{s.varName}</div>
                <div className="text-muted mt-0.5">{s.description}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Masthead ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-masthead" className="space-y-4">
        <div id="lbl-masthead">
          <SectionLabel>Masthead</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">volume</code>,{' '}
          <code className="font-mono">date</code>
        </p>
        <div className="max-w-[380px]">
          <Masthead volume="VOL. III · BRIEFING" date="SAT, MAY 24" />
        </div>
      </section>

      {/* ── Headline ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-headline" className="space-y-4">
        <div id="lbl-headline">
          <SectionLabel>Headline</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">children</code>,{' '}
          <code className="font-mono">as</code> (h1 | h2 | h3)
        </p>
        <div className="space-y-3">
          <Headline as="h1">Net worth, up 2.4% this month.</Headline>
          <Headline as="h2">Groceries down. Utilities steady.</Headline>
          <Headline as="h3">Tucker mortgage current — next due Jun 5.</Headline>
        </div>
      </section>

      {/* ── Standfirst ─────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-standfirst" className="space-y-4">
        <div id="lbl-standfirst">
          <SectionLabel>Standfirst</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">children</code>
        </p>
        <Standfirst>
          A quiet month in the Lopez household. Groceries came in 18% under
          budget, three bills shifted into the next cycle, and Anthropic
          transferred the May stipend on the 3rd as expected.
        </Standfirst>
      </section>

      {/* ── SectionLabel ───────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-sectionlabel" className="space-y-4">
        <div id="lbl-sectionlabel">
          <SectionLabel>SectionLabel (the component itself)</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">children</code>
        </p>
        <div className="space-y-3 pl-3 border-l-2 border-rule">
          <SectionLabel>Coming Due — 14 days</SectionLabel>
          <SectionLabel>Spending by Category</SectionLabel>
          <SectionLabel>Net Worth · Tucker household</SectionLabel>
        </div>
      </section>

      {/* ── KpiStone ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-kpistone" className="space-y-5">
        <div id="lbl-kpistone">
          <SectionLabel>KpiStone</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">label</code>,{' '}
          <code className="font-mono">value</code>,{' '}
          <code className="font-mono">caption</code>,{' '}
          <code className="font-mono">tone</code> (neutral | positive | negative)
        </p>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Positive tone</p>
          <div className="grid grid-cols-3 gap-4 max-w-sm">
            <KpiStone label="CASH"       value="$42,180.00" caption="+$620.00"  tone="positive" />
            <KpiStone label="DEBT"       value="$18,902.44" caption="−$340.00"  tone="positive" />
            <KpiStone label="THIS MONTH" value="+$1,840.00" caption="net"       tone="neutral"  />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Negative tone</p>
          <div className="grid grid-cols-3 gap-4 max-w-sm">
            <KpiStone label="SPENDING"  value="$3,241.80" caption="+$482.10" tone="negative" />
            <KpiStone label="UTILITIES" value="$183.42"   caption="+$22.00"  tone="negative" />
            <KpiStone label="SAVINGS"   value="$8,750.00" caption="−$500.00" tone="negative" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Neutral tone (no caption)</p>
          <div className="grid grid-cols-3 gap-4 max-w-sm">
            <KpiStone label="ACCOUNTS"   value="4" />
            <KpiStone label="OPEN BILLS" value="7" />
            <KpiStone label="DAYS LEFT"  value="8" />
          </div>
        </div>
      </section>

      {/* ── RulerList ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-rulerlist" className="space-y-4">
        <div id="lbl-rulerlist">
          <SectionLabel>RulerList</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">items</code> (label, value, key)
        </p>

        <div className="grid gap-8 lg:grid-cols-2 max-w-3xl">
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-muted">Coming due — next 14 days</p>
            <RulerList items={comingDue} />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] uppercase tracking-widest text-muted">Large payments — upcoming</p>
            <RulerList items={largePayments} />
          </div>
        </div>
      </section>

      {/* ── Composition: Briefing extract ──────────────────────────────────── */}
      <section aria-labelledby="lbl-composition" className="space-y-6">
        <div className="space-y-1">
          <div id="lbl-composition">
            <SectionLabel>Composition: Briefing extract</SectionLabel>
          </div>
          <p className="text-[13px] text-muted">
            Mobile-width frames (380px) shown side-by-side on desktop.
            Left frame: positive month. Right frame: negative month — same
            structure, different data state.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* ── Good month ───────────────────────────────────────────────── */}
          <PhoneFrame>
            <Masthead volume="VOL. III · BRIEFING" date="SAT, MAY 24" />

            <div className="space-y-2">
              <Headline as="h2">Net worth, up 2.4%.</Headline>
              <Standfirst>
                Groceries down 18%, three bills shifted into June. Anthropic
                stipend landed on the 3rd — everything on track.
              </Standfirst>
            </div>

            <div className="space-y-3">
              <SectionLabel>Snapshot · May 2025</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <KpiStone label="CASH"       value="$42,180" caption="+$620"  tone="positive" />
                <KpiStone label="DEBT"       value="$18,902" caption="−$340"  tone="positive" />
                <KpiStone label="THIS MONTH" value="+$1,840" caption="net"    tone="neutral"  />
              </div>
            </div>

            <div className="space-y-3">
              <SectionLabel>Coming Due — 14 days</SectionLabel>
              <RulerList items={comingDue} />
            </div>
          </PhoneFrame>

          {/* ── Bad month ────────────────────────────────────────────────── */}
          <PhoneFrame>
            <Masthead volume="VOL. IV · BRIEFING" date="SAT, JUN 21" />

            <div className="space-y-2">
              <Headline as="h2">Spending overrun — June.</Headline>
              <Standfirst>
                Car repair hit in week 2. Utilities 22% over baseline. Net
                position negative for the first time in four months.
              </Standfirst>
            </div>

            <div className="space-y-3">
              <SectionLabel>Snapshot · Jun 2025</SectionLabel>
              <div className="grid grid-cols-3 gap-3">
                <KpiStone label="CASH"       value="$39,120" caption="−$3,060" tone="negative" />
                <KpiStone label="DEBT"       value="$19,480" caption="+$578"   tone="negative" />
                <KpiStone label="THIS MONTH" value="−$980"   caption="net"     tone="negative" />
              </div>
            </div>

            <div className="space-y-3">
              <SectionLabel>Coming Due — 14 days</SectionLabel>
              <RulerList
                items={[
                  { key: 'tucker-mortgage-jun', label: 'Tucker Mortgage — 5th',   value: '$2,847.00' },
                  { key: 'firstenergy-jun',      label: 'FirstEnergy — 7th',       value: '$205.18' },
                  { key: 'property-tax-q3',      label: 'Property Tax Q3 — 9th',   value: '$1,420.00' },
                  { key: 'auto-insurance',        label: 'Auto Insurance — 14th',   value: '$892.00' },
                  { key: 'anthropic-sub-jun',     label: 'Anthropic Claude — 12th', value: '$20.00' },
                ]}
              />
            </div>
          </PhoneFrame>

        </div>
      </section>

    </main>
  )
}
