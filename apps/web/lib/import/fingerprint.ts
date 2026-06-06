/**
 * Stable transaction fingerprint.
 *
 *   raw = f"{date}|{normalize(desc)}|{amount}|{account}".lower()
 *   fingerprint = sha256(raw).hexdigest()[:16]
 *
 * Description normalization is what stops banks (esp. American Express)
 * from creating "ghost duplicates" by re-exporting the same charge with
 * extra detail appended. See {@link normalizeDescriptionForFingerprint}.
 *
 * Amount formatting mirrors Python's f"{x}" so legacy rows imported by
 * the original `migrate_from_excel.py` script use the same byte format
 * after the description-normalization backfill (see migration / data
 * backfill: every existing row was recomputed with this algorithm so the
 * DB and the app agree).
 *
 * Uses Web Crypto's subtle.digest, which is async.
 */

export interface FingerprintInput {
  /** ISO yyyy-mm-dd. */
  date: string
  description: string
  amount: number
  /** Account text name (NOT uuid) — matches what the Python script uses. */
  account: string
}

/**
 * Mirror Python's f"{x}" where x is a float:
 * - 100 → "100.0"
 * - 0 → "0.0"
 * - -15.99 → "-15.99"
 *
 * JS's String(n) drops the ".0" for whole numbers — this helper fixes the
 * integer case explicitly while leaving non-integer numbers untouched.
 */
function pythonFloatStr(n: number): string {
  if (Number.isInteger(n)) return `${n}.0`
  return String(n)
}

/**
 * Collapse the variations banks introduce when they re-export the same
 * underlying charge:
 *   - Run multiple whitespace characters together. AmEx pads its CSV to
 *     fixed widths, so "UNITED AIRLINES     HOUSTON             TX"
 *     becomes "UNITED AIRLINES HOUSTON TX".
 *   - Strip a trailing parenthetical. AmEx's newer feed adds detail like
 *     " (ALEXIS LOPEZ-41007-... WWW.UNITED.COM ...)" after the merchant
 *     name; the short and long form should collapse to the same fp so
 *     re-importing later snapshots doesn't double-insert. Only the
 *     trailing parenthetical is removed and only if it has no nested
 *     parens — keeps merchants whose actual name contains parens (rare)
 *     safe.
 *   - Delete remaining punctuation. AmEx occasionally exports the same
 *     merchant two different ways across feeds — one with the dot in
 *     "LOB.COM" and one as "LOBCOM" — and we want those to collapse to
 *     the same fingerprint. Punctuation is *deleted*, not replaced with
 *     space, so "LOB.COM" → "LOBCOM" matches the dot-less variant
 *     exactly. Letters/digits/whitespace are preserved.
 *   - Trim outer whitespace.
 *
 * Exported so the SQL backfill and the test suite can use the same rule.
 */
export function normalizeDescriptionForFingerprint(d: string): string {
  let s = d.replace(/\s+/g, ' ').trim()
  s = s.replace(/\s*\([^()]*\)\s*$/, '').trim()
  // Delete non-alphanumeric / non-whitespace chars (punctuation). Then
  // re-collapse whitespace in case adjacent punctuation produced runs.
  s = s.replace(/[^\p{L}\p{N}\s]/gu, '')
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

export async function computeFingerprint(input: FingerprintInput): Promise<string> {
  const raw = `${input.date}|${normalizeDescriptionForFingerprint(input.description)}|${pythonFloatStr(input.amount)}|${input.account}`.toLowerCase()
  const data = new TextEncoder().encode(raw)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return toHex(hash).slice(0, 16)
}

export async function computeFingerprintsBatch(
  rows: ReadonlyArray<FingerprintInput>
): Promise<ReadonlyArray<string>> {
  return Promise.all(rows.map(r => computeFingerprint(r)))
}

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let hex = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i] ?? 0
    hex += (b < 16 ? '0' : '') + b.toString(16)
  }
  return hex
}
