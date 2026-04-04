import { useState, useMemo } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Filter, ChevronDown, X, Calendar, Users, Wallet, BarChart3, PieChart as PieIcon, LayoutDashboard, LogOut, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useFinanceData } from '../../hooks/useFinanceData.js'

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

export default function Dashboard({ user }) {
  const { transactions, bills, loading, error, reload } = useFinanceData()
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
            {[['overview','Overview',LayoutDashboard],['spending','Spending',PieIcon],['bills','Bills',Wallet],['trends','Trends',BarChart3]].map(([key,label,Icon]) => (
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

      {transactions.length === 0 ? (
        <div className="max-w-xl mx-auto px-4 md:px-6 py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h2>
            <p className="text-sm text-gray-500">Import your data into Supabase to see your dashboard.</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">

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

              <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
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

          {activeTab === 'bills' && (
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
