/**
 * Stable transaction fingerprint matching the Python importer's algorithm:
 *
 *   raw = `${date}|${desc}|${amount}|${account}`.toLowerCase()
 *   fingerprint = sha256(raw).hex.slice(0, 16)
 *
 * Why this exact format: the legacy `supabase/migrate_from_excel.py` script
 * writes fingerprints in this shape, and we need to dedup against rows it
 * inserted. `String(amount)` mirrors Python's default repr — `-12.34` not
 * `"-12.34000"`, `0` not `"0.0"`.
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

export async function computeFingerprint(input: FingerprintInput): Promise<string> {
  const raw = `${input.date}|${input.description}|${input.amount}|${input.account}`.toLowerCase()
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
