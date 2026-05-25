# Phase 3A — Transaction import (CSV upload)

> Subagent-driven; ~3 dispatches. First feature work post-cutover.

**Goal:** Browser-based transaction import from bank CSV exports. Replaces the legacy Python `migrate_from_excel.py` for ongoing use. Multi-bank auto-detection, one-account-per-file model, fingerprint-based dedup.

**Architecture:** Three-step client-side flow at `/ledger/import` (Upload → Preview → Done). All parsing, dedup, and categorization run in the browser; only the final batch INSERT goes over the wire. Uses the authenticated user's session — no service-role key in the browser. Per-bank adapters convert raw CSV rows into a normalized `ImportRow` shape that maps cleanly to the `transactions` table.

**Why client-side parse:** CSVs are 1–10 KB typically; parsing client-side keeps the server stateless, surfaces format-detection feedback instantly, and lets the user review the preview before any DB write happens. The only round-trip is the existing-transactions fetch (for dedup) + the batch insert.

## Schema reality (verified against live DB)

- `transactions.fingerprint` (text, nullable) — already exists, same column the Python importer writes
- `transactions.account_id` (uuid FK) — populated on all 632 existing rows; we'll write this AND `account` (text) for back-compat
- `transactions.category_id` (uuid FK) — nullable; auto-categorize via `bill_match_rules` populates it when we have a match
- `transactions.imported_at` (timestamptz, default `now()`) — auto-set; nothing to do

**No schema migration required.**

## File structure

```
apps/web/
├── app/(app)/ledger/import/
│   └── page.tsx                       # Server shell, mounts <ImportFlow>
├── components/ledger/import/
│   ├── ImportFlow.tsx                 # Client root: step state machine + shared data
│   ├── UploadStep.tsx                 # Dropzone + file picker + account dropdown
│   ├── DetectedBanner.tsx             # "Detected: Chase Credit Card · 47 rows" pill
│   ├── PreviewStep.tsx                # Parsed rows table + dedup/categorize summary
│   ├── PreviewRow.tsx                 # One row in the preview list
│   ├── CompleteStep.tsx               # Success summary + 'View in Ledger' link
│   └── *.test.tsx
└── lib/import/
    ├── csv.ts                         # Pure: text → ParsedCsv (headers + rows[])
    ├── csv.test.ts
    ├── adapters/
    │   ├── types.ts                   # Adapter interface + ImportRow shape
    │   ├── chase.ts                   # Chase bank/credit card CSV
    │   ├── capitalOne.ts              # Capital One CSV
    │   ├── discover.ts                # Discover card CSV
    │   ├── amex.ts                    # American Express CSV
    │   ├── generic.ts                 # Fallback: date/description/amount columns
    │   └── index.ts                   # detectAdapter(headers) → Adapter | null
    ├── adapters.test.ts
    ├── fingerprint.ts                 # Pure: (date, desc, amount, account) → SHA256 hash
    ├── fingerprint.test.ts
    ├── dedup.ts                       # ImportRow[] + existing fingerprints → { new, dupes }
    ├── dedup.test.ts
    ├── categorize.ts                  # ImportRow[] + bill_match_rules → enriched ImportRow[]
    ├── categorize.test.ts
    └── insert.ts                      # ImportRow[] → batched Supabase insert + progress
```

## Tasks

| # | Task | Files |
|---|---|---|
| 1 | Pure modules: `csv.ts`, per-bank adapters, `fingerprint.ts`, `dedup.ts`, `categorize.ts`. ~80+ tests. No UI yet. | `lib/import/**/*.ts` |
| 2 | UI scaffold: `/ledger/import` route + `<ImportFlow>` 3-step state machine + `<UploadStep>` (dropzone + file picker + account dropdown + bank detection). Lint/build/tests green at end of step. | `app/(app)/ledger/import/page.tsx`, `components/ledger/import/{ImportFlow,UploadStep,DetectedBanner}.tsx` |
| 3 | PreviewStep (rows table + dedup summary + categorize summary + confirm) + CompleteStep + `insert.ts` batched Supabase insert. Link "Import" button from Ledger toolbar. Final verify + commit. | `components/ledger/import/{PreviewStep,PreviewRow,CompleteStep}.tsx`, `lib/import/insert.ts`, edits to `components/ledger/Ledger.tsx` (toolbar) |

## Pure module specs

### `lib/import/csv.ts`

```ts
export interface ParsedCsv {
  headers: ReadonlyArray<string>            // trimmed, original case
  rows: ReadonlyArray<ReadonlyArray<string>>  // raw string cells, NOT yet adapted
  /** True when at least one row had a column count != headers.length. */
  hasMalformedRows: boolean
}

/**
 * Parses a CSV file's text content. Handles:
 * - Standard RFC 4180 quoting (commas inside quoted fields, escaped quotes via "")
 * - CRLF and LF line endings
 * - BOM at start of file
 * - Empty rows (skipped)
 * - Trailing newline (skipped, not counted as malformed)
 *
 * Does NOT handle:
 * - TSV / pipe / semicolon delimiters (defer; banks all export CSV)
 * - Quoted multi-line cells (rare in bank exports; if encountered, hasMalformedRows = true)
 */
export function parseCsv(text: string): ParsedCsv
```

