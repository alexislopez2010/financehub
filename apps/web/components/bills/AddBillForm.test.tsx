import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AddBillForm, groupCategoriesByType, type CategoryOption, type AccountOption } from './AddBillForm'

const noop = () => {}

const CATEGORIES: ReadonlyArray<CategoryOption> = [
  { name: 'Groceries', type: 'expense' },
  { name: 'Housing', type: 'expense' },
  { name: 'Salary', type: 'income' },
  { name: 'Bonus', type: 'income' },
  { name: 'Misc', type: 'savings' }  // anything not expense/income goes to Other bucket
]

const ACCOUNTS: ReadonlyArray<AccountOption> = [
  { name: 'Chase Checking' },
  { name: 'Apple Card' }
]

describe('groupCategoriesByType', () => {
  it('splits options into expense / income / other buckets sorted alphabetically', () => {
    const result = groupCategoriesByType(CATEGORIES)
    expect(result.expense.map(c => c.name)).toEqual(['Groceries', 'Housing'])
    expect(result.income.map(c => c.name)).toEqual(['Bonus', 'Salary'])
    expect(result.other.map(c => c.name)).toEqual(['Misc'])
  })

  it('dedupes by case-insensitive name', () => {
    const result = groupCategoriesByType([
      { name: 'Groceries', type: 'expense' },
      { name: 'groceries', type: 'expense' },
      { name: 'GROCERIES', type: 'expense' }
    ])
    expect(result.expense).toHaveLength(1)
  })

  it('skips empty names', () => {
    const result = groupCategoriesByType([
      { name: '', type: 'expense' },
      { name: '   ', type: 'income' },
      { name: 'Salary', type: 'income' }
    ])
    expect(result.expense).toHaveLength(0)
    expect(result.income).toEqual([{ name: 'Salary', type: 'income' }])
  })
})

describe('<AddBillForm>', () => {
  it('renders category options grouped under Expense and Income', () => {
    render(
      <AddBillForm
        categoryOptions={CATEGORIES}
        accountOptions={ACCOUNTS}
        isSubmitting={false}
        onSubmit={noop}
      />
    )
    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement
    const groupLabels = Array.from(categorySelect.querySelectorAll('optgroup')).map(g => g.label)
    expect(groupLabels).toContain('Expense')
    expect(groupLabels).toContain('Income')
    // Each known category shows up exactly once.
    expect(within(categorySelect).getByText('Groceries')).toBeInTheDocument()
    expect(within(categorySelect).getByText('Salary')).toBeInTheDocument()
    // The "Other…" custom-entry sentinel is present.
    expect(within(categorySelect).getByText('Other…')).toBeInTheDocument()
  })

  it('renders account options as a select with optional placeholder', () => {
    render(
      <AddBillForm
        categoryOptions={CATEGORIES}
        accountOptions={ACCOUNTS}
        isSubmitting={false}
        onSubmit={noop}
      />
    )
    const accountSelect = screen.getByLabelText('Account (optional)') as HTMLSelectElement
    expect(within(accountSelect).getByText(/Account \(optional\)/i)).toBeInTheDocument()
    expect(within(accountSelect).getByText('Chase Checking')).toBeInTheDocument()
    expect(within(accountSelect).getByText('Apple Card')).toBeInTheDocument()
  })

  it('submits the selected category name and account name as free-text strings', () => {
    const onSubmit = vi.fn()
    render(
      <AddBillForm
        categoryOptions={CATEGORIES}
        accountOptions={ACCOUNTS}
        isSubmitting={false}
        onSubmit={onSubmit}
      />
    )
    fireEvent.change(screen.getByLabelText('Bill name'), { target: { value: 'Electric' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Housing' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '220' } })
    fireEvent.change(screen.getByLabelText('Account (optional)'), { target: { value: 'Chase Checking' } })
    fireEvent.click(screen.getByRole('button', { name: /add bill/i }))

    expect(onSubmit).toHaveBeenCalledTimes(1)
    const payload = onSubmit.mock.calls[0]?.[0]
    expect(payload).toMatchObject({
      name: 'Electric',
      category: 'Housing',
      account: 'Chase Checking',
      budget_amount: 220
    })
  })

  it('sends null for category and account when neither is selected', () => {
    const onSubmit = vi.fn()
    render(
      <AddBillForm
        categoryOptions={CATEGORIES}
        accountOptions={ACCOUNTS}
        isSubmitting={false}
        onSubmit={onSubmit}
      />
    )
    fireEvent.change(screen.getByLabelText('Bill name'), { target: { value: 'Bare bill' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: /add bill/i }))

    const payload = onSubmit.mock.calls[0]?.[0]
    expect(payload).toMatchObject({ category: null, account: null })
  })

  it('reveals a custom category input when "Other…" is selected and submits the typed value', () => {
    const onSubmit = vi.fn()
    render(
      <AddBillForm
        categoryOptions={CATEGORIES}
        accountOptions={ACCOUNTS}
        isSubmitting={false}
        onSubmit={onSubmit}
      />
    )
    fireEvent.change(screen.getByLabelText('Bill name'), { target: { value: 'Niche bill' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: '__other__' } })
    // Custom input appears.
    const custom = screen.getByLabelText('Custom category name')
    fireEvent.change(custom, { target: { value: 'Hobbies' } })
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: /add bill/i }))

    const payload = onSubmit.mock.calls[0]?.[0]
    expect(payload?.category).toBe('Hobbies')
  })

  it('does not submit when amount is missing or name is empty', () => {
    const onSubmit = vi.fn()
    render(
      <AddBillForm
        categoryOptions={CATEGORIES}
        accountOptions={ACCOUNTS}
        isSubmitting={false}
        onSubmit={onSubmit}
      />
    )
    // Empty name, with amount filled — required attr will block the browser, but
    // even if it submitted, the handler trims and bails.
    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /add bill/i }))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('hides empty optgroups when a bucket has no options', () => {
    render(
      <AddBillForm
        categoryOptions={[{ name: 'Salary', type: 'income' }]}
        accountOptions={[]}
        isSubmitting={false}
        onSubmit={noop}
      />
    )
    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement
    const labels = Array.from(categorySelect.querySelectorAll('optgroup')).map(g => g.label)
    expect(labels).toContain('Income')
    expect(labels).not.toContain('Expense')
    expect(labels).not.toContain('Other')
  })
})
