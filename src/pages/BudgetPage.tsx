import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { mockBudgets, mockCategories, monthlySummary } from '@/lib/mock-data'
import { PieChart, Target, AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

const budgetData = mockBudgets.map(b => {
  const cat = mockCategories.find(c => c.id === b.category_id)
  const percent = (b.spent / b.amount) * 100
  return {
    ...b,
    categoryName: cat?.name || 'Unknown',
    categoryColor: cat?.color || '#71717a',
    categoryIcon: cat?.icon || 'Circle',
    percent,
    remaining: b.amount - b.spent,
    status: percent > 100 ? 'over' : percent > 80 ? 'warning' : 'good',
  }
}).sort((a, b) => b.percent - a.percent)

const totalBudget = budgetData.reduce((s, b) => s + b.amount, 0)
const totalSpent = budgetData.reduce((s, b) => s + b.spent, 0)
const overBudget = budgetData.filter(b => b.status === 'over').length
const onTrack = budgetData.filter(b => b.status === 'good').length

const chartData = budgetData.map(b => ({
  name: b.categoryName,
  budget: b.amount,
  spent: b.spent,
  color: b.categoryColor,
}))

export function BudgetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Budget</h1>
        <p className="text-muted-foreground">March 2026 budget tracking</p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-xl font-bold">{formatCurrency(totalBudget)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <PieChart className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Spent</p>
                <p className="text-xl font-bold">{formatCurrency(totalSpent)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">On Track</p>
                <p className="text-xl font-bold">{onTrack} categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Over Budget</p>
                <p className="text-xl font-bold">{overBudget} categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium">Overall Budget Usage</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(totalSpent)} of {formatCurrency(totalBudget)}</p>
            </div>
            <span className="text-2xl font-bold">{((totalSpent / totalBudget) * 100).toFixed(0)}%</span>
          </div>
          <Progress value={totalSpent} max={totalBudget} className="h-3" />
          <p className="mt-2 text-sm text-muted-foreground">
            {formatCurrency(totalBudget - totalSpent)} remaining this month
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                  <XAxis type="number" stroke="#71717a" fontSize={12} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={12} width={90} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0f',
                      border: '1px solid #27272a',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), '']}
                  />
                  <Bar dataKey="budget" fill="#27272a" radius={[0, 4, 4, 0]} name="Budget" />
                  <Bar dataKey="spent" radius={[0, 4, 4, 0]} name="Spent">
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Category List */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Individual category progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {budgetData.map(b => (
              <div key={b.id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: b.categoryColor }} />
                    <span className="text-sm font-medium">{b.categoryName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(b.spent)} / {formatCurrency(b.amount)}
                    </span>
                    <Badge
                      variant={b.status === 'over' ? 'destructive' : b.status === 'warning' ? 'warning' : 'success'}
                      className="text-xs"
                    >
                      {b.percent.toFixed(0)}%
                    </Badge>
                  </div>
                </div>
                <Progress value={b.spent} max={b.amount} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Monthly Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Savings Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlySummary}>
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
                <Bar dataKey="savings" fill="#6366f1" radius={[4, 4, 0, 0]} name="Savings" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
