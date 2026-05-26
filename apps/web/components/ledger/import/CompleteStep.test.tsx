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

  it('renders failure headline when inserted=0 and no failed rows (all skipped upstream)', () => {
    const result: InsertResult = { inserted: 0, failed: [] }
    render(
      <CompleteStep
        result={result}
        accountId="acc-1"
        accountName="Chase Checking"
        dateRange={{ start: '2026-05-21', end: '2026-05-21' }}
        onReset={() => {}}
      />
    )
    expect(screen.getByText(/import didn't insert anything/i)).toBeInTheDocument()
    expect(screen.getByText(/no rows were available to insert/i)).toBeInTheDocument()
    expect(screen.queryByText(/imported 0 transactions/i)).not.toBeInTheDocument()
    // No "View in Ledger" link on failure.
    expect(screen.queryByRole('link', { name: /view in ledger/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /back to upload/i })).toBeInTheDocument()
  })

  it('renders failure headline + expanded details when inserted=0 and failed rows present', () => {
    const result: InsertResult = {
      inserted: 0,
      failed: [
        { row: makeRow('ROW A'), error: 'constraint violation' },
        { row: makeRow('ROW B'), error: 'constraint violation' }
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
    expect(screen.getByText(/import didn't insert anything/i)).toBeInTheDocument()
    expect(screen.getByText(/all 2 rows failed at insert/i)).toBeInTheDocument()
    // Failure <details> must be auto-expanded. Anchor on the <summary>
    // (the only one in this view) rather than the "See details" text, which
    // also appears in the headline subtext.
    const summary = document.querySelector('summary')
    expect(summary).not.toBeNull()
    const detailsEl = summary?.closest('details') ?? null
    expect(detailsEl).not.toBeNull()
    expect(detailsEl).toHaveAttribute('open')
    // Failed rows visible because details is open.
    expect(screen.getByText('ROW A')).toBeInTheDocument()
    expect(screen.getByText('ROW B')).toBeInTheDocument()
  })

  it('auto-expands failure details on partial failure (inserted > 0 and failed > 0)', () => {
    const result: InsertResult = {
      inserted: 5,
      failed: [{ row: makeRow('PARTIAL FAIL'), error: 'fk violation' }]
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
    // Success headline still appears…
    expect(screen.getByText(/imported 5 transactions/i)).toBeInTheDocument()
    // …but failure <details> must be auto-expanded so the user notices.
    const detailsEl = screen.getByText(/see details/i).closest('details')
    expect(detailsEl).not.toBeNull()
    expect(detailsEl).toHaveAttribute('open')
    expect(screen.getByText('PARTIAL FAIL')).toBeInTheDocument()
  })

  it('does not render any failure panel on pure success', () => {
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
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.queryByText(/see details/i)).not.toBeInTheDocument()
  })
})
