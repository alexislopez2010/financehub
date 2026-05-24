import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockSignOut = vi.fn()
const mockReplace = vi.fn()
const mockRefresh = vi.fn()

vi.mock('@/lib/supabase/browser', () => ({
  createClient: () => ({ auth: { signOut: mockSignOut } })
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh, push: vi.fn() })
}))

import { ProfileMenu } from './ProfileMenu'

beforeEach(() => {
  mockSignOut.mockReset()
  mockReplace.mockReset()
  mockRefresh.mockReset()
})

describe('<ProfileMenu>', () => {
  it('renders initials from the email local part', () => {
    render(<ProfileMenu email="alexis.hiram@gmail.com" />)
    expect(screen.getByRole('button')).toHaveTextContent('AL')
  })

  it('toggles the menu on click', async () => {
    const user = userEvent.setup()
    render(<ProfileMenu email="alex@example.com" />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('alex@example.com')).toBeInTheDocument()
  })

  it('signs the user out and redirects to /login', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(<ProfileMenu email="alex@example.com" />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: /sign out/i }))
    await waitFor(() => expect(mockSignOut).toHaveBeenCalled())
    expect(mockRefresh).toHaveBeenCalled()
    expect(mockReplace).toHaveBeenCalledWith('/login')
  })
})
