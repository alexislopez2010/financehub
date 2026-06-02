'use client'

import { Pencil, Trash2, UserPlus } from 'lucide-react'
import type { FamilyMemberRow } from '@/lib/data/familyMembers'

export interface PlaceholderMemberRowProps {
  member: FamilyMemberRow
  onEdit: () => void
  onPromote: () => void
  onRemove: () => void
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '??'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
}

export function PlaceholderMemberRow({
  member,
  onEdit,
  onPromote,
  onRemove
}: PlaceholderMemberRowProps) {
  const displayName = member.name.trim() || 'Unnamed'
  const relationship = member.relationship?.trim() || null

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-200 text-muted text-[11px] font-semibold"
        aria-hidden="true"
      >
        {initialsFrom(displayName)}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className="text-sm font-medium text-ink truncate">{displayName}</div>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-200 text-[10px] font-medium uppercase tracking-wider text-muted">
            Placeholder
          </span>
        </div>
        {relationship && (
          <div className="text-xs text-muted truncate">{relationship}</div>
        )}
      </div>

      <button
        type="button"
        onClick={onEdit}
        title={`Edit ${displayName}`}
        aria-label={`Edit ${displayName}`}
        className="p-1 rounded text-muted hover:text-ink hover:bg-gray-100"
      >
        <Pencil size={14} />
      </button>

      <button
        type="button"
        onClick={onPromote}
        title={`Promote ${displayName} to login account`}
        aria-label={`Promote ${displayName} to login account`}
        className="p-1 rounded text-muted hover:text-brand hover:bg-gray-100"
      >
        <UserPlus size={14} />
      </button>

      <button
        type="button"
        onClick={onRemove}
        title={`Remove ${displayName}`}
        aria-label={`Remove ${displayName}`}
        className="p-1 rounded text-muted hover:text-red-600 hover:bg-red-50"
      >
        <Trash2 size={14} />
      </button>
    </li>
  )
}