Use a hand-rolled parser — adding a dep for this is overkill. ~60 lines.

### `lib/import/adapters/types.ts`

```ts
export type TransactionType = 'Income' | 'Expense' | 'Transfer' | 'Refund'

export interface ImportRow {
  /** ISO yyyy-mm-dd. */
  date: string
  description: string
  /** Signed: positive = income/refund, negative = expense. */
  amount: number
  /** Always 'Expense' for now — Income is inferred from positive amount + heuristic. */
  type: TransactionType
  /** Set later by categorize.ts; nullable until then. */
  categoryId: string | null
  /** Set later by categorize.ts; nullable until then. */
  billId: string | null
  /** Computed by fingerprint.ts. */
  fingerprint: string
  /** Adapter that produced this row, for error reporting. */
  source: string
}

export interface Adapter {
  /** Human-readable name for the UI banner. */
  name: string
  /**
   * Returns true if this adapter can parse the given headers.
   * Match should be strict — false positives degrade UX more than
   * false negatives (user falls back to manual mapping).
   */
  matches(headers: ReadonlyArray<string>): boolean
  /**
   * Convert raw CSV rows into ImportRow[]. Skips rows that can't be parsed
   * (returns them in skipped[] with a reason). Does NOT compute fingerprint
   * or categoryId — those happen in later passes.
   */
  parse(rows: ReadonlyArray<ReadonlyArray<string>>): {
    parsed: ReadonlyArray<Omit<ImportRow, 'fingerprint' | 'categoryId' | 'billId'>>
    skipped: ReadonlyArray<{ rowIndex: number; reason: string }>
  }
}
```

### Per-bank adapter contracts

| Adapter | Header signature | Notes |
|---|---|---|
| `chase.ts` | `Transaction Date`, `Post Date`, `Description`, `Category`, `Type`, `Amount`, `Memo` | Amount is signed (negative = expense). Type column: Sale/Payment/Return. Use Transaction Date. |
| `capitalOne.ts` | `Transaction Date`, `Posted Date`, `Card No.`, `Description`, `Category`, `Debit`, `Credit` | Two columns — Debit (positive) and Credit (positive). Compute signed amount: `credit - debit`. |
| `discover.ts` | `Trans. Date`, `Post Date`, `Description`, `Amount`, `Category` | Amount positive for expense (need to flip sign). |
| `amex.ts` | `Date`, `Description`, `Amount` (sometimes more columns; we read just these three) | Amount positive for expense (need to flip). |
| `generic.ts` | Fallback: looks for any of `date`/`transaction date`/`posted date`, `description`/`payee`/`memo`, `amount`/`value` (case-insensitive). | If sign convention is ambiguous, assume negative=expense like Chase. Surface a warning in PreviewStep. |

Each adapter's `matches` is a header-substring check: e.g. Chase = headers includes both `Transaction Date` AND `Post Date` AND `Memo`. If `chase.matches` returns true, that's the adapter; we don't continue checking others (first match wins; order: chase, capitalOne, discover, amex, generic).

### `lib/import/fingerprint.ts`

```ts
/**
 * Stable fingerprint matching the Python importer's format so we can dedup
 * against rows already inserted by the legacy script.
 *
 * raw = `${date}|${desc}|${amount}|${account}`.toLowerCase()
 * fingerprint = sha256(raw).hex.slice(0, 16)
 *
 * Uses Web Crypto's subtle.digest — async because it must be in the browser.
 */
export async function computeFingerprint(input: {
  date: string
  description: string
  amount: number
  account: string  // text account name, NOT uuid (matches Python script)
}): Promise<string>

export async function computeFingerprintsBatch(
  rows: ReadonlyArray<{ date: string; description: string; amount: number; account: string }>
): Promise<ReadonlyArray<string>>
```

Important: this is async because Web Crypto's `subtle.digest` returns a Promise. Wrap with a small helper that takes an array.

### `lib/import/dedup.ts`

```ts
export interface DedupResult {
  /** Rows whose fingerprint is NOT in the existing-set; safe to insert. */
  newRows: ReadonlyArray<ImportRow>
  /** Rows whose fingerprint IS in the existing-set; UI shows these as 'already imported'. */
  duplicateRows: ReadonlyArray<ImportRow>
}

export function dedup(
  incoming: ReadonlyArray<ImportRow>,
  existingFingerprints: ReadonlySet<string>
): DedupResult
```

Pure. No DB calls inside — the caller fetches existing fingerprints from Supabase first.

### `lib/import/categorize.ts`

