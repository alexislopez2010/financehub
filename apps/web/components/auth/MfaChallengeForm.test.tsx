import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockListFactors = vi.fn()
const mockChallengeAndVerify = vi.fn()
const mockRefreshSession = vi.fn()
const mockRouterReplace = vi.fn()
const mockRouterRefresh = vi.fn()
const mockSearchParamsGet = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: {
      refreshSession: mockRefreshSession,
      mfa: {
        listFactors: mockListFactors,
        challengeAndVerify: mockChallengeAndVerify
      }
    }
  })
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockRouterReplace, refresh: mockRouterRefresh, push: vi.fn() }),
  useSearchParams: () => ({ get: mockSearchParamsGet })
}))

import { MfaChallengeForm } from './MfaChallengeForm'

const FACTORS_OK = {
  data: { totp: [{ id: 'f1', status: 'verified' }, { id: 'f2', status: 'unverified' }] },
  error: null
}

beforeEach(() => {
  mockListFactors.mockReset()
  mockChallengeAndVerify.mockReset()
  mockRefreshSession.mockReset()
  mockRouterReplace.mockReset()
  mockRouterRefresh.mockReset()
  mockSearchParamsGet.mockReset()
  mockSearchParamsGet.mockReturnValue(null)
})

describe('<MfaChallengeForm>', () => {
  it('shows loading while factors load', async () => {
    mockListFactors.mockReturnValueOnce(new Promise(() => {}))
    render(<MfaChallengeForm />)
    expect(await screen.findByText(/loading…/i)).toBeInTheDocument()
  })

  it('renders the code input after a verified factor is found', async () => {
    mockListFactors.mockResolvedValueOnce(FACTORS_OK)
    render(<MfaChallengeForm />)
    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument()
  })

  it('shows an error when no verified factor exists', async () => {
    mockListFactors.mockResolvedValueOnce({ data: { totp: [{ id: 'x', status: 'unverified' }] }, error: null })
    render(<MfaChallengeForm />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no verified mfa factor/i)
  })

  it('shows the listFactors error message inline', async () => {
    mockListFactors.mockResolvedValueOnce({ data: null, error: { message: 'Network down' } })
    render(<MfaChallengeForm />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i)
  })

  it('rejects non-6-digit codes', async () => {
    mockListFactors.mockResolvedValueOnce(FACTORS_OK)
    render(<MfaChallengeForm />)
    await screen.findByLabelText(/6-digit code/i)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), 'abc')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByText(/enter the 6-digit code/i)).toBeInTheDocument()
    expect(mockChallengeAndVerify).not.toHaveBeenCalled()
  })

  it('verifies on submit and hard-navigates to ?next= after refreshSession', async () => {
    mockListFactors.mockResolvedValueOnce(FACTORS_OK)
    mockChallengeAndVerify.mockResolvedValueOnce({ data: {}, error: null })
    mockRefreshSession.mockResolvedValueOnce({ data: { session: null }, error: null })
    mockSearchParamsGet.mockReturnValue('/ledger')
    const assignSpy = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { assign: assignSpy, href: 'http://localhost/' }
    })
    render(<MfaChallengeForm />)
    await screen.findByLabelText(/6-digit code/i)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => {
      expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'f1', code: '123456' })
    })
    expect(mockRefreshSession).toHaveBeenCalled()
    expect(assignSpy).toHaveBeenCalledWith('/ledger')
  })

  it('shows the verify error message when verification fails', async () => {
    mockListFactors.mockResolvedValueOnce(FACTORS_OK)
    mockChallengeAndVerify.mockResolvedValueOnce({ data: null, error: { message: 'Invalid code' } })
    render(<MfaChallengeForm />)
    await screen.findByLabelText(/6-digit code/i)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '999999')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => {
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Invalid code')
    })
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('falls back to a friendly 422 message when Supabase returns no error message', async () => {
    mockListFactors.mockResolvedValueOnce(FACTORS_OK)
    // Real-world: Supabase 422 on stale TOTP sometimes returns empty message.
    mockChallengeAndVerify.mockResolvedValueOnce({ data: null, error: { message: '', status: 422 } })
    render(<MfaChallengeForm />)
    await screen.findByLabelText(/6-digit code/i)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '111111')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => {
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent(/invalid or expired code/i)
    })
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when verify throws with empty message', async () => {
    mockListFactors.mockResolvedValueOnce(FACTORS_OK)
    mockChallengeAndVerify.mockRejectedValueOnce(new Error(''))
    render(<MfaChallengeForm />)
    await screen.findByLabelText(/6-digit code/i)
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '222222')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => {
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent(/verification failed/i)
    })
  })
})
