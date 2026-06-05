import { describe, it, expect } from 'vitest'
import {
  parseOfx,
  looksLikeOfx,
  parseOfxDate,
  parseAmount,
  buildDescription,
  mapType,
  extractTagValue,
  extractBlocks
} from './ofx'

// Real PayPal Credit QFX export shape (December 2025 statement, abbreviated).
// Preserve OFX 1.x's leaf-tag-without-close-tag style — the parser must
// survive it.
const PAYPAL_QFX = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
\t<SIGNONMSGSRSV1>
\t\t<SONRS>
\t\t<STATUS>
\t\t<CODE>0
\t\t<SEVERITY>INFO
\t\t</STATUS>
\t\t<DTSERVER>20260605095346.057[-8:PST]
\t\t<LANGUAGE>ENG
\t\t<FI>
\t\t<ORG>SYNCB
\t\t<FID>4537
\t\t</FI>
\t\t<INTU.BID>4537
\t\t</SONRS>
\t</SIGNONMSGSRSV1>
\t<CREDITCARDMSGSRSV1>
\t\t<CCSTMTTRNRS>
\t\t<CCSTMTRS>
\t\t\t<CURDEF>USD
\t\t\t<CCACCTFROM>
\t\t\t<ACCTID>6044191028569715
\t\t\t</CCACCTFROM>
\t\t\t<BANKTRANLIST>
\t\t\t<DTSTART>20251205
\t\t\t<DTEND>20260105
\t\t\t\t<STMTTRN>
\t\t\t\t<TRNTYPE>CREDIT
\t\t\t\t<DTPOSTED>20251128
\t\t\t\t<DTUSER>20251128
\t\t\t\t<TRNAMT>200.0
\t\t\t\t<FITID>11282025271020000000000000000000
\t\t\t\t<NAME>Auto pay
\t\t\t\t<MEMO>F928300AC00CHGDDA
\t\t\t\t</STMTTRN>
\t\t\t\t<STMTTRN>
\t\t\t\t<TRNTYPE>DEBIT
\t\t\t\t<DTPOSTED>20251107
\t\t\t\t<DTUSER>20251107
\t\t\t\t<TRNAMT>-96.0
\t\t\t\t<FITID>11072025253009600313502065223209
\t\t\t\t<NAME>Purchase
\t\t\t\t<MEMO>P9283009TEHM6DLN7
\t\t\t\t</STMTTRN>
\t\t\t\t<STMTTRN>
\t\t\t\t<TRNTYPE>CREDIT
\t\t\t\t<DTPOSTED>20251121
\t\t\t\t<DTUSER>20251121
\t\t\t\t<TRNAMT>438.0
\t\t\t\t<FITID>11212025255043800327502065497083
\t\t\t\t<NAME>
\t\t\t\t<MEMO>P928300A7EHM6DWSP
\t\t\t\t</STMTTRN>
\t\t\t\t<STMTTRN>
\t\t\t\t<TRNTYPE>DEBIT
\t\t\t\t<DTPOSTED>20251205
\t\t\t\t<DTUSER>20251205
\t\t\t\t<TRNAMT>-81.83
\t\t\t\t<FITID>12052025963008183000000000000000
\t\t\t\t<NAME>
\t\t\t\t<MEMO>No Memo
\t\t\t\t</STMTTRN>
\t\t\t</BANKTRANLIST>
\t\t\t<LEDGERBAL>
\t\t\t<BALAMT>-192.05
\t\t\t<DTASOF>20260605095346.057[-8:PST]
\t\t\t</LEDGERBAL>
\t\t</CCSTMTRS>
\t\t</CCSTMTTRNRS>
\t</CREDITCARDMSGSRSV1>
</OFX>
`

describe('looksLikeOfx', () => {
  it('detects the OFXHEADER:100 marker', () => {
    expect(looksLikeOfx('OFXHEADER:100\nDATA:OFXSGML\n')).toBe(true)
  })

  it('detects a leading <OFX> tag when the header is missing', () => {
    expect(looksLikeOfx('<OFX>\n<SIGNONMSGSRSV1>')).toBe(true)
  })

  it('is case-insensitive on the marker', () => {
    expect(looksLikeOfx('ofxheader:100')).toBe(true)
  })

  it('returns false for CSV and empty input', () => {
    expect(looksLikeOfx('')).toBe(false)
    expect(looksLikeOfx('Date,Description,Amount\n')).toBe(false)
  })
})

describe('parseOfxDate', () => {
  it('parses YYYYMMDD to ISO yyyy-mm-dd', () => {
    expect(parseOfxDate('20251121')).toBe('2025-11-21')
  })

  it('ignores time + timezone suffix', () => {
    expect(parseOfxDate('20260605095346.057[-8:PST]')).toBe('2026-06-05')
  })

  it('returns null on invalid input', () => {
    expect(parseOfxDate(null)).toBeNull()
    expect(parseOfxDate('')).toBeNull()
    expect(parseOfxDate('not-a-date')).toBeNull()
    expect(parseOfxDate('20251301')).toBeNull()   // bad month
    expect(parseOfxDate('20251199')).toBeNull()   // bad day
  })
})

describe('parseAmount', () => {
  it('parses positive and negative decimals', () => {
    expect(parseAmount('438.0')).toBe(438)
    expect(parseAmount('-96.0')).toBe(-96)
    expect(parseAmount('-192.05')).toBe(-192.05)
    expect(parseAmount('21.31')).toBe(21.31)
  })

  it('accepts comma as decimal separator', () => {
    expect(parseAmount('438,0')).toBe(438)
  })

  it('returns null for invalid amounts', () => {
    expect(parseAmount(null)).toBeNull()
    expect(parseAmount('')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('NaN')).toBeNull()
  })
})

describe('extractTagValue', () => {
  it('returns the value after a single tag, trimming whitespace', () => {
    expect(extractTagValue('<TRNAMT>438.0\n<FITID>123', 'TRNAMT')).toBe('438.0')
  })

  it('returns null when the tag is missing', () => {
    expect(extractTagValue('<OTHER>x', 'TRNAMT')).toBeNull()
  })

  it('returns null when the tag has no value (empty)', () => {
    // <NAME> followed immediately by next tag → no captured text
    expect(extractTagValue('<NAME>\n<MEMO>x', 'NAME')).toBeNull()
  })

  it('is case-insensitive on the tag name', () => {
    expect(extractTagValue('<trnamt>5.0', 'TRNAMT')).toBe('5.0')
  })
})

describe('extractBlocks', () => {
  it('returns every <STMTTRN> block in source order', () => {
    const text = '<STMTTRN>A</STMTTRN><STMTTRN>B</STMTTRN>'
    expect(extractBlocks(text, 'STMTTRN')).toEqual(['A', 'B'])
  })

  it('returns [] when no blocks present', () => {
    expect(extractBlocks('<OTHER>x</OTHER>', 'STMTTRN')).toEqual([])
  })
})

describe('buildDescription', () => {
  it('uses NAME alone when MEMO is empty', () => {
    expect(buildDescription('Auto pay', '')).toBe('Auto pay')
  })

  it('combines NAME and MEMO when both are present and distinct', () => {
    expect(buildDescription('Purchase', 'P928300A2EHM6DTB7')).toBe('Purchase (P928300A2EHM6DTB7)')
  })

  it('falls back to MEMO when NAME is empty', () => {
    expect(buildDescription('', 'P928300A7EHM6DWSP')).toBe('P928300A7EHM6DWSP')
  })

  it('returns a sentinel when both NAME and MEMO are empty', () => {
    expect(buildDescription('', '')).toBe('No description')
  })

  it('drops the literal "No Memo" placeholder', () => {
    expect(buildDescription('Purchase', 'No Memo')).toBe('Purchase')
  })

  it('drops duplicated MEMO that just echoes NAME', () => {
    expect(buildDescription('Purchase', 'Purchase')).toBe('Purchase')
  })
})

describe('mapType', () => {
  it('maps DEBIT to Expense', () => {
    expect(mapType('DEBIT', 'Purchase')).toBe('Expense')
  })

  it('maps CREDIT + payment-shaped NAME to Income', () => {
    expect(mapType('CREDIT', 'Auto pay')).toBe('Income')
    expect(mapType('CREDIT', 'Online Payment')).toBe('Income')
    expect(mapType('CREDIT', 'PAYMENT THANK YOU')).toBe('Income')
    expect(mapType('CREDIT', 'AUTOPAY')).toBe('Income')
  })

  it('maps CREDIT + non-payment NAME to Refund', () => {
    expect(mapType('CREDIT', 'No Interest if paid in full')).toBe('Refund')
    expect(mapType('CREDIT', '')).toBe('Refund')
    expect(mapType('CREDIT', 'Merchant Credit')).toBe('Refund')
  })

  it('defaults unknown TRNTYPE to Expense (user can re-classify)', () => {
    expect(mapType('XFER', 'Transfer')).toBe('Expense')
    expect(mapType(null, 'Something')).toBe('Expense')
  })
})

describe('parseOfx — full statement', () => {
  it('extracts statement metadata (FI, account, balance, period)', () => {
    const r = parseOfx(PAYPAL_QFX)
    expect(r.statement.fi).toBe('SYNCB')
    expect(r.statement.accountId).toBe('6044191028569715')
    expect(r.statement.accountLastFour).toBe('9715')
    expect(r.statement.endingBalance).toBe(-192.05)
    expect(r.statement.periodStart).toBe('2025-12-05')
    expect(r.statement.periodEnd).toBe('2026-01-05')
  })

  it('parses all 4 fixture transactions', () => {
    const r = parseOfx(PAYPAL_QFX)
    expect(r.parsed).toHaveLength(4)
    expect(r.skipped).toHaveLength(0)
  })

  it('preserves OFX sign convention (debits negative, credits positive)', () => {
    const r = parseOfx(PAYPAL_QFX)
    const byMemo = (memo: string) => r.parsed.find(t => t.description.includes(memo))
    expect(byMemo('F928300AC00CHGDDA')?.amount).toBe(200)        // CREDIT (auto pay)
    expect(byMemo('P9283009TEHM6DLN7')?.amount).toBe(-96)        // DEBIT (purchase)
    expect(byMemo('P928300A7EHM6DWSP')?.amount).toBe(438)        // CREDIT (promo offset)
    // Last row has NAME='' and MEMO='No Memo' → falls back to default description
    expect(r.parsed.find(t => t.amount === -81.83)?.description).toBe('No description')
  })

  it('uses DTUSER over DTPOSTED for the row date', () => {
    const r = parseOfx(PAYPAL_QFX)
    const purchase = r.parsed.find(t => t.description.includes('P9283009TEHM6DLN7'))
    expect(purchase?.date).toBe('2025-11-07')
  })

  it('classifies the Auto pay credit as Income and the unnamed credit as Refund', () => {
    const r = parseOfx(PAYPAL_QFX)
    const autopay = r.parsed.find(t => t.amount === 200)
    const promoCredit = r.parsed.find(t => t.amount === 438)
    expect(autopay?.type).toBe('Income')
    expect(promoCredit?.type).toBe('Refund')
  })

  it('stamps every row with source="PayPal QFX"', () => {
    const r = parseOfx(PAYPAL_QFX)
    expect(r.parsed.every(t => t.source === 'PayPal QFX')).toBe(true)
  })

  it('classifies all debits as Expense', () => {
    const r = parseOfx(PAYPAL_QFX)
    const debits = r.parsed.filter(t => t.amount < 0)
    expect(debits.length).toBeGreaterThan(0)
    expect(debits.every(t => t.type === 'Expense')).toBe(true)
  })

  it('emits an empty parsed array when there are no STMTTRN blocks', () => {
    const empty = `<OFX><SIGNONMSGSRSV1></SIGNONMSGSRSV1></OFX>`
    const r = parseOfx(empty)
    expect(r.parsed).toEqual([])
    expect(r.skipped).toEqual([])
  })

  it('skips rows missing TRNAMT or date with a clear reason', () => {
    const malformed = `<OFX>
<STMTTRN>
<TRNTYPE>DEBIT
<DTUSER>20251107
<NAME>Bad amount
<MEMO>x
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<TRNAMT>-10.0
<NAME>No date
</STMTTRN>
</OFX>`
    const r = parseOfx(malformed)
    expect(r.parsed).toHaveLength(0)
    expect(r.skipped).toHaveLength(2)
    expect(r.skipped[0]?.reason).toMatch(/TRNAMT/i)
    expect(r.skipped[1]?.reason).toMatch(/date|DTUSER/i)
  })
})
