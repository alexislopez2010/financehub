/**
 * Builds the dropdown options for a transaction's `member` field.
 *
 * The dropdown always starts with two synthetic entries:
 *   1. '(Unassigned)' — value=null
 *   2. 'Family'       — value='Family' (literal string written into the DB)
 *
 * Then each `household_members` row's `display_name` is appended in the
 * order received (the hook already sorts by display_name).
 *
 * Legacy values (e.g. a former member name still set on an old transaction)
 * that aren't covered by the current roster get appended at the end so the
 * dropdown still has an option matching the row's current value. The dedup
 * is case-sensitive on `value`.
 *
 * Pure module — no React, no data hook imports — so it can be unit-tested
 * in isolation.
 */
export interface MemberOption {
  /** null = unassigned; 'Family' = shared; else a member's display_name. */
  value: string | null
  label: string
  kind: 'unassigned' | 'family' | 'member'
}

const FAMILY_LABEL = 'Family'
const UNASSIGNED_LABEL = '(Unassigned)'

export function buildMemberOptions(
  members: ReadonlyArray<{ display_name: string }>,
  legacyValues: ReadonlyArray<string> = []
): ReadonlyArray<MemberOption> {
  const options: MemberOption[] = [
    { value: null, label: UNASSIGNED_LABEL, kind: 'unassigned' },
    { value: FAMILY_LABEL, label: FAMILY_LABEL, kind: 'family' }
  ]

  // Track already-covered values for dedup. 'Family' is reserved; null is
  // reserved separately via the unassigned entry.
  const covered = new Set<string>([FAMILY_LABEL])

  for (const m of members) {
    const name = m.display_name
    if (name.length === 0) continue
    if (covered.has(name)) continue
    options.push({ value: name, label: name, kind: 'member' })
    covered.add(name)
  }

  for (const legacy of legacyValues) {
    if (legacy.length === 0) continue
    if (covered.has(legacy)) continue
    options.push({ value: legacy, label: legacy, kind: 'member' })
    covered.add(legacy)
  }

  return options
}
