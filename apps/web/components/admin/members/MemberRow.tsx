'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import {
  KeyRound,
  Loader2,
  Lock,
  MoreVertical,
  Pencil,
  Power,
  PowerOff,
  ShieldOff,
  UserMinus
} from 'lucide-react'
import type { HouseholdMemberRow } from '@/lib/data/admin'
import { cn } from '@/lib/cn'

export interface MemberRowProps {
  member: HouseholdMemberRow
  onEdit: () => void
  onResetMfa: () => void
  onRemove: () => void
  onResetPassword: () => void
  /**
   * Open the admin-set-password dialog for this member. Hidden when the row
   * is the caller's own user — admins should use the standard reset flow on
   * themselves.
   */
  onSetPassword: () => void
  onToggleActive: () => void
  /** True when the row is the currently authenticated user — hides the toggle. */
  isSelf: boolean
  /** Spinner state for the reset-password mutation. */
  resetPasswordPending: boolean
  /** Spinner state for the toggle-active mutation. */
  toggleActivePending: boolean
}

function initialsFrom(member: HouseholdMemberRow): string {
  const src = member.display_name?.trim() || member.email
  const parts = src.split(/\s+|[@.]/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function MemberRow({
  member,
  onEdit,
  onResetMfa,
  onRemove,
  onResetPassword,
  onSetPassword,
  onToggleActive,
  isSelf,
  resetPasswordPending,
  toggleActivePending
}: MemberRowProps) {
  const isOwner = member.role === 'owner'
  const displayLabel = member.display_name?.trim() || member.email
  return (
    <li className={cn('flex items-center gap-3 px-4 py-3', !member.is_active && 'opacity-60')}>
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg text-[11px] font-semibold"
        aria-hidden="true"
      >
        {initialsFrom(member)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-ink truncate">{displayLabel}</div>
          {!member.is_active && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-200 text-[10px] font-medium uppercase tracking-wider text-muted">
              Inactive
            </span>
          )}
        </div>
        <div className="text-xs text-muted truncate">{member.email}</div>
      </div>

      <span
        className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider',
          isOwner ? 'bg-brand text-white' : 'bg-surface text-muted border border-rule'
        )}
      >
        {member.role}
      </span>

      <span className="hidden sm:inline-block text-[11px] text-muted tabular w-[70px] text-right">
        {member.mfa_factors} {member.mfa_factors === 1 ? 'factor' : 'factors'}
      </span>

      <button
        type="button"
        onClick={onResetPassword}
        disabled={resetPasswordPending}
        title={`Send password-reset email to ${displayLabel}`}
        aria-label={`Send password-reset email to ${displayLabel}`}
        className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {resetPasswordPending ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <KeyRound size={14} />
        )}
      </button>

      {!isSelf && (
        <button
          type="button"
          onClick={onToggleActive}
          disabled={toggleActivePending}
          title={
            member.is_active
              ? `Disable ${displayLabel}'s account`
              : `Enable ${displayLabel}'s account`
          }
          aria-label={
            member.is_active
              ? `Disable ${displayLabel}'s account`
              : `Enable ${displayLabel}'s account`
          }
          className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {toggleActivePending ? (
            <Loader2 size={14} className="animate-spin" />
          ) : member.is_active ? (
            <PowerOff size={14} />
          ) : (
            <Power size={14} />
          )}
        </button>
      )}

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Actions for ${member.display_name ?? member.email}`}
            className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100"
          >
            <MoreVertical size={14} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className={cn(
              'z-50 min-w-[180px] rounded-lg bg-surface border border-rule shadow-lg p-1',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0'
            )}
          >
            <DropdownMenu.Item
              onSelect={onEdit}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
            >
              <Pencil size={14} className="text-brand" />
              Edit
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={onResetMfa}
              className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
            >
              <ShieldOff size={14} className="text-amber-600" />
              Reset MFA
            </DropdownMenu.Item>
            {!isSelf && (
              <DropdownMenu.Item
                onSelect={onSetPassword}
                className="flex items-center gap-2 px-3 py-2 text-sm text-ink rounded cursor-pointer hover:bg-gray-100 outline-none"
              >
                <Lock size={14} className="text-brand" />
                Set temporary password…
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item
              onSelect={onRemove}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 rounded cursor-pointer hover:bg-red-50 outline-none"
            >
              <UserMinus size={14} />
              Remove
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </li>
  )
}
