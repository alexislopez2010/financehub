import { useState, useMemo, useEffect, Fragment } from 'react'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, AreaChart, Area, ReferenceLine } from 'recharts'
import { DollarSign, TrendingUp, TrendingDown, CreditCard, ArrowUpRight, ArrowDownRight, Filter, ChevronDown, X, Calendar, Users, Wallet, BarChart3, PieChart as PieIcon, LayoutDashboard, LogOut, RefreshCw, Building2, Target, Search, Download, List, Banknote, Edit2, Check, Shield, Plus, ClipboardList, AlertCircle, Eye, EyeOff, Activity } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useFinanceData } from '../../hooks/useFinanceData.js'
import { useCategoryTaxonomy } from '../../hooks/useCategoryTaxonomy.js'
import { useIsOwner } from '../../hooks/useIsOwner.js'
import AccountsPage from '../Accounts/AccountsPage.jsx'
import AdminTab from '../Admin/AdminTab.jsx'

const COLORS = ['#2563eb','#059669','#d97706','#dc2626','#7c3aed','#db2777','#0891b2','#65a30d','#ea580c','#6366f1','#14b8a6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16','#f97316']
const ACCENT = { blue: '#2563eb', green: '#059669', red: '#dc2626', amber: '#d97706', purple: '#7c3aed', slate: '#475569' }

const fmt = (n) => n < 0 ? `($${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})})` : `$${n.toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:0})}`
const fmtK = (n) => n >= 1000 ? `$${(n/1000).toFixed(1)}k` : fmt(n)
const pct = (n) => `${(n*100).toFixed(1)}%`
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

/** Clamp a nominal day-of-month (1-31) to the actual last day of the given month/year */
const clampDay = (day, year, month /* 1-based */) => {
  // new Date(year, month, 0) gives the last day of 'month' (0-indexed trick)
  const lastDay = new Date(year, month, 0).getDate()
  return Math.min(Math.max(1, day), lastDay)
}

/** Check if a nominal due day (1-31) falls on a specific date, accounting for short months */
const isDueOn = (nominalDay, date) => {
  if (!nominalDay) return false
  const yr = date.getFullYear()
  const mo = date.getMonth() + 1
  const dom = date.getDate()
  const clamped = clampDay(nominalDay, yr, mo)
  return dom === clamped
}

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

