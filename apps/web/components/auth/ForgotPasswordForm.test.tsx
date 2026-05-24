import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockReset = vi.fn()
vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({ auth: { resetPasswordForEmail: mockReset } })
}))

import { ForgotPasswordForm } from './ForgotPasswordForm'

beforeEach(() => {
  mockReset.mockReset()
  // jsdom: provide window.location.origin
  Object.defineProperty(window, 'location', {
    value: { origin: 'http://localhost:3100' },
    writable: true
  })
})

describe('<ForgotPasswordForm>', () => {
  it('validates the email format', async () => {
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.click(screen.getByRole('button', { name: /send reset email/i }))
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument()
    expect(mockReset).not.toHaveBeenCalled()
  })

  it('calls Supabase with the email and the callback URL', async () => {
    mockReset.mockResolvedValueOnce({ data: {}, error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: /send reset email/i }))
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith('alex@example.com', {
        redirectTo: 'http://localhost:3100/auth/callback?next=/reset-password'
      })
    })
  })

  it('shows a confirmation message after success', async () => {
    mockReset.mockResolvedValueOnce({ data: {}, error: null })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: /send reset email/i }))
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument()
  })

  it('shows the Supabase error message on failure', async () => {
    mockReset.mockResolvedValueOnce({ data: null, error: { message: 'Too many requests' } })
    const user = userEvent.setup()
    render(<ForgotPasswordForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: /send reset email/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests')
  })
})
