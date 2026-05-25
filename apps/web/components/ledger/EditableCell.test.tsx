import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { EditableCell } from './EditableCell'

describe('<EditableCell variant="text">', () => {
  it('renders display in read mode by default', () => {
    render(<EditableCell variant="text" value="hello" onCommit={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('hello')
  })

  it('clicking enters edit mode', async () => {
    const user = userEvent.setup()
    render(<EditableCell variant="text" value="hello" onCommit={() => {}} />)
    await user.click(screen.getByRole('button'))
    expect(screen.getByRole('textbox')).toHaveValue('hello')
  })

  it('Enter commits the changed value', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="text" value="hello" onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'world{Enter}')
    expect(onCommit).toHaveBeenCalledWith('world')
  })

  it('Esc cancels without committing', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="text" value="hello" onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'world{Escape}')
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('blur commits the changed value', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="text" value="hello" onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, 'world')
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith('world')
  })

  it('does not call onCommit when value is unchanged', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="text" value="hello" onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('renders custom display node', () => {
    render(
      <EditableCell
        variant="text"
        value="hello"
        onCommit={() => {}}
        display={<em>HELLO</em>}
      />
    )
    expect(screen.getByText('HELLO').tagName).toBe('EM')
  })
})

describe('<EditableCell variant="number">', () => {
  it('commits parsed number on Enter', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="number" value={100} onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '250.50{Enter}')
    expect(onCommit).toHaveBeenCalledWith(250.5)
  })

  it('ignores NaN input on commit', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="number" value={100} onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    const input = screen.getByRole('spinbutton')
    await user.clear(input)
    await user.tab()
    expect(onCommit).not.toHaveBeenCalled()
  })
})

describe('<EditableCell variant="select">', () => {
  const options = [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo' }
  ]

  it('renders display by default', () => {
    render(<EditableCell variant="select" value="a" options={options} onCommit={() => {}} display={<span>Alpha</span>} />)
    expect(screen.getByRole('button')).toHaveTextContent('Alpha')
  })

  it('commits selected value on change + blur', async () => {
    const onCommit = vi.fn()
    const user = userEvent.setup()
    render(<EditableCell variant="select" value="a" options={options} onCommit={onCommit} />)
    await user.click(screen.getByRole('button'))
    const sel = screen.getByRole('combobox')
    await user.selectOptions(sel, 'b')
    await user.tab()
    expect(onCommit).toHaveBeenCalledWith('b')
  })
})
