import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BillDetailsEditor } from './BillDetailsEditor'
import type { Tables } from '@/lib/supabase/database.types'

type BillRow = Tables<'bills'>
type AccountRow = Tables<'accounts'>
type CategoryRow = Tables<'categories'>

const mutateMock = vi.fn()
const mockUseAccounts = vi.fn()
const mockUseCategories = vi.fn()

vi.mock('@/lib/data/bills', () => ({
  useUpdateBill: () => ({ mutate: mutateMock, isPending: false })
}))
vi.mock('@/lib/data/accounts', () => ({
  useAccounts: () => mockUseAccounts()
}))
vi.mock('@/lib/data/categories', () => ({
  useCategories: () => mockUseCategories()
}))

const HID = '00000000-0000-0000-0000-000000000001'

function mkBill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    household_id: HID,
    name: 'Mortgage',
    budget_amount: 2469.40,
    budget_category_id: null,
    category: 'Housing',
    due_day: 1,
    frequency: 'Monthly',
    is_active: true,
    account: 'Chase Checking',
    notes: null,
    linked_debt_id: null,
    created_at: null,
    ...over
  } as BillRow
}

function mkAccount(name: string, id: string): AccountRow {
  return {
    id, name, household_id: HID, type: 'checking', is_active: true,
    starting_balance: 0, starting_balance_date: null, institution: null,
    display_order: 0, notes: null, created_at: null, updated_at: null
  } as unknown as AccountRow
}

function mkCategory(name: string, id: string, type: string = 'expense'): CategoryRow {
  return {
    id, name, type, household_id: HID, parent_category: null, is_fixed: null,
    created_at: null
  } as unknown as CategoryRow
}

beforeEach(() => {
  mutateMock.mockReset()
  mockUseAccounts.mockReset()
  mockUseCategories.mockReset()
  mockUseAccounts.mockReturnValue({ data: [
    mkAccount('Chase Checking', 'a1'),
    mkAccount('Apple Card', 'a2')
  ], isLoading: false })
  mockUseCategories.mockReturnValue({ data: [
    mkCategory('Housing', 'c1'),
    mkCategory('Groceries', 'c2'),
    mkCategory('Salary', 'c3', 'income')
  ], isLoading: false })
})

describe('<BillDetailsEditor>', () => {
  it('renders every editable field with the bill\'s current values', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    expect((screen.getByLabelText(/Name/i, { selector: 'input' }) as HTMLInputElement).value).toBe('Mortgage')
    expect((screen.getByLabelText(/Frequency/i) as HTMLSelectElement).value).toBe('Monthly')
    expect((screen.getByLabelText(/Due day/i) as HTMLInputElement).value).toBe('1')
    expect((screen.getByLabelText(/Amount/i) as HTMLInputElement).value).toBe('2469.4')
    expect((screen.getByLabelText(/Account/i) as HTMLSelectElement).value).toBe('Chase Checking')
    expect((screen.getByLabelText(/Category/i) as HTMLSelectElement).value).toBe('Housing')
    expect((screen.getByLabelText(/^Active/i) as HTMLInputElement).checked).toBe(true)
  })

  it('commits a name change on blur with the trimmed value', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    const input = screen.getByLabelText(/Name/i, { selector: 'input' })
    fireEvent.change(input, { target: { value: '  Mortgage (Freedom Mtg)  ' } })
    fireEvent.blur(input)
    expect(mutateMock).toHaveBeenCalledWith({
      id: 'b1',
      patch: { name: 'Mortgage (Freedom Mtg)' }
    })
  })

  it('skips the mutation when the trimmed name is empty', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    const input = screen.getByLabelText(/Name/i, { selector: 'input' })
    fireEvent.change(input, { target: { value: '   ' } })
    fireEvent.blur(input)
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('commits a frequency change immediately on select', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    fireEvent.change(screen.getByLabelText(/Frequency/i), { target: { value: 'Biweekly' } })
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { frequency: 'Biweekly' } })
  })

  it('commits a due day change clamped to 1..31 on blur', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    const input = screen.getByLabelText(/Due day/i)
    fireEvent.change(input, { target: { value: '45' } })
    fireEvent.blur(input)
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { due_day: 31 } })
  })

  it('clears the due day when the input is emptied', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    const input = screen.getByLabelText(/Due day/i)
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { due_day: null } })
  })

  it('commits an amount change on blur', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    const input = screen.getByLabelText(/Amount/i)
    fireEvent.change(input, { target: { value: '2500.55' } })
    fireEvent.blur(input)
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { budget_amount: 2500.55 } })
  })

  it('ignores invalid amounts (negative, NaN)', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    const input = screen.getByLabelText(/Amount/i)
    fireEvent.change(input, { target: { value: '-5' } })
    fireEvent.blur(input)
    fireEvent.change(input, { target: { value: 'notanumber' } })
    fireEvent.blur(input)
    expect(mutateMock).not.toHaveBeenCalled()
  })

  it('commits an account change on select', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    fireEvent.change(screen.getByLabelText(/Account/i), { target: { value: 'Apple Card' } })
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { account: 'Apple Card' } })
  })

  it('clears the account when the user picks (none)', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    fireEvent.change(screen.getByLabelText(/Account/i), { target: { value: '' } })
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { account: null } })
  })

  it('commits a category change on select with BOTH the free-text and the FK', () => {
    // Regression: the editor used to write only `category` and leave
    // `budget_category_id` NULL, silently keeping new mappings out of the
    // Plan rollup. Both fields now travel together.
    render(<BillDetailsEditor bill={mkBill()} />)
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: 'Groceries' } })
    expect(mutateMock).toHaveBeenCalledWith({
      id: 'b1',
      patch: { category: 'Groceries', budget_category_id: 'c2' }
    })
  })

  it('clears BOTH category and budget_category_id when "(none)" is selected', () => {
    render(<BillDetailsEditor bill={mkBill()} />)
    fireEvent.change(screen.getByLabelText(/Category/i), { target: { value: '' } })
    expect(mutateMock).toHaveBeenCalledWith({
      id: 'b1',
      patch: { category: null, budget_category_id: null }
    })
  })

  it('renders a (custom) entry preserving a legacy free-text category not in the table', () => {
    render(<BillDetailsEditor bill={mkBill({ category: 'Tithes & Offerings' })} />)
    expect(screen.getByText(/\(custom\) Tithes & Offerings/)).toBeInTheDocument()
  })

  it('groups categories under Expense / Income optgroups', () => {
    render(<BillDetailsEditor bill={mkBill({ category: null })} />)
    const select = screen.getByLabelText(/Category/i) as HTMLSelectElement
    const labels = Array.from(select.querySelectorAll('optgroup')).map(g => g.label)
    expect(labels).toContain('Expense')
    expect(labels).toContain('Income')
  })

  it('commits a notes change on blur, normalizing empty string to null', () => {
    render(<BillDetailsEditor bill={mkBill({ notes: 'old' })} />)
    const ta = screen.getByLabelText(/Notes/i)
    fireEvent.change(ta, { target: { value: '' } })
    fireEvent.blur(ta)
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { notes: null } })
  })

  it('toggles is_active via the checkbox', () => {
    render(<BillDetailsEditor bill={mkBill({ is_active: true })} />)
    fireEvent.click(screen.getByLabelText(/^Active/i))
    expect(mutateMock).toHaveBeenCalledWith({ id: 'b1', patch: { is_active: false } })
  })
})
