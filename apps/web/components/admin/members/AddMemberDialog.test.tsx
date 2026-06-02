import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AddHouseholdMemberResult } from '@/lib/data/admin'

const mockMutateAsync = vi.fn()
const mockReset = vi.fn()
const mockUseAdd = vi.fn(() => ({
  mutateAsync: mockMutateAsync,
  reset: mockReset,
  isPending: false,
  data: undefined as AddHouseholdMemberResult | undefined,
  error: null as Error | null
}))

const mockCreateFamilyMutate = vi.fn()
const mockCreateFamilyReset = vi.fn()
const mockUseCreateFamily = vi.fn(() => ({
  mutateAsync: mockCreateFamilyMutate,
  reset: mockCreateFamilyReset,
  isPending: false,
  data: undefined,
  error: null
}))

vi.mock('@/lib/data/admin', async () => ({
  useAddHouseholdMember: () => mockUseAdd()
}))

vi.mock('@/lib/data/familyMembers', async () => ({
  useCreateFamilyMember: () => mockUseCreateFamily()
}))

import { AddMemberDialog } from './AddMemberDialog'

beforeEach(() => {
  mockMutateAsync.mockReset()
  mockReset.mockReset()
  mockUseAdd.mockReset()
  mockUseAdd.mockReturnValue({
    mutateAsync: mockMutateAsync,
    reset: mockReset,
    isPending: false,
    data: undefined,
    error: null
  })
  mockCreateFamilyMutate.mockReset()
  mockCreateFamilyReset.mockReset()
  mockUseCreateFamily.mockReset()
  mockUseCreateFamily.mockReturnValue({
    mutateAsync: mockCreateFamilyMutate,
    reset: mockCreateFamilyReset,
    isPending: false,
    data: undefined,
    error: null
  })
})

describe('<AddMemberDialog>', () => {
  it('renders the form when open', () => {
    render(<AddMemberDialog open onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /add member/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    // Role segmented control buttons (Edit dialog pattern).
    expect(screen.getByRole('button', { name: /^member$/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^owner$/i })).toBeInTheDocument()
  })

  it('submits the form with the typed values', async () => {
    mockMutateAsync.mockResolvedValue({
      userId: 'u-new',
      email: 'b@example.com',
      initialPassword: 'pw',
      displayName: 'Bob',
      role: 'member'
    })
    const user = userEvent.setup()
    render(<AddMemberDialog open onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'b@example.com')
    await user.type(screen.getByLabelText(/display name/i), 'Bob')
    await user.click(screen.getByRole('button', { name: /^owner$/i }))
    await user.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() =>
      expect(mockMutateAsync).toHaveBeenCalledWith({
        email: 'b@example.com',
        displayName: 'Bob',
        role: 'owner'
      })
    )
  })

  it('renders the success view with the generated password when mutation has data', () => {
    mockUseAdd.mockReturnValue({
      mutateAsync: mockMutateAsync,
      reset: mockReset,
      isPending: false,
      data: {
        userId: 'u-new',
        email: 'b@example.com',
        initialPassword: 'sup3r-S3cret!',
        displayName: 'Bob',
        role: 'member'
      },
      error: null
    })

    render(<AddMemberDialog open onClose={vi.fn()} />)
    // "Member added" appears twice (Dialog.Title heading + the inline check banner).
    expect(screen.getAllByText(/member added/i).length).toBeGreaterThan(0)
    expect(screen.getByTestId('initial-password')).toHaveTextContent('sup3r-S3cret!')
    expect(screen.getByRole('button', { name: /copy initial password/i })).toBeInTheDocument()
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /done/i })).toBeInTheDocument()
  })

  it('writes the password to the clipboard when Copy is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true
    })

    mockUseAdd.mockReturnValue({
      mutateAsync: mockMutateAsync,
      reset: mockReset,
      isPending: false,
      data: {
        userId: 'u-new',
        email: 'b@example.com',
        initialPassword: 'sup3r-S3cret!',
        displayName: 'Bob',
        role: 'member'
      },
      error: null
    })

    render(<AddMemberDialog open onClose={vi.fn()} />)

    // Use fireEvent here to avoid userEvent's own clipboard handling — we want
    // the real navigator.clipboard.writeText we installed above to fire.
    fireEvent.click(screen.getByRole('button', { name: /copy initial password/i }))

    await waitFor(() => expect(writeText).toHaveBeenCalledWith('sup3r-S3cret!'))
  })

  it('surfaces the mutation error inline', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('only owners can add members'))
    const user = userEvent.setup()
    render(<AddMemberDialog open onClose={vi.fn()} />)

    await user.type(screen.getByLabelText(/email/i), 'b@example.com')
    await user.type(screen.getByLabelText(/display name/i), 'Bob')
    await user.click(screen.getByRole('button', { name: /add member/i }))

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/only owners can add members/i)
    )
  })
})
