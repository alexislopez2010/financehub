import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUseHouseholdMembersList = vi.fn<() => { data: ReadonlyArray<{ display_name: string }> }>()

vi.mock('@/lib/data/householdMembers', () => ({
  useHouseholdMembersList: () => mockUseHouseholdMembersList()
}))

import { MemberFilter } from './MemberFilter'

beforeEach(() => {
  mockUseHouseholdMembersList.mockReset()
  mockUseHouseholdMembersList.mockReturnValue({
    data: [
      { display_name: 'Alexis Lopez' },
      { display_name: 'Marilyn Lopez' }
    ]
  })
})

describe('<MemberFilter>', () => {
  it('renders "Member ▼" trigger when value is undefined', () => {
    render(<MemberFilter value={undefined} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: /filter by member/i })).toBeInTheDocument()
  })

  it('renders set state with value + clear button', () => {
    render(<MemberFilter value="Alexis Lopez" onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear member filter \(alexis lopez\)/i })
    expect(chip.textContent).toMatch(/Alexis Lopez/)
  })

  it('clicking clear chip calls onChange(undefined)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MemberFilter value="Alexis Lopez" onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /clear member filter/i }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })

  it('picking a member fires onChange with the name', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MemberFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by member/i }))
    const item = await screen.findByRole('menuitem', { name: 'Marilyn Lopez' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith('Marilyn Lopez')
  })

  it('renders (Unassigned) as the first option in the dropdown', async () => {
    const user = userEvent.setup()
    render(<MemberFilter value={undefined} onChange={() => {}} />)
    await user.click(screen.getByRole('button', { name: /filter by member/i }))

    const items = await screen.findAllByRole('menuitem')
    expect(items[0]?.textContent).toBe('(Unassigned)')
  })

  it('picking (Unassigned) calls onChange(null)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MemberFilter value={undefined} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /filter by member/i }))
    const item = await screen.findByRole('menuitem', { name: '(Unassigned)' })
    await user.click(item)
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renders "(Unassigned)" label when value is null', () => {
    render(<MemberFilter value={null} onChange={() => {}} />)
    const chip = screen.getByRole('button', { name: /clear member filter \(\(unassigned\)\)/i })
    expect(chip.textContent).toMatch(/\(Unassigned\)/)
  })

  it('clicking clear chip when value=null calls onChange(undefined)', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<MemberFilter value={null} onChange={onChange} />)
    await user.click(screen.getByRole('button', { name: /clear member filter/i }))
    expect(onChange).toHaveBeenCalledWith(undefined)
  })
})
