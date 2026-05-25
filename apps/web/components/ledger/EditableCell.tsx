'use client'

import { useState, useEffect, useRef, type ReactNode, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

export interface EditableTextProps {
  variant: 'text'
  value: string
  onCommit: (next: string) => void
  /** Display when not editing. Defaults to value. Use this to render a badge etc. */
  display?: ReactNode
  className?: string
  inputClassName?: string
  placeholder?: string
}

export interface EditableNumberProps {
  variant: 'number'
  value: number
  onCommit: (next: number) => void
  display?: ReactNode
  className?: string
  inputClassName?: string
  step?: number
}

export interface SelectOption {
  value: string
  label: string
}

export interface EditableSelectProps {
  variant: 'select'
  value: string
  options: ReadonlyArray<SelectOption>
  onCommit: (next: string) => void
  display?: ReactNode
  className?: string
  inputClassName?: string
}

export type EditableCellProps = EditableTextProps | EditableNumberProps | EditableSelectProps

/**
 * Inline-edit cell. Click to enter edit mode; Enter or blur commits;
 * Esc reverts. The display node is rendered when not editing (defaults
 * to a div with the raw value).
 *
 * The cell DOES NOT manage loading/error UI — the caller's onCommit
 * is expected to delegate to a mutation hook (with optimistic update).
 */
export function EditableCell(props: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  // Local draft for in-progress edits. Reset whenever upstream value changes.
  const [draft, setDraft] = useState<string>(() => initialDraft(props))
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null)

  useEffect(() => {
    if (!editing) setDraft(initialDraft(props))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, props.value])

  useEffect(() => {
    if (editing) {
      // Focus + select on enter-edit
      inputRef.current?.focus()
      if (inputRef.current && 'select' in inputRef.current) {
        (inputRef.current as HTMLInputElement).select()
      }
    }
  }, [editing])

  function startEditing() {
    setDraft(initialDraft(props))
    setEditing(true)
  }

  function cancel() {
    setDraft(initialDraft(props))
    setEditing(false)
  }

  function commit() {
    setEditing(false)
    if (props.variant === 'number') {
      const n = parseFloat(draft)
      if (!Number.isNaN(n) && n !== props.value) props.onCommit(n)
    } else {
      if (draft !== String(props.value)) {
        props.onCommit(draft)
      }
    }
  }

  function onKey(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancel()
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className={cn(
          'block w-full text-left rounded -mx-1 px-1 py-0.5',
          'hover:bg-gray-100 focus:outline-none focus:ring-1 focus:ring-brand/40',
          props.className
        )}
      >
        {props.display ?? <span>{String(props.value)}</span>}
      </button>
    )
  }

  if (props.variant === 'select') {
    return (
      <select
        ref={el => { inputRef.current = el }}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={cn(
          'w-full rounded px-1 py-0.5 text-sm',
          'bg-white border border-brand text-ink',
          'focus:outline-none focus:ring-1 focus:ring-brand/40',
          props.inputClassName
        )}
      >
        {props.options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    )
  }

  return (
    <input
      ref={el => { inputRef.current = el }}
      type={props.variant === 'number' ? 'number' : 'text'}
      inputMode={props.variant === 'number' ? 'decimal' : undefined}
      step={props.variant === 'number' ? (props.step ?? 0.01) : undefined}
      value={draft}
      placeholder={props.variant === 'text' ? props.placeholder : undefined}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKey}
      className={cn(
        'w-full rounded px-1 py-0.5 text-sm tabular',
        'bg-white border border-brand text-ink',
        'focus:outline-none focus:ring-1 focus:ring-brand/40',
        props.inputClassName
      )}
    />
  )
}

function initialDraft(props: EditableCellProps): string {
  return String(props.value)
}
