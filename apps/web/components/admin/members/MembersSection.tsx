'use client'

import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { useHouseholdMembers, type HouseholdMemberRow } from '@/lib/data/admin'
import { MemberRow } from './MemberRow'
import { EditMemberDialog } from './EditMemberDialog'
import { ResetMfaDialog } from './ResetMfaDialog'
import { RemoveMemberDialog } from './RemoveMemberDialog'
import { AddMemberDialog } from './AddMemberDialog'

type ActiveDialog = 'edit' | 'reset-mfa' | 'remove' | null

export function MembersSection() {
  const membersQ = useHouseholdMembers()
  const [target, setTarget] = useState<HouseholdMemberRow | null>(null)
  const [active, setActive] = useState<ActiveDialog>(null)
  const [showAdd, setShowAdd] = useState(false)

  function open(dialog: ActiveDialog, member: HouseholdMemberRow) {
    setTarget(member)
    setActive(dialog)
  }

  function close() {
    setActive(null)
    setTarget(null)
  }

  const members = membersQ.data ?? []

  return (
    <>
      <section className="bg-surface border border-rule rounded-xl shadow-sm overflow-hidden">
        <header className="px-4 py-3 border-b border-rule flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Members</h2>
            <p className="text-xs text-muted">
              {membersQ.isLoading
                ? 'Loading…'
                : `${members.length} ${members.length === 1 ? 'member' : 'members'} in this household`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rule bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-bg transition"
          >
            <UserPlus size={14} />
            Add member
          </button>
        </header>

        {membersQ.isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
        ) : membersQ.error ? (
          <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
            Failed to load members: {membersQ.error.message}
          </div>
        ) : members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">No members.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                onEdit={() => open('edit', m)}
                onResetMfa={() => open('reset-mfa', m)}
                onRemove={() => open('remove', m)}
              />
            ))}
          </ul>
        )}
      </section>

      <EditMemberDialog member={active === 'edit' ? target : null} onClose={close} />
      <ResetMfaDialog member={active === 'reset-mfa' ? target : null} onClose={close} />
      <RemoveMemberDialog member={active === 'remove' ? target : null} onClose={close} />
      <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} />
    </>
  )
}
