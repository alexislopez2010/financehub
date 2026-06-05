/**
 * OFX 1.x / QFX SGML parser for credit-card and bank statements.
 *
 * OFX 1.x is *not* XML — leaf elements omit closing tags. Container elements
 * (like <STMTTRN>) do have closing tags. We don't try to be a general OFX
 * parser; we extract enough to build ParsedImportRow[] for the import flow
 * plus a small `statement` block of metadata for the UI banner.
 *
 * Format reference: OFX 1.0.2 spec, Section 5 (SGML envelope).
 * Sign convention in OFX:
 *   - DEBIT (purchases) → negative TRNAMT
 *   - CREDIT (payments, refunds) → positive TRNAMT
 * That matches our internal convention (signedActivity: expense = negative,
 * income/refund = positive), so we copy the sign through unchanged.
 *
 * Type mapping:
 *   - DEBIT             → Expense (purchases / cash advances)
 *   - CREDIT + payment  → Income  (auto-pay, online payment, cardholder pmt)
 *   - CREDIT otherwise  → Refund  (merchant credit, promotional offset, etc.)
 *
 * The "looks like a payment" heuristic is conservative — only NAME text
 * matching /\bpay(ment)?s?\b/i counts. Everything else surfaces as Refund
 * so the user can re-classify if needed.
 */

import type { ParsedImportRow, SkippedRow, TransactionType } from './adapters/types'

export interface OfxStatement {
  /** ORG tag inside SIGNONMSGSRSV1 → SONRS → FI → ORG. */
  readonly fi: string | null
  /** ACCTID inside CCACCTFROM or BANKACCTFROM (credit cards vs bank). */
  readonly accountId: string | null
  /** Last 4 digits of the account, derived from accountId for display. */
  readonly accountLastFour: string | null
  /** Statement-end ledger balance (LEDGERBAL.BALAMT), or null when absent. */
  readonly endingBalance: number | null
  /** DTSTART → ISO yyyy-mm-dd. */
  readonly periodStart: string | null
  /** DTEND → ISO yyyy-mm-dd. */
  readonly periodEnd: string | null
}

export interface OfxParseResult {
  /** Parsed transactions in source order. */
  readonly parsed: ReadonlyArray<ParsedImportRow>
  /** Rows we couldn't decode + why. Indices are 0-based into the STMTTRN blocks. */
  readonly skipped: ReadonlyArray<SkippedRow>
  /** Statement-level metadata for the import banner. */
  readonly statement: OfxStatement
}

const SOURCE = 'PayPal QFX'

/**
 * True when the text looks like an OFX/QFX document. Used by the UI to pick
 * the OFX parser path instead of the CSV parser path.
 */
export function looksLikeOfx(text: string): boolean {
  if (!text) return false
  // OFX 1.x files start with OFXHEADER:100 or DATA:OFXSGML on the first
  // few lines. Some exports skip the header and go straight to <OFX>. We
  // accept either signature.
  const head = text.slice(0, 256)
  return /\bOFXHEADER:\s*100/i.test(head) || /<OFX[\s>]/i.test(head)
}

