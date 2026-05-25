'use client'

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { MoreVertical, Pencil, ShieldOff, UserMinus } from 'lucide-react'
import type { HouseholdMemberRow } from '@/lib/data/admin'
import { cn } from '@/lib/cn'

export interface MemberRowProps {
  member: HouseholdMemberRow
  onEdit: () => void
  onResetMfa: () => void
  onRemove: () => void
}

function initialsFrom(member: HouseholdMemberRow): string {
  const src = member.display_name?.trim() || member.email
  const parts = src.split(/\s+|[@.]/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function MemberRow({ member, onEdit, onResetMfa, onRemove }: MemberRowProps) {
  const isOwner = member.role === 'owner'
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-bg text-[11px] font-semibold"
        aria-hidden="true"
      >
        {initialsFrom(member)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink truncate">
          {member.display_name?.trim() || member.email}
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
