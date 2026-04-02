import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/utils'
import { mockTransactions, mockCategories, mockAccounts } from '@/lib/mock-data'
import {
  Search,
  Filter,
  ArrowUpDown,
  TrendingUp,
  TrendingDown,
  Download,
} from 'lucide-react'

type SortField = 'date' | 'amount' | 'description'
type SortDir = 'asc' | 'desc'

export function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'income' | 'expense'>('all')
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const filtered = useMemo(() => {
    let txs = [...mockTransactions]

    if (search) {
      const q = search.toLowerCase()
      txs = txs.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.merchant?.toLowerCase().includes(q)
      )
    }

    if (typeFilter !== 'all') {
      txs = txs.filter(t => t.type === typeFilter)
    }

    txs.sort((a, b) => {
      let cmp = 0
      if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime()
      else if (sortField === 'amount') cmp = a.amount - b.amount
      else cmp = a.description.localeCompare(b.description)
      return sortDir === 'desc' ? -cmp : cmp
    })

    return txs
  }, [search, typeFilter, sortField, sortDir])

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDir('desc') }
  }

  const getCategoryName = (id?: string) => mockCategories.find(c => c.id === id)?.name || 'Uncategorized'
  const getCategoryColor = (id?: string) => mockCategories.find(c => c.id === id)?.color || '#71717a'
  const getAccountName = (id: string) => mockAccounts.find(a => a.id === id)?.name || 'Unknown'

  const totalIncome = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const totalExpenses = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">{filtered.length} transactions found</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Income</p>
              <p className="text-xl font-bold text-success">{formatCurrency(totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Expenses</p>
              <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ArrowUpDown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net</p>
              <p className={`text-xl font-bold ${totalIncome - totalExpenses >= 0 ? 'text-success' : 'text-destructive'}`}>
                {formatCurrency(totalIncome - totalExpenses)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-1">
            {(['all', 'income', 'expense'] as const).map(t => (
              <Button
                key={t}
                variant={typeFilter === t ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTypeFilter(t)}
                className="capitalize"
              >
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                {t}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">All Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="cursor-pointer px-6 py-3 hover:text-foreground" onClick={() => toggleSort('date')}>
                    Date {sortField === 'date' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="cursor-pointer px-6 py-3 hover:text-foreground" onClick={() => toggleSort('description')}>
                    Description {sortField === 'description' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Account</th>
                  <th className="cursor-pointer px-6 py-3 text-right hover:text-foreground" onClick={() => toggleSort('amount')}>
                    Amount {sortField === 'amount' && (sortDir === 'desc' ? '↓' : '↑')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(tx => (
                  <tr key={tx.id} className="border-b border-border/50 transition-colors hover:bg-secondary/30">
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-medium">{tx.description}</p>
                        <p className="text-xs text-muted-foreground">{tx.merchant}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="outline" className="gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getCategoryColor(tx.category_id) }} />
                        {getCategoryName(tx.category_id)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground">{getAccountName(tx.account_id)}</td>
                    <td className={`px-6 py-4 text-right text-sm font-semibold ${tx.type === 'income' ? 'text-success' : ''}`}>
                      {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
