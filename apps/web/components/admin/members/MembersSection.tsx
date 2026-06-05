'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import {
  useHouseholdMembers,
  useResetHouseholdMemberPassword,
  useSetHouseholdMemberActive,
  type HouseholdMemberRow
} from '@/lib/data/admin'
import {
  useFamilyMembers,
  useDeleteFamilyMember,
  type FamilyMemberRow
} from '@/lib/data/familyMembers'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { createClient } from '@/lib/supabase/browser'
import { MemberRow } from './MemberRow'
import { PlaceholderMemberRow } from './PlaceholderMemberRow'
import { EditMemberDialog } from './EditMemberDialog'
import { EditPlaceholderDialog } from './EditPlaceholderDialog'
import { ResetMfaDialog } from './ResetMfaDialog'
import { RemoveMemberDialog } from './RemoveMemberDialog'
import { AddMemberDialog } from './AddMemberDialog'
import { PromotePlaceholderDialog } from './PromotePlaceholderDialog'
import { SetPasswordDialog } from './SetPasswordDialog'

type ActiveDialog = 'edit' | 'reset-mfa' | 'remove' | 'set-password' | null
type PlaceholderDialog = 'edit' | 'promote' | null

interface FlashMessage {
  readonly tone: 'success' | 'error'
  readonly text: string
}

export function MembersSection() {
  const membersQ = useHouseholdMembers()
  const familyQ = useFamilyMembers()
  const resetPassword = useResetHouseholdMemberPassword()
  const setActive = useSetHouseholdMemberActive()
  const deletePlaceholder = useDeleteFamilyMember()

  const [target, setTarget] = useState<HouseholdMemberRow | null>(null)
  const [active, setActiveDialog] = useState<ActiveDialog>(null)
  const [placeholderTarget, setPlaceholderTarget] = useState<FamilyMemberRow | null>(null)
  const [placeholderDialog, setPlaceholderDialog] = useState<PlaceholderDialog>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [flash, setFlash] = useState<FlashMessage | null>(null)
  // Track which member id has a mutation in flight so we only spin one button.
  const [pendingResetId, setPendingResetId] = useState<string | null>(null)
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    void supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return
      setCurrentUserId(data.user?.id ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function open(dialog: ActiveDialog, member: HouseholdMemberRow) {
    setTarget(member)
    setActiveDialog(dialog)
  }

  function close() {
    setActiveDialog(null)
    setTarget(null)
  }

  function openPlaceholder(dialog: PlaceholderDialog, placeholder: FamilyMemberRow) {
    setPlaceholderTarget(placeholder)
    setPlaceholderDialog(dialog)
  }

  function closePlaceholder() {
    setPlaceholderDialog(null)
    setPlaceholderTarget(null)
  }

  async function handleRemovePlaceholder(placeholder: FamilyMemberRow): Promise<void> {
    const label = placeholder.name.trim() || 'this placeholder'
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Remove placeholder ${label}?`)
    ) {
      return
    }
    setFlash(null)
    try {
      await deletePlaceholder.mutateAsync(placeholder.id)
      setFlash({ tone: 'success', text: `Removed placeholder ${label}.` })
    } catch (err: unknown) {
      setFlash({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Failed to remove placeholder'
      })
    }
  }

  async function handleResetPassword(member: HouseholdMemberRow): Promise<void> {
    const label = member.display_name?.trim() || member.email
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Send password-reset email to ${label}?`)
    ) {
      return
    }
    setPendingResetId(member.user_id)
    setFlash(null)
    try {
      const res = await resetPassword.mutateAsync({
        household_id: LOPEZ_HOUSEHOLD_ID,
        target_user_id: member.user_id
      })
      setFlash({ tone: 'success', text: `Password reset email sent to ${res.email}` })
    } catch (err: unknown) {
      setFlash({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Failed to send password reset email'
      })
    } finally {
      setPendingResetId(null)
    }
  }

  async function handleToggleActive(member: HouseholdMemberRow): Promise<void> {
    const label = member.display_name?.trim() || member.email
    const nextActive = !member.is_active
    const verb = nextActive ? 'Enable' : 'Disable'
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`${verb} ${label}'s account?`)
    ) {
      return
    }
    setPendingToggleId(member.user_id)
    setFlash(null)
    try {
      await setActive.mutateAsync({
        household_id: LOPEZ_HOUSEHOLD_ID,
        target_user_id: member.user_id,
        active: nextActive
      })
      setFlash({
        tone: 'success',
        text: `${label}'s account ${nextActive ? 'enabled' : 'disabled'}.`
      })
    } catch (err: unknown) {
      setFlash({
        tone: 'error',
        text: err instanceof Error ? err.message : 'Failed to update member status'
      })
    } finally {
      setPendingToggleId(null)
    }
  }

  const members = membersQ.data ?? []
  const placeholders = familyQ.data ?? []

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

        {flash && (
          <div
            role="status"
            className={
              flash.tone === 'success'
                ? 'border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800'
                : 'border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700'
            }
          >
            {flash.text}
          </div>
        )}

        <div className="px-4 py-2 bg-bg/40 border-b border-rule">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Login accounts
          </h3>
        </div>

        {membersQ.isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
        ) : membersQ.error ? (
          <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
            Failed to load members: {membersQ.error.message}
          </div>
        ) : members.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">No login accounts.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {members.map(m => (
              <MemberRow
                key={m.user_id}
                member={m}
                onEdit={() => open('edit', m)}
                onResetMfa={() => open('reset-mfa', m)}
                onRemove={() => open('remove', m)}
                onResetPassword={() => { void handleResetPassword(m) }}
                onSetPassword={() => open('set-password', m)}
                onToggleActive={() => { void handleToggleActive(m) }}
                isSelf={currentUserId === m.user_id}
                resetPasswordPending={pendingResetId === m.user_id}
                toggleActivePending={pendingToggleId === m.user_id}
              />
            ))}
          </ul>
        )}

        <div className="px-4 py-2 bg-bg/40 border-y border-rule">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
            Placeholder members
          </h3>
        </div>

        {familyQ.isLoading ? (
          <div className="px-4 py-8 text-center text-sm text-muted">Loading…</div>
        ) : familyQ.error ? (
          <div role="alert" className="px-4 py-4 text-sm text-red-700 bg-red-50">
            Failed to load placeholders: {familyQ.error.message}
          </div>
        ) : placeholders.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted">No placeholder members.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {placeholders.map(p => (
              <PlaceholderMemberRow
                key={p.id}
                member={p}
                onEdit={() => openPlaceholder('edit', p)}
                onPromote={() => openPlaceholder('promote', p)}
                onRemove={() => { void handleRemovePlaceholder(p) }}
              />
            ))}
          </ul>
        )}
      </section>

      <EditMemberDialog member={active === 'edit' ? target : null} onClose={close} />
      <ResetMfaDialog member={active === 'reset-mfa' ? target : null} onClose={close} />
      <RemoveMemberDialog member={active === 'remove' ? target : null} onClose={close} />
      <SetPasswordDialog member={active === 'set-password' ? target : null} onClose={close} />
      <AddMemberDialog open={showAdd} onClose={() => setShowAdd(false)} />
      <EditPlaceholderDialog
        placeholder={placeholderDialog === 'edit' ? placeholderTarget : null}
        onClose={closePlaceholder}
      />
      <PromotePlaceholderDialog
        placeholder={placeholderDialog === 'promote' ? placeholderTarget : null}
        onClose={closePlaceholder}
      />
    </>
  )
}
