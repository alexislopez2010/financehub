import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock UploadStep so we can drive the flow without touching Supabase/IO.
vi.mock('./UploadStep', () => ({
  UploadStep: ({ onParsed }: { onParsed: (p: unknown) => void }) => (
    <button
      type="button"
      onClick={() =>
        onParsed({
          accountId: 'acc-1',
          accountName: 'Chase Checking',
          adapterName: 'Chase',
          parsedRows: [],
          duplicateRows: [],
          skipped: []
        })
      }
    >
      mock-upload-trigger
    </button>
  )
}))

import { ImportFlow } from './ImportFlow'

describe('<ImportFlow>', () => {
  it('renders the upload step by default', () => {
    render(<ImportFlow />)
    expect(screen.getByRole('heading', { name: /import transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mock-upload-trigger/i })).toBeInTheDocument()
  })

  it('advances to preview when the upload step emits a payload', async () => {
    const user = userEvent.setup()
    render(<ImportFlow />)
    await user.click(screen.getByRole('button', { name: /mock-upload-trigger/i }))
    expect(screen.getByText(/preview ui lands in phase 3a t3/i)).toBeInTheDocument()
  })

  it('returns to the upload step when the placeholder back button is clicked', async () => {
    const user = userEvent.setup()
    render(<ImportFlow />)
    await user.click(screen.getByRole('button', { name: /mock-upload-trigger/i }))
    await user.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByRole('button', { name: /mock-upload-trigger/i })).toBeInTheDocument()
  })
})
