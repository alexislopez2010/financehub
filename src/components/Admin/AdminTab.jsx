import { useState, useCallback } from 'react'
import { Users, UserCircle, Tags, Building2, Wallet, Banknote, TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import AdminEntityManager from './AdminEntityManager.jsx'
import AdminUsersManager from './AdminUsersManager.jsx'

const SECTIONS = [
  { key: 'users', label: 'Users', icon: Users },
  { key: 'family', label: 'Family Members', icon: UserCircle },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'accounts', label: 'Accounts', icon: Building2 },
  { key: 'bills', label: 'Bills', icon: Wallet },
  { key: 'debts', label: 'Debts', icon: Banknote },
  { key: 'income', label: 'Income Plan', icon: TrendingUp },
]

export default function AdminTab({ householdId }) {
  const [section, setSection] = useState('users')

  // Cascade category/sub_category renames to transactions, budgets, and bills
  const cascadeCategoryRename = useCallback(async (oldRow, newPayload) => {
    const catChanged = oldRow.category && newPayload.category && oldRow.category !== newPayload.category
    const subChanged = (oldRow.sub_category || null) !== (newPayload.sub_category || null)
    if (!catChanged && !subChanged) return

    const tables = ['transactions', 'budgets', 'bills']
    for (const t of tables) {
      if (catChanged) {
        const update = { category: newPayload.category }
        // Also update sub_category if it changed (for tables that have it)
        if (subChanged && t !== 'bills') update.sub_category = newPayload.sub_category || null
        let q = supabase.from(t).update(update)
          .eq('household_id', householdId)
          .eq('category', oldRow.category)
        // For sub_category scoped renames, narrow to matching sub_category
        if (oldRow.sub_category && t !== 'bills') {
          q = q.eq('sub_category', oldRow.sub_category)
        }
        await q
      } else if (subChanged && t !== 'bills') {
        // Only sub_category changed, category stayed the same
        let q = supabase.from(t).update({ sub_category: newPayload.sub_category || null })
          .eq('household_id', householdId)
          .eq('category', oldRow.category)
        if (oldRow.sub_category) {
          q = q.eq('sub_category', oldRow.sub_category)
        } else {
          q = q.is('sub_category', null)
        }
        await q
      }
    }
  }, [householdId])

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-2 shadow-sm">
        <div className="flex gap-1 overflow-x-auto">
          {SECTIONS.map(s => {
            const Icon = s.icon
            return (
              <button key={s.key} onClick={() => setSection(s.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap ${section === s.key ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}>
                <Icon size={14} />{s.label}
              </button>
            )
          })}
        </div>
      </div>

      {section === 'users' && <AdminUsersManager householdId={householdId} />}

      {section === 'family' && (
        <AdminEntityManager
          title="Family Member"
          table="family_members"
          householdId={householdId}
          orderBy={{ column: 'name', ascending: true }}
          columns={[
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'relationship', label: 'Relationship', type: 'text' },
          ]}
        />
      )}

      {section === 'categories' && (
        <AdminEntityManager
          title="Category Rule"
          table="category_rules"
          householdId={householdId}
          orderBy={{ column: 'category', ascending: true }}
          onAfterSave={cascadeCategoryRename}
          columns={[
            { key: 'category', label: 'Category', type: 'text', required: true },
            { key: 'sub_category', label: 'Sub-category', type: 'text' },
            { key: 'pattern', label: 'Match pattern', type: 'text', required: true },
            { key: 'pattern_type', label: 'Match type', type: 'select', required: true, default: 'contains',
              options: [
                { value: 'contains', label: 'Contains' },
                { value: 'exact', label: 'Exact' },
                { value: 'regex', label: 'Regex' },
              ] },
            { key: 'priority', label: 'Priority', type: 'number', default: 100, step: 1 },
            { key: 'is_active', label: 'Active', type: 'boolean', default: true },
            { key: 'note', label: 'Note', type: 'text' },
          ]}
        />
      )}

      {section === 'accounts' && (
        <AdminEntityManager
          title="Account"
          table="accounts"
          householdId={householdId}
          orderBy={{ column: 'display_order', ascending: true }}
          columns={[
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'type', label: 'Type', type: 'select', options: [
              { value: 'checking', label: 'Checking' },
              { value: 'savings', label: 'Savings' },
              { value: 'credit', label: 'Credit Card' },
              { value: 'loan', label: 'Loan' },
              { value: 'investment', label: 'Investment' },
            ] },
            { key: 'institution', label: 'Institution', type: 'text' },
            { key: 'last_four', label: 'Last 4', type: 'text' },
            { key: 'starting_balance', label: 'Starting balance', type: 'number', default: 0, step: 0.01 },
            { key: 'starting_balance_date', label: 'Starting balance date', type: 'date' },
            { key: 'currency', label: 'Currency', type: 'text', default: 'USD' },
            { key: 'display_order', label: 'Display order', type: 'number', default: 0, step: 1 },
            { key: 'is_active', label: 'Active', type: 'boolean', default: true },
          ]}
        />
      )}

      {section === 'bills' && (
        <AdminEntityManager
          title="Bill"
          table="bills"
          householdId={householdId}
          orderBy={{ column: 'name', ascending: true }}
          columns={[
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'category', label: 'Category', type: 'text' },
            { key: 'account', label: 'Account', type: 'text' },
            { key: 'budget_amount', label: 'Amount', type: 'number', required: true, default: 0, step: 0.01 },
            { key: 'due_day', label: 'Due day (1–31)', type: 'number', step: 1, min: 1, max: 31 },
            { key: 'frequency', label: 'Frequency', type: 'select', options: [
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Weekly', label: 'Weekly' },
              { value: 'Biweekly', label: 'Bi-weekly' },
              { value: 'Quarterly', label: 'Quarterly' },
              { value: 'Annual', label: 'Annual' },
            ] },
            { key: 'is_active', label: 'Active', type: 'boolean', default: true },
            { key: 'notes', label: 'Notes', type: 'text' },
          ]}
        />
      )}

      {section === 'debts' && (
        <AdminEntityManager
          title="Debt"
          table="debts"
          householdId={householdId}
          orderBy={{ column: 'balance', ascending: false }}
          columns={[
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'type', label: 'Type', type: 'select', required: true, options: [
              { value: 'credit_card', label: 'Credit Card' },
              { value: 'loan', label: 'Loan' },
              { value: 'mortgage', label: 'Mortgage' },
              { value: 'student_loan', label: 'Student Loan' },
              { value: 'auto_loan', label: 'Auto Loan' },
              { value: 'other', label: 'Other' },
            ] },
            { key: 'balance', label: 'Balance', type: 'number', required: true, default: 0, step: 0.01 },
            { key: 'original_balance', label: 'Original balance', type: 'number', step: 0.01 },
            { key: 'apr', label: 'APR %', type: 'number', step: 0.01 },
            { key: 'min_payment', label: 'Min payment', type: 'number', step: 0.01 },
            { key: 'due_day', label: 'Due day (1–31)', type: 'number', step: 1, min: 1, max: 31 },
            { key: 'account_id', label: 'Linked account ID', type: 'text' },
            { key: 'is_active', label: 'Active', type: 'boolean', default: true },
            { key: 'notes', label: 'Notes', type: 'text' },
          ]}
        />
      )}

      {section === 'income' && (
        <AdminEntityManager
          title="Income Plan"
          table="income_plan"
          householdId={householdId}
          orderBy={{ column: 'member', ascending: true }}
          columns={[
            { key: 'member', label: 'Member', type: 'text', required: true },
            { key: 'source', label: 'Source', type: 'text', required: true },
            { key: 'expected_amount', label: 'Amount', type: 'number', required: true, default: 0, step: 0.01 },
            { key: 'frequency', label: 'Frequency', type: 'select', required: true, default: 'Semi-monthly', options: [
              { value: 'Weekly', label: 'Weekly' },
              { value: 'Biweekly', label: 'Bi-weekly' },
              { value: 'Semi-monthly', label: 'Semi-monthly' },
              { value: 'Monthly', label: 'Monthly' },
              { value: 'Quarterly', label: 'Quarterly' },
              { value: 'Annual', label: 'Annual' },
            ] },
            { key: 'year', label: 'Year', type: 'number', required: true, default: new Date().getFullYear(), step: 1 },
            { key: 'month', label: 'Month (1-12)', type: 'number', required: true, default: new Date().getMonth() + 1, step: 1, min: 1 },
            { key: 'day_of_month', label: 'Pay day (1–31)', type: 'number', step: 1, min: 1, max: 31 },
            { key: 'is_active', label: 'Active', type: 'boolean', default: true },
            { key: 'notes', label: 'Notes', type: 'text' },
          ]}
        />
      )}
    </div>
  )
}
