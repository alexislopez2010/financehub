# Phase 3C — Convert-to-Transfer + Pair

> Subagent-driven; ~2 dispatches.

**Goal:** Let the user re-classify any pair of existing transactions as a Transfer and link them together via `transfer_pair_id`. Fixes the import-induced double-counting for cross-account payments (CC payments, between-account transfers, etc.) WITHOUT changing how the importer works.

**Architecture:** New SECURITY DEFINER RPC `pair_transfer_rows` does both UPDATEs in one transaction (so you can't end up half-paired). Frontend adds a row-action dialog accessible from the existing Ledger row context menu (next to "Promote to bill"). Dialog shows the source row + candidate counterparts on other accounts + confirm. Optimistic update on both rows in the local TanStack cache.

**Why this design:** The Briefing's signed-activity math already excludes `type='Transfer'` from income/expense KPIs (from Phase 2F). So the moment a pair is created, the KPI pollution disappears for free — no recompute, no data migration, no schema change beyond the RPC. Schema already has `transfer_pair_id` from migration 0008.

## Schema reality (verified earlier)

- `transactions.transfer_pair_id` (uuid, nullable, FK to transactions.id, on delete set null) — exists
- `transactions.type` accepts `'Transfer'` — already used in places like Briefing
- `create_transfer` RPC exists (creates two NEW rows) — pattern reference for the new RPC's security model
- 50 legacy single-row Transfer rows (from the deferred 2N cleanup) exist — those will be findable via this new flow too

## File structure

```
supabase/migrations/
└── 0016_pair_transfer_rows.sql           NEW — RPC + tests-friendly idempotency

apps/web/
├── lib/data/
│   └── transactions.ts                   EDIT — add usePairTransferRows + useUnpairTransferRow mutations
├── components/ledger/
│   ├── ConvertToTransferDialog.tsx       NEW — picker + confirm dialog
│   ├── TransactionRow.tsx                EDIT — add menu item next to "Promote to bill"
│   └── *.test.tsx                        Smoke tests
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Migration `0016_pair_transfer_rows.sql` (+ unpair RPC) applied to live prod via MCP. Mutation hooks `usePairTransferRows` + `useUnpairTransferRow` in `lib/data/transactions.ts` with optimistic updates. Tests. | `supabase/migrations/0016_pair_transfer_rows.sql`, `lib/data/transactions.ts`, `lib/data/transactions.test.tsx` |
| 2 | `ConvertToTransferDialog.tsx` (Radix Dialog mirroring PromoteToBillDialog style) — shows source row, search/filter candidates (same `|amount|`, ±5d date, opposite sign, other accounts, not already paired), confirm. Wire into TransactionRow row-action menu next to "Promote to bill". Add "Unpair transfer" menu item visible only on already-paired Transfer rows. Final verify + commit. | `components/ledger/ConvertToTransferDialog.tsx`, `components/ledger/TransactionRow.tsx` |

## RPC spec (T1)

### `pair_transfer_rows`

```sql
create or replace function pair_transfer_rows(
  p_household_id uuid,
  p_row_a_id    uuid,
  p_row_b_id    uuid
) returns uuid
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_a record;
  v_b record;
begin
  -- Owner check
  if not is_household_member(p_household_id) then
    raise exception 'not authorized';
  end if;

  if p_row_a_id = p_row_b_id then
    raise exception 'cannot pair a row with itself';
  end if;

  -- Load both rows under the household scope (RLS irrelevant in SECURITY DEFINER, we enforce manually)
  select id, household_id, account_id, amount, type, transfer_pair_id, date
    into v_a from transactions where id = p_row_a_id;
  if v_a.id is null then raise exception 'row a not found'; end if;
  if v_a.household_id <> p_household_id then raise exception 'row a is not in this household'; end if;

  select id, household_id, account_id, amount, type, transfer_pair_id, date
    into v_b from transactions where id = p_row_b_id;
  if v_b.id is null then raise exception 'row b not found'; end if;
  if v_b.household_id <> p_household_id then raise exception 'row b is not in this household'; end if;

  -- Validations
  if v_a.account_id is null or v_b.account_id is null then
    raise exception 'both rows must have an account_id';
  end if;
  if v_a.account_id = v_b.account_id then
    raise exception 'rows must be on different accounts';
  end if;
  if abs(v_a.amount) <> abs(v_b.amount) then
    raise exception 'amounts must match in magnitude (% vs %)', v_a.amount, v_b.amount;
  end if;
  if sign(v_a.amount) = sign(v_b.amount) then
    raise exception 'rows must have opposite signs (one inflow, one outflow)';
  end if;
  if v_a.transfer_pair_id is not null or v_b.transfer_pair_id is not null then
    raise exception 'one or both rows are already paired';
  end if;

  -- Pair: use row_a_id as the pair anchor (convention from create_transfer)
  update transactions
    set type = 'Transfer', transfer_pair_id = p_row_a_id
    where id in (p_row_a_id, p_row_b_id);

  return p_row_a_id;
end $$;

revoke all on function pair_transfer_rows(uuid, uuid, uuid) from public;
grant execute on function pair_transfer_rows(uuid, uuid, uuid) to authenticated;
```

### `unpair_transfer_row`

```sql
create or replace function unpair_transfer_row(
  p_household_id uuid,
  p_row_id      uuid
) returns int
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_pair_id uuid;
  v_row_household uuid;
  v_count int;
begin
  if not is_household_member(p_household_id) then
    raise exception 'not authorized';
  end if;

  select household_id, transfer_pair_id into v_row_household, v_pair_id
    from transactions where id = p_row_id;
  if v_row_household is null then raise exception 'row not found'; end if;
  if v_row_household <> p_household_id then raise exception 'row is not in this household'; end if;
  if v_pair_id is null then raise exception 'row is not paired'; end if;

  -- Clear pair_id on both legs. Leave type as-is (caller can edit if they want
  -- to demote back to Expense/Income via the existing EditableCell).
  update transactions
    set transfer_pair_id = null
    where household_id = p_household_id
      and (transfer_pair_id = v_pair_id or id = v_pair_id);
  get diagnostics v_count = row_count;

  return v_count;
end $$;

revoke all on function unpair_transfer_row(uuid, uuid) from public;
grant execute on function unpair_transfer_row(uuid, uuid) to authenticated;
```

## Mutation hook spec (T1)

In `apps/web/lib/data/transactions.ts`:

```ts
export interface PairTransferRowsArgs {
  rowAId: string
  rowBId: string
}

/**
 * Calls the pair_transfer_rows RPC. Optimistically updates the two rows in
 * the local TanStack cache to type='Transfer' + transfer_pair_id=rowAId.
 * Rolls back on error.
 */
export function usePairTransferRows(): UseMutationResult<string, Error, PairTransferRowsArgs, PairCtx>

/**
 * Calls the unpair_transfer_row RPC. Optimistically clears transfer_pair_id
 * on both legs (the row + its paired sibling). Leaves type='Transfer' on
 * both — user can edit via EditableCell.
 */
export function useUnpairTransferRow(): UseMutationResult<number, Error, string, UnpairCtx>
```

Optimistic update pattern: mirror the existing `useUpdateTransaction` pattern — snapshot the affected rows from every active `queryKeys.transactions(...)` entry, apply the patch optimistically, on error restore the snapshot.

Tests: 4 cases per hook (success, error rollback, RPC validation failure surfaces error, optimistic state visible before settle).

## Dialog spec (T2)

### `ConvertToTransferDialog.tsx`

Props:
```ts
interface ConvertToTransferDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The transaction the user clicked "Convert to transfer" on. */
  sourceTransaction: TransactionRow
  /** All other transactions in the cache (for candidate search). */
  allTransactions: ReadonlyArray<TransactionRow>
}
```

Layout (Radix Dialog, matches the existing PromoteToBillDialog modal style):

1. **Source row card** at the top — date · description · account · signed amount (color-toned). Muted "From" label.

2. **"Pair with"** section header + below:
   - Candidate list — filtered:
     - `account_id !== source.account_id`
     - `Math.abs(amount) === Math.abs(source.amount)`
     - `transfer_pair_id === null`
     - `sign(amount) !== sign(source.amount)` (opposite signs)
     - Date within ±5 days of source
   - Sorted by absolute date-difference (closest first)
   - Each candidate row: date · description · account · signed amount + a "Pair" button
   - Empty state: muted italic "No matching transactions found on other accounts. Try widening the date range or check that the counterpart is already imported."

3. **Date range widener** — small chip below the candidates list: "Expand to ±10 days" / "Expand to ±30 days". Re-filters when toggled.

4. **Cancel / Confirm** footer — but actually no Confirm at the bottom; each candidate has its own "Pair" button (avoids a 2-step click). Cancel button just dismisses.

On candidate "Pair" click:
- Call `usePairTransferRows({ rowAId: sourceTransaction.id, rowBId: candidate.id })`
- On success: close dialog + toast "Paired ✓"
- On error: keep dialog open, show error inline above candidates

### Row menu wire-up in `TransactionRow.tsx`

Look at the existing menu (probably a dropdown trigger near each row). Add **two** new items:

1. **"Convert to transfer"** — visible when `tx.type !== 'Transfer'` AND `tx.transfer_pair_id === null`. Opens the dialog.

2. **"Unpair transfer"** — visible when `tx.transfer_pair_id !== null`. Calls `useUnpairTransferRow(tx.id)` directly (no dialog; one-click with toast).

## Success criteria

- Migration 0016 applied to live prod, `pair_transfer_rows` + `unpair_transfer_row` callable as `authenticated` role
- A user can click any Expense/Income row in the Ledger, pick a matching opposite-sign row on another account, and convert both to Transfer + linked pair in a single action
- Briefing's `monthIncome` + `monthExpense` immediately update (drop the paired amounts) because of the existing Transfer-skip logic
- Cash + Debt + Net Worth tiles unchanged (Transfer math already correct)
- Trying to pair two same-sign rows → RPC raises, dialog shows error
- Trying to pair two rows on the same account → RPC raises, dialog shows error
- Trying to pair an already-paired row → RPC raises
- "Unpair" works in one click; both legs revert to `transfer_pair_id = null` (type stays as 'Transfer'; user can hand-edit)
- All previous tests still pass; new tests cover the mutation hooks + dialog smoke

## Out of scope

- Bulk pairing (pair many rows at once) — defer
- Cross-household pairing — impossible by design
- Auto-detect-and-suggest on import — separate feature (we explicitly chose this UI path instead)
- Pairing with rows older than 30 days — possible via the date-range widener but not optimized
- Pair-with-search-input (free-text search) — defer; the date-window approach is usually enough
- Updating the existing 50 legacy unpaired Transfer rows in bulk — manual via this UI is fine, or future cleanup task
