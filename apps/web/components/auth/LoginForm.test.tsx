import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Hoisted mocks
const mockSignInWithPassword = vi.fn()
const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockRouterRefresh = vi.fn()
const mockSearchParamsGet = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: { signInWithPassword: mockSignInWithPassword }
  })
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh
  }),
  useSearchParams: () => ({ get: mockSearchParamsGet })
}))

import { LoginForm } from './LoginForm'

beforeEach(() => {
  mockSignInWithPassword.mockReset()
  mockRouterPush.mockReset()
  mockRouterReplace.mockReset()
  mockRouterRefresh.mockReset()
  mockSearchParamsGet.mockReset()
  mockSearchParamsGet.mockReturnValue(null)
})

describe('<LoginForm>', () => {
  it('shows validation errors for invalid email and short password', async () => {
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'short')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument()
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
    expect(mockSignInWithPassword).not.toHaveBeenCalled()
  })

  it('calls Supabase and redirects on success', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: {}, error: null })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/password/i), 'longenoughpw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'alex@example.com',
        password: 'longenoughpw'
      })
    })
    expect(mockRouterRefresh).toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith('/')
  })

  it('honors ?next= for the post-login redirect target', async () => {
    mockSearchParamsGet.mockReturnValue('/ledger?account=chase')
    mockSignInWithPassword.mockResolvedValueOnce({ data: {}, error: null })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/password/i), 'longenoughpw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/ledger?account=chase')
    })
  })

  it('shows the Supabase error message inline on failure', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({ data: null, error: { message: 'Invalid login credentials' } })
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/password/i), 'longenoughpw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('disables the submit button while pending', async () => {
    let resolve: ((v: { data: object; error: null }) => void) = () => {}
    mockSignInWithPassword.mockReturnValueOnce(new Promise(r => { resolve = r }))
    const user = userEvent.setup()
    render(<LoginForm />)
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/password/i), 'longenoughpw')
    await user.click(screen.getByRole('button', { name: /sign in/i }))
    const btn = await screen.findByRole('button', { name: /signing in/i })
    expect(btn).toBeDisabled()
    resolve({ data: {}, error: null })
  })
})
