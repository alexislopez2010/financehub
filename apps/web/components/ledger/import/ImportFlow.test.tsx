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

// Mock PreviewStep so this test stays focused on the state-machine wiring.
vi.mock('./PreviewStep', () => ({
  PreviewStep: ({
    onBack,
    onComplete
  }: {
    onBack: () => void
    onComplete: (r: unknown) => void
  }) => (
    <div>
      <p>mock-preview-step</p>
      <button type="button" onClick={onBack}>preview-back</button>
      <button type="button" onClick={() => onComplete({ inserted: 3, failed: [] })}>
        preview-finish
      </button>
    </div>
  )
}))

vi.mock('./CompleteStep', () => ({
  CompleteStep: ({ onReset }: { onReset: () => void }) => (
    <div>
      <p>mock-complete-step</p>
      <button type="button" onClick={onReset}>complete-reset</button>
    </div>
  )
}))

import { ImportFlow } from './ImportFlow'

describe('<ImportFlow>', () => {
  it('renders the upload step by default', () => {
    render(<ImportFlow />)
    expect(screen.getByRole('heading', { name: /import transactions/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mock-upload-trigger/i })).toBeInTheDocument()
  })

  it('advances to the preview step when the upload step emits a payload', async () => {
    const user = userEvent.setup()
    render(<ImportFlow />)
    await user.click(screen.getByRole('button', { name: /mock-upload-trigger/i }))
    expect(screen.getByText(/mock-preview-step/i)).toBeInTheDocument()
  })

  it('returns to the upload step from the preview back button', async () => {
    const user = userEvent.setup()
    render(<ImportFlow />)
    await user.click(screen.getByRole('button', { name: /mock-upload-trigger/i }))
    await user.click(screen.getByRole('button', { name: /preview-back/i }))
    expect(screen.getByRole('button', { name: /mock-upload-trigger/i })).toBeInTheDocument()
  })

  it('advances to the complete step when the preview completes, and resets back to upload', async () => {
    const user = userEvent.setup()
    render(<ImportFlow />)
    await user.click(screen.getByRole('button', { name: /mock-upload-trigger/i }))
    await user.click(screen.getByRole('button', { name: /preview-finish/i }))
    expect(screen.getByText(/mock-complete-step/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /complete-reset/i }))
    expect(screen.getByRole('button', { name: /mock-upload-trigger/i })).toBeInTheDocument()
  })
})
