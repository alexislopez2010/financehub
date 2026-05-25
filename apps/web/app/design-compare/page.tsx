import { BriefingEditorial } from '@/components/briefing/BriefingEditorial'
import { BriefingDashboard } from '@/components/briefing/BriefingDashboard'

export const metadata = { title: 'Design comparison — Lopez Family Finances' }

export default function DesignComparePage() {
  return (
    <main className="min-h-screen bg-gray-100 p-6 sm:p-10">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Briefing design comparison</h1>
          <p className="text-sm text-gray-600">
            Two visual treatments of the same Briefing content, rendered against shared fixture
            data. Pick a direction; that wins, the other one gets removed.
          </p>
          <nav className="flex gap-3 pt-2 text-sm">
            <a href="#editorial" className="text-blue-600 hover:underline">
              → Editorial variant
            </a>
            <a href="#dashboard" className="text-blue-600 hover:underline">
              → Dashboard variant
            </a>
          </nav>
        </header>

        <section id="editorial" className="space-y-3 scroll-mt-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">A. Editorial</h2>
            <span className="text-xs text-gray-500">
              Warm paper, ruler dividers, masthead, muted tones, restrained editorial flow.
            </span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            <BriefingEditorial />
          </div>
        </section>

        <section id="dashboard" className="space-y-3 scroll-mt-6">
          <div className="flex items-baseline gap-3">
            <h2 className="text-lg font-semibold text-gray-900">B. Dashboard (legacy aesthetic)</h2>
            <span className="text-xs text-gray-500">
              White cards, vibrant Tailwind palette, icon pills, bold numerals, conventional
              fintech look.
            </span>
          </div>
          <div className="rounded-2xl overflow-hidden border border-gray-200">
            <BriefingDashboard />
          </div>
        </section>
      </div>
    </main>
  )
}
