/**
 * Stable transaction fingerprint matching the Python importer's algorithm:
 *
 *   raw = f"{date}|{desc}|{amount}|{account}".lower()
 *   fingerprint = sha256(raw).hexdigest()[:16]
 *
 * Why this exact format: the legacy `supabase/migrate_from_excel.py` script
 * writes fingerprints in this shape, and we need to dedup against rows it
 * inserted. The Python script reads amounts from Excel as floats, so
 * `f"{amount}"` emits `"100.0"` for whole-dollar amounts, `"0.0"` for zero,
 * and `"15.99"` for non-trivial decimals. JS's `String(n)` drops the `".0"`
 * for whole numbers, so we must mirror Python's float repr explicitly.
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

export async function computeFingerprint(input: FingerprintInput): Promise<string> {
  const raw = `${input.date}|${input.description}|${pythonFloatStr(input.amount)}|${input.account}`.toLowerCase()
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
