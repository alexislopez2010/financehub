'use client'

import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AmountValue {
  minAmount: number | undefined
  maxAmount: number | undefined
}

export interface AmountFilterProps {
  value: AmountValue
  onChange: (next: AmountValue) => void
}

interface QuickRange {
  label: string
  value: AmountValue
}

const QUICK_RANGES: ReadonlyArray<QuickRange> = [
  { label: 'Over $100', value: { minAmount: 100, maxAmount: undefined } },
  { label: '≥ $500 expenses', value: { minAmount: undefined, maxAmount: -500 } },
  { label: 'Income only', value: { minAmount: 0, maxAmount: undefined } }
]

function formatDollars(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatChip(value: AmountValue): string {
  const { minAmount, maxAmount } = value
  if (minAmount !== undefined && maxAmount !== undefined) {
    return `${formatDollars(minAmount)} to ${formatDollars(maxAmount)}`
  }
  if (minAmount !== undefined) return `≥ ${formatDollars(minAmount)}`
  if (maxAmount !== undefined) return `≤ ${formatDollars(maxAmount)}`
  return ''
}

function parseNumber(s: string): number | undefined {
  if (s.trim() === '') return undefined
  const n = Number(s)
  return Number.isFinite(n) ? n : undefined
}

export function AmountFilter({ value, onChange }: AmountFilterProps) {
  const [open, setOpen] = useState(false)
  const [draftMin, setDraftMin] = useState(
    value.minAmount !== undefined ? String(value.minAmount) : ''
  )
  const [draftMax, setDraftMax] = useState(
    value.maxAmount !== undefined ? String(value.maxAmount) : ''
  )

  useEffect(() => {
    if (open) {
      setDraftMin(value.minAmount !== undefined ? String(value.minAmount) : '')
      setDraftMax(value.maxAmount !== undefined ? String(value.maxAmount) : '')
    }
  }, [open, value.minAmount, value.maxAmount])

  const isSet = value.minAmount !== undefined || value.maxAmount !== undefined

  if (isSet) {
    return (
      <div className="inline-flex">
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Edit amount range filter"
              className={cn(
                'inline-flex items-center gap-1 pl-2 py-1 rounded-l-full text-xs',
                'bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors'
              )}
            >
              <span className="font-medium">amount:</span>
              <span>{formatChip(value)}</span>
            </button>
          </DropdownMenu.Trigger>
          <AmountMenu
            draftMin={draftMin}
            draftMax={draftMax}
            setDraftMin={setDraftMin}
            setDraftMax={setDraftMax}
            onApply={() => {
              onChange({
                minAmount: parseNumber(draftMin),
                maxAmount: parseNumber(draftMax)
              })
              setOpen(false)
            }}
            onClear={() => {
              onChange({ minAmount: undefined, maxAmount: undefined })
              setOpen(false)
            }}
          />
        </DropdownMenu.Root>
        <button
          type="button"
          onClick={() => onChange({ minAmount: undefined, maxAmount: undefined })}
          aria-label="Clear amount filter"
          className={cn(
            'inline-flex items-center px-1.5 rounded-r-full',
            'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-warn transition-colors'
          )}
        >
          <X size={12} />
        </button>
      </div>
    )
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Filter by amount"
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-2 py-1 rounded-full text-xs',
            'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
          )}
        >
          <span className="font-medium">Amount</span>
          <ChevronDown size={12} />
        </button>
      </DropdownMenu.Trigger>
      <AmountMenu
        draftMin={draftMin}
        draftMax={draftMax}
        setDraftMin={setDraftMin}
        setDraftMax={setDraftMax}
        onApply={() => {
          onChange({
            minAmount: parseNumber(draftMin),
            maxAmount: parseNumber(draftMax)
          })
          setOpen(false)
        }}
        onClear={() => {
          setDraftMin('')
          setDraftMax('')
          onChange({ minAmount: undefined, maxAmount: undefined })
          setOpen(false)
        }}
        onQuick={(v) => {
          setDraftMin(v.minAmount !== undefined ? String(v.minAmount) : '')
          setDraftMax(v.maxAmount !== undefined ? String(v.maxAmount) : '')
          onChange(v)
          setOpen(false)
        }}
      />
    </DropdownMenu.Root>
  )
}

interface AmountMenuProps {
  draftMin: string
  draftMax: string
  setDraftMin: (v: string) => void
  setDraftMax: (v: string) => void
  onApply: () => void
  onClear: () => void
  onQuick?: (v: AmountValue) => void
}

function AmountMenu({
  draftMin,
  draftMax,
  setDraftMin,
  setDraftMax,
  onApply,
  onClear,
  onQuick
}: AmountMenuProps) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="start"
        sideOffset={4}
        className={cn(
          'z-50 w-[280px] rounded-lg bg-surface border border-rule shadow-lg p-3',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0'
        )}
        onCloseAutoFocus={e => e.preventDefault()}
      >
        {onQuick && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_RANGES.map(r => (
              <button
                key={r.label}
                type="button"
                onClick={() => onQuick(r.value)}
                className={cn(
                  'inline-flex items-center px-2 py-1 rounded-full text-[11px]',
                  'bg-bg text-muted border border-rule hover:text-ink hover:bg-surface transition-colors'
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted block mb-1">Min</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
              <input
                type="number"
                step="0.01"
                value={draftMin}
                onChange={e => setDraftMin(e.target.value)}
                placeholder="−"
                className="w-full pl-6 pr-2.5 py-1.5 text-sm rounded-md bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </label>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted block mb-1">Max</span>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted">$</span>
              <input
                type="number"
                step="0.01"
                value={draftMax}
                onChange={e => setDraftMax(e.target.value)}
                placeholder="−"
                className="w-full pl-6 pr-2.5 py-1.5 text-sm rounded-md bg-bg border border-rule text-ink focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          </label>
        </div>

        <p className="text-[11px] text-muted mt-2 leading-snug">
          Use negative numbers for expenses. e.g. min = -500 means &ldquo;at least $500 spent&rdquo;.
        </p>

        <div className="flex justify-end gap-2 mt-3 pt-2 border-t border-rule">
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-muted hover:text-ink px-2 py-1"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onApply}
            className="px-3 py-1 rounded-md bg-brand text-white text-xs font-medium hover:bg-brand/90"
          >
            Apply
          </button>
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}