function TransactionsTab({ rows, fmt, MONTH_NAMES, onUpdate, familyMembers, initialCategoryFilter, onCategoryFilterConsumed, initialAccountFilter, onAccountFilterConsumed, onPromoteToBill, householdId }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState(initialCategoryFilter || '')
  const [accountFilter, setAccountFilter] = useState(initialAccountFilter || '')
  const [sort, setSort] = useState({ col: 'date', dir: 'desc' })
  const [page, setPage] = useState(1)
  const pageSize = 50
  // Accept external category filter hand-off (e.g. from clicking pie chart)
  useEffect(() => {
    if (initialCategoryFilter !== undefined && initialCategoryFilter !== null) {
      setCategoryFilter(initialCategoryFilter || '')
      if (onCategoryFilterConsumed) onCategoryFilterConsumed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCategoryFilter])
  // Accept external account filter hand-off (e.g. from "By Account" pie on Spending tab)
  useEffect(() => {
    if (initialAccountFilter !== undefined && initialAccountFilter !== null) {
      setAccountFilter(initialAccountFilter || '')
      if (onAccountFilterConsumed) onAccountFilterConsumed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAccountFilter])
  const [editingId, setEditingId] = useState(null)
  const [editCategory, setEditCategory] = useState('')
  const [editSubCategory, setEditSubCategory] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editMember, setEditMember] = useState('')
  const [saving, setSaving] = useState(false)
  const [matchModal, setMatchModal] = useState(null) // { patch, matches: [{id,date,amount,category,...}], selectedIds: Set }
  // Promote-to-bill state
  const [promoteTarget, setPromoteTarget] = useState(null) // transaction being promoted
  const [promoteName, setPromoteName] = useState('')
  const [promoteCategory, setPromoteCategory] = useState('')
  const [promoteFrequency, setPromoteFrequency] = useState('Monthly')
  const [promoteAmount, setPromoteAmount] = useState('')
  const [promoteDueDay, setPromoteDueDay] = useState('')
  const [promoteAccount, setPromoteAccount] = useState('')
  const [promoteSaving, setPromoteSaving] = useState(false)
  const [promoteError, setPromoteError] = useState('')
  const startPromote = (t) => {
    setPromoteTarget(t)
    setPromoteName(t.description?.substring(0, 60) || '')
    setPromoteCategory(t.sub_category || t.category || '')
    setPromoteFrequency('Monthly')
    setPromoteAmount(String(Number(t.amount) || 0))
    setPromoteDueDay(t.date ? String(new Date(t.date + 'T12:00:00').getDate()) : '')
    setPromoteAccount(t.account || '')
    setPromoteError('')
  }
  const cancelPromote = () => { setPromoteTarget(null); setPromoteError('') }
  const submitPromote = async () => {
    if (!promoteName.trim()) { setPromoteError('Bill name is required'); return }
    if (!promoteAmount || Number(promoteAmount) <= 0) { setPromoteError('Amount must be > 0'); return }
    setPromoteSaving(true)
    try {
      await onPromoteToBill({
        household_id: householdId,
        name: promoteName.trim(),
        category: promoteCategory || null,
        account: promoteAccount || null,
        frequency: promoteFrequency,
        budget_amount: Number(promoteAmount),
        due_day: promoteDueDay ? Number(promoteDueDay) : null,
        is_active: true,
      })
      setPromoteTarget(null)
    } catch (e) {
      setPromoteError(e.message || 'Failed to create bill')
    } finally {
      setPromoteSaving(false)
    }
  }
  const { tree: catTree, categories: catList } = useCategoryTaxonomy()
  const subCatOptions = useMemo(() => (editCategory ? (catTree[editCategory] || []) : []), [editCategory, catTree])
  const startEdit = (t) => {
    setEditingId(t.id)
    setEditCategory(t.category || '')
    setEditSubCategory(t.sub_category || '')
    setEditNotes(t.notes || '')
    setEditMember(t.member || '')
  }
  const cancelEdit = () => {
    setEditingId(null); setEditCategory(''); setEditSubCategory(''); setEditNotes(''); setEditMember('')
  }
  const saveEdit = async (t) => {
    setSaving(true)
    try {
      const patch = {
        category:     editCategory || null,
        sub_category: editSubCategory || null,
        notes:        editNotes.trim() || null,
        member:       editMember || null,
      }
      const { error } = await supabase.from('transactions').update(patch).eq('id', t.id)
      if (error) throw error
      if (onUpdate) onUpdate(t.id, patch)

      // Look for other transactions in the same account with the exact same description
      let similarQuery = supabase
        .from('transactions')
        .select('id, date, amount, description, type, category, sub_category, account, account_id')
        .eq('description', t.description)
        .neq('id', t.id)
      if (t.account_id) {
        similarQuery = similarQuery.eq('account_id', t.account_id)
      } else if (t.account) {
        similarQuery = similarQuery.eq('account', t.account)
      }
      const { data: similar, error: simErr } = await similarQuery.order('date', { ascending: false })
      if (simErr) throw simErr

      cancelEdit()
      if (similar && similar.length > 0) {
        setMatchModal({
          patch,
          matches: similar,
          selectedIds: new Set(similar.map(s => s.id)),
        })
      }
    } catch (e) {
      alert('Save failed: ' + (e.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }
  const applyBulkUpdate = async () => {
    if (!matchModal) return
    const ids = Array.from(matchModal.selectedIds)
    if (ids.length === 0) { setMatchModal(null); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('transactions').update(matchModal.patch).in('id', ids)
      if (error) throw error
      if (onUpdate) ids.forEach(id => onUpdate(id, matchModal.patch))
      setMatchModal(null)
    } catch (e) {
      alert('Bulk update failed: ' + (e.message || 'unknown error'))
    } finally {
      setSaving(false)
    }
  }
  const toggleMatchId = (id) => {
    setMatchModal(m => {
      if (!m) return m
      const s = new Set(m.selectedIds)
      if (s.has(id)) s.delete(id); else s.add(id)
      return { ...m, selectedIds: s }
    })
  }
  const toggleAllMatches = () => {
    setMatchModal(m => {
      if (!m) return m
      const allChecked = m.selectedIds.size === m.matches.length
      return { ...m, selectedIds: new Set(allChecked ? [] : m.matches.map(x => x.id)) }
    })
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows
    if (typeFilter !== 'all') out = out.filter(t => t.type === typeFilter)
    if (categoryFilter) {
      out = out.filter(t => (t.category || '(uncategorized)') === categoryFilter)
    }
    if (accountFilter) {
      out = out.filter(t => (t.account || '') === accountFilter)
    }
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
  }, [rows, search, typeFilter, categoryFilter, accountFilter, sort])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [search, typeFilter, categoryFilter, accountFilter, rows])

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
          {categoryFilter && (
            <div className="flex items-center gap-1 px-2 py-1 bg-blue-50 border border-blue-200 rounded-lg text-xs">
              <span className="text-gray-500">Category:</span>
              <span className="font-semibold text-blue-700">{categoryFilter}</span>
              <button onClick={() => setCategoryFilter('')} className="ml-1 p-0.5 rounded hover:bg-blue-100 text-blue-600" title="Clear category filter">
                <X size={12}/>
              </button>
            </div>
          )}
          {accountFilter && (
            <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-xs">
              <span className="text-gray-500">Account:</span>
              <span className="font-semibold text-emerald-700">{accountFilter}</span>
              <button onClick={() => setAccountFilter('')} className="ml-1 p-0.5 rounded hover:bg-emerald-100 text-emerald-600" title="Clear account filter">
                <X size={12}/>
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{filtered.length.toLocaleString()} {filtered.length === 1 ? 'row' : 'rows'}</span>
          <span className="text-gray-400">·</span>
          <span>Sum: <span className="font-semibold text-gray-900">{fmt(Math.round(filtered.reduce((s, t) => s + (Number(t.amount) || 0), 0)))}</span></span>
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
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('type')}>Type{sortIcon('type')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('category')}>Category{sortIcon('category')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('sub_category')}>Sub{sortIcon('sub_category')}</th>
              <th className="px-3 py-2 text-right cursor-pointer hover:text-gray-900" onClick={() => toggleSort('amount')}>Amount{sortIcon('amount')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('account')}>Account{sortIcon('account')}</th>
              <th className="px-3 py-2 text-left cursor-pointer hover:text-gray-900" onClick={() => toggleSort('member')}>Member{sortIcon('member')}</th>
              <th className="w-10 px-2"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">No transactions match.</td></tr>
            ) : pageRows.map((t) => {
              const isEditing = editingId === t.id
              return (
              <Fragment key={t.id}>
              <tr className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600 tabular-nums whitespace-nowrap">{t.date}</td>
                <td className="px-3 py-2 text-gray-900 max-w-[320px] truncate" title={t.description}>
                  <div className="truncate">{t.description}</div>
                  {t.notes && !isEditing && <div className="text-[11px] text-gray-500 italic truncate" title={t.notes}>{t.notes}</div>}
                </td>
                <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeColor(t.type)}`}>{t.type || ''}</span></td>
                <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{t.category || '—'}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{t.sub_category || ''}</td>
                <td className={`px-3 py-2 text-right tabular-nums font-medium ${amountColor(t.type)} whitespace-nowrap`}>{amountSign(t.type)}{fmt(Number(t.amount) || 0).replace('-','')}</td>
                <td className="px-3 py-2 text-gray-600 whitespace-nowrap text-xs">{t.account || ''}</td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap text-xs">{t.member || ''}</td>
                <td className="px-2 py-2">
                  {!isEditing && (
                    <div className="flex items-center gap-0.5">
                      <button onClick={() => startEdit(t)} className="p-1 rounded hover:bg-gray-200 text-gray-500" title="Edit category/notes">
                        <Edit2 size={13}/>
                      </button>
                      {t.type === 'Expense' && onPromoteToBill && (
                        <button onClick={() => startPromote(t)} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600" title="Promote to recurring bill">
                          <ArrowUpRight size={13}/>
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
              {isEditing && (
                <tr className="bg-blue-50/40 border-b border-gray-100">
                  <td colSpan={9} className="px-3 py-3">
                    <div className="flex flex-col md:flex-row gap-2 md:items-end">
                      <label className="flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Category</span>
                        <select
                          value={editCategory}
                          onChange={e => { setEditCategory(e.target.value); setEditSubCategory('') }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          autoFocus
                        >
                          <option value="">— Select —</option>
                          {catList.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </label>
                      <label className="flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sub-category</span>
                        <select
                          value={editSubCategory}
                          onChange={e => setEditSubCategory(e.target.value)}
                          disabled={!editCategory || subCatOptions.length === 0}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white disabled:bg-gray-100 disabled:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="">{subCatOptions.length === 0 ? '—' : '— None —'}</option>
                          {subCatOptions.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </label>
                      <label className="flex-1">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Member</span>
                        <select
                          value={editMember}
                          onChange={e => setEditMember(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                        >
                          <option value="">— Unassigned —</option>
                          {(familyMembers || []).map(m => <option key={m.id || m.name} value={m.name}>{m.name}</option>)}
                        </select>
                      </label>
                      <label className="flex-[2]">
                        <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Notes</span>
                        <input
                          type="text"
                          value={editNotes}
                          onChange={e => setEditNotes(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                          placeholder="Optional notes"
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(t)}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
                        >
                          <Check size={13}/> Save
                        </button>
                        <button
                          onClick={cancelEdit}
                          disabled={saving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50"
                        >
                          <X size={13}/> Cancel
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            )})}
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
      {matchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !saving && setMatchModal(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Apply to similar transactions?</h3>
              <p className="text-xs text-gray-500 mt-1">
                Found {matchModal.matches.length} other {matchModal.matches.length === 1 ? 'transaction' : 'transactions'} with the same description in this account. Check the ones you'd like to update with{' '}
                <span className="font-medium text-gray-700">{matchModal.patch.category || '—'}{matchModal.patch.sub_category ? ` / ${matchModal.patch.sub_category}` : ''}</span>.
              </p>
            </div>
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <button onClick={toggleAllMatches} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
                {matchModal.selectedIds.size === matchModal.matches.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-xs text-gray-500">{matchModal.selectedIds.size} of {matchModal.matches.length} selected</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500 font-semibold sticky top-0">
                  <tr>
                    <th className="w-8 px-3 py-2"></th>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Current Category</th>
                    <th className="text-right px-3 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {matchModal.matches.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={matchModal.selectedIds.has(m.id)}
                          onChange={() => toggleMatchId(m.id)}
                          className="rounded border-gray-300 text-blue-600"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{m.date}</td>
                      <td className="px-3 py-2 text-xs text-gray-700">
                        {m.category ? (
                          <>
                            <span>{m.category}</span>
                            {m.sub_category && <span className="text-gray-400"> / {m.sub_category}</span>}
                          </>
                        ) : <span className="text-gray-400 italic">uncategorized</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-xs whitespace-nowrap">{fmt(Number(m.amount) || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setMatchModal(null)}
                disabled={saving}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={applyBulkUpdate}
                disabled={saving || matchModal.selectedIds.size === 0}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {saving ? 'Applying…' : `Apply to ${matchModal.selectedIds.size} selected`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote to Bill modal */}
      {promoteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={cancelPromote}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-900">Promote to Recurring Bill</h3>
              <p className="text-xs text-gray-500 mt-1">
                Create a recurring bill from this transaction. The bill will appear in your Bills tab.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {promoteError && <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded border border-red-200">{promoteError}</div>}
              <label className="block">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Bill Name</span>
                <input type="text" value={promoteName} onChange={e => setPromoteName(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Category</span>
                  <input type="text" value={promoteCategory} onChange={e => setPromoteCategory(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Account</span>
                  <input type="text" value={promoteAccount} onChange={e => setPromoteAccount(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Amount</span>
                  <input type="number" step="0.01" value={promoteAmount} onChange={e => setPromoteAmount(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none tabular-nums" />
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Frequency</span>
                  <select value={promoteFrequency} onChange={e => setPromoteFrequency(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none">
                    <option value="Monthly">Monthly</option>
                    <option value="Biweekly">Biweekly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Quarterly">Quarterly</option>
                    <option value="Annual">Annual</option>
                  </select>
                </label>
                <label className="block">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Due Day</span>
                  <input type="number" min="1" max="31" value={promoteDueDay} onChange={e => setPromoteDueDay(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none tabular-nums"
                    placeholder="1-31" />
                </label>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 flex items-center justify-end gap-2 bg-gray-50">
              <button onClick={cancelPromote} disabled={promoteSaving}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={submitPromote} disabled={promoteSaving}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold">
                {promoteSaving ? 'Creating…' : 'Create Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BillsDetail({ bills, transactions, thisYear, fmt, onRemove, onDelete }) {
  const [sort, setSort] = useState({ col: 'due_day', dir: 'asc' })
  const [confirmId, setConfirmId] = useState(null) // id of bill pending delete confirmation
  const [actionError, setActionError] = useState('')

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
    const f = (b.frequency || '').toLowerCase()
    // Try current month first, clamping to its actual last day
    let day = clampDay(b.due_day, curYear, curMonth)
    let d = new Date(curYear, curMonth - 1, day)
    if (d < today) {
      // Move to next month and re-clamp for that month's length
      const nextMo = curMonth === 12 ? 1 : curMonth + 1
      const nextYr = curMonth === 12 ? curYear + 1 : curYear
      day = clampDay(b.due_day, nextYr, nextMo)
      d = new Date(nextYr, nextMo - 1, day)
    }
    if (f === 'annual' || f === 'yearly') {
      if (d < today) d.setFullYear(curYear + 1)
    }
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
      {actionError && (
        <div className="mx-4 mt-2 px-3 py-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError('')} className="text-red-400 hover:text-red-600 ml-2">✕</button>
        </div>
      )}
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
              <th className="px-3 py-2 text-center w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-gray-500">No active bills.</td></tr>
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
                  <td className="px-3 py-2 text-center whitespace-nowrap">
                    {confirmId === r.id ? (
                      <div className="flex items-center gap-1 justify-center">
                        <button onClick={async () => { try { setActionError(''); await onDelete(r.id); setConfirmId(null) } catch(e) { setActionError(e.message) } }}
                          className="px-1.5 py-0.5 text-[10px] font-semibold bg-red-600 text-white rounded hover:bg-red-700" title="Permanently delete this bill">Delete</button>
                        <button onClick={async () => { try { setActionError(''); await onRemove(r.id); setConfirmId(null) } catch(e) { setActionError(e.message) } }}
                          className="px-1.5 py-0.5 text-[10px] font-semibold bg-amber-500 text-white rounded hover:bg-amber-600" title="Deactivate (keep record)">Hide</button>
                        <button onClick={() => setConfirmId(null)}
                          className="px-1.5 py-0.5 text-[10px] text-gray-500 rounded hover:bg-gray-100">✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmId(r.id)} className="text-gray-400 hover:text-red-500" title="Remove bill">
                        <X size={14} />
                      </button>
                    )}
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

function DebtTracker({ debts, accounts, transactions, fmt }) {
  const [strategy, setStrategy] = useState('avalanche') // 'snowball' | 'avalanche'
  const [extra, setExtra] = useState(0)
  // Per-card min-payment overrides (keyed by debt id). undefined means "use default".
  const [minOverrides, setMinOverrides] = useState({})
  const [savingMin, setSavingMin] = useState({})
  const saveTimers = useMemo(() => ({}), [])

  // Persist min_payment to Supabase (debounced 1s after last keystroke)
  const persistMinPayment = (debtId, value) => {
    if (saveTimers[debtId]) clearTimeout(saveTimers[debtId])
    saveTimers[debtId] = setTimeout(async () => {
      const numVal = Number(value)
      if (isNaN(numVal) || numVal < 0) return
      setSavingMin(s => ({ ...s, [debtId]: true }))
      await supabase.from('debts').update({ min_payment: numVal > 0 ? numVal : null }).eq('id', debtId)
      setSavingMin(s => ({ ...s, [debtId]: false }))
    }, 1000)
  }

  // For account-linked debts, compute live balance from starting_balance + transactions.
  // Assumes liability-account convention: Expense adds debt, Income/Refund/Transfer reduce it.
  const liveBalances = useMemo(() => {
    const map = {}
    ;(accounts || []).forEach(a => {
      if (a.type !== 'credit' && a.type !== 'loan') return
      const starting = Number(a.starting_balance) || 0
      let change = 0
      ;(transactions || []).forEach(t => {
        if (t.account_id !== a.id) return
        const amt = Number(t.amount) || 0
        switch (t.type) {
          case 'Expense': change += amt; break       // charge → debt up
          case 'Income':
          case 'Refund': change -= amt; break        // payment/refund → debt down
          case 'Transfer': change -= amt; break      // inbound payment → debt down
          default: break
        }
      })
      map[a.id] = starting + change
    })
    return map
  }, [accounts, transactions])

  const active = useMemo(() => (debts || []).filter(d => d.is_active !== false).map(d => {
    const linked = d.account_id && liveBalances[d.account_id] != null
    const balance = linked ? Math.max(0, liveBalances[d.account_id]) : (Number(d.balance) || 0)
    // Default min payment: stored value if present, else max($25, 2% of balance) for cards,
    // else just $0 (forces user to set one).
    const storedMin = Number(d.min_payment) || 0
    const computedMin = storedMin > 0 ? storedMin
      : d.type === 'credit_card' ? Math.max(25, Math.round(balance * 0.02))
      : storedMin
    const escrow = Number(d.escrow) || 0
    const totalPayment = minOverrides[d.id] != null ? Number(minOverrides[d.id]) : computedMin
    // P&I = total payment minus escrow (escrow doesn't reduce the loan balance)
    const minPayment = Math.max(0, totalPayment - escrow)
    return {
      id: d.id,
      name: d.name,
      type: d.type || '',
      balance,
      apr: Number(d.apr) || 0,
      minPayment,
      totalPayment,
      escrow,
      defaultMin: computedMin,
      linked,
    }
  }), [debts, liveBalances, minOverrides])

  const totalBalance = active.reduce((s, d) => s + d.balance, 0)
  const totalMin = active.reduce((s, d) => s + d.totalPayment, 0)
  const totalEscrow = active.reduce((s, d) => s + d.escrow, 0)
  const totalPI = active.reduce((s, d) => s + d.minPayment, 0)
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
        <KPICard title="Min Monthly" value={fmt(totalMin)} icon={Wallet} color={ACCENT.slate} subtitle={totalEscrow > 0 ? `P&I ${fmt(totalPI)} · Escrow ${fmt(totalEscrow)}` : 'required /mo'} />
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
                <th className="px-3 py-2 text-right">Payment / mo</th>
                <th className="px-3 py-2 text-right">Escrow</th>
                <th className="px-3 py-2 text-right">P&I</th>
                <th className="px-3 py-2 text-right">Payoff</th>
                <th className="px-3 py-2 text-right">Interest</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map(r => {
                const isOverridden = minOverrides[r.id] != null && Number(minOverrides[r.id]) !== r.defaultMin
                const isSaving = savingMin[r.id]
                return (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 text-gray-400 tabular-nums">{r.order}</td>
                    <td className="px-3 py-2 text-gray-900 font-medium">
                      <span>{r.name}</span>
                      {r.linked && <span className="ml-2 text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">LIVE</span>}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{r.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-900">{fmt(Math.round(r.balance))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{r.apr.toFixed(2)}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          min="0"
                          step="10"
                          value={Math.round(r.totalPayment)}
                          onChange={(e) => { setMinOverrides(o => ({ ...o, [r.id]: e.target.value })); persistMinPayment(r.id, e.target.value) }}
                          className={`w-20 px-1.5 py-1 text-xs text-right border rounded tabular-nums focus:outline-none focus:ring-1 focus:ring-blue-300 ${isOverridden ? 'border-blue-300 bg-blue-50 text-blue-900' : 'border-gray-200 text-gray-700'}`}
                          title={isSaving ? 'Saving…' : isOverridden ? `Overridden (default: $${r.defaultMin})` : `Default: $${r.defaultMin}`}
                        />
                        {isOverridden && (
                          <button
                            onClick={() => { setMinOverrides(o => { const n = { ...o }; delete n[r.id]; return n }); persistMinPayment(r.id, r.defaultMin) }}
                            className="text-[10px] text-gray-400 hover:text-gray-600"
                            title="Reset to default"
                          >↺</button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.escrow > 0 ? fmt(Math.round(r.escrow)) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 font-medium">{fmt(Math.round(r.minPayment))}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{r.paidMonth ? monthsToYears(r.paidMonth) : <span className="text-red-500">30+ yrs</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600">{fmt(Math.round(r.interestPaid))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BudgetTab({ data, incomeData, period, fmt, thisYear, householdId, onBudgetChanged, categoryList }) {
  const [expanded, setExpanded] = useState({})
  const toggle = (cat) => setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))
  const editableMonth = period !== 'ytd' ? parseInt(period, 10) : null
  const canEdit = editableMonth !== null && !!householdId
  const [editing, setEditing] = useState(null) // { category, sub_category, value }
  const [editingIncome, setEditingIncome] = useState(null) // { source, value }
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newRow, setNewRow] = useState({ category: '', sub_category: '', amount: '' })
  const [err, setErr] = useState('')

  const startEdit = (category, sub_category, current) => {
    if (!canEdit) return
    setErr('')
    setEditing({ category, sub_category, value: current != null ? String(current) : '' })
  }

  const saveEdit = async () => {
    if (!editing || !canEdit) return
    setSaving(true); setErr('')
    try {
      const amt = Number(editing.value)
      if (Number.isNaN(amt)) throw new Error('Amount must be a number')
      // Find existing row (sub_category may be null, so branch)
      const baseSel = supabase.from('budgets').select('id')
        .eq('household_id', householdId).eq('year', thisYear).eq('month', editableMonth)
        .eq('category', editing.category)
      const { data: found, error: selErr } = editing.sub_category
        ? await baseSel.eq('sub_category', editing.sub_category)
        : await baseSel.is('sub_category', null)
      if (selErr) throw selErr
      const matchRow = found?.[0] || null
      if (matchRow) {
        const { error } = await supabase.from('budgets').update({ amount: amt }).eq('id', matchRow.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('budgets').insert({
          household_id: householdId, year: thisYear, month: editableMonth,
          category: editing.category, sub_category: editing.sub_category || null, amount: amt
        })
        if (error) throw error
      }
      setEditing(null)
      if (onBudgetChanged) await onBudgetChanged()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const deleteLine = async (category, sub_category) => {
    if (!canEdit) return
    if (!confirm(`Remove budget for ${category}${sub_category ? ' / ' + sub_category : ''} in this month?`)) return
    setSaving(true); setErr('')
    try {
      const q = supabase.from('budgets').delete()
        .eq('household_id', householdId).eq('year', thisYear).eq('month', editableMonth)
        .eq('category', category)
      const { error } = sub_category ? await q.eq('sub_category', sub_category) : await q.is('sub_category', null)
      if (error) throw error
      if (onBudgetChanged) await onBudgetChanged()
    } catch (e) {
      setErr(e.message || 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const addLine = async () => {
    if (!canEdit) return
    setSaving(true); setErr('')
    try {
      const amt = Number(newRow.amount)
      if (!newRow.category.trim()) throw new Error('Category is required')
      if (Number.isNaN(amt)) throw new Error('Amount must be a number')
      const { error } = await supabase.from('budgets').insert({
        household_id: householdId, year: thisYear, month: editableMonth,
        category: newRow.category.trim(), sub_category: newRow.sub_category.trim() || null, amount: amt
      })
      if (error) throw error
      setAdding(false)
      setNewRow({ category: '', sub_category: '', amount: '' })
      if (onBudgetChanged) await onBudgetChanged()
    } catch (e) {
      setErr(e.message || 'Add failed')
    } finally {
      setSaving(false)
    }
  }
  const saveIncomeEdit = async () => {
    if (!editingIncome || !canEdit) return
    setSaving(true); setErr('')
    try {
      const newTotal = Number(editingIncome.value)
      if (Number.isNaN(newTotal) || newTotal < 0) throw new Error('Amount must be a valid number')
      // Fetch all income_plan rows for this source in the current month
      const { data: rows, error: fetchErr } = await supabase.from('income_plan')
        .select('id, expected_amount')
        .eq('household_id', householdId)
        .eq('year', thisYear)
        .eq('month', editableMonth)
        .eq('source', editingIncome.source)
        .eq('is_active', true)
      if (fetchErr) throw fetchErr
      const oldTotal = rows.reduce((s, r) => s + (Number(r.expected_amount) || 0), 0)
      if (oldTotal === 0 && rows.length > 0) {
        // All zeros — distribute evenly
        const each = newTotal / rows.length
        for (const r of rows) {
          const { error } = await supabase.from('income_plan').update({ expected_amount: each }).eq('id', r.id)
          if (error) throw error
        }
      } else {
        // Scale proportionally
        const ratio = newTotal / oldTotal
        for (const r of rows) {
          const scaled = Math.round((Number(r.expected_amount) || 0) * ratio * 100) / 100
          const { error } = await supabase.from('income_plan').update({ expected_amount: scaled }).eq('id', r.id)
          if (error) throw error
        }
      }
      setEditingIncome(null)
      if (onBudgetChanged) await onBudgetChanged()
    } catch (e) {
      setErr(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const statusColor = (budget, actual) => {
    if (budget === 0 && actual === 0) return { bar: '#e5e7eb', text: 'text-gray-400' }
    if (budget === 0) return { bar: '#dc2626', text: 'text-red-600' }           // spent with no budget
    const used = actual / budget
    if (used > 1) return { bar: '#dc2626', text: 'text-red-600' }               // over budget
    if (used >= 0.9) return { bar: '#d97706', text: 'text-amber-600' }          // 90-100%
    if (used >= 0.7) return { bar: '#ca8a04', text: 'text-yellow-600' }         // 70-90%
    return { bar: '#059669', text: 'text-emerald-600' }                         // under 70%
  }
  const Row = ({ label, budget, actual, variance, depth=0, isParent=false, onClick, expandedNow, canExpand, editable, onEditClick, onDelete, isEditing, editValue, onEditChange, onEditSave, onEditCancel }) => {
    const { bar, text } = statusColor(budget, actual)
    const pctUsed = budget > 0 ? Math.min((actual / budget) * 100, 150) : 0
    return (
      <div
        onClick={canExpand ? onClick : undefined}
        className={`group grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 border-b border-gray-100 text-sm ${isParent ? 'bg-gray-50 font-semibold text-gray-900' : 'text-gray-700'} ${canExpand ? 'cursor-pointer hover:bg-gray-100' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        <div className="flex items-center gap-2 truncate">
          {canExpand && <ChevronDown size={14} className={`transition-transform flex-shrink-0 ${expandedNow ? '' : '-rotate-90'}`} />}
          <span className="truncate">{label}</span>
          {editable && onDelete && !isEditing && (
            <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-600" title="Remove this budget line">
              <X size={12} />
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="text-right" onClick={e => e.stopPropagation()}>
            <input
              type="number" step="0.01" autoFocus
              value={editValue}
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel() }}
              onBlur={onEditSave}
              className="w-24 px-2 py-0.5 border border-blue-500 rounded text-sm text-right tabular-nums focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>
        ) : (
          <div
            onClick={editable ? (e) => { e.stopPropagation(); onEditClick() } : undefined}
            className={`text-right tabular-nums ${editable ? 'cursor-pointer hover:bg-blue-50 rounded px-2 -mx-2' : ''}`}
            title={editable ? 'Click to edit' : undefined}
          >
            {fmt(budget)}
          </div>
        )}
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
        <div className="text-xs text-gray-500">
          {canEdit ? 'Expand a category and click a budget amount to edit' : 'Pick a single month above to edit budgets'}
        </div>
      </div>
      {err && <div className="mx-4 mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{err}</div>}

      {/* ── Income section ── */}
      {incomeData && incomeData.rows.length > 0 && (
        <>
          <div className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-emerald-50 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 border-b border-emerald-200">
            <div>Income Source</div>
            <div className="text-right">Planned</div>
            <div className="text-right">Actual</div>
            <div className="text-right">Variance</div>
            <div>% Received</div>
          </div>
          {incomeData.rows.map(r => {
            const pctRcvd = r.planned > 0 ? Math.min((r.actual / r.planned) * 100, 150) : 0
            const varColor = r.variance >= 0 ? 'text-emerald-600' : 'text-red-600'
            const barColor = r.planned > 0 && r.actual >= r.planned ? '#059669' : r.actual >= r.planned * 0.9 ? '#d97706' : '#dc2626'
            const isEditingThis = canEdit && editingIncome && editingIncome.source === r.source
            return (
              <div key={r.key} className="group grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 border-b border-gray-100 text-sm text-gray-700">
                <div className="truncate">{r.source}</div>
                {isEditingThis ? (
                  <div className="text-right" onClick={e => e.stopPropagation()}>
                    <input
                      type="number" step="0.01" autoFocus
                      value={editingIncome.value}
                      onChange={e => setEditingIncome(prev => prev ? { ...prev, value: e.target.value } : prev)}
                      onKeyDown={e => { if (e.key === 'Enter') saveIncomeEdit(); if (e.key === 'Escape') setEditingIncome(null) }}
                      onBlur={saveIncomeEdit}
                      className="w-24 px-2 py-0.5 border border-emerald-500 rounded text-sm text-right tabular-nums focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                ) : (
                  <div
                    onClick={canEdit && r.planned > 0 ? () => { setErr(''); setEditingIncome({ source: r.source, value: String(r.planned) }) } : undefined}
                    className={`text-right tabular-nums ${canEdit && r.planned > 0 ? 'cursor-pointer hover:bg-emerald-50 rounded px-2 -mx-2' : ''}`}
                    title={canEdit && r.planned > 0 ? 'Click to edit' : undefined}
                  >
                    {fmt(r.planned)}
                  </div>
                )}
                <div className="text-right tabular-nums">{fmt(r.actual)}</div>
                <div className={`text-right tabular-nums font-medium ${varColor}`}>{fmt(r.variance)}</div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5 min-w-[40px] overflow-hidden">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(pctRcvd, 100)}%`, backgroundColor: barColor }} />
                  </div>
                  <span className="text-xs tabular-nums w-12 text-right">{r.planned > 0 ? `${Math.round(pctRcvd)}%` : '—'}</span>
                </div>
              </div>
            )
          })}
          <div className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-2 bg-emerald-50 text-sm font-bold text-gray-900 border-b-2 border-emerald-300">
            <div className="pl-3">Total Income</div>
            <div className="text-right tabular-nums">{fmt(incomeData.totals.planned)}</div>
            <div className="text-right tabular-nums">{fmt(incomeData.totals.actual)}</div>
            <div className={`text-right tabular-nums ${incomeData.totals.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(incomeData.totals.variance)}</div>
            <div className="text-xs text-gray-500">{incomeData.totals.planned > 0 ? `${Math.round((incomeData.totals.actual / incomeData.totals.planned) * 100)}% received` : '—'}</div>
          </div>
        </>
      )}

      {/* ── Expense section ── */}
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
              {expanded[p.category] && p.subs.map(s => {
                const isEditingThis = canEdit && editing && editing.category === p.category && (editing.sub_category || '') === (s.sub_category || '')
                return (
                  <Row
                    key={`${p.category}|${s.sub_category}`}
                    label={s.sub_category || '(no sub-category)'}
                    budget={s.budget}
                    actual={s.actual}
                    variance={s.variance}
                    depth={1}
                    editable={canEdit}
                    onEditClick={() => startEdit(p.category, s.sub_category, s.budget)}
                    onDelete={() => deleteLine(p.category, s.sub_category)}
                    isEditing={isEditingThis}
                    editValue={editing?.value || ''}
                    onEditChange={(v) => setEditing(prev => prev ? { ...prev, value: v } : prev)}
                    onEditSave={saveEdit}
                    onEditCancel={() => setEditing(null)}
                  />
                )
              })}
            </div>
          ))}
          <div className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-3 bg-gray-100 text-sm font-bold text-gray-900 border-t-2 border-gray-300">
            <div className="pl-3">Total Expenses</div>
            <div className="text-right tabular-nums">{fmt(data.totals.budget)}</div>
            <div className="text-right tabular-nums">{fmt(data.totals.actual)}</div>
            <div className={`text-right tabular-nums ${data.totals.variance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{fmt(data.totals.variance)}</div>
            <div className="text-xs text-gray-500">{data.totals.budget > 0 ? `${Math.round((data.totals.actual / data.totals.budget) * 100)}% used` : '—'}</div>
          </div>
        </>
      )}
      {/* Net summary when income data exists */}
      {incomeData && incomeData.totals.planned > 0 && (
        <div className="grid grid-cols-[minmax(180px,2fr)_1fr_1fr_1fr_1fr] gap-2 items-center px-3 py-3 bg-blue-50 text-sm font-bold text-gray-900 border-t-2 border-blue-300">
          <div className="pl-3">Net (Income − Expenses)</div>
          <div className="text-right tabular-nums">{fmt(incomeData.totals.planned - data.totals.budget)}</div>
          <div className="text-right tabular-nums">{fmt(incomeData.totals.actual - data.totals.actual)}</div>
          <div className={`text-right tabular-nums ${(incomeData.totals.actual - data.totals.actual) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt((incomeData.totals.actual - data.totals.actual) - (incomeData.totals.planned - data.totals.budget))}
          </div>
          <div className="text-xs text-gray-500">Planned vs Actual</div>
        </div>
      )}
      {canEdit && (
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          {adding ? (
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex-1 min-w-[140px]">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Category</span>
                <input list="budget-categories" value={newRow.category} onChange={e => setNewRow({ ...newRow, category: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="e.g. Groceries" />
                <datalist id="budget-categories">
                  {(categoryList || []).map(c => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label className="flex-1 min-w-[140px]">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Sub-category</span>
                <input type="text" value={newRow.sub_category} onChange={e => setNewRow({ ...newRow, sub_category: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" placeholder="Optional" />
              </label>
              <label className="w-32">
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Amount</span>
                <input type="number" step="0.01" value={newRow.amount} onChange={e => setNewRow({ ...newRow, amount: e.target.value })}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm bg-white text-right tabular-nums focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none" />
              </label>
              <div className="flex gap-2">
                <button onClick={addLine} disabled={saving} className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold">
                  {saving ? 'Saving…' : 'Add'}
                </button>
                <button onClick={() => { setAdding(false); setNewRow({ category: '', sub_category: '', amount: '' }); setErr('') }} disabled={saving}
                  className="px-3 py-1.5 rounded border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-100">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setAdding(true); setErr('') }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700">
              <Plus size={14} />Add budget line for {MONTH_LABELS[editableMonth-1]} {thisYear}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/* ───── Obligations Tab ───── */
function ObligationsTab({ householdId, fmt }) {
  const [obligations, setObligations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!householdId) return
    setLoading(true)
    supabase
      .from('v_advisor_upcoming_obligations')
      .select('*')
      .eq('household_id', householdId)
      .order('due_date', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setObligations(data || [])
        setLoading(false)
      })
  }, [householdId])

  if (loading) return <div className="text-center text-gray-500 py-12">Loading obligations…</div>
  if (error) return <div className="text-center text-red-500 py-12">Error: {error}</div>

  const totalMonthly = obligations.reduce((s, o) => s + (Number(o.amount) || 0), 0)
  const fromBills = obligations.filter(o => o.source === 'bill').reduce((s, o) => s + (Number(o.amount) || 0), 0)
  const fromDebts = obligations.filter(o => o.source === 'debt').reduce((s, o) => s + (Number(o.amount) || 0), 0)

  const today = new Date()
  today.setHours(0,0,0,0)

  const groupByWeek = () => {
    const groups = {}
    obligations.forEach(o => {
      const d = new Date(o.due_date + 'T00:00:00')
      const diffDays = Math.floor((d - today) / 86400000)
      let label
      if (diffDays < 0) label = 'Past due'
      else if (diffDays <= 7) label = 'This week'
      else if (diffDays <= 14) label = 'Next week'
      else if (diffDays <= 30) label = 'This month'
      else label = 'Next month+'
      if (!groups[label]) groups[label] = []
      groups[label].push(o)
    })
    return groups
  }

  const groups = groupByWeek()
  const ORDER = ['Past due', 'This week', 'Next week', 'This month', 'Next month+']

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <KPICard title="Total Obligations" value={fmt(Math.round(totalMonthly))} icon={ClipboardList} color={ACCENT.blue} subtitle={`${obligations.length} items`} />
        <KPICard title="From Bills" value={fmt(Math.round(fromBills))} icon={Wallet} color={ACCENT.green} subtitle={`${obligations.filter(o=>o.source==='bill').length} bills`} />
        <KPICard title="From Debts" value={fmt(Math.round(fromDebts))} icon={Banknote} color={ACCENT.red} subtitle={`${obligations.filter(o=>o.source==='debt').length} debts`} />
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2.5">
        <AlertCircle size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-blue-800">
          <strong>What are obligations?</strong> These are the recurring bills and debt payments that Bill (your financial advisor) uses to project your cash flow. If something is missing or shouldn't be here, adjust it in the Bills or Debt tabs.
        </div>
      </div>

      {/* Grouped list */}
      {ORDER.filter(g => groups[g]?.length).map(group => (
        <div key={group} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className={`px-4 py-2.5 border-b border-gray-100 flex items-center justify-between ${group === 'Past due' ? 'bg-red-50' : 'bg-gray-50'}`}>
            <span className={`text-xs font-semibold uppercase tracking-wider ${group === 'Past due' ? 'text-red-600' : 'text-gray-500'}`}>{group}</span>
            <span className="text-xs font-semibold text-gray-500">{fmt(Math.round(groups[group].reduce((s, o) => s + (Number(o.amount) || 0), 0)))}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {groups[group].map((o, i) => {
              const isPastDue = group === 'Past due'
              const dueDate = new Date(o.due_date + 'T00:00:00')
              const dateStr = dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div key={`${o.name}-${i}`} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${o.source === 'bill' ? 'bg-green-50' : 'bg-red-50'}`}>
                      {o.source === 'bill' ? <Wallet size={14} className="text-green-600" /> : <Banknote size={14} className="text-red-600" />}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{o.name}</div>
                      <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${o.source === 'bill' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{o.source}</span>
                        <span>{o.category || '—'}</span>
                        {o.frequency && o.frequency !== 'Monthly' && <span>· {o.frequency}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-sm font-bold ${isPastDue ? 'text-red-600' : 'text-gray-900'}`}>{fmt(Math.round(Number(o.amount) || 0))}</div>
                    <div className={`text-[11px] ${isPastDue ? 'text-red-400' : 'text-gray-400'}`}>due {dateStr}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {obligations.length === 0 && (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          No obligations found. Add bills or debts to see them here.
        </div>
      )}
    </div>
  )
}

/* ───── CFO View Tab ───── */
function CFOView({ householdId, fmt }) {
  const [obligations, setObligations] = useState([])
  const [snapshotData, setSnapshotData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [excluded, setExcluded] = useState(new Set())

  useEffect(() => {
    if (!householdId) return
    setLoading(true)
    Promise.all([
      supabase.from('v_advisor_upcoming_obligations').select('*').eq('household_id', householdId),
      supabase.rpc('rpc_advisor_snapshot', { p_household_id: householdId }),
    ]).then(([oblRes, snapRes]) => {
      if (oblRes.data) setObligations(oblRes.data)
      if (snapRes.data) setSnapshotData(snapRes.data)
      setLoading(false)
    })
  }, [householdId])

  // Expand a single obligation into all occurrences within the horizon
  const expandObligation = (o, horizonDays) => {
    const occurrences = []
    const firstDue = new Date(o.due_date + 'T00:00:00')
    const today = new Date(); today.setHours(0,0,0,0)
    const endDate = new Date(today); endDate.setDate(endDate.getDate() + horizonDays)
    const freq = (o.frequency || '').toLowerCase()

    if (freq === 'monthly') {
      for (let n = 0; n <= Math.ceil(horizonDays / 28); n++) {
        const d = new Date(firstDue); d.setMonth(d.getMonth() + n)
        if (d >= today && d <= endDate) occurrences.push({ date: new Date(d), amount: Number(o.amount) || 0 })
      }
    } else if (freq === 'biweekly') {
      for (let n = 0; n <= Math.ceil(horizonDays / 14); n++) {
        const d = new Date(firstDue); d.setDate(d.getDate() + n * 14)
        if (d >= today && d <= endDate) occurrences.push({ date: new Date(d), amount: Number(o.amount) || 0 })
      }
    } else if (freq === 'weekly') {
      for (let n = 0; n <= Math.ceil(horizonDays / 7); n++) {
        const d = new Date(firstDue); d.setDate(d.getDate() + n * 7)
        if (d >= today && d <= endDate) occurrences.push({ date: new Date(d), amount: Number(o.amount) || 0 })
      }
    } else {
      if (firstDue >= today && firstDue <= endDate) occurrences.push({ date: firstDue, amount: Number(o.amount) || 0 })
    }
    return occurrences
  }

  // Run the full projection client-side using the same model as the RPC
  const projection = useMemo(() => {
    if (!snapshotData || !obligations.length) return null
    const detail = snapshotData.projection_90d?.detail || {}
    const dailyIncome = detail.daily_income_avg || 0
    const dailyDiscretionary = detail.daily_discretionary_avg || 0
    const liquid = snapshotData.projection_90d?.liquid_balance || 0
    const horizonDays = 90
    const today = new Date(); today.setHours(0,0,0,0)

    // Build obligation-by-day map from enabled obligations
    const oblByDay = {}
    obligations.forEach((o, idx) => {
      if (excluded.has(idx)) return
      expandObligation(o, horizonDays).forEach(occ => {
        const key = occ.date.toISOString().slice(0, 10)
        oblByDay[key] = (oblByDay[key] || 0) + occ.amount
      })
    })

    // Day-by-day walk
    const days = []
    let balance = Number(liquid)
    let minBal = balance, minDate = today, totalIn = 0, totalOut = 0, totalObl = 0
    for (let i = 0; i <= horizonDays; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const obl = oblByDay[key] || 0
      const inflow = dailyIncome
      const outflow = dailyDiscretionary + obl
      balance += (inflow - outflow)
      totalIn += inflow
      totalOut += outflow
      totalObl += obl
      if (balance < minBal) { minBal = balance; minDate = new Date(d) }
      days.push({
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        rawDate: key,
        balance: Math.round(balance),
        inflow: Math.round(inflow),
        outflow: Math.round(outflow),
        obligations: Math.round(obl),
      })
    }
    return { days, ending: Math.round(balance), lowPoint: Math.round(minBal), lowDate: minDate, totalIn: Math.round(totalIn), totalOut: Math.round(totalOut), totalObl: Math.round(totalObl), liquid: Math.round(Number(liquid)), dailyIncome: Math.round(dailyIncome), dailyDiscretionary: Math.round(dailyDiscretionary) }
  }, [snapshotData, obligations, excluded])

  const toggle = (idx) => {
    setExcluded(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const toggleAll = () => {
    if (excluded.size === 0) {
      setExcluded(new Set(obligations.map((_, i) => i)))
    } else {
      setExcluded(new Set())
    }
  }

  if (loading) return <div className="text-center text-gray-500 py-12">Loading CFO View…</div>
  if (!projection) return <div className="text-center text-gray-500 py-12">No projection data available.</div>

  const oblTotalEnabled = obligations.reduce((s, o, i) => excluded.has(i) ? s : s + (Number(o.amount) || 0), 0)

  const CfoTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-xs">
        <p className="font-semibold mb-1">{d.date}</p>
        <p>Balance: <span className="text-blue-300 font-semibold">{fmt(d.balance)}</span></p>
        {d.obligations > 0 && <p>Obligations: <span className="text-red-300">{fmt(d.obligations)}</span></p>}
        <p className="text-gray-400">In: {fmt(d.inflow)} · Out: {fmt(d.outflow)}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard title="Liquid Now" value={fmt(projection.liquid)} icon={DollarSign} color={ACCENT.blue} subtitle="checking + savings" />
        <KPICard title="90-Day Ending" value={fmt(projection.ending)} icon={projection.ending >= projection.liquid ? TrendingUp : TrendingDown} color={projection.ending >= projection.liquid ? ACCENT.green : ACCENT.red} subtitle={`${projection.ending >= projection.liquid ? '+' : ''}${fmt(projection.ending - projection.liquid)} net`} />
        <KPICard title="Low Point" value={fmt(projection.lowPoint)} icon={ArrowDownRight} color={ACCENT.amber} subtitle={projection.lowDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
        <KPICard title="Obligations (90d)" value={fmt(projection.totalObl)} icon={ClipboardList} color={ACCENT.purple} subtitle={`${obligations.length - excluded.size} of ${obligations.length} active`} />
      </div>

      {/* Income / Discretionary / Obligations daily breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Daily Income Avg</div>
          <div className="text-xl font-bold text-emerald-600">{fmt(projection.dailyIncome)}<span className="text-xs text-gray-400 font-normal">/day</span></div>
          <div className="text-[11px] text-gray-400 mt-1">Based on last 90 days of inflows</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Daily Discretionary</div>
          <div className="text-xl font-bold text-red-500">{fmt(projection.dailyDiscretionary)}<span className="text-xs text-gray-400 font-normal">/day</span></div>
          <div className="text-[11px] text-gray-400 mt-1">Non-fixed spending avg (last 3 mo)</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">Monthly Obligations</div>
          <div className="text-xl font-bold text-purple-600">{fmt(Math.round(oblTotalEnabled))}<span className="text-xs text-gray-400 font-normal">/mo</span></div>
          <div className="text-[11px] text-gray-400 mt-1">{obligations.length - excluded.size} active items · {excluded.size} excluded</div>
        </div>
      </div>

      {/* 90-Day Projection Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Activity size={16} className="text-blue-500" />
            90-Day Cash Flow Projection
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Balance</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block" /> Obligation days</span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={projection.days} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} interval={13} />
            <YAxis tickFormatter={(v) => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v}`} tick={{ fontSize: 10, fill: '#6b7280' }} />
            <Tooltip content={<CfoTooltip />} />
            <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: '$0', position: 'left', fontSize: 10, fill: '#ef4444' }} />
            <ReferenceLine y={projection.lowPoint} stroke="#d97706" strokeDasharray="3 3" label={{ value: `Low: ${fmt(projection.lowPoint)}`, position: 'right', fontSize: 10, fill: '#d97706' }} />
            <Area type="monotone" dataKey="balance" stroke="#2563eb" strokeWidth={2} fill="url(#balGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Obligations Toggle Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <ClipboardList size={16} className="text-purple-500" />
            Obligations — Toggle to Adjust Projection
          </h3>
          <button onClick={toggleAll} className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50">
            {excluded.size === 0 ? 'Exclude All' : excluded.size === obligations.length ? 'Include All' : `Reset (${excluded.size} excluded)`}
          </button>
        </div>
        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
          {obligations.map((o, idx) => {
            const isOff = excluded.has(idx)
            const amount = Number(o.amount) || 0
            return (
              <div key={`${o.name}-${idx}`} className={`px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${isOff ? 'bg-gray-50 opacity-60' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => toggle(idx)} className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${isOff ? 'bg-gray-200 hover:bg-gray-300' : 'bg-blue-100 hover:bg-blue-200'}`}>
                    {isOff ? <EyeOff size={13} className="text-gray-400" /> : <Eye size={13} className="text-blue-600" />}
                  </button>
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${isOff ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{o.name}</div>
                    <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${o.source === 'bill' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{o.source}</span>
                      <span>{o.category || '—'}</span>
                      <span>· {o.frequency || 'Monthly'}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className={`text-sm font-bold ${isOff ? 'text-gray-400' : 'text-gray-900'}`}>{fmt(Math.round(amount))}</div>
                  <div className="text-[11px] text-gray-400">
                    {new Date(o.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        {excluded.size > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 bg-amber-50 text-xs text-amber-700 flex items-center gap-2">
            <AlertCircle size={14} />
            <span><strong>{excluded.size} obligation{excluded.size > 1 ? 's' : ''} excluded</strong> — the projection above reflects this. These toggles are for what-if analysis only; they don't change Bill's actual model.</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard({ user }) {
  const { transactions, bills, budgets, debts, accounts: accountRecords, familyMembers, incomePlan, loading, error, reload, patchTransaction, removeBill, deleteBill, createBill } = useFinanceData()
  const { isOwner, householdId } = useIsOwner()
  const { categories: dashCatList } = useCategoryTaxonomy()
  const [period, setPeriod] = useState('ytd')
  const [selectedAccounts, setSelectedAccounts] = useState(null)
  const [selectedMembers, setSelectedMembers] = useState(null)
  const [selectedCats, setSelectedCats] = useState([])
  const [activeTab, setActiveTab] = useState('overview')
  const [pendingCategoryFilter, setPendingCategoryFilter] = useState(null)
  const [pendingAccountFilter, setPendingAccountFilter] = useState(null)

  const jumpToCategory = (cat) => {
    setPendingCategoryFilter(cat)
    setActiveTab('transactions')
  }
  const jumpToAccount = (acct) => {
    setPendingAccountFilter(acct)
    setActiveTab('transactions')
  }

  const thisYear = new Date().getFullYear()

  // Derived option lists
  const allAccounts = useMemo(() => [...new Set(transactions.map(t => t.account || ''))].sort(), [transactions])
  const allMembers = useMemo(() => {
    const fromFamily = (familyMembers || []).map(f => f.name).filter(Boolean)
    const fromTx = transactions.map(t => t.member || '')
    return [...new Set([...fromFamily, ...fromTx])].sort()
  }, [transactions, familyMembers])
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

  // Bill category → transaction (category, sub_category, optional description keywords)
  // Keywords narrow the match when multiple bills share the same tx sub_category
  const BILL_TX_MAP = {
    'AI Services':        { cat: 'Entertainment & Subscriptions', sub: 'AI Services' },
    'Books/Courses':      { cat: 'Entertainment & Subscriptions', sub: 'Books & Courses' },
    'Books/Media':        { cat: 'Entertainment & Subscriptions', sub: 'Books & Media' },
    'Car Payment':        { cat: 'Transportation',                sub: 'Auto Loan/Lease' },
    'Debt Payment':       { cat: 'Financial',                     sub: 'Debt Payment' },
    'Dog Food/Supplies':  { cat: 'Personal & Family',             sub: 'Pets' },
    'Electric':           { cat: 'Housing', sub: 'Utilities (Electric/Gas/Water)', kw: ['firstenergy','electric'] },
    'Gas':                { cat: 'Housing', sub: 'Utilities (Electric/Gas/Water)', kw: ['njng','natgas','natural gas'] },
    'Water/Sewer':        { cat: 'Housing', sub: 'Utilities (Electric/Gas/Water)', kw: ['american water','water'] },
    'Gifts':              { cat: 'Family & Gifts',                sub: null },
    'Gym/Fitness':        { cat: 'Health & Medical',              sub: 'Fitness' },
    'Home Insurance':     { cat: 'Housing',                       sub: 'Home Insurance' },
    'Mortgage/Rent':      { cat: 'Housing',                       sub: null, kw: ['mortgage','freedom mtg'] },
    'Movies/Events':      { cat: 'Entertainment & Subscriptions', sub: null, kw: ['cinemark','movie','amc'] },
    'Parking/Tolls':      { cat: 'Transportation',                sub: null, kw: ['ezpass','e-zpass','toll','parking'] },
    'Phone':              { cat: 'Housing',                       sub: 'Phone' },
    'School Fees':        { cat: 'Kids',                          sub: 'School Fees' },
    'School Tuition':     { cat: 'Kids',                          sub: null, kw: ['tuition','middle road'] },
    'Spa/Massage':        { cat: 'Health & Medical',              sub: 'Spa' },
    'Streaming Services': { cat: 'Entertainment & Subscriptions', sub: 'Streaming' },
    'Subscriptions':      { cat: 'Entertainment & Subscriptions', sub: 'Subscriptions' },
    'Taxes (Federal)':    { cat: 'Taxes',                         sub: 'Federal' },
    'Technology/Software':{ cat: 'Software & Apps',               sub: 'Subscriptions' },
    'Tithes/Offering':    { cat: 'Giving',                        sub: 'Tithing' },
  }

  // Per-bill keyword overrides — narrows AI Services / Debt Payment pools to individual bills
  const BILL_NAME_KW = {
    'OpenAI (ChatGPT + API)':       ['openai'],
    'Claude AI / Anthropic':        ['anthropic','claude'],
    'ElevenLabs':                   ['elevenlabs'],
    'Perplexity AI':                ['perplexity'],
    'Undetectable AI':              ['undetectable'],
    'Hedra AI':                     ['hedra'],
    'Best Buy Card':                ['best buy','bestbuy','comenity'],
    'Merrick Bank Card':            ['merrick'],
    'Premier / First Premier Cards':['premier','first premier'],
    'Continental Finance':          ['continental'],
    'Apple Services Bundle (PayPal)':['apple','paypal inst xfer apple'],
    'Pinter':                       ['pinter'],
    'Tucker Carlson Network':       ['tucker','tcn'],
    'Cozyla':                       ['cozyla'],
    'NRA Membership':               ['nra'],
    'LinkedIn Premium':             ['linkedin'],
    'Uber One':                     ['uber'],
    'Wired Magazine':               ['wired'],
    'Microsoft 365':                ['microsoft'],
    'n8n Cloud':                    ['n8n'],
    'Canva Pro':                    ['canva'],
    'Regrid':                       ['regrid'],
  }

  // Income plan vs actual — aggregate by source for selected period
  const incomePlanVsActual = useMemo(() => {
    const months = period !== 'ytd' ? [parseInt(period, 10)] : availableMonths.map(m => parseInt(m, 10))
    const monthSet = new Set(months)

    // ── Planned: aggregate by source (combine all members under same source) ──
    const planBySource = {} // source -> { source, members: Set, planned }
    ;(incomePlan || []).forEach(p => {
      if (p.year !== thisYear || !monthSet.has(p.month) || !p.is_active) return
      const src = p.source || 'Other'
      if (!planBySource[src]) planBySource[src] = { source: src, members: new Set(), planned: 0 }
      if (p.member) planBySource[src].members.add(p.member)
      planBySource[src].planned += toNum(p.expected_amount)
    })

    // Build lowercase keywords from each source name for matching to tx descriptions
    // e.g. "Omnicom Shared Services" → ["omnicom","shared","services"]
    const sourceKeys = Object.keys(planBySource)
    const sourceTokens = sourceKeys.map(s => s.toLowerCase().split(/\s+/).filter(w => w.length > 2))

    // ── Actual: match Income transactions to plan sources by description ──
    const actualBySource = {} // source -> amount
    const unmatchedActual = {} // category -> amount (income txns that don't match any plan source)
    filtered.filter(t => t.type === 'Income').forEach(t => {
      const desc = (t.description || '').toLowerCase()
      const member = t.member || ''
      // Try to match against a plan source (by keywords in description, or by member name)
      let matched = false
      for (let i = 0; i < sourceKeys.length; i++) {
        const tokens = sourceTokens[i]
        // Match if any significant keyword from the source appears in the description
        if (tokens.length > 0 && tokens.some(tok => desc.includes(tok))) {
          actualBySource[sourceKeys[i]] = (actualBySource[sourceKeys[i]] || 0) + toNum(t.amount)
          matched = true
          break
        }
        // Or match by member name
        const members = planBySource[sourceKeys[i]].members
        if (member && members.has(member)) {
          actualBySource[sourceKeys[i]] = (actualBySource[sourceKeys[i]] || 0) + toNum(t.amount)
          matched = true
          break
        }
      }
      if (!matched) {
        const cat = t.category || 'Other Income'
        unmatchedActual[cat] = (unmatchedActual[cat] || 0) + toNum(t.amount)
      }
    })

    // ── Build rows: one per plan source + one per unmatched category ──
    const rows = []
    sourceKeys.forEach(src => {
      const plan = planBySource[src]
      const planned = Math.round(plan.planned)
      const actual = Math.round(actualBySource[src] || 0)
      rows.push({
        key: src,
        source: src,
        planned,
        actual,
        variance: actual - planned,
      })
    })
    Object.keys(unmatchedActual).forEach(cat => {
      const actual = Math.round(unmatchedActual[cat])
      rows.push({
        key: `unmatched-${cat}`,
        source: cat,
        planned: 0,
        actual,
        variance: actual,
      })
    })
    rows.sort((a,b) => b.planned - a.planned || b.actual - a.actual)

    const totals = rows.reduce((acc, r) => ({
      planned: acc.planned + r.planned,
      actual: acc.actual + r.actual,
    }), { planned: 0, actual: 0 })
    return {
      rows,
      totals: { ...totals, variance: totals.actual - totals.planned },
      monthCount: months.length,
      planItems: (incomePlan || []).filter(p => p.year === thisYear && p.is_active),
    }
  }, [incomePlan, filtered, period, availableMonths, thisYear])

  // Bills: monthly spend against each bill's budget_amount
  const billsComparison = useMemo(() => {
    const months = period !== 'ytd' ? [period] : availableMonths
    return bills.filter(b => b.is_active).slice(0,15).map(b => {
      const budget = toNum(b.budget_amount) * months.length
      const mapping = BILL_TX_MAP[b.category]
      const nameKw = BILL_NAME_KW[b.name]
      const actual = transactions
        .filter(t => {
          if (t.type !== 'Expense') return false
          if (!months.some(m => t.date?.startsWith(`${thisYear}-${m}`))) return false
          if (!mapping) return t.category === b.category  // fallback: exact match
          if (t.category !== mapping.cat) return false
          if (mapping.sub && t.sub_category !== mapping.sub) return false
          const desc = (t.description || '').toLowerCase()
          // If bill-specific keywords exist, use them for precise matching
          if (nameKw) return nameKw.some(k => desc.includes(k))
          // If category-level keywords exist (e.g. Utilities), use them
          if (mapping.kw) return mapping.kw.some(k => desc.includes(k))
          return true
        })
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
            {[['overview','Overview',LayoutDashboard],['accounts','Accounts',Building2],['transactions','Transactions',List],['spending','Spending',PieIcon],['budget','Budget',Target],['bills','Bills',Wallet],['debt','Debt',Banknote],['obligations','Obligations',ClipboardList],['cfo','CFO View',Activity],['trends','Trends',BarChart3], ...(isOwner ? [['admin','Admin',Shield]] : [])].map(([key,label,Icon]) => (
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
              {Array.from({ length: 12 }, (_, i) => { const m = String(i + 1).padStart(2, '0'); return <Pill key={m} label={MONTH_NAMES[i]} active={period===m} onClick={()=>setPeriod(m)} /> })}
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

      {transactions.length === 0 && activeTab !== 'accounts' && activeTab !== 'admin' ? (
        <div className="max-w-xl mx-auto px-4 md:px-6 py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">No transactions yet</h2>
            <p className="text-sm text-gray-500">Import your data into Supabase to see your dashboard.</p>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">

          {activeTab === 'accounts' && <AccountsPage />}

          {activeTab === 'admin' && isOwner && <AdminTab householdId={householdId} />}

          {activeTab === 'overview' && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                <KPICard title="Income" value={fmt(totalIncome)} icon={TrendingUp} color={ACCENT.green} trend={incomeTrend} trendLabel="vs prev month" />
                <KPICard title="Expenses" value={fmt(totalExpense)} icon={TrendingDown} color={ACCENT.red} trend={expenseTrend !== undefined ? -expenseTrend : undefined} trendLabel="vs prev month" />
                <KPICard title="Net Cash Flow" value={fmt(netCashflow)} icon={DollarSign} color={netCashflow >= 0 ? ACCENT.green : ACCENT.red} subtitle={netCashflow >= 0 ? 'Positive' : 'Deficit'} />
                <KPICard title="Savings Rate" value={pct(savingsRate)} icon={Wallet} color={ACCENT.purple} subtitle={savingsRate >= 0.2 ? 'On track' : 'Below 20% target'} />
              </div>
              {incomePlanVsActual.totals.planned > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                  <KPICard
                    title="Planned Income"
                    value={fmt(incomePlanVsActual.totals.planned)}
                    icon={TrendingUp}
                    color={ACCENT.green}
                    subtitle={`${Math.round((incomePlanVsActual.totals.actual / incomePlanVsActual.totals.planned) * 100)}% received`}
                  />
                  <KPICard
                    title="Projected Net"
                    value={fmt(incomePlanVsActual.totals.planned - budgetVsActual.totals.budget)}
                    icon={DollarSign}
                    color={(incomePlanVsActual.totals.planned - budgetVsActual.totals.budget) >= 0 ? ACCENT.green : ACCENT.red}
                    subtitle="Planned income − budgeted expenses"
                  />
                  <KPICard
                    title="Target Savings"
                    value={incomePlanVsActual.totals.planned > 0 ? pct((incomePlanVsActual.totals.planned - budgetVsActual.totals.budget) / incomePlanVsActual.totals.planned) : '—'}
                    icon={Target}
                    color={ACCENT.purple}
                    subtitle={`Actual: ${pct(savingsRate)}`}
                  />
                  <KPICard
                    title="Income Variance"
                    value={fmt(incomePlanVsActual.totals.variance)}
                    icon={TrendingUp}
                    color={incomePlanVsActual.totals.variance >= 0 ? ACCENT.green : ACCENT.red}
                    subtitle={incomePlanVsActual.totals.variance >= 0 ? 'Ahead of plan' : 'Behind plan'}
                  />
                </div>
              )}

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
                      <Pie data={categoryData.slice(0,10)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={2} label={({name,percent}) => `${(name||'').substring(0,10)} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:10,cursor:'pointer'}} onClick={(d) => d && d.name && jumpToCategory(d.name)}>
                        {categoryData.slice(0,10).map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} style={{cursor:'pointer'}} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-gray-400 text-center mt-1">Click a slice to view transactions</p>
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

              {/* Balance Forecast — 30-day projection using income + bills */}
              {incomePlanVsActual.totals.planned > 0 && (() => {
                const today = new Date()
                const todayStr = today.toISOString().slice(0,10)
                const curMonth = today.getMonth() + 1
                const curYear = today.getFullYear()
                // Starting balance: sum of all active account current balances
                // We approximate current balances from accountRecords + their starting_balance + all historical transactions
                // Simpler: use a naive sum from account starting_balance (user can refine)
                const startBalance = accountRecords.filter(a => a.is_active && (a.type === 'checking' || a.type === 'savings'))
                  .reduce((s, a) => s + (Number(a.starting_balance) || 0), 0)
                // Add/subtract all past transactions to get today's balance
                const pastDelta = transactions
                  .filter(t => t.date && t.date <= todayStr)
                  .reduce((s, t) => {
                    const amt = Number(t.amount) || 0
                    return s + (t.type === 'Income' || t.type === 'Refund' ? amt : t.type === 'Expense' ? -amt : 0)
                  }, 0)
                let runBal = startBalance + pastDelta

                // Build 30-day forecast
                const points = []
                for (let d = 0; d <= 30; d++) {
                  const dt = new Date(today)
                  dt.setDate(dt.getDate() + d)
                  const dom = dt.getDate()
                  const mo = dt.getMonth() + 1
                  const yr = dt.getFullYear()
                  // Income arriving this day (clamp day_of_month to actual month length)
                  const dayIncome = (incomePlan || []).filter(p =>
                    p.is_active && p.year === yr && p.month === mo && isDueOn(p.day_of_month, dt)
                  ).reduce((s, p) => s + (Number(p.expected_amount) || 0), 0)
                  // Bills due this day (clamp due_day to actual month length)
                  const dayBills = bills.filter(b =>
                    b.is_active && isDueOn(b.due_day, dt)
                  ).reduce((s, b) => s + (Number(b.budget_amount) || 0), 0)
                  if (d > 0) runBal = runBal + dayIncome - dayBills
                  const label = `${mo}/${dom}`
                  points.push({ day: label, balance: Math.round(runBal), income: Math.round(dayIncome), bills: Math.round(dayBills) })
                }
                const minBal = Math.min(...points.map(p => p.balance))
                return (
                  <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-gray-700">30-Day Balance Forecast</h3>
                      <span className="text-[11px] text-gray-400">Based on planned income + recurring bills</span>
                    </div>
                    {minBal < 0 && (
                      <div className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        Warning: projected balance drops below $0 during this period
                      </div>
                    )}
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={points}>
                        <CartesianGrid {...GRID_STYLE} />
                        <XAxis dataKey="day" tick={LABEL_STYLE} interval={4} />
                        <YAxis tickFormatter={fmtK} tick={LABEL_STYLE} />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null
                          const pt = payload[0].payload
                          return (
                            <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
                              <div className="font-semibold mb-1">{label}</div>
                              <div>Balance: <span className="font-bold">{fmt(pt.balance)}</span></div>
                              {pt.income > 0 && <div className="text-emerald-600">+{fmt(pt.income)} income</div>}
                              {pt.bills > 0 && <div className="text-red-600">−{fmt(pt.bills)} bills</div>}
                            </div>
                          )
                        }} />
                        <Line type="monotone" dataKey="balance" name="Balance" stroke={ACCENT.blue} strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )
              })()}
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
                      <Pie data={accountData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name,percent}) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} style={{fontSize:10,cursor:'pointer'}} onClick={(d) => d && d.name && jumpToAccount(d.name)}>
                        {accountData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} style={{cursor:'pointer'}} />)}
                      </Pie>
                      <Tooltip formatter={(v) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <p className="text-[10px] text-gray-400 text-center mt-1">Click a slice to view transactions</p>
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
            <TransactionsTab rows={filtered} fmt={fmt} MONTH_NAMES={MONTH_NAMES} onUpdate={patchTransaction} familyMembers={familyMembers} initialCategoryFilter={pendingCategoryFilter} onCategoryFilterConsumed={() => setPendingCategoryFilter(null)} initialAccountFilter={pendingAccountFilter} onAccountFilterConsumed={() => setPendingAccountFilter(null)} onPromoteToBill={createBill} householdId={householdId} />
          )}

          {activeTab === 'budget' && (
            <BudgetTab data={budgetVsActual} incomeData={incomePlanVsActual} period={period} fmt={fmt} thisYear={thisYear} householdId={householdId} onBudgetChanged={reload} categoryList={dashCatList} />
          )}

          {activeTab === 'bills' && (
            <>
            <BillsDetail bills={bills} transactions={transactions} thisYear={thisYear} fmt={fmt} onRemove={removeBill} onDelete={deleteBill} />
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
            <DebtTracker debts={debts} accounts={accountRecords} transactions={transactions} fmt={fmt} />
          )}

          {activeTab === 'obligations' && (
            <ObligationsTab householdId={householdId} fmt={fmt} />
          )}

          {activeTab === 'cfo' && (
            <CFOView householdId={householdId} fmt={fmt} />
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
