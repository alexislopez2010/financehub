import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FamilyMemberRow } from '@/lib/data/familyMembers'
import { PlaceholderMemberRow } from './PlaceholderMemberRow'

function makeRow(over: Partial<FamilyMemberRow> = {}): FamilyMemberRow {
  return {
    id: 'fm1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Olivia Lopez',
    relationship: 'Daughter',
    created_at: '2025-05-01T00:00:00Z',
    ...over
  }
}

function setup(over: Partial<FamilyMemberRow> = {}) {
  const onEdit = vi.fn()
  const onPromote = vi.fn()
  const onRemove = vi.fn()
  // Wrap in a <ul> so the <li> markup is well-formed for jsdom.
  render(
    <ul>
      <PlaceholderMemberRow
        member={makeRow(over)}
        onEdit={onEdit}
        onPromote={onPromote}
        onRemove={onRemove}
      />
    </ul>
  )
  return { onEdit, onPromote, onRemove }
}

describe('<PlaceholderMemberRow>', () => {
  it('renders the name, relationship, and PLACEHOLDER pill', () => {
    setup()
    expect(screen.getByText('Olivia Lopez')).toBeInTheDocument()
    expect(screen.getByText('Daughter')).toBeInTheDocument()
    expect(screen.getByText(/placeholder/i)).toBeInTheDocument()
  })

  it('fires onPromote when the Promote button is clicked', async () => {
    const { onPromote } = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /promote olivia lopez/i }))
    expect(onPromote).toHaveBeenCalledTimes(1)
  })

  it('fires onRemove when the Remove button is clicked', async () => {
    const { onRemove } = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /remove olivia lopez/i }))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it('fires onEdit when the Edit button is clicked', async () => {
    const { onEdit } = setup()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /edit olivia lopez/i }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it('hides the relationship line when relationship is null', () => {
    setup({ relationship: null })
    expect(screen.queryByText('Daughter')).toBeNull()
  })
})
