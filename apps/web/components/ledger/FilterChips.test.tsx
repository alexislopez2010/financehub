import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUseHouseholdMembersList = vi.fn<() => { data: ReadonlyArray<{ display_name: string }> }>()

vi.mock('@/lib/data/householdMembers', () => ({
  useHouseholdMembersList: () => mockUseHouseholdMembersList()
}))

import { FilterChips } from './FilterChips'

beforeEach(() => {
  mockUseHouseholdMembersList.mockReset()
  mockUseHouseholdMembersList.mockReturnValue({
    data: [
      { display_name: 'Alexis Lopez' },
      { display_name: 'Marilyn Lopez' }
    ]
  })
})

describe('<FilterChips> Member chip', () => {
  it('renders "Member ▼" trigger when filters.member is not set', () => {
    render(<FilterChips filters={{}} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /filter by member/i })).toBeInTheDocument()
  })

  it('renders "member: <value>" with a clear button when filters.member is set', () => {
    render(<FilterChips filters={{ member: 'Alexis Lopez' }} onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear member filter \(alexis lopez\)/i })
    expect(chip).toBeInTheDocument()
    expect(chip.textContent).toMatch(/member:/i)
    expect(chip.textContent).toMatch(/Alexis Lopez/)
  })

  it('clicking the clear button removes member from filters', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FilterChips filters={{ member: 'Alexis Lopez', account: 'Checking' }} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /clear member filter/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ account: 'Checking' })
  })

  it('opening the dropdown and picking a member sets filters.member', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FilterChips filters={{}} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /filter by member/i }))

    const item = await screen.findByRole('menuitem', { name: 'Marilyn Lopez' })
    await user.click(item)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith({ member: 'Marilyn Lopez' })
  })

  it('Family is offered as a synthetic option in the dropdown', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<FilterChips filters={{}} onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: /filter by member/i }))

    const family = await screen.findByRole('menuitem', { name: 'Family' })
    await user.click(family)

    expect(onChange).toHaveBeenCalledWith({ member: 'Family' })
  })

  it('does NOT offer an "(Unassigned)" option in the filter dropdown', async () => {
    const user = userEvent.setup()
    render(<FilterChips filters={{}} onChange={() => {}} />)

    await user.click(screen.getByRole('button', { name: /filter by member/i }))

    // Wait for the menu to settle
    await screen.findByRole('menuitem', { name: 'Family' })
    expect(screen.queryByRole('menuitem', { name: /\(Unassigned\)/i })).toBeNull()
  })
})
