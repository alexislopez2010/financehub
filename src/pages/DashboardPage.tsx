import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatPercent } from '@/lib/utils'
import {
  mockAccounts,
  mockTransactions,
  monthlySummary,
  spendingByCategory,
} from '@/lib/mock-data'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  CreditCard,
  PiggyBank,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

const totalAssets = mockAccounts.filter(a => a.is_asset).reduce((s, a) => s + a.balance, 0)
const totalLiabilities = Math.abs(mockAccounts.filter(a => !a.is_asset).reduce((s, a) => s + a.balance, 0))
const marchData = monthlySummary[monthlySummary.length - 1]
const febData = monthlySummary[monthlySummary.length - 2]
const incomeChange = ((marchData.income - febData.income) / febData.income) * 100
const expenseChange = ((marchData.expenses - febData.expenses) / febData.expenses) * 100

const recentTransactions = [...mockTransactions]
  .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  .slice(0, 8)

const kpis = [
  {
    title: 'Total Balance',
    value: formatCurrency(totalAssets - totalLiabilities),
    change: '+3.2%',
    trend: 'up' as const,
    icon: DollarSign,
    color: 'text-primary',
  },
  {
    title: 'Monthly Income',
    value: formatCurrency(marchData.income),
    change: formatPercent(incomeChange),
    trend: incomeChange >= 0 ? 'up' as const : 'down' as const,
    icon: TrendingUp,
    color: 'text-success',
  },
  {
    title: 'Monthly Expenses',
    value: formatCurrency(marchData.expenses),
    change: formatPercent(expenseChange),
    trend: expenseChange <= 0 ? 'up' as const : 'down' as const,
    icon: CreditCard,
    color: 'text-warning',
  },
  {
    title: 'Savings Rate',
    value: `${((marchData.savings / marchData.income) * 100).toFixed(0)}%`,
    change: '+12.4%',
    trend: 'up' as const,
    icon: PiggyBank,
    color: 'text-success',
  },
]

export function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Your financial overview for March 2026</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title} className="relative overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{kpi.value}</span>
                <Badge variant={kpi.trend === 'up' ? 'success' : 'warning'} className="gap-0.5">
                  {kpi.trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {kpi.change}
                </Badge>
              </div>
              {/* Subtle gradient overlay */}
              <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-primary/5 blur-2xl" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySummary}>
                  <defs>
                    <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="month" stroke="#71717a" fontSize={12} />
                  <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0f',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), '']}
                  />
                  <Area type="monotone" dataKey="income" stroke="#22c55e" fill="url(#incomeGrad)" strokeWidth={2} name="Income" />
                  <Area type="monotone" dataKey="expenses" stroke="#ef4444" fill="url(#expenseGrad)" strokeWidth={2} name="Expenses" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Spending Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={spendingByCategory.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {spendingByCategory.slice(0, 6).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0f',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), '']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 space-y-2">
              {spendingByCategory.slice(0, 6).map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="text-muted-foreground">{cat.name}</span>
                  </div>
                  <span className="font-medium">{formatCurrency(cat.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions + Accounts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transactions</CardTitle>
            <a href="/transactions" className="text-sm text-primary hover:underline">View all</a>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tx.type === 'income' ? 'bg-success/10' : 'bg-destructive/10'}`}>
                      {tx.type === 'income'
                        ? <TrendingUp className="h-5 w-5 text-success" />
                        : <TrendingDown className="h-5 w-5 text-destructive" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.merchant} · {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold ${tx.type === 'income' ? 'text-success' : 'text-foreground'}`}>
                    {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Accounts */}
        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockAccounts.map((acc) => (
              <div key={acc.id} className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-secondary/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary" style={{ borderLeft: `3px solid ${acc.color}` }}>
                    <span className="text-xs font-bold text-muted-foreground">
                      {acc.institution.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.type.replace('_', ' ')}</p>
                  </div>
                </div>
                <span className={`text-sm font-semibold ${acc.balance < 0 ? 'text-destructive' : ''}`}>
                  {formatCurrency(acc.balance)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