export function parseOfx(text: string): OfxParseResult {
  const cleaned = stripBom(text)

  const statement: OfxStatement = {
    fi: extractTagValue(cleaned, 'ORG'),
    accountId: extractTagValue(cleaned, 'ACCTID'),
    accountLastFour: lastFour(extractTagValue(cleaned, 'ACCTID')),
    endingBalance: parseAmount(extractTagValue(cleaned, 'BALAMT')),
    periodStart: parseOfxDate(extractTagValue(cleaned, 'DTSTART')),
    periodEnd: parseOfxDate(extractTagValue(cleaned, 'DTEND'))
  }

  const txBlocks = extractBlocks(cleaned, 'STMTTRN')
  const parsed: ParsedImportRow[] = []
  const skipped: SkippedRow[] = []

  txBlocks.forEach((block, i) => {
    const trnType = extractTagValue(block, 'TRNTYPE')
    const trnAmtRaw = extractTagValue(block, 'TRNAMT')
    // Prefer DTUSER (user-facing transaction date) over DTPOSTED (bank-posting).
    // The user wants the date the activity happened, not when it cleared.
    const dateRaw = extractTagValue(block, 'DTUSER') ?? extractTagValue(block, 'DTPOSTED')
    const name = extractTagValue(block, 'NAME')?.trim() ?? ''
    const memo = extractTagValue(block, 'MEMO')?.trim() ?? ''

    if (!trnAmtRaw) {
      skipped.push({ rowIndex: i, reason: 'Missing TRNAMT' })
      return
    }
    const amount = parseAmount(trnAmtRaw)
    if (amount === null) {
      skipped.push({ rowIndex: i, reason: `Invalid TRNAMT: "${trnAmtRaw}"` })
      return
    }
    if (!dateRaw) {
      skipped.push({ rowIndex: i, reason: 'Missing DTUSER and DTPOSTED' })
      return
    }
    const date = parseOfxDate(dateRaw)
    if (!date) {
      skipped.push({ rowIndex: i, reason: `Invalid date: "${dateRaw}"` })
      return
    }

    const description = buildDescription(name, memo)
    const type = mapType(trnType, name)

    parsed.push({
      date,
      description,
      amount,
      type,
      source: SOURCE
    })
  })

  return { parsed, skipped, statement }
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Combine NAME + MEMO into a single human-readable description. */
export function buildDescription(name: string, memo: string): string {
  const n = name.trim()
  // "No Memo" is a literal value PayPal uses for empty memos; treat it as empty.
  const m = /^no\s+memo$/i.test(memo.trim()) ? '' : memo.trim()
  if (!n) return m || 'No description'
  // Memo is often a bank reference (P9283…). Skip it when it adds no signal.
  if (!m || m === n) return n
  return `${n} (${m})`
}

/** Decide Income / Expense / Refund from TRNTYPE + NAME heuristic. */
export function mapType(trnType: string | null, name: string): TransactionType {
  const tt = (trnType ?? '').toUpperCase().trim()
  if (tt === 'DEBIT') return 'Expense'
  if (tt === 'CREDIT') {
    // Treat anything that reads like a payment as Income (these reduce the
    // card balance via a transfer from another account). Examples:
    //   "Auto pay", "Online Payment", "Payment Thank You", "AUTOPAY".
    if (/\bauto[\s-]?pay\b/i.test(name) || /\bpay(ment)?s?\b/i.test(name)) {
      return 'Income'
    }
    return 'Refund'
  }
  // Unknown TRNTYPE (some banks emit XFER, ATM, FEE, etc.): infer from sign.
  return 'Expense'  // safest default; user can re-categorize
}

/**
 * Extract the value following an OFX leaf tag. Returns the trimmed text from
 * `<TAG>` up to the next `<` or end of line. Container tags are not handled
 * here — use extractBlocks for those.
 */
export function extractTagValue(text: string, tag: string): string | null {
  const tagPattern = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')
  const m = tagPattern.exec(text)
  if (!m || !m[1]) return null
  return m[1].trim()
}

/**
 * Return every container block `<TAG>...</TAG>`. Non-greedy so nested same-
 * named blocks don't merge (they don't exist in OFX statements, but
 * defending in depth is cheap).
 */
export function extractBlocks(text: string, tag: string): ReadonlyArray<string> {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text)) !== null) {
    if (m[1] !== undefined) out.push(m[1])
  }
  return out
}

/** OFX dates: YYYYMMDD[HHmmss[.ms]][TZ] → ISO yyyy-mm-dd. */
export function parseOfxDate(raw: string | null): string | null {
  if (!raw) return null
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw.trim())
  if (!m) return null
  const year = parseInt(m[1]!, 10)
  const month = parseInt(m[2]!, 10)
  const day = parseInt(m[3]!, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${m[1]}-${m[2]}-${m[3]}`
}

/** Parse a TRNAMT or BALAMT. OFX allows decimal point or comma; we accept both. */
export function parseAmount(raw: string | null): number | null {
  if (!raw) return null
  const cleaned = raw.trim().replace(/,/g, '.')
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n)) return null
  return n
}

function lastFour(acctId: string | null): string | null {
  if (!acctId) return null
  const digits = acctId.replace(/\D/g, '')
  if (digits.length < 4) return null
  return digits.slice(-4)
}

const BOM = '﻿'
function stripBom(text: string): string {
  return text.startsWith(BOM) ? text.slice(BOM.length) : text
}
