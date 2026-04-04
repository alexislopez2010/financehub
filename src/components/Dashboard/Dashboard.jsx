import { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Filter, ChevronDown, X, Calendar, Users, Wallet, BarChart3, PieChart as PieIcon, LayoutDashboard, LogOut, RefreshCw, Building2, Target, Search, Download, List, Banknote } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useFinanceData } from '../../hooks/useFinanceData.js'
import AccountsPage from '../Accounts/AccountsPage.jsx'

const COLORS = ['#2563eb','#059669','#d97706','#dc2626','#7c3aed','#db2777','#0891b2','#65a30d','#ea580c','#6366f1','#14b8a6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316']
const ACCENT = { blue: '#2563eb', green: '#059669', red: '#dc2626', amber: '#d97706', purple: '#7c3aed', slate: '#475569' }

const fmt = (n) => n < 0 ? `($${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})})` : `$${n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`
const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : fmt(n)
const pct = (n) => `${(n*100).toFixed(1)}%`
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const KPICard = ({ title, value, subtitle, icon: Icon, color, trend, trendLabel }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 flex flex-col gap-1 shadow-sm">
    <div className="flex items-center justify-between">
      <span className="text-[10px] md:text-xs font-semibold uppercase tracking-wider text-gray-400">{title}</span>
      <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
        <Icon size={16} style={{ color }} />
      </div>
    </div>
    <div className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{value}</div>
    <div className="flex items-center gap-1.5 mt-0.5">
      {trend !== undefined && !isNaN(trend) && isFinite(trend) && (
        <span className={`flex items-center text-xs font-semibold ${trend >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
          {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
          {pct(Math.abs(trend))}
        </span>
      )}
      {(subtitle || trendLabel) && <span className="text-[11px] text-gray-400">{trendLabel || subtitle}</span>}
    </div>
  </div>
)

const Pill = ({ label, active, onClick }) => (
  <button onClick={onClick} className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}>{label}</button>
)

const MultiSelect = ({ label, options, selected, onChange, icon: Icon }) => {
  const [open, setOpen] = useState(false)
  const allSelected = options.length > 0 && selected.length === options.length
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 hover:border-blue-300">
        {Icon && <Icon size={14} className="text-gray-400" />}
        <span>{label}</span>
        <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{allSelected ? 'All' : selected.length}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-56 max-h-64 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <button onClick={() => onChange(allSelected ? [] : [...options])} className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 border-b border-gray-100">
              {allSelected ? 'Deselect All' : 'Select All'}
            </button>
            {options.map(o => (
              <label key={o || '(blank)'} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(o)} onChange={() => onChange(selected.includes(o) ? selected.filter(x=>x!==o) : [...selected,o])} className="rounded border-gray-300 text-blue-600" />
                <span className="truncate">{o || '(unassigned)'}</span>
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{backgroundColor:p.color}}/>{p.name}: {fmt(p.value)}</p>
      ))}
    </div>
  )
}

function TransactionsTab({ rows, fmt, MONTH_NAMES }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const pageSize = 50

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows
    if (typeFilter !== 'all') out = out.filter(t => t.type === typeFilter)
    if (q) {
      out = out.filter(t =>
        (t.description || '').toLowerCase().includes(q) ||
        (t.category || '').toLowerCase().includes(q) ||
        (t.sub_category || '').toLowerCase().includes(q) ||
        (t.account || '').toLowerCase().includes(q) ||
        (t.member || '').toLowerCase().includes(q)
      )
    }
    const mult = sort.dir === 'asc' ? 1 : -1
    out = [...out].sort((a, b) => {
      const av = a[sort.col] ?? ''
      const bv = b[sort.col] ?? ''
      if (sort.col === 'amount') return (Number(av) - Number(bv)) * mult
      return String(av).localeCompare(String(bv)) * mult
    })
    return out
  }, [rows, search, typeFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, typeFilter, rows])

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' })
  const sortIcon = (col) => sort.col !== col ? null : <span className="text-[9px] ml-0.5">{sort.dir === 'asc' ? '▲' : '▼'}</span>

  const exportCsv = () => {
    const cols = ['date','description','type','category','sub_category','amount','account','member','notes']
    const escape = (v) => {
      if (v == null) return ''
      const s = String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [cols.join(',')]
    filtered.forEach(t => lines.push(cols.map(c => escape(t[c])).join(',')))
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions_${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const typeColor = (t) => t === 'Income' ? 'bg-emerald-100 text-emerald-700' : t === 'Refund' ? 'bg-blue-100 text-blue-700' : t === 'Transfer' ? 'bg-slate-100 text-slate-700' : 'bg-red-100 text-red-700'
  const amountColor = (t) => t === 'Income' || t === 'Refund' ? 'text-emerald-700' : t === 'Transfer' ? 'text-slate-600' : 'text-gray-900'
  const amountSign = (t) => t === 'Income' || t === 'Refund' ? '+' : t === 'Transfer' ? '' : '−'

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search description, category, account, member…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
          >
            <option value="all">All types</option>
            <option value="Expense">Expense</option>
            <option value="Income">Income</option>
            <option value="Refund">Refund</option>
            <option value="Transfer">Transfer</option>
          </select>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{filtered.length.toLocaleString()} {filtered.length === 1 ? 'row' : 'rows'}</span>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50" title="Export filtered rows to CSV">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('date')}>Date{sortIcon('date')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('description')}>Description{sortIcon('description')}</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('category')}>Category{sortIcon('category')}</th>
              <th className="px-3 py-2 text-left">Sub</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:text-gray-900" onClick={() => toggleSort('amount')}>Amount{sortIcon('amount')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('account')}>Account{sortIcon('account')}</th>
              <th className="px-3 py-2 text-left">Member</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">No transactions match.</td></tr>
            ) : pageRows.map((t) => (
              <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600 tabular-nums whitespace-nowrap">{t.date}</td>
                <td className="px-3 py-2 text-gray-900 max-w-[320px] truncate" title={t.description}>{t.description}</td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor(t.type)}`}>{t.type || ''}</span></td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{t.category || '—'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{t.sub_category || ''}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${amountColor(t.type)} whitespace-nowrap`}>{amountSign(t.type)}{fmt(Number(t.amount) || 0).replace('-','')}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{t.account || ''}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{t.member || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 text-xs text-gray-600">
          <span>Page {currentPage} of {totalPages} · {pageSize} per page</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(1)} disabled={currentPage === 1} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">« First</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">‹ Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Next ›</button>
            <button onClick={() => setPage(totalPages)} disabled={currentPage === totalPages} className="px-2 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50">Last »</button>
          </div>
        </div>
      )}
    </div>
  )
}

function BillsDetail({ bills, transactions, thisYear, fmt }) {
  const [sort, setSort] = useState({ col: 'due_day', dir: 'asc' })

  const toNum = (n) => Number(n) || 0
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  const curMonth = today.getMonth() + 1 // 1-12
  const curYear = today.getFullYear()

  // Monthly-equivalent for each bill
  const monthlyEquiv = (b) => {
    const amt = toNum(b.budget_amount)
    const f = (b.frequency || '').toLowerCase()
    if (f === 'biweekly') return amt * 26 / 12
    if (f === 'weekly') return amt * 52 / 12
    if (f === 'annual' || f === 'yearly') return amt / 12
    if (f === 'quarterly') return amt / 3
    return amt // Monthly or unspecified
  }

  // Next due date based on due_day + frequency (monthly cadence approximation)
  const nextDue = (b) => {
    if (!b.due_day) return null
    const day = Math.min(28, Math.max(1, b.due_day))
    const f = (b.frequency || '').toLowerCase()
    if (f === 'annual' || f === 'yearly') {
      // Unknown month — show day of current month as anchor
      const d = new Date(curYear, curMonth - 1, day)
      if (d < today) d.setFullYear(curYear + 1)
      return d
    }
    // Monthly/Biweekly/Weekly/Quarterly: approximate via monthly anchor
    const d = new Date(curYear, curMonth - 1, day)
    if (d < today) d.setMonth(d.getMonth() + 1)
    return d
  }

  // Last paid date from transactions matching category within last 90 days
  const ninetyDaysAgo = new Date(today)
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
  const ninetyIso = ninetyDaysAgo.toISOString().slice(0, 10)
  const byCategory = useMemo(() => {
    const m = {}
    transactions.forEach(t => {
      if (t.type !== 'Expense' || !t.category || !t.date) return
      if (t.date < ninetyIso) return
      if (!m[t.category]) m[t.category] = []
      m[t.category].push(t)
    })
    Object.values(m).forEach(arr => arr.sort((a, b) => b.date.localeCompare(a.date)))
    return m
  }, [transactions, ninetyIso])

  // This-month actual per category
  const thisMonthActual = useMemo(() => {
    const mm = String(curMonth).padStart(2, '0')
    const prefix = `${curYear}-${mm}`
    const m = {}
    transactions.forEach(t => {
      if (t.type !== 'Expense' || !t.category || !t.date?.startsWith(prefix)) return
      m[t.category] = (m[t.category] || 0) + toNum(t.amount)
    })
    return m
  }, [transactions, curMonth, curYear])

  const rows = useMemo(() => bills.filter(b => b.is_active).map(b => {
    const monthly = monthlyEquiv(b)
    const due = nextDue(b)
    const daysUntil = due ? Math.round((due - today) / 86400000) : null
    const catTxns = byCategory[b.category] || []
    const lastTxn = catTxns[0]
    const actualThisMonth = thisMonthActual[b.category] || 0
    const pctUsed = monthly > 0 ? actualThisMonth / monthly : 0
    return {
      id: b.id,
      name: b.name,
      category: b.category,
      account: b.account,
      frequency: b.frequency,
      due_day: b.due_day,
      budget_amount: toNum(b.budget_amount),
      monthly,
      nextDueDate: due,
      daysUntil,
      lastPaidDate: lastTxn?.date || null,
      lastPaidAmount: lastTxn ? toNum(lastTxn.amount) : null,
      actualThisMonth,
      pctUsed,
    }
  }), [bills, byCategory, thisMonthActual])

  const sorted = useMemo(() => {
    const mult = sort.dir === 'asc' ? 1 : -1
    const out = [...rows].sort((a, b) => {
      const av = a[sort.col]
      const bv = b[sort.col]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mult
      if (av instanceof Date && bv instanceof Date) return (av - bv) * mult
      return String(av).localeCompare(String(bv)) * mult
    })
    return out
  }, [rows, sort])

  const toggleSort = (col) => setSort(s => s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' })
  const sortIcon = (col) => sort.col !== col ? null : <span className="text-[9px] ml-0.5">{sort.dir === 'asc' ? '▲' : '▼'}</span>

  const monthlyTotal = rows.reduce((s, r) => s + r.monthly, 0)
  const thisMonthTotal = rows.reduce((s, r) => s + r.actualThisMonth, 0)
  const upcoming7 = rows.filter(r => r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= 7).length

  const pctColor = (p) => {
    if (p === 0) return { bar: '#e5e7eb', text: 'text-gray-400' }
    if (p > 1) return { bar: '#dc2626', text: 'text-red-600' }
    if (p >= 0.9) return { bar: '#d97706', text: 'text-amber-600' }
    return { bar: '#059669', text: 'text-emerald-600' }
  }

  const fmtDate = (d) => d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'
  const relDays = (n) => {
    if (n === null) return ''
    if (n === 0) return 'today'
    if (n === 1) return 'tomorrow'
    if (n < 0) return `${Math.abs(n)}d ago`
    return `in ${n}d`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-gray-700">Recurring Bills — Detail</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{rows.length} active</span>
          <span className="text-gray-400">·</span>
          <span>Monthly budget: <span className="font-semibold text-gray-900">{fmt(Math.round(monthlyTotal))}</span></span>
          <span className="text-gray-400">·</span>
          <span>This month: <span className="font-semibold text-gray-900">{fmt(Math.round(thisMonthTotal))}</span></span>
          {upcoming7 > 0 && (
            <>
              <span className="text-gray-400">·</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">{upcoming7} due in 7 days</span>
            </>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('name')}>Bill{sortIcon('name')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('category')}>Category{sortIcon('category')}</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('frequency')}>Freq{sortIcon('frequency')}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:text-gray-900" onClick={() => toggleSort('monthly')}>Monthly{sortIcon('monthly')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('nextDueDate')}>Next Due{sortIcon('nextDueDate')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('lastPaidDate')}>Last Paid{sortIcon('lastPaidDate')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('pctUsed')}>% Used (this mo){sortIcon('pctUsed')}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-500">No active bills.</td></tr>
            ) : sorted.map(r => {
              const { bar, text } = pctColor(r.pctUsed)
              const width = Math.min(r.pctUsed * 100, 150)
              const urgent = r.daysUntil !== null && r.daysUntil >= 0 && r.daysUntil <= 3
              return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900 font-medium max-w-[220px] truncate" title={r.name}>{r.name}</td>
                  <td className="px-3 py-2 text-gray-600 text-xs whitespace-nowrap">{r.category || '—'}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.account || ''}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{r.frequency || '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900 whitespace-nowrap">{fmt(Math.round(r.monthly))}</td>
                  <td className={`px-3 py-2 whitespace-nowrap text-xs ${urgent ? 'text-amber-700 font-semibold' : 'text-gray-600'}`}>
                    {fmtDate(r.nextDueDate)} <span className="text-gray-400">· {relDays(r.daysUntil)}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                    {r.lastPaidDate ? (
                      <>
                        {r.lastPaidDate} {r.lastPaidAmount != null && <span className="text-gray-400">· {fmt(Math.round(r.lastPaidAmount))}</span>}
                      </>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-2 min-w-[140px]">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[60px] overflow-hidden">
                        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(width, 100)}%`, backgroundColor: bar }} />
                      </div>
                      <span className={`text-xs ${text} tabular-nums w-10 text-right`}>{r.monthly > 0 ? `${Math.round(r.pctUsed * 100)}%` : '—'}</span>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DebtTracker({ debts, fmt }) {
  const [strategy, setStrategy] = useState('avalanche') // 'snowball' | 'avalanche'
  const [extra, setExtra] = useState(0)

  const active = useMemo(() => (debts || []).filter(d => d.is_active !== false).map(d => ({
    id: d.id,
    name: d.name,
    type: d.type || '',
    balance: Number(d.balance) || 0,
    apr: Number(d.apr) || 0,
    minPayment: Number(d.min_payment) || 0,
  })), [debts])

  const totalBalance = active.reduce((s, d) => s + d.balance, 0)
  const totalMin = active.reduce((s, d) => s + d.minPayment, 0)
  const weightedApr = totalBalance > 0 ? active.reduce((s, d) => s + d.apr * d.balance, 0) / totalBalance : 0

  // Simulate a payoff plan given an ordering function and monthly extra.
  // Budget model: total monthly payment = sum(original min_payments) + extra.
  // Each month, pay interest + min on every debt; route any leftover (including
  // freed min payments from paid-off debts) to the top-priority debt.
  const simulate = (ordering, monthlyExtra) => {
    const MAX_MONTHS = 600 // 50 years cap
    const bals = active.map(d => ({ ...d, paidMonth: null, interestPaid: 0 }))
    if (bals.length === 0) return { months: 0, totalInterest: 0, schedule: [], capped: false }
    const originalMinTotal = bals.reduce((s, b) => s + b.minPayment, 0)
    const monthlyBudget = originalMinTotal + (Number(monthlyExtra) || 0)
    let month = 0
    let totalInterest = 0
    while (bals.some(b => b.balance > 0.01) && month < MAX_MONTHS) {
      month++
      // 1) accrue interest
      bals.forEach(b => {
        if (b.balance > 0.01) {
          const interest = b.balance * (b.apr / 100 / 12)
          b.balance += interest
          b.interestPaid += interest
          totalInterest += interest
        }
      })
      // 2) pay the min on each non-zero debt (bounded by balance)
      let spent = 0
      bals.forEach(b => {
        if (b.balance <= 0.01) return
        const pay = Math.min(b.minPayment, b.balance)
        b.balance -= pay
        spent += pay
        if (b.balance <= 0.01 && b.paidMonth === null) b.paidMonth = month
      })
      // 3) route the leftover budget to the highest-priority remaining debt(s)
      let pool = Math.max(0, monthlyBudget - spent)
      const order = ordering(bals.filter(b => b.balance > 0.01))
      for (const target of order) {
        if (pool <= 0.01) break
        const pay = Math.min(pool, target.balance)
        target.balance -= pay
        pool -= pay
        if (target.balance <= 0.01 && target.paidMonth === null) target.paidMonth = month
      }
      // Safety: if min payments cannot cover interest and no extra, break
      if (monthlyExtra === 0 && month > 12) {
        const stuck = bals.every(b => b.balance <= 0.01 || b.minPayment <= b.balance * (b.apr / 100 / 12) + 0.01)
        if (stuck) break
      }
    }
    const capped = bals.some(b => b.balance > 0.01)
    return { months: month, totalInterest, schedule: bals, capped }
  }

  const snowballOrder = (list) => [...list].sort((a, b) => a.balance - b.balance)
  const avalancheOrder = (list) => [...list].sort((a, b) => b.apr - a.apr)
  const orderFn = strategy === 'snowball' ? snowballOrder : avalancheOrder

  const plan = useMemo(() => simulate(orderFn, Number(extra) || 0), [active, strategy, extra])
  const planMinOnly = useMemo(() => simulate(orderFn, 0), [active, strategy])

  const monthsToYears = (m) => {
    if (m <= 0) return '0 mo'
    const y = Math.floor(m / 12), r = m % 12
    return y > 0 ? `${y}y ${r}m` : `${r} mo`
  }
  const debtFreeDate = plan.months > 0 && !plan.capped
    ? new Date(new Date().setMonth(new Date().getMonth() + plan.months)).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : plan.capped ? '30+ years' : '—'
  const interestSaved = Math.max(0, planMinOnly.totalInterest - plan.totalInterest)

  // Table: ordered by current strategy, with simulated payoff month
  const tableRows = useMemo(() => {
    const map = Object.fromEntries(plan.schedule.map(s => [s.id, s]))
    return orderFn(active.map(d => ({ ...d }))).map((d, i) => {
      const sim = map[d.id] || {}
      return { ...d, order: i + 1, paidMonth: sim.paidMonth, interestPaid: sim.interestPaid || 0 }
    })
  }, [active, strategy, plan])

  if (active.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
        <p className="text-sm text-gray-500">No debts tracked yet. Add rows to the <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">debts</code> table.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KPICard title="Total Balance" value={fmt(totalBalance)} icon={Banknote} color={ACCENT.red} subtitle={`${active.length} debt${active.length===1?'':'s'}`} />
        <KPICard title="Weighted APR" value={`${weightedApr.toFixed(2)}%`} icon={TrendingDown} color={ACCENT.amber} subtitle="blended rate" />
        <KPICard title="Min Monthly" value={fmt(totalMin)} icon={Wallet} color={ACCENT.slate} subtitle="required /mo" />
        <KPICard title="Debt-Free Date" value={debtFreeDate} icon={Target} color={ACCENT.green} subtitle={plan.capped ? '(capped)' : monthsToYears(plan.months)} />
      </div>

      {/* Strategy controls */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Strategy</div>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setStrategy('avalanche')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${strategy==='avalanche' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                title="Pay highest-APR debt first (saves the most interest)"
              >Avalanche</button>
              <button
                onClick={() => setStrategy('snowball')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${strategy==='snowball' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                title="Pay smallest-balance debt first (psychological wins)"
              >Snowball</button>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Extra Payment / Month</div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="50"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  className="w-28 pl-6 pr-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>
              {[100, 250, 500, 1000].map(v => (
                <button key={v} onClick={() => setExtra(v)} className="px-2 py-1 text-xs text-gray-600 border border-gray-200 rounded hover:bg-gray-50">+${v}</button>
              ))}
            </div>
          </div>
          <div className="flex-1" />
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-400 uppercase tracking-wider font-semibold text-[10px]">Total Interest (plan)</div>
              <div className="text-sm font-semibold text-gray-900 tabular-nums">{fmt(Math.round(plan.totalInterest))}</div>
            </div>
            <div>
              <div className="text-gray-400 uppercase tracking-wider font-semibold text-[10px]">Saved vs Min-Only</div>
              <div className={`text-sm font-semibold tabular-nums ${interestSaved > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>{fmt(Math.round(interestSaved))}</div>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">
          {strategy === 'avalanche'
            ? 'Avalanche: extra payments attack the highest-APR debt first. Mathematically optimal.'
            : 'Snowball: extra payments attack the smallest-balance debt first. Faster psychological wins.'}
        </p>
      </div>

      {/* Debt table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Payoff Order — {strategy === 'avalanche' ? 'Avalanche' : 'Snowball'}</h3>
          <span className="text-xs text-gray-400">{Number(extra) > 0 ? `with $${Number(extra).toLocaleString()}/mo extra` : 'minimum payments only'}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left w-10">#</th>
                <th className="px-3 py-2 text-left">Debt</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Balance</th>
                <th className="px-3 py-2 text-right">APR</th>
                <th className="px-3 py-2 text-right">Min / mo</th>
                <th className="px-3 py-2 text-right">Payoff</th>
                <th className="px-3 py-2 text-right">Interest</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-400 tabular-nums">{r.order}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium">{r.name}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{r.type}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(Math.round(r.balance))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{r.apr.toFixed(2)}%</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{fmt(Math.round(r.minPayment))}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700">{r.paidMonth ? monthsToYears(r.paidMonth) : <span className="text-red-500">30+ yrs</span>}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-amber-600">{fmt(Math.round(r.interestPaid))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BudgetTab({ data, period, fmt }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (cat) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  const statusColor = (budget, actual) => {
    if (budget === 0 && actual === 0) return { bar: '#e5e7eb', text: 'text-gray-400' }
    if (budget === 0) return { bar: '#dc2626', text: 'text-red-600' }           // spent with no budget
    const used = actual / budget
    if (used > 1) return { bar: '#dc2626', text: 'text-red-600' }               // over budget
    if (used >= 0.9) return { bar: '#d97706', text: 'text-amber-600' }          // 90-100%
    if (used >= 0.7) return { bar: '#ca8a04', text: 'text-yellow-600' }         // 70-90%
    return { bar: '#059669', text: 'text-emerald-600' }                         // under 70%
  }
  const Row = ({ label, budget, actual, variance, depth=0, isParent=false, onClick, expandedNow, canExpand }) => {
    const { bar, text } = statusColor(budget, actual)
    const pctUsed = budget > 0 ? Math.min((actual / budget) * 100, 150) : 0
    return (
      <div
        onClick={canExpand ? onClick : undefined}
        className={`grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 border-b border-gray-100 text-sm ${isParent ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700'} ${canExpand ? 'cursor-pointer hover:bg-gray-100' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {canExpand && <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${expandedNow ? '' : '-rotate-90'}`} />}
          <span className="truncate">{label}</span>
        </div>
        <div className="text-right tabular-nums">{fmt(budget)}</div>
        <div className="text-right tabular-nums">{fmt(actual)}</div>
        <div className={`text-right tabular-nums font-medium ${text}`}>{fmt(variance)}</div>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[40px] overflow-hidden">
            <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pctUsed, 100)}%`, backgroundColor: bar }} />
          </div>
          <span className={`text-xs ${text} tabular-nums w-12 text-right`}>{budget > 0 ? `${Math.round(pctUsed)}%` : '—'}</span>
        </div>
      </div>
    )
  }
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const periodLabel = period === 'ytd' ? `YTD (${data.monthCount} mo)` : MONTH_LABELS[parseInt(period,10)-1]
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">Budget vs Actual — {periodLabel}</h3>
        <div className="text-xs text-gray-500">Click a category to expand sub-categories</div>
      </div>
      <div className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-gray-100 text-[10px] font-semibold uppercase tracking-wider text-gray-500 border-b border-gray-200">
        <div>Category</div>
        <div className="text-right">Budget</div>
        <div className="text-right">Actual</div>
        <div className="text-right">Variance</div>
        <div>% Used</div>
      </div>
      {data.parents.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-gray-500">No budget data for this period.</div>
      ) : (
        <>
          {data.parents.map(p => (
            <div key={p.category}>
              <Row
                label={p.category}
                budget={p.budget}
                actual={p.actual}
                variance={p.variance}
                isParent
                canExpand={p.subs.length > 0}
                expandedNow={expanded[p.category]}
                onClick={() => toggle(p.category)}
              />
              {expanded[p.category] && p.subs.map(s => (
                <Row
                  key={`${p.category}|${s.sub_category}`}
                  label={s.sub_category || '(no sub-category)'}
                  budget={s.budget}
                  actual={s.actual}
                  variance={s.variance}
                  depth={1}
                />
              ))}
            </div>
          ))}
          <div className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-3 bg-gray-100 text-sm font-bold text-gray-900 border-t-2 border-gray-300">
            <div className="pl-3">Total</div>
            <div className="text-right tabular-nums">{fmt(data.totals.budget)}</div>
            <div className="text-right tabular-nums">{fmt(data.totals.actual)}</div>
            <div className={`text-right tabular-nums ${data.totals.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(data.totals.variance)}</div>
            <div className="text-xs text-gray-500">{data.totals.budget > 0 ? `${Math.round((data.totals.actual / data.totals.budget) * 100)}% used` : '—'}</div>
          </div>
        </>
      )}
    </div>
  )
}

export default function Dashboard({ user }) {
  const { transactions, bills, budgets, debts, loading, error, reload } = useFinanceData()
  const [period, setPeriod] = useState('ytd')
  const [selectedAccounts, setSelectedAccounts] = useState(null)
  const [selectedMembers, setSelectedMembers] = useState(null)
  const [selectedCats, setSelectedCats] = useState([])
  const [activeTab, setActiveTab] = useState('overview')

  const thisYear = new Date().getFullYear()

  // Derived option lists
  const allAccounts = useMemo(() => [...new Set(transactions.map(t => t.account || ''))].sort(), [transactions])
  const allMembers = useMemo(() => [...new Set(transactions.map(t => t.member || ''))].sort(), [transactions])
  const allUsedCats = useMemo(() => [...new Set(transactions.filter(t => t.type === 'Expense').map(t => t.category || ''))].sort(), [transactions])
  const availableMonths = useMemo(() => {
    const set = new Set()
    transactions.forEach(t => {
      if (t.date && t.date.startsWith(String(thisYear))) set.add(t.date.substring(5,7))
    })
    return [...set].sort()
  }, [transactions, thisYear])

  // Initialize account/member filters to "all" once data loads
  const accounts = selectedAccounts ?? allAccounts
  const members = selectedMembers ?? allMembers

  // Filter transactions
  const filtered = useMemo(() => {
    let txns = transactions.filter(t => t.date && t.date.startsWith(String(thisYear)))
    txns = txns.filter(t => accounts.includes(t.account || ''))
    txns = txns.filter(t => members.includes(t.member || ''))
    if (period !== 'ytd') {
      txns = txns.filter(t => t.date.substring(5,7) === period)
    }
    if (selectedCats.length > 0) txns = txns.filter(t => selectedCats.includes(t.category || ''))
    return txns
  }, [transactions, period, accounts, members, selectedCats, thisYear])

  const toNum = (a) => Number(a) || 0
  const expenses = useMemo(() => filtered.filter(t => t.type === 'Expense'), [filtered])
  const income = useMemo(() => filtered.filter(t => t.type === 'Income'), [filtered])
  const refunds = useMemo(() => filtered.filter(t => t.type === 'Refund'), [filtered])

  const totalExpense = expenses.reduce((s,t) => s + toNum(t.amount), 0)
  const totalIncome = income.reduce((s,t) => s + toNum(t.amount), 0)
  const totalRefund = refunds.reduce((s,t) => s + toNum(t.amount), 0)
  const netCashflow = totalIncome - totalExpense + totalRefund
  const savingsRate = totalIncome > 0 ? netCashflow / totalIncome : 0

  // Monthly data
  const monthlyData = useMemo(() => {
    const months = period !== 'ytd' ? [period] : availableMonths
    return months.map(m => {
      const mTxns = filtered.filter(t => t.date.substring(5,7) === m)
      const inc = mTxns.filter(t=>t.type==='Income').reduce((s,t)=>s+toNum(t.amount),0)
      const exp = mTxns.filter(t=>t.type==='Expense').reduce((s,t)=>s+toNum(t.amount),0)
      const ref = mTxns.filter(t=>t.type==='Refund').reduce((s,t)=>s+toNum(t.amount),0)
      return { month: MONTH_NAMES[parseInt(m,10)-1], income: Math.round(inc), expenses: Math.round(exp), refunds: Math.round(ref), net: Math.round(inc-exp+ref) }
    })
  }, [filtered, period, availableMonths])

  // Category breakdown
  const categoryData = useMemo(() => {
    const map = {}
    expenses.forEach(t => { const k = t.category || '(uncategorized)'; map[k] = (map[k]||0) + toNum(t.amount) })
    return Object.entries(map).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value: Math.round(value) }))
  }, [expenses])

  // Account breakdown
  const accountData = useMemo(() => {
    const map = {}
    expenses.forEach(t => { const k = t.account || '(none)'; map[k] = (map[k]||0) + toNum(t.amount) })
    return Object.entries(map).sort((a,b) => b[1]-a[1]).map(([name,value]) => ({ name, value: Math.round(value) }))
  }, [expenses])

  // Member breakdown
  const memberData = useMemo(() => {
    const map = {}
    expenses.forEach(t => { const k = t.member || 'Household'; map[k] = (map[k]||0) + toNum(t.amount) })
    return Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([name,value]) => ({ name, value: Math.round(value) }))
  }, [expenses])

  // Daily trend
  const dailyTrend = useMemo(() => {
    const map = {}
    expenses.forEach(t => { map[t.date] = (map[t.date]||0) + toNum(t.amount) })
    return Object.entries(map).sort((a,b) => a[0].localeCompare(b[0])).map(([date,amount]) => {
      const [, mm, dd] = date.split('-')
      return { date: `${MONTH_NAMES[parseInt(mm,10)-1]} ${parseInt(dd,10)}`, amount: Math.round(amount) }
    })
  }, [expenses])

  // Top merchants
  const topMerchants = useMemo(() => {
    const map = {}
    expenses.forEach(t => {
      const key = (t.description || '').split(/\s+(#|:)/)[0].substring(0,30) || '(blank)'
      map[key] = (map[key]||0) + toNum(t.amount)
    })
    return Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,10).map(([name,value]) => ({ name, value: Math.round(value) }))
  }, [expenses])

  // Previous-month trend (for KPI deltas)
  const { incomeTrend, expenseTrend } = useMemo(() => {
    if (availableMonths.length < 2) return { incomeTrend: undefined, expenseTrend: undefined }
    const last = availableMonths[availableMonths.length-1]
    const prev = availableMonths[availableMonths.length-2]
    const sum = (month, type) => transactions
      .filter(t => t.type === type && t.date && t.date.startsWith(`${thisYear}-${month}`))
      .reduce((s,t)=>s+toNum(t.amount),0)
    const prevInc = sum(prev,'Income'), lastInc = sum(last,'Income')
    const prevExp = sum(prev,'Expense'), lastExp = sum(last,'Expense')
    return {
      incomeTrend: prevInc > 0 ? (lastInc-prevInc)/prevInc : undefined,
      expenseTrend: prevExp > 0 ? (lastExp-prevExp)/prevExp : undefined,
    }
  }, [transactions, availableMonths, thisYear])

  // Quick Stats — days covered, avg spend/day, avg income/month, top category, recurring bills
  const quickStats = useMemo(() => {
    const months = period !== 'ytd' ? [period] : availableMonths
    // Days covered in the filtered window
    const dates = filtered.map(t => t.date).filter(Boolean).sort()
    let daysCovered = 30
    if (dates.length > 0) {
      const first = new Date(dates[0])
      const last = new Date(dates[dates.length - 1])
      daysCovered = Math.max(1, Math.round((last - first) / 86400000) + 1)
    }
    const monthCount = Math.max(1, months.length)
    const activeBills = bills.filter(b => b.is_active)
    const billsMonthly = activeBills.reduce((s, b) => s + toNum(b.budget_amount), 0)
    return {
      txnCount: filtered.length,
      daysCovered,
      avgDailySpend: totalExpense / daysCovered,
      topCategory: categoryData[0] || null,
      refundAmount: totalRefund,
      refundCount: refunds.length,
      billsMonthly,
      billsCount: activeBills.length,
      avgMonthlyIncome: totalIncome / monthCount,
    }
  }, [filtered, period, availableMonths, bills, totalExpense, totalIncome, totalRefund, refunds, categoryData])

  // Budget vs Actual — group budgets + expenses by (category, sub_category),
  // aggregate across selected period, roll up to parents.
  const budgetVsActual = useMemo(() => {
    const months = period !== 'ytd' ? [parseInt(period, 10)] : availableMonths.map(m => parseInt(m, 10))
    const monthSet = new Set(months)
    // Sum budgets for the selected months (current year only)
    const budgetMap = {} // key "cat|sub" -> amount
    budgets.forEach(b => {
      if (b.year !== thisYear || !monthSet.has(b.month)) return
      const key = `${b.category}|${b.sub_category || ''}`
      budgetMap[key] = (budgetMap[key] || 0) + toNum(b.amount)
    })
    // Sum actuals (Expense + Refund) for the selected months, honoring filters
    const actualMap = {}
    filtered.forEach(t => {
      if (t.type !== 'Expense' && t.type !== 'Refund') return
      const key = `${t.category || 'Uncategorized'}|${t.sub_category || ''}`
      const sign = t.type === 'Refund' ? -1 : 1
      actualMap[key] = (actualMap[key] || 0) + sign * toNum(t.amount)
    })
    // Union of keys
    const allKeys = new Set([...Object.keys(budgetMap), ...Object.keys(actualMap)])
    const subRows = [...allKeys].map(k => {
      const [cat, sub] = k.split('|')
      const budget = Math.round(budgetMap[k] || 0)
      const actual = Math.round(actualMap[k] || 0)
      return { category: cat, sub_category: sub, budget, actual, variance: budget - actual }
    })
    // Roll up to parents
    const parentMap = {}
    subRows.forEach(r => {
      if (!parentMap[r.category]) parentMap[r.category] = { category: r.category, budget: 0, actual: 0, subs: [] }
      parentMap[r.category].budget += r.budget
      parentMap[r.category].actual += r.actual
      parentMap[r.category].subs.push(r)
    })
    const parents = Object.values(parentMap).map(p => ({
      ...p,
      variance: p.budget - p.actual,
      subs: p.subs.sort((a,b) => b.actual - a.actual),
    })).sort((a,b) => b.actual - a.actual)
    const totals = parents.reduce((acc,p) => ({ budget: acc.budget+p.budget, actual: acc.actual+p.actual }), { budget: 0, actual: 0 })
    return { parents, totals: { ...totals, variance: totals.budget - totals.actual }, monthCount: months.length }
  }, [budgets, filtered, period, availableMonths, thisYear])

  // Bills: monthly spend against each bill's budget_amount
  const billsComparison = useMemo(() => {
    const months = period !== 'ytd' ? [period] : availableMonths
    return bills.filter(b => b.is_active).slice(0,15).map(b => {
      const budget = toNum(b.budget_amount) * months.length
      const actual = transactions
        .filter(t => t.type === 'Expense' && t.category === b.category && months.some(m => t.date?.startsWith(`${thisYear}-${m}`)))
        .reduce((s,t) => s+toNum(t.amount), 0)
      return { name: b.name.length > 20 ? b.name.substring(0,20)+'…' : b.name, budget: Math.round(budget), actual: Math.round(actual) }
    })
  }, [bills, transactions, period, availableMonths, thisYear])

  const LABEL_STYLE = { fontSize: 11, fill: '#6b7280' }
  const GRID_STYLE = { strokeDasharray: '3 3', stroke: '#e5e7eb' }

  const signOut = () => supabase.auth.signOut()

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-sm text-gray-500">Loading your finances…</div></div>
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-red-200 p-6 max-w-md">
          <h2 className="text-lg font-semibold text-red-700 mb-2">Unable to load data</h2>
          <p className="text-sm text-gray-600 mb-4">{error}</p>
          <button onClick={reload} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm">Retry</button>
        </div>
      </div>
    )
  }

  const displayName = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 md:py-4">
          <div className="flex items-center justify-between mb-3 md:mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 md:w-10 md:h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <LayoutDashboard size={18} className="text-white" />
              </div>
              <div>
                <h1 className="text-base md:text-xl font-bold text-gray-900">Lopez Family Finance</h1>
                <p className="text-[10px] md:text-xs text-gray-400">{thisYear} • {displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={reload} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" title="Refresh"><RefreshCw size={16} /></button>
              <button onClick={signOut} className="flex items-center gap-1.5 px-2 md:px-3 py-2 text-xs text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg"><LogOut size={14} /><span className="hidden md:inline">Sign out</span></button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-3 overflow-x-auto -mx-1 px-1">
            {[['overview','Overview',LayoutDashboard],['accounts','Accounts',Building2],['transactions','Transactions',List],['spending','Spending',PieIcon],['budget','Budget',Target],['bills','Bills',Wallet],['debt','Debt',Banknote],['trends','Trends',BarChart3]].map(([key,label,Icon]) => (
              <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap ${activeTab===key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                <Icon size={14} />{label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 md:gap-3 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              <Calendar size={14} className="text-gray-400" />
              <span className="text-xs font-medium text-gray-500 mr-1">Period:</span>
              <Pill label="YTD" active={period==='ytd'} onClick={()=>setPeriod('ytd')} />
              {availableMonths.map(m => <Pill key={m} label={MONTH_NAMES[parseInt(m,10)-1]} active={period===m} onClick={()=>setPeriod(m)} />)}
            </div>
            <div className="hidden md:block w-px h-6 bg-gray-200" />
            <MultiSelect label="Accounts" options={allAccounts} selected={accounts} onChange={setSelectedAccounts} icon={CreditCard} />
            <MultiSelect label="Members" options={allMembers} selected={members} onChange={setSelectedMembers} icon={Users} />
            <MultiSelect label="Categories" options={allUsedCats} selected={selectedCats} onChange={setSelectedCats} icon={Filter} />
            {selectedCats.length > 0 && (
              <button onClick={() => setSelectedCats([])} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"><X size={12} />Clear</button>
            )}
          </div>
        </div>
      </div>

      {transactions.length === 0 && activeTab !== 'accounts' ? (
        <div className="max-w-xl mx-auto px-4 md:px-6 py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h2>
            <p className="text-sm text-gray-500">Import your data into Supabase to see your dashboard.</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">

          {activeTab === 'accounts' && <AccountsPage />}

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <KPICard title="Income" value={fmt(totalIncome)} icon={TrendingUp} color={ACCENT.green} trend={incomeTrend} trendLabel="vs prev month" />
                <KPICard title="Expenses" value={fmt(totalExpense)} icon={TrendingDown} color={ACCENT.red} trend={expenseTrend !== undefined ? -expenseTrend : undefined} trendLabel="vs prev month" />
                <KPICard title="Net Cash Flow" value={fmt(netCashflow)} icon={DollarSign} color={netCashflow >= 0 ? ACCENT.green : ACCENT.red} subtitle={netCashflow >= 0 ? 'Positive' : 'Deficit'} />
                <KPICard title="Savings Rate" value={pct(savingsRate)} icon={Wallet} color={ACCENT.purple} subtitle={savingsRate >= 0.2 ? 'On track' : 'Below 20% target'} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Monthly Income vs Expenses</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlyData} barGap={4}>
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis dataKey="month" tick={LABEL_STYLE} />
                      <YAxis tickFormatter={fmtK} tick={LABEL_STYLE} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend wrapperStyle={{fontSize:12}} />
                      <Bar dataKey="income" name="Income" fill={ACCENT.green} radius={[4,4,0,0]} />
                      <Bar dataKey="expenses" name="Expenses" fill={ACCENT.red} radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Spending by Category</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={categoryData.slice(0,10)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({name,percent}) => `${(name||'').substring(0,10)} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:10}}>
                        {categoryData.slice(0,10).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Net Cash Flow by Month</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis dataKey="month" tick={LABEL_STYLE} />
                      <YAxis tickFormatter={fmtK} tick={LABEL_STYLE} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="net" name="Net" stroke={ACCENT.blue} strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Stats</h3>
                  <div className="space-y-0.5">
                    {[
                      ['Transactions', quickStats.txnCount.toString(), `${quickStats.daysCovered} days`],
                      ['Avg Daily Spend', fmt(quickStats.avgDailySpend), '/day'],
                      ['Top Category', quickStats.topCategory ? fmt(quickStats.topCategory.value) : '$0', quickStats.topCategory?.name || ''],
                      ['Total Refunds', fmt(quickStats.refundAmount), `${quickStats.refundCount} items`],
                      ['Recurring Bills', fmt(quickStats.billsMonthly), `${quickStats.billsCount} /mo`],
                      ['Avg Income', fmt(quickStats.avgMonthlyIncome), '/month'],
                    ].map(([label, val, sub], i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                        <span className="text-xs text-gray-500">{label}</span>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-gray-900">{val}</span>
                          {sub && <span className="text-xs text-gray-400 ml-1">{sub}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'spending' && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Categories</h3>
                  <div className="space-y-2">
                    {categoryData.slice(0,15).map((c,i) => {
                      const maxV = categoryData[0]?.value || 1
                      return (
                        <div key={c.name} className="flex items-center gap-3">
                          <div className="w-28 text-xs text-gray-600 truncate">{c.name}</div>
                          <div className="flex-1 bg-gray-100 rounded h-5 relative">
                            <div className="h-5 rounded" style={{ width: `${(c.value/maxV)*100}%`, backgroundColor: COLORS[i%COLORS.length] }} />
                          </div>
                          <div className="w-16 text-xs text-right font-medium">{fmt(c.value)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">By Account</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={accountData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:10}}>
                        {accountData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">Top Merchants</h3>
                  <div className="space-y-2">
                    {topMerchants.map((m,i) => (
                      <div key={m.name+i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700 truncate flex-1 pr-2">{m.name}</span>
                        <span className="font-medium">{fmt(m.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">By Member</h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={memberData} layout="vertical">
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis type="number" tickFormatter={fmtK} tick={LABEL_STYLE} />
                      <YAxis type="category" dataKey="name" tick={LABEL_STYLE} width={100} />
                      <Tooltip formatter={(v) => fmt(v)} />
                      <Bar dataKey="value" fill={ACCENT.blue} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}

          {activeTab === 'transactions' && (
            <TransactionsTab rows={filtered} fmt={fmt} MONTH_NAMES={MONTH_NAMES} />
          )}

          {activeTab === 'budget' && (
            <BudgetTab data={budgetVsActual} period={period} fmt={fmt} />
          )}

          {activeTab === 'bills' && (
            <>
            <BillsDetail bills={bills} transactions={transactions} thisYear={thisYear} fmt={fmt} />
            <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Bills: Budget vs Actual ({period === 'ytd' ? 'YTD' : MONTH_NAMES[parseInt(period,10)-1]})</h3>
              {billsComparison.length === 0 ? (
                <p className="text-sm text-gray-500">No bills configured yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(300, billsComparison.length*35)}>
                  <BarChart data={billsComparison} layout="vertical" margin={{left: 20}}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis type="number" tickFormatter={fmtK} tick={LABEL_STYLE} />
                    <YAxis type="category" dataKey="name" tick={LABEL_STYLE} width={140} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{fontSize:12}} />
                    <Bar dataKey="budget" name="Budget" fill={ACCENT.slate} radius={[0,4,4,0]} />
                    <Bar dataKey="actual" name="Actual" fill={ACCENT.blue} radius={[0,4,4,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            </>
          )}

          {activeTab === 'debt' && (
            <DebtTracker debts={debts} fmt={fmt} />
          )}

          {activeTab === 'trends' && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Daily Spending</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={dailyTrend}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis dataKey="date" tick={LABEL_STYLE} interval="preserveStartEnd" />
                    <YAxis tickFormatter={fmtK} tick={LABEL_STYLE} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="amount" name="Spending" stroke={ACCENT.red} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Savings Rate by Month</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={monthlyData.map(m => ({ month: m.month, rate: m.income > 0 ? Math.round(((m.income - m.expenses + m.refunds)/m.income)*100) : 0 }))}>
                    <CartesianGrid {...GRID_STYLE} />
                    <XAxis dataKey="month" tick={LABEL_STYLE} />
                    <YAxis tickFormatter={(v)=>`${v}%`} tick={LABEL_STYLE} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Bar dataKey="rate" name="Savings %" fill={ACCENT.purple} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

        </div>
      )}
    </div>
  )
}
