import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockUpdateUser = vi.fn()
const mockReplace = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({ auth: { updateUser: mockUpdateUser } })
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh, push: vi.fn() })
}))

import { ResetPasswordForm } from './ResetPasswordForm'

beforeEach(() => {
  mockUpdateUser.mockReset()
  mockReplace.mockReset()
  mockRefresh.mockReset()
})

describe('<ResetPasswordForm>', () => {
  it('rejects short passwords', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordForm />)
    await user.type(screen.getByLabelText(/^new password/i), 'short')
    await user.type(screen.getByLabelText(/confirm new password/i), 'short')
    await user.click(screen.getByRole('button', { name: /set new password/i }))
    expect(await screen.findByText(/at least 12 characters/i)).toBeInTheDocument()
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('rejects mismatched confirmations', async () => {
    const user = userEvent.setup()
    render(<ResetPasswordForm />)
    await user.type(screen.getByLabelText(/^new password/i), 'longenoughpassword')
    await user.type(screen.getByLabelText(/confirm new password/i), 'differentpassword!!')
    await user.click(screen.getByRole('button', { name: /set new password/i }))
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  it('updates the password and redirects on success', async () => {
    mockUpdateUser.mockResolvedValueOnce({ data: {}, error: null })
    const user = userEvent.setup()
    render(<ResetPasswordForm />)
    await user.type(screen.getByLabelText(/^new password/i), 'a-good-strong-pw')
    await user.type(screen.getByLabelText(/confirm new password/i), 'a-good-strong-pw')
    await user.click(screen.getByRole('button', { name: /set new password/i }))
    await waitFor(() => {
      expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'a-good-strong-pw' })
    })
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/')
  })

  it('shows the Supabase error message on failure', async () => {
    mockUpdateUser.mockResolvedValueOnce({ data: null, error: { message: 'Session expired' } })
    const user = userEvent.setup()
    render(<ResetPasswordForm />)
    await user.type(screen.getByLabelText(/^new password/i), 'a-good-strong-pw')
    await user.type(screen.getByLabelText(/confirm new password/i), 'a-good-strong-pw')
    await user.click(screen.getByRole('button', { name: /set new password/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Session expired')
  })
})
