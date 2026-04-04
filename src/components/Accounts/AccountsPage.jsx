import { useState } from 'react'
import { Plus, Edit2, Archive, ArchiveRestore, X, Building2, CreditCard, Wallet, PiggyBank, TrendingUp, Landmark } from 'lucide-react'
import { useAccounts } from '../../hooks/useAccounts.js'

const TYPE_META = {
  checking:   { label: 'Checking',   icon: Wallet,     color: '#2563eb', isLiability: false },
  savings:    { label: 'Savings',    icon: PiggyBank,  color: '#059669', isLiability: false },
  credit:     { label: 'Credit',     icon: CreditCard, color: '#dc2626', isLiability: true  },
  loan:       { label: 'Loan',       icon: Landmark,   color: '#d97706', isLiability: true  },
  investment: { label: 'Investment', icon: TrendingUp, color: '#7c3aed', isLiability: false },
}

const fmtUSD = (n) => (n == null || isNaN(n))
  ? '—'
  : (n < 0
      ? `($${Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})})`
      : `$${n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`)

const EMPTY_FORM = {
  name: '', type: 'checking', institution: '', last_four: '',
  starting_balance: '0', starting_balance_date: '', is_active: true, display_order: 0,
}

export default function AccountsPage() {
  const { accounts, balances, loading, error, createAccount, updateAccount, archiveAccount, unarchiveAccount } = useAccounts()
  const [showArchived, setShowArchived] = useState(false)
  const [editingId, setEditingId] = useState(null) // 'new' or account.id
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const openNew = () => { setForm(EMPTY_FORM); setEditingId('new'); setSaveError('') }
  const openEdit = (a) => {
    setForm({
      name: a.name || '',
      type: a.type || 'checking',
      institution: a.institution || '',
      last_four: a.last_four || '',
      starting_balance: a.starting_balance != null ? String(a.starting_balance) : '0',
      starting_balance_date: a.starting_balance_date || '',
      is_active: a.is_active ?? true,
      display_order: a.display_order ?? 0,
    })
    setEditingId(a.id)
    setSaveError('')
  }
  const closeModal = () => { setEditingId(null); setSaveError('') }

  const onSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    const payload = {
      name: form.name.trim(),
      type: form.type,
      institution: form.institution.trim() || null,
      last_four: form.last_four.trim() || null,
      starting_balance: Number(form.starting_balance) || 0,
      starting_balance_date: form.starting_balance_date || null,
      is_active: form.is_active,
      display_order: Number(form.display_order) || 0,
    }
    try {
      if (editingId === 'new') {
        // household_id is set by default via trigger? No — we need to set it.
        // We get it from the first existing account if any, otherwise the Lopez household constant.
        payload.household_id = accounts[0]?.household_id || '00000000-0000-0000-0000-000000000001'
        await createAccount(payload)
      } else {
        await updateAccount(editingId, payload)
      }
      closeModal()
    } catch (err) {
      setSaveError(err.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const visibleAccounts = accounts.filter(a => showArchived ? a.archived_at : !a.archived_at)

  // net worth calculation
  const netWorth = visibleAccounts.reduce((sum, a) => {
    const bal = balances[a.id]?.balance
    const starting = Number(a.starting_balance) || 0
    const current = bal != null ? bal : starting
    const meta = TYPE_META[a.type] || TYPE_META.checking
    return sum + (meta.isLiability ? -current : current)
  }, 0)

  if (loading) return <div className="text-center text-gray-500 py-12">Loading accounts…</div>
  if (error) return <div className="text-center text-red-600 py-12">Error: {error}</div>

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg md:text-xl font-bold text-gray-900">Accounts</h2>
          <p className="text-xs text-gray-500">Manage accounts and starting balances</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowArchived(!showArchived)} className="text-xs font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300">
            {showArchived ? 'Active accounts' : 'Archived'}
          </button>
          <button onClick={openNew} className="flex items-center gap-1.5 text-xs md:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-lg shadow-sm">
            <Plus size={14}/> Add account
          </button>
        </div>
      </div>

      {/* Net worth summary */}
      {!showArchived && (
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 md:p-5 text-white shadow-sm">
          <div className="text-[10px] md:text-xs font-semibold uppercase tracking-wider opacity-80">Estimated net worth</div>
          <div className="text-2xl md:text-3xl font-bold mt-1">{fmtUSD(netWorth)}</div>
          <div className="text-[11px] opacity-80 mt-0.5">{visibleAccounts.length} active accounts</div>
        </div>
      )}

      {/* Account list */}
      {visibleAccounts.length === 0 ? (
        <div className="text-center text-gray-500 py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          {showArchived ? 'No archived accounts.' : 'No accounts yet. Click "Add account" to create one.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visibleAccounts.map(a => {
            const meta = TYPE_META[a.type] || TYPE_META.checking
            const Icon = meta.icon
            const bal = balances[a.id]?.balance
            const asOf = balances[a.id]?.as_of
            const displayBal = bal != null ? bal : Number(a.starting_balance) || 0
            const effectiveBal = meta.isLiability ? -displayBal : displayBal
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: meta.color + '15' }}>
                      <Icon size={18} style={{ color: meta.color }}/>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{a.name}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {meta.label}{a.institution ? ` · ${a.institution}` : ''}{a.last_four ? ` · ···${a.last_four}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Edit">
                      <Edit2 size={14}/>
                    </button>
                    {a.archived_at ? (
                      <button onClick={() => unarchiveAccount(a.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Restore">
                        <ArchiveRestore size={14}/>
                      </button>
                    ) : (
                      <button onClick={() => archiveAccount(a.id)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Archive">
                        <Archive size={14}/>
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                      {bal != null ? 'Current balance' : 'Starting balance'}
                    </div>
                    <div className="text-xl font-bold" style={{ color: meta.isLiability && displayBal > 0 ? '#dc2626' : '#111827' }}>
                      {meta.isLiability && displayBal > 0 ? `-${fmtUSD(displayBal)}` : fmtUSD(displayBal)}
                    </div>
                    {asOf && <div className="text-[10px] text-gray-400">as of {asOf}</div>}
                  </div>
                  {meta.isLiability && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700">Liability</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Edit/Create Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-xl max-w-md w-full shadow-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">{editingId === 'new' ? 'Add account' : 'Edit account'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
            </div>
            <form onSubmit={onSave} className="p-4 space-y-3">
              <Field label="Name" required>
                <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="input" placeholder="Chase Checking" />
              </Field>
              <Field label="Type" required>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input">
                  {Object.entries(TYPE_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Institution">
                  <input type="text" value={form.institution} onChange={e => setForm({...form, institution: e.target.value})} className="input" placeholder="Chase" />
                </Field>
                <Field label="Last 4">
                  <input type="text" maxLength={4} value={form.last_four} onChange={e => setForm({...form, last_four: e.target.value})} className="input" placeholder="1234" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starting balance">
                  <input type="number" step="0.01" value={form.starting_balance} onChange={e => setForm({...form, starting_balance: e.target.value})} className="input" />
                </Field>
                <Field label="As-of date">
                  <input type="date" value={form.starting_balance_date} onChange={e => setForm({...form, starting_balance_date: e.target.value})} className="input" />
                </Field>
              </div>
              <div className="text-[11px] text-gray-500 bg-gray-50 rounded p-2">
                Tip: enter the balance shown on a statement, and set the as-of date to one day <em>before</em> that statement period begins. Transactions imported after that date will be added on top.
              </div>
              {saveError && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{saveError}</div>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeModal} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={saving} className="flex-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`.input { width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.5rem; font-size: 0.875rem; } .input:focus { outline: 2px solid #2563eb; outline-offset: -1px; border-color: #2563eb; }`}</style>
    </div>
  )
}

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-gray-700 mb-1">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  )
}
