import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { InsertResult } from '@/lib/import/insert'
import type { ImportRow } from '@/lib/import/adapters/types'
import { CompleteStep } from './CompleteStep'

function makeRow(description: string): ImportRow {
  return {
    date: '2026-05-21',
    description,
    amount: -1,
    type: 'Expense',
    categoryId: null,
    billId: null,
    fingerprint: 'fp-' + description,
    source: 'chase'
  }
}

describe('<CompleteStep>', () => {
  it('renders the inserted count and account name', () => {
    const result: InsertResult = { inserted: 3, failed: [] }
    render(
      <CompleteStep
        result={result}
        accountId="acc-1"
        accountName="Chase Checking"
        dateRange={{ start: '2026-04-12', end: '2026-05-21' }}
        onReset={() => {}}
      />
    )
    expect(screen.getByText(/imported 3 transactions/i)).toBeInTheDocument()
    expect(screen.getByText(/into chase checking/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /view in ledger/i })).toHaveAttribute(
      'href',
      expect.stringContaining('account=Chase+Checking')
    )
  })

  it('calls onReset when "Import another" is clicked', async () => {
    const user = userEvent.setup()
    const onReset = vi.fn()
    render(
      <CompleteStep
        result={{ inserted: 1, failed: [] }}
        accountId="acc-1"
        accountName="Chase Checking"
        dateRange={{ start: '2026-05-21', end: '2026-05-21' }}
        onReset={onReset}
      />
    )
    await user.click(screen.getByRole('button', { name: /import another/i }))
    expect(onReset).toHaveBeenCalledTimes(1)
  })

  it('renders failed rows inside an alert with details', () => {
    const result: InsertResult = {
      inserted: 1,
      failed: [
        { row: makeRow('BAD ROW'), error: 'duplicate fingerprint' }
      ]
    }
    render(
      <CompleteStep
        result={result}
        accountId="acc-1"
        accountName="Chase Checking"
        dateRange={{ start: '2026-05-21', end: '2026-05-21' }}
        onReset={() => {}}
      />
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/1 row failed to import/i)
    expect(screen.getByText('BAD ROW')).toBeInTheDocument()
    expect(screen.getByText(/duplicate fingerprint/i)).toBeInTheDocument()
  })
})
