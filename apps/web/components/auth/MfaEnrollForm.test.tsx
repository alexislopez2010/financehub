import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockEnroll = vi.fn()
const mockChallengeAndVerify = vi.fn()
const mockRouterReplace = vi.fn()
const mockRouterRefresh = vi.fn()
const mockSearchParamsGet = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({
    auth: {
      mfa: {
        enroll: mockEnroll,
        challengeAndVerify: mockChallengeAndVerify
      }
    }
  })
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
    push: vi.fn()
  }),
  useSearchParams: () => ({ get: mockSearchParamsGet })
}))

import { MfaEnrollForm } from './MfaEnrollForm'

const FAKE_ENROLL = {
  data: { id: 'factor-1', totp: { qr_code: '<svg data-testid="qr" />', secret: 'JBSWY3DPEHPK3PXP' } },
  error: null
}

beforeEach(() => {
  mockEnroll.mockReset()
  mockChallengeAndVerify.mockReset()
  mockRouterReplace.mockReset()
  mockRouterRefresh.mockReset()
  mockSearchParamsGet.mockReset()
  mockSearchParamsGet.mockReturnValue(null)
})

describe('<MfaEnrollForm>', () => {
  it('shows the loading message while enroll is pending', async () => {
    mockEnroll.mockReturnValueOnce(new Promise(() => {}))  // never resolves
    render(<MfaEnrollForm />)
    expect(await screen.findByText(/generating your authenticator code/i)).toBeInTheDocument()
  })

  it('renders QR + secret + code input after enroll succeeds', async () => {
    mockEnroll.mockResolvedValueOnce(FAKE_ENROLL)
    render(<MfaEnrollForm />)
    await waitFor(() => expect(screen.getByTestId('qr')).toBeInTheDocument())
    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument()
  })

  it('shows the secret when expanded', async () => {
    mockEnroll.mockResolvedValueOnce(FAKE_ENROLL)
    render(<MfaEnrollForm />)
    await waitFor(() => expect(screen.getByTestId('qr')).toBeInTheDocument())
    expect(screen.getByText(FAKE_ENROLL.data.totp.secret)).toBeInTheDocument()
  })

  it('shows enroll error inline when enrollment fails', async () => {
    mockEnroll.mockResolvedValueOnce({ data: null, error: { message: 'Could not enroll' } })
    render(<MfaEnrollForm />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not enroll')
  })

  it('rejects non-6-digit codes', async () => {
    mockEnroll.mockResolvedValueOnce(FAKE_ENROLL)
    render(<MfaEnrollForm />)
    await waitFor(() => expect(screen.getByTestId('qr')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '12345')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    expect(await screen.findByText(/enter the 6-digit code/i)).toBeInTheDocument()
    expect(mockChallengeAndVerify).not.toHaveBeenCalled()
  })

  it('verifies on submit and redirects to ?next= or /', async () => {
    mockEnroll.mockResolvedValueOnce(FAKE_ENROLL)
    mockChallengeAndVerify.mockResolvedValueOnce({ data: {}, error: null })
    mockSearchParamsGet.mockReturnValue('/briefing')
    render(<MfaEnrollForm />)
    await waitFor(() => expect(screen.getByTestId('qr')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '123456')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => {
      expect(mockChallengeAndVerify).toHaveBeenCalledWith({ factorId: 'factor-1', code: '123456' })
    })
    expect(mockRouterRefresh).toHaveBeenCalled()
    expect(mockRouterReplace).toHaveBeenCalledWith('/briefing')
  })

  it('shows the verify error message when verification fails', async () => {
    mockEnroll.mockResolvedValueOnce(FAKE_ENROLL)
    mockChallengeAndVerify.mockResolvedValueOnce({ data: null, error: { message: 'Invalid code' } })
    render(<MfaEnrollForm />)
    await waitFor(() => expect(screen.getByTestId('qr')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.type(screen.getByLabelText(/6-digit code/i), '999999')
    await user.click(screen.getByRole('button', { name: /verify/i }))
    await waitFor(() => {
      expect(screen.getAllByRole('alert')[0]).toHaveTextContent('Invalid code')
    })
    expect(mockRouterReplace).not.toHaveBeenCalled()
  })
})
