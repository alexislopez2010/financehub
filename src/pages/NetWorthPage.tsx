import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { mockAssets, netWorthHistory } from '@/lib/mock-data'
import {
  TrendingUp,
  Building2,
  Car,
  Landmark,
  Bitcoin,
  BarChart3,
  ArrowUpRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

const assets = mockAssets.filter(a => !a.is_liability)
const liabilities = mockAssets.filter(a => a.is_liability)
const totalAssets = assets.reduce((s, a) => s + a.value, 0)
const totalLiabilities = liabilities.reduce((s, a) => s + a.value, 0)
const netWorth = totalAssets - totalLiabilities

const iconMap: Record<string, typeof Building2> = {
  property: Building2,
  vehicle: Car,
  retirement: Landmark,
  investment: BarChart3,
  crypto: Bitcoin,
  mortgage: Building2,
  student_loan: Landmark,
  auto_loan: Car,
  personal_loan: Landmark,
}

const assetAllocation = [
  { name: 'Real Estate', value: 450000, percent: (450000 / totalAssets * 100), color: '#f59e0b' },
  { name: 'Retirement', value: 87650, percent: (87650 / totalAssets * 100), color: '#6366f1' },
  { name: 'Vehicles', value: 28000, percent: (28000 / totalAssets * 100), color: '#3b82f6' },
  { name: 'Investments', value: 12300, percent: (12300 / totalAssets * 100), color: '#22c55e' },
  { name: 'Crypto', value: 8500, percent: (8500 / totalAssets * 100), color: '#f97316' },
]

export function NetWorthPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Net Worth</h1>
        <p className="text-muted-foreground">Track your assets and liabilities over time</p>
      </div>

      {/* Net Worth Summary */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Net Worth</p>
            <p className="mt-1 text-3xl font-bold">{formatCurrency(netWorth)}</p>
            <Badge variant="success" className="mt-2 gap-1">
              <ArrowUpRight className="h-3 w-3" /> +12.8% YTD
            </Badge>
            <div className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/5 blur-2xl" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Total Assets</p>
            <p className="mt-1 text-3xl font-bold text-success">{formatCurrency(totalAssets)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{assets.length} assets tracked</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm font-medium text-muted-foreground">Total Liabilities</p>
            <p className="mt-1 text-3xl font-bold text-destructive">{formatCurrency(totalLiabilities)}</p>
            <p className="mt-2 text-sm text-muted-foreground">{liabilities.length} debts tracked</p>
          </CardContent>
        </Card>
      </div>

      {/* Net Worth Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Net Worth Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthHistory}>
                <defs>
                  <linearGradient id="nwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} tickFormatter={v => `$${v / 1000}k`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0f',
                    border: '1px solid #27272a',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                  formatter={(value) => [formatCurrency(Number(value)), '']}
                />
                <Area type="monotone" dataKey="netWorth" stroke="#6366f1" fill="url(#nwGrad)" strokeWidth={2} name="Net Worth" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Assets */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-success">Assets</CardTitle>
            <span className="text-lg font-bold text-success">{formatCurrency(totalAssets)}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {assets.map(a => {
              const Icon = iconMap[a.type] || TrendingUp
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                      <Icon className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{a.type.replace('_', ' ')}{a.institution ? ` · ${a.institution}` : ''}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(a.value)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-destructive">Liabilities</CardTitle>
            <span className="text-lg font-bold text-destructive">{formatCurrency(totalLiabilities)}</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {liabilities.map(a => {
              const Icon = iconMap[a.type] || TrendingUp
              return (
                <div key={a.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                      <Icon className="h-5 w-5 text-destructive" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{a.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {a.type.replace('_', ' ')}{a.institution ? ` · ${a.institution}` : ''}
                        {a.interest_rate ? ` · ${a.interest_rate}% APR` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-destructive">{formatCurrency(a.value)}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Asset Allocation */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assetAllocation.map(a => (
              <div key={a.name} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{a.percent.toFixed(1)}%</span>
                    <span className="font-semibold">{formatCurrency(a.value)}</span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full transition-all" style={{ width: `${a.percent}%`, backgroundColor: a.color }} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
