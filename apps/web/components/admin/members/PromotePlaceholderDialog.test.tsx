import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PromoteFamilyMemberResult } from '@/lib/data/admin'
import type { FamilyMemberRow } from '@/lib/data/familyMembers'

const mockMutateAsync = vi.fn()
const mockReset = vi.fn()
const mockUsePromote = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  reset: mockReset,
  isPending: false,
  data: undefined as PromoteFamilyMemberResult | undefined,
  error: null as Error | null
}))

vi.mock('@/lib/data/admin', async () => ({
  usePromoteFamilyMember: () => mockUsePromote()
}))

import { PromotePlaceholderDialog } from './PromotePlaceholderDialog'

function makePlaceholder(over: Partial<FamilyMemberRow> = {}): FamilyMemberRow {
  return {
    id: 'fm1',
    household_id: '00000000-0000-0000-0000-000000000001',
    name: 'Olivia Lopez',
    relationship: 'Daughter',
    created_at: '2025-05-01T00:00:00Z',
    ...over
  }
}

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockReset.mockReset()
  mockUsePromote.mockReset()
  mockUsePromote.mockReturnValue({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: false,
    data: undefined,
    error: null
  })
})

describe('<PromotePlaceholderDialog>', () => {
  it('renders the form prefilled with the placeholder name', () => {
    render(<PromotePlaceholderDialog placeholder={makePlaceholder()} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /promote placeholder/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    const nameInput = screen.getByLabelText(/display name/i) as HTMLInputElement
    expect(nameInput.value).toBe('Olivia Lopez')
  })

  it('calls the promote hook with the family member id, email, display name, and role', async () => {
    mockMutateAsync.mockResolvedValue({
      userId: 'u-new',
      email: 'olivia@example.com',
      initialPassword: 'pw',
      displayName: 'Olivia Lopez',
      role: 'member'
    })
    const user = userEvent.setup()
    render(<PromotePlaceholderDialog placeholder={makePlaceholder()} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'olivia@example.com')
    await user.click(screen.getByRole('button', { name: /^promote$/i }))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        family_member_id: 'fm1',
        email: 'olivia@example.com',
        displayName: 'Olivia Lopez',
        role: 'member'
      })
    )
  })

  it('renders the initial password with copy button when promotion succeeds', () => {
    mockUsePromote.mockReturnValue({
      mutateAsync: mockMutateAsync,
      reset: mockReset,
      isPending: false,
      data: {
        userId: 'u-new',
        email: 'olivia@example.com',
        initialPassword: 'sup3r-S3cret!',
        displayName: 'Olivia Lopez',
        role: 'member'
      },
      error: null
    })

    render(<PromotePlaceholderDialog placeholder={makePlaceholder()} onClose={vi.fn()} />)
    expect(screen.getByTestId('initial-password')).toHaveTextContent('sup3r-S3cret!')
    expect(screen.getByRole('button', { name: /copy initial password/i })).toBeInTheDocument()
    expect(screen.getByText(/copy now/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
  })

  it('surfaces the mutation error inline', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('only owners can promote'))
    const user = userEvent.setup()
    render(<PromotePlaceholderDialog placeholder={makePlaceholder()} onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'olivia@example.com')
    await user.click(screen.getByRole('button', { name: /^promote$/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/only owners can promote/i)
    )
  })
})
