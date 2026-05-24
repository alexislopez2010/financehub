const swatches: Array<{ name: string; varName: string }> = [
  { name: 'bg',      varName: '--color-bg' },
  { name: 'surface', varName: '--color-surface' },
  { name: 'ink',     varName: '--color-ink' },
  { name: 'muted',   varName: '--color-muted' },
  { name: 'rule',    varName: '--color-rule' },
  { name: 'accent',  varName: '--color-accent' },
  { name: 'warn',    varName: '--color-warn' }
]

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-semibold mb-1">Lopez Family Finances</h1>
      <p className="text-sm text-muted mb-8">Next.js scaffold + design tokens.</p>
      <section>
        <h2 className="text-xs uppercase tracking-widest text-muted mb-3">Tokens</h2>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 max-w-3xl">
          {swatches.map(s => (
            <div key={s.name} className="flex flex-col items-stretch">
              <div
                className="h-16 rounded-md border"
                style={{
                  backgroundColor: `var(${s.varName})`,
                  borderColor: 'var(--color-rule)'
                }}
              />
              <div className="mt-2 text-[11px]">
                <div className="font-medium">{s.name}</div>
                <div className="text-muted">{s.varName}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
