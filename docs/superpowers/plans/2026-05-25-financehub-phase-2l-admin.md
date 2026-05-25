# Phase 2L — Admin surface

> Subagent-driven; ~3 dispatches.

**Goal:** Owner-only `/admin` surface that manages household membership (display name + role + MFA reset + removal), categories (list/rename/add/delete), and bill match rules (the editor deferred from 2I). Wires the five admin RPCs locked down in Phase 0.

**Architecture:** Server shell at `app/(app)/admin/page.tsx` does a server-side owner check via `supabase.from('household_members').select('role').eq('user_id', user.id).single()` — non-owners redirect to `/`. The shell mounts a Client root with a section nav (Members / Categories / Match rules) mirroring the Accounts pattern from 2J. Member mutations route through a new `lib/data/admin.ts` (RPC-backed; no direct table writes — the SECURITY DEFINER functions are the gate). Categories and Bill match rules reuse their existing TanStack hooks from 2E.

The Admin link is added to `ProfileMenu` for all signed-in users; the actual gate is the server-side role check (UI hiding would still leak via the URL, so the page itself is the boundary).

## File structure

```
apps/web/
├── app/(app)/admin/
│   └── page.tsx                          Server shell + owner redirect
├── components/admin/
│   ├── Admin.tsx                         Client root: section nav + composition
│   ├── AdminSectionNav.tsx               Members / Categories / Match rules tabs
│   ├── members/
│   │   ├── MembersSection.tsx            Members card with row list + actions
│   │   ├── MemberRow.tsx                 One member: avatar, name, email, role, MFA count, actions
│   │   ├── EditMemberDialog.tsx          Radix Dialog: edit display_name + role
│   │   ├── ResetMfaDialog.tsx            Confirm + execute MFA reset
│   │   └── RemoveMemberDialog.tsx        Confirm + execute remove
│   ├── categories/
│   │   ├── CategoriesSection.tsx         Categories grouped by type/parent + add row
│   │   ├── CategoryRow.tsx               Inline rename + delete
│   │   └── AddCategoryForm.tsx           Inline "+ Add category" form
│   ├── rules/
│   │   ├── RulesSection.tsx              Bill match rules grouped by bill + add
│   │   ├── RuleRow.tsx                   One rule: keyword + optional category/account_filter + delete
│   │   └── AddRuleForm.tsx               Inline "+ Add rule for <bill>" form
│   └── *.test.tsx
├── components/auth/
│   └── ProfileMenu.tsx                   EDIT — add Admin menu item
└── lib/data/
    └── admin.ts                          NEW — RPC-backed hooks: useHouseholdMembers, useUpdateHouseholdMember, useResetMfa, useRemoveHouseholdMember
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | `lib/data/admin.ts` (TanStack hooks calling the four admin RPCs) + tests. `/admin` scaffold with server-side owner check. AdminSectionNav. MembersSection: list + EditMemberDialog (display_name + role) + ResetMfaDialog + RemoveMemberDialog. ProfileMenu Admin link. | `lib/data/admin.*`, `app/(app)/admin/page.tsx`, `components/admin/{Admin,AdminSectionNav}.tsx`, `components/admin/members/*`, `components/auth/ProfileMenu.tsx` |
| 2 | CategoriesSection: grouped list (by `type` then `parent_category`), inline rename via EditableCell, per-row delete with confirm, AddCategoryForm. Reuses existing `useCategories`/`useCreateCategory`/`useUpdateCategory`/`useDeleteCategory`. | `components/admin/categories/*` |
| 3 | RulesSection: grouped list (by `bill_id`, with bill name resolved via `useBills`), per-rule edit (keyword + category + account_filter) + delete + AddRuleForm. Final verify (all tests, lint, build); commit close-out. | `components/admin/rules/*` |

## Data layer spec — `lib/data/admin.ts`

```ts
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'

export interface HouseholdMemberRow {
  user_id: string
  email: string
  display_name: string | null
  role: 'owner' | 'member'
  mfa_factors: number
  joined_at: string  // ISO timestamp
}

export function useHouseholdMembers(): UseQueryResult<ReadonlyArray<HouseholdMemberRow>, Error>
// Calls supabase.rpc('admin_list_household_users', { h_id: LOPEZ_HOUSEHOLD_ID })
// staleTime: 60_000 (1 min — admin work is bursty)

export interface UpdateMemberArgs {
  target_user: string
  patch: { display_name?: string; role?: 'owner' | 'member' }
}
export function useUpdateHouseholdMember(): UseMutationResult<void, Error, UpdateMemberArgs, Ctx>
// Calls supabase.rpc('admin_update_household_user', { h_id, target_user, new_role, new_display_name })

export interface ResetMfaArgs { target_user: string }
export function useResetMfa(): UseMutationResult<number, Error, ResetMfaArgs, never>
// Returns factor count removed.
// Calls supabase.rpc('admin_reset_user_mfa', { h_id, target_user })

export interface RemoveMemberArgs { target_user: string }
export function useRemoveHouseholdMember(): UseMutationResult<void, Error, RemoveMemberArgs, Ctx>
// Calls supabase.rpc('admin_remove_household_user', { h_id, target_user })
```

All mutations:
- Optimistic update on the `householdMembers` cache when sensible (display_name/role flip in-place; remove drops the row).
- Roll back on error and re-display the surfaced PG exception message.
- Invalidate `householdMembers` on settle.

New query key: extend `lib/data/keys.ts` with `householdMembers: () => ['householdMembers'] as const`.

## Server-side owner check (T1)

`app/(app)/admin/page.tsx` (server component):

```ts
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LOPEZ_HOUSEHOLD_ID } from '@/lib/household'
import { Admin } from '@/components/admin/Admin'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/admin')

  const { data: membership } = await supabase
    .from('household_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('household_id', LOPEZ_HOUSEHOLD_ID)
    .maybeSingle()

  if (!membership || membership.role !== 'owner') {
    redirect('/')
  }

  return <Suspense fallback={<AdminSkeleton />}><Admin /></Suspense>
}
```

This is the gate. The admin RPCs are also gated (defense-in-depth), but the page boundary is what stops non-owners from even loading the bundle.

## ProfileMenu Admin link (T1)

Add an Admin link below "Signed in as" — same row style as Sign out. Visible to all signed-in users; the page itself enforces. (Hiding the link client-side based on role would require an extra round-trip and isn't worth the complexity.)

```tsx
<Link href="/admin" role="menuitem" onClick={() => setOpen(false)}
  className="block w-full px-4 py-2.5 text-left text-sm text-ink hover:bg-surface">
  Admin
</Link>
```

## Member section interactions (T1)

- **MemberRow** shows: initials avatar, display_name (or email if null), email line, role pill ("owner" / "member" — owner uses brand color), MFA factor count, ellipsis menu with Edit / Reset MFA / Remove
- **EditMemberDialog**: Radix Dialog with two fields — display name (text input) and role (segmented control: member / owner). Submit calls `useUpdateHouseholdMember`. Includes "last-owner" hint: if changing role from owner to member and the user is the only owner, surface the PG exception message verbatim (the trigger from Phase 0 enforces last-owner protection).
- **ResetMfaDialog**: confirm "Reset MFA for {name}? They will need to re-enroll on next login." Shows the count returned from the RPC in a toast/success message.
- **RemoveMemberDialog**: confirm "Remove {name} from the household?" Disabled if member.role === 'owner' (per RPC's contract; show inline hint "Demote to member first").

## Categories section interactions (T2)

- Grouped by `type` (Income / Expense) then by `parent_category` (treat null as "(uncategorized)")
- Each row: name (EditableCell text variant — renames via `useUpdateCategory`) + delete button
- `+ Add category` inline form: type select (Income / Expense), parent_category text (optional), name text → `useCreateCategory({ type, parent_category, name, household_id })`. Use `LOPEZ_HOUSEHOLD_ID` for the household.
- Delete: confirm dialog (categories are FK-referenced by transactions; the FK is `on delete set null` per migration 0006 — confirm dialog notes "Transactions in this category will become Uncategorized.")

## Rules section interactions (T3)

- Grouped by `bill_id` with bill name + frequency shown as group header
- Each row: keyword (EditableCell) + category (select bound to `useCategories`) + account_filter (EditableCell) + delete
- `+ Add rule for {bill}` inline form below each bill group
- Resolves null `bill_id` rules into a "General rules" group at the bottom (the table allows null bill_id for general bill detection)

## Success criteria

- Non-owner visiting `/admin` is redirected to `/` immediately (server-side; never sees the page)
- Owner sees member list with display names, roles, MFA counts
- Display name + role edits commit via RPC, optimistic update in UI
- MFA reset surfaces count of factors removed
- Removing a member excludes them from list immediately
- Last-owner demotion is prevented with a clear error message
- Categories surface lists every category grouped by type/parent
- Adding, renaming, deleting categories works
- Bill match rules surface lists rules grouped by bill
- Adding, editing, deleting rules works
- ProfileMenu has Admin link visible to all (gate is page-level)
- All previous tests still pass; new tests cover `lib/data/admin.ts` hooks (mocked Supabase RPC), MemberRow rendering, dialog confirm-and-mutate paths
- Mobile: section nav scrolls horizontally, rows reflow

## Out of scope

- Invite new members (Lopez household is closed; would require email invite + signup flow that's currently disabled)
- Transfer-ownership UI (out of scope; if needed, owner promotes another member, then a separate "demote me" flow — defer)
- Category merge (deferred — manual SQL via Supabase Studio for now)
- Bulk-delete categories with reassign
- Bill match rules drag-to-reorder priority
