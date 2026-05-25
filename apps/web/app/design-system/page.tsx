import { TrendingUp, TrendingDown, Wallet, CreditCard, Coins, Calendar } from 'lucide-react'
import { Masthead } from '@/components/ui/Masthead'
import { Headline } from '@/components/ui/Headline'
import { Standfirst } from '@/components/ui/Standfirst'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { KpiTile } from '@/components/ui/KpiTile'
import { RulerList, type RulerListItem } from '@/components/ui/RulerList'

// ─── Token metadata ───────────────────────────────────────────────────────────

interface Swatch {
  name: string
  varName: string
  description: string
}

const swatches: ReadonlyArray<Swatch> = [
  { name: 'bg',      varName: '--color-bg',      description: 'Page background (gray-50)' },
  { name: 'surface', varName: '--color-surface',  description: 'White cards' },
  { name: 'ink',     varName: '--color-ink',      description: 'Primary text (gray-900)' },
  { name: 'muted',   varName: '--color-muted',    description: 'Secondary text (gray-500)' },
  { name: 'rule',    varName: '--color-rule',     description: 'Borders + dividers (gray-200)' },
  { name: 'accent',  varName: '--color-accent',   description: 'Positive / emerald-600' },
  { name: 'warn',    varName: '--color-warn',     description: 'Negative / red-600' },
  { name: 'brand',   varName: '--color-brand',    description: 'Primary brand / blue-600' },
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DesignSystemPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-5xl mx-auto space-y-16">

      {/* ── Page intro ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight text-ink">Design system</h1>
        <p className="text-[15px] text-muted max-w-prose">
          Dashboard primitives + design tokens. Iterate here against realistic
          Lopez-household data before touching production surfaces.
        </p>
      </div>

      {/* ── Tokens ─────────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-tokens">
        <div id="lbl-tokens" className="mb-4">
          <SectionLabel>Color tokens</SectionLabel>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
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

      {/* ── KpiTile ────────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-kpitile" className="space-y-6">
        <div id="lbl-kpitile">
          <SectionLabel>KpiTile</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">label</code>,{' '}
          <code className="font-mono">value</code>,{' '}
          <code className="font-mono">caption</code>,{' '}
          <code className="font-mono">captionTone</code> (positive | negative | neutral),{' '}
          <code className="font-mono">icon</code>,{' '}
          <code className="font-mono">iconTone</code> (emerald | red | purple | blue | amber | gray)
        </p>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Dashboard KPI row — icon tones</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Cash"
              value="$42,180"
              caption="+$620 this month"
              captionTone="positive"
              icon={Wallet}
              iconTone="emerald"
            />
            <KpiTile
              label="Debt"
              value="$18,902"
              caption="-$340 paid down"
              captionTone="positive"
              icon={CreditCard}
              iconTone="red"
            />
            <KpiTile
              label="This Month"
              value="+$1,840"
              caption="net positive"
              captionTone="positive"
              icon={TrendingUp}
              iconTone="emerald"
            />
            <KpiTile
              label="Net Worth"
              value="$23,278"
              caption="positive position"
              captionTone="positive"
              icon={Coins}
              iconTone="purple"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">Negative month</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile
              label="Cash"
              value="$39,120"
              caption="-$3,060 this month"
              captionTone="negative"
              icon={Wallet}
              iconTone="emerald"
            />
            <KpiTile
              label="Debt"
              value="$19,480"
              caption="+$578 added"
              captionTone="negative"
              icon={CreditCard}
              iconTone="red"
            />
            <KpiTile
              label="This Month"
              value="−$980"
              caption="net negative"
              captionTone="negative"
              icon={TrendingDown}
              iconTone="red"
            />
            <KpiTile
              label="Net Worth"
              value="$19,640"
              caption="positive position"
              captionTone="positive"
              icon={Coins}
              iconTone="purple"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">All icon tones (no caption)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <KpiTile label="Emerald" value="$1,200" icon={TrendingUp} iconTone="emerald" />
            <KpiTile label="Red" value="$900" icon={TrendingDown} iconTone="red" />
            <KpiTile label="Purple" value="$5,400" icon={Coins} iconTone="purple" />
            <KpiTile label="Blue" value="7" icon={Calendar} iconTone="blue" />
            <KpiTile label="Amber" value="3" icon={Wallet} iconTone="amber" />
            <KpiTile label="Gray" value="12" icon={CreditCard} iconTone="gray" />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] uppercase tracking-widest text-muted">No icon</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-lg">
            <KpiTile label="Accounts" value="4" />
            <KpiTile label="Open Bills" value="7" />
            <KpiTile label="Days Left" value="8" />
          </div>
        </div>
      </section>

      {/* ── Masthead ───────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-masthead" className="space-y-4">
        <div id="lbl-masthead">
          <SectionLabel>Masthead</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">volume</code>,{' '}
          <code className="font-mono">date</code>. Retains editorial character — useful inside cards for section headers.
        </p>
        <div className="max-w-[380px] bg-surface border border-rule rounded-xl p-5 shadow-sm">
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
          <code className="font-mono">as</code> (h1 | h2 | h3). Works inside cards for bold section intros.
        </p>
        <div className="bg-surface border border-rule rounded-xl p-5 shadow-sm space-y-3">
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
          Props: <code className="font-mono">children</code>. Subheading-weight body text inside a Notable card.
        </p>
        <div className="bg-surface border border-rule rounded-xl p-5 shadow-sm">
          <Standfirst>
            A quiet month in the Lopez household. Groceries came in 18% under
            budget, three bills shifted into the next cycle, and Anthropic
            transferred the May stipend on the 3rd as expected.
          </Standfirst>
        </div>
      </section>

      {/* ── SectionLabel ───────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-sectionlabel" className="space-y-4">
        <div id="lbl-sectionlabel">
          <SectionLabel>SectionLabel (the component itself)</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">children</code>. Uppercase tracking label for section headings.
        </p>
        <div className="space-y-3 pl-3 border-l-2 border-rule">
          <SectionLabel>Coming Due — 14 days</SectionLabel>
          <SectionLabel>Spending by Category</SectionLabel>
          <SectionLabel>Net Worth · Tucker household</SectionLabel>
        </div>
      </section>

      {/* ── RulerList ──────────────────────────────────────────────────────── */}
      <section aria-labelledby="lbl-rulerlist" className="space-y-4">
        <div id="lbl-rulerlist">
          <SectionLabel>RulerList</SectionLabel>
        </div>
        <p className="text-[13px] text-muted">
          Props: <code className="font-mono">items</code> (label, value, key). Used inside Coming Due card.
        </p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="bg-surface border border-rule rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-50 text-blue-600">
                <Calendar size={16} strokeWidth={2} />
              </div>
              <h3 className="text-sm font-semibold text-ink">Coming due — next 14 days</h3>
            </div>
            <RulerList items={comingDue} />
          </div>
          <div className="bg-surface border border-rule rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-sm font-semibold text-ink">Large payments — upcoming</h3>
            <RulerList items={largePayments} />
          </div>
        </div>
      </section>

    </main>
  )
}