```ts
/**
 * Enriches rows with categoryId and billId based on bill_match_rules.
 * Re-uses `lib/finance/billsMatch.ts` matchBills() but applied to the
 * incoming (not-yet-inserted) rows.
 *
 * For rows that don't match any bill rule, categoryId stays null
 * (= Uncategorized; user can fix later via Ledger inline-edit).
 */
export function categorize(
  rows: ReadonlyArray<ImportRow>,
  rules: ReadonlyArray<BillMatchRule>,
  bills: ReadonlyArray<Bill>
): ReadonlyArray<ImportRow>
```

Pure. Takes rules + bills as input (caller fetches both).

### `lib/import/insert.ts`

```ts
export interface InsertResult {
  inserted: number
  failed: ReadonlyArray<{ row: ImportRow; error: string }>
}

/**
 * Batch-inserts ImportRows into the transactions table.
 * - Chunks of 100
 * - Maps ImportRow → transaction row shape (account text + account_id FK both
 *   populated, fingerprint stored, household_id from caller, imported_at left
 *   to default)
 * - On per-chunk failure, falls back to per-row insert to identify which
 *   rows specifically failed
 * - Returns counts + list of failed rows with messages
 */
export async function insertImportedTransactions(args: {
  supabase: SupabaseClient
  rows: ReadonlyArray<ImportRow>
  householdId: string
  accountId: string
  accountName: string
  onProgress?: (inserted: number, total: number) => void
}): Promise<InsertResult>
```

## UI flow

### `UploadStep`

- Big dashed-border drop zone (drag-drop friendly) + a fallback "Choose file" button
- Below: account dropdown (`useAccounts()`), required before file can be uploaded
- On file select: read text via `FileReader.readAsText`, call `parseCsv`, detect adapter, parse rows, compute fingerprints, fetch existing fingerprints for selected account (last 6 months window), dedup, categorize
- If detection succeeds → `<DetectedBanner adapter="Chase Credit Card" count={47} />` + a "Continue to preview" button advances to step 2
- If detection fails → error: "Unrecognized format. Headers: …" + a Cancel button

### `DetectedBanner`

Small pill across the top of the upload area when detection succeeds:
- Adapter name (e.g. "Chase Credit Card")
- Row count (e.g. "47 rows")
- Date range (e.g. "Apr 12 – May 21, 2026")

### `PreviewStep`

- Top summary: "X new · Y duplicates · Z categorized" — three KPI tiles
- Below: scrollable table of `PreviewRow` (new rows only by default; toggle "Show skipped duplicates" reveals them)
- Each row: date · description · signed amount (red/green tone) · category (from auto-categorize, otherwise "Uncategorized" muted) · checkbox to opt-out per row
- Bottom: "Import N transactions" button (primary), "Back" button, total amount + count

### `CompleteStep`

- Big green check icon + "Imported N transactions" headline
- Summary card: "X categorized · Y uncategorized · Z duplicates skipped"
- Two CTAs: "View in Ledger" (`/ledger?account=<id>&start=<minDate>&end=<maxDate>`) and "Import another"

### Toolbar entry point

Edit `components/ledger/Ledger.tsx` to add an "Import" button (lucide `Upload` icon) next to the existing controls. Click → `router.push('/ledger/import')`.

## Tests

T1 unit tests per pure module (~80+ tests total). Coverage targets:
- `csv.test.ts` — RFC 4180 cases (quoted commas, escaped quotes, CRLF/LF, BOM, empty rows, trailing newlines), malformed-row detection
- `adapters.test.ts` — for EACH adapter: header match positive case, header match negative case, sign convention, date parsing, multi-row real-world fixture
- `fingerprint.test.ts` — deterministic hash for known input (compare against Python implementation output for the same input — paste a fixture), batch helper preserves order, async correctness
- `dedup.test.ts` — empty existing set, all dupes, all new, mixed
- `categorize.test.ts` — keyword match → category set, no match → null, multiple rules → first wins

T2 + T3 component tests are smoke-level (loading state, file select fires handler, preview shows row count).

## Success criteria

- Upload a real Chase CSV → adapter detected → preview shows correct row count + amounts (sign right) → click Import → rows appear in Ledger
- Upload the SAME CSV again → preview shows "0 new, N duplicates" — no double-insert
- Bill match rules auto-categorize the rows that match (e.g. "NETFLIX" → Subscriptions if rule exists)
- Wrong-format CSV → graceful error, not a crash
- All existing tests pass; new tests cover the pure modules at 100%
- Mobile works (drop zone → file picker is the touch fallback)
- No service-role key needed in browser; everything goes through the user's session under RLS

## Out of scope

- OFX / QFX / xlsx upload (deferred; Excel can be exported as CSV anyway)
- Editing parsed rows inline before insert (defer; edit in Ledger after import)
- Multi-account in one file (we picked one-account-per-file in scoping)
- Per-import undo (deferred; manual delete via Ledger bulk-delete works)
- Account auto-detection from CSV (we picked manual account selection)
- Transfer-pair detection across two account uploads (deferred)
- Server-side import (CLI / API endpoint) (deferred; the Python script remains for batch one-time imports)
- Per-bank format save ("remember Chase format for this account") (deferred; auto-detect makes this unnecessary)
