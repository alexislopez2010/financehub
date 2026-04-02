import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { mockBills, mockCategories } from '@/lib/mock-data'
import {
  Receipt,
  Calendar,
  CreditCard,
  Zap,
  Plus,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react'

const sortedBills = [...mockBills].sort((a, b) =>
  new Date(a.next_due_date).getTime() - new Date(b.next_due_date).getTime()
)

const totalMonthly = mockBills.filter(b => b.is_active).reduce((s, b) => s + b.amount, 0)
const autopayCount = mockBills.filter(b => b.is_autopay).length
const manualCount = mockBills.filter(b => !b.is_autopay).length

const today = new Date('2026-04-01')
const dueSoon = sortedBills.filter(b => {
  const due = new Date(b.next_due_date)
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= 7
})

const getCategoryName = (id?: string) => mockCategories.find(c => c.id === id)?.name || 'Other'

export function BillsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bills & Subscriptions</h1>
          <p className="text-muted-foreground">Manage your recurring payments</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Add Bill
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Total</p>
                <p className="text-xl font-bold">{formatCurrency(totalMonthly)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due This Week</p>
                <p className="text-xl font-bold">{dueSoon.length} bills</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <Zap className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Autopay</p>
                <p className="text-xl font-bold">{autopayCount} bills</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Manual Pay</p>
                <p className="text-xl font-bold">{manualCount} bills</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Due Soon Alert */}
      {dueSoon.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-warning">
              <AlertCircle className="h-5 w-5" /> Due This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dueSoon.map(bill => (
                <div key={bill.id} className="flex items-center justify-between rounded-lg bg-background/50 p-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">{bill.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        Due {new Date(bill.next_due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{formatCurrency(bill.amount)}</span>
                    {bill.is_autopay && <Badge variant="success">Autopay</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Bills */}
      <Card>
        <CardHeader>
          <CardTitle>All Bills & Subscriptions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Frequency</th>
                  <th className="px-6 py-3">Next Due</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {sortedBills.map(bill => {
                  const dueDate = new Date(bill.next_due_date)
                  const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                  return (
                    <tr key={bill.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <span className="text-sm font-medium">{bill.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-muted-foreground">
                        {getCategoryName(bill.category_id)}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="capitalize">{bill.frequency}</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <span>{dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                          <span className={`ml-2 text-xs ${daysUntil <= 3 ? 'text-warning' : 'text-muted-foreground'}`}>
                            ({daysUntil === 0 ? 'Today' : `${daysUntil}d`})
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {bill.is_autopay ? (
                          <Badge variant="success" className="gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Autopay
                          </Badge>
                        ) : (
                          <Badge variant="warning" className="gap-1">
                            <AlertCircle className="h-3 w-3" /> Manual
                          </Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-semibold">
                        {formatCurrency(bill.amount)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Annual Cost */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold">Estimated Annual Cost</p>
              <p className="text-sm text-muted-foreground">Based on current recurring bills</p>
            </div>
            <p className="text-3xl font-bold text-primary">{formatCurrency(totalMonthly * 12)}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
