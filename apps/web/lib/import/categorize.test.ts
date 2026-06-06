import { describe, expect, it } from 'vitest'
import { categorize, ruleMatchesRow, type CategorizeBill, type CategorizeCategory, type CategorizeRule } from './categorize'
import type { ImportRow } from './adapters/types'

function row(over: Partial<ImportRow> = {}): ImportRow {
  return {
    date: '2026-01-01',
    description: 'NETFLIX',
    amount: -15.99,
    type: 'Expense',
    categoryId: null,
    billId: null,
    fingerprint: 'fp1234',
    source: 'Chase',
    ...over
  }
}

function rule(over: Partial<CategorizeRule> = {}): CategorizeRule {
  return {
    id: 'r1',
    bill_id: 'b1',
    bill_name: null,
    rule_kind: 'name_keyword',
    keyword: 'netflix',
    sub_category: null,
    category: null,
    account_filter: null,
    tx_type_override: null,
    pair_account_filter: null,
    ...over
  }
}

function bill(over: Partial<CategorizeBill> = {}): CategorizeBill {
  return {
    id: 'b1',
    name: 'Netflix',
    category: 'Entertainment & Subscriptions',
    ...over
  }
}

function category(over: Partial<CategorizeCategory> = {}): CategorizeCategory {
  return { id: 'c1', name: 'Entertainment & Subscriptions', ...over }
}

describe('ruleMatchesRow', () => {
  it('name_keyword: matches when description contains keyword (case-insensitive)', () => {
    // Arrange
    const r = rule({ rule_kind: 'name_keyword', keyword: 'NETFLIX' })

    // Act / Assert
    expect(ruleMatchesRow(r, row({ description: 'netflix.com 5/15' }))).toBe(true)
    expect(ruleMatchesRow(r, row({ description: 'hulu' }))).toBe(false)
  })

  it('name_keyword: does not match when keyword is null', () => {
    // Arrange
    const r = rule({ rule_kind: 'name_keyword', keyword: null })

    // Act / Assert
    expect(ruleMatchesRow(r, row())).toBe(false)
  })

  it('account_filter set → never matches at import time', () => {
    // Arrange — incoming rows don't carry account text on the row.
    const r = rule({ account_filter: 'Some Account' })

    // Act / Assert
    expect(ruleMatchesRow(r, row({ description: 'netflix' }))).toBe(false)
  })

  it('category_map: requires keyword or sub_category to match description', () => {
    // Arrange
    const withKw = rule({ rule_kind: 'category_map', category: 'Food', keyword: 'starbucks' })
    const withSub = rule({ rule_kind: 'category_map', category: 'Food', keyword: null, sub_category: 'coffee' })
    const broad = rule({ rule_kind: 'category_map', category: 'Food', keyword: null, sub_category: null })

    // Act / Assert
    expect(ruleMatchesRow(withKw, row({ description: 'STARBUCKS 1234' }))).toBe(true)
    expect(ruleMatchesRow(withKw, row({ description: 'whole foods' }))).toBe(false)
    expect(ruleMatchesRow(withSub, row({ description: 'coffee shop' }))).toBe(true)
    // Broad category_map (no keyword and no sub_category) does NOT auto-match
    // because we have no transaction.category to anchor on at import time.
    expect(ruleMatchesRow(broad, row({ description: 'anything' }))).toBe(false)
  })

  it('unknown rule_kind never matches', () => {
    // Arrange
    const r = rule({ rule_kind: 'mystery_kind' })

    // Act / Assert
    expect(ruleMatchesRow(r, row())).toBe(false)
  })
})

describe('categorize', () => {
  it('returns rows unchanged when no rules match', () => {
    // Arrange
    const rows = [row({ description: 'GAS STATION' })]
    const rules = [rule({ keyword: 'starbucks' })]

    // Act
    const out = categorize({ rows, rules, bills: [bill()], categories: [category()] })

    // Assert
    expect(out[0]?.billId).toBeNull()
    expect(out[0]?.categoryId).toBeNull()
  })

  it('sets billId + categoryId on a matching name_keyword rule', () => {
    // Arrange
    const rows = [row()]
    const rules = [rule()]
    const bills = [bill()]
    const categories = [category()]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.billId).toBe('b1')
    expect(out[0]?.categoryId).toBe('c1')
  })

  it('returns null categoryId when bill has no category and rule provides none', () => {
    // Arrange
    const rows = [row()]
    const rules = [rule()]
    const bills = [bill({ category: null })]
    const categories = [category()]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.billId).toBe('b1')
    expect(out[0]?.categoryId).toBeNull()
  })

  it('falls back to rule.category when bill has no category', () => {
    // Arrange
    const rows = [row()]
    const rules = [rule({ category: 'Entertainment & Subscriptions' })]
    const bills = [bill({ category: null })]
    const categories = [category()]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.categoryId).toBe('c1')
  })

  it('first matching rule wins', () => {
    // Arrange
    const rows = [row({ description: 'NETFLIX SUB' })]
    const rules = [
      rule({ id: 'r1', bill_id: 'b1', keyword: 'netflix' }),
      rule({ id: 'r2', bill_id: 'b2', keyword: 'netflix' })
    ]
    const bills = [bill({ id: 'b1', name: 'Netflix', category: 'Entertainment & Subscriptions' }), bill({ id: 'b2', name: 'Other', category: 'Other' })]
    const categories = [category()]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.billId).toBe('b1')
  })

  it('resolves bill via bill_name when bill_id is null', () => {
    // Arrange
    const rows = [row()]
    const rules = [rule({ bill_id: null, bill_name: 'Netflix' })]
    const bills = [bill()]
    const categories = [category()]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.billId).toBe('b1')
  })

  it('preserves input order in output', () => {
    // Arrange
    const rows = [
      row({ description: 'A', fingerprint: '1' }),
      row({ description: 'B', fingerprint: '2' }),
      row({ description: 'C', fingerprint: '3' })
    ]

    // Act
    const out = categorize({ rows, rules: [], bills: [], categories: [] })

    // Assert
    expect(out.map(r => r.fingerprint)).toEqual(['1', '2', '3'])
  })

  it('empty rows returns empty output', () => {
    // Arrange / Act
    const out = categorize({ rows: [], rules: [rule()], bills: [bill()], categories: [category()] })

    // Assert
    expect(out).toEqual([])
  })

  it('does not match when account_filter is set on the rule', () => {
    // Arrange
    const rows = [row()]
    const rules = [rule({ account_filter: 'Chase' })]

    // Act
    const out = categorize({ rows, rules, bills: [bill()], categories: [category()] })

    // Assert
    expect(out[0]?.billId).toBeNull()
    expect(out[0]?.categoryId).toBeNull()
  })

  it('category lookup is case-insensitive', () => {
    // Arrange
    const rows = [row()]
    const rules = [rule()]
    const bills = [bill({ category: 'ENTERTAINMENT & SUBSCRIPTIONS' })]
    const categories = [category({ name: 'entertainment & subscriptions' })]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.categoryId).toBe('c1')
  })
})

describe('transfer_recognizer rules', () => {
  it('matches like name_keyword on the description', () => {
    // Arrange — a transfer_recognizer rule with a known AmEx payment keyword.
    const r = rule({
      rule_kind: 'transfer_recognizer',
      keyword: 'mobile payment - thank you',
      tx_type_override: 'Transfer'
    })

    // Act / Assert
    expect(ruleMatchesRow(r, row({ description: 'MOBILE PAYMENT - THANK YOU' }))).toBe(true)
    expect(ruleMatchesRow(r, row({ description: 'something else'           }))).toBe(false)
  })

  it('overrides row.type when tx_type_override is set', () => {
    // Arrange — incoming AmEx row would normally be Income (positive amount);
    // the transfer_recognizer rule promotes it to Transfer.
    const rows = [row({
      description: 'MOBILE PAYMENT - THANK YOU',
      amount: 6000,
      type: 'Income'
    })]
    const rules = [rule({
      bill_id: null,
      rule_kind: 'transfer_recognizer',
      keyword: 'mobile payment - thank you',
      category: 'Bank Fees',
      tx_type_override: 'Transfer',
      pair_account_filter: 'Citibank'
    })]
    const bills: CategorizeBill[] = []
    const categories = [category({ name: 'Bank Fees' })]

    // Act
    const out = categorize({ rows, rules, bills, categories })

    // Assert
    expect(out[0]?.type).toBe('Transfer')
    expect(out[0]?.categoryId).toBe('c1')
    expect(out[0]?.pairAccountFilter).toBe('Citibank')
  })

  it('does NOT set pairAccountFilter when the rule has none', () => {
    // Arrange
    const rows = [row({ description: 'MOBILE PAYMENT - THANK YOU' })]
    const rules = [rule({
      bill_id: null,
      rule_kind: 'transfer_recognizer',
      keyword: 'mobile payment - thank you',
      category: 'Bank Fees',
      tx_type_override: 'Transfer',
      pair_account_filter: null
    })]

    // Act
    const out = categorize({ rows, rules, bills: [], categories: [category({ name: 'Bank Fees' })] })

    // Assert
    expect(out[0]?.type).toBe('Transfer')
    expect(out[0]?.pairAccountFilter).toBeUndefined()
  })

  it('ignores an invalid tx_type_override value defensively', () => {
    // Arrange — even if a bad row slipped past the DB CHECK, we don't want
    // to write a row with type='Tranfser' into transactions.
    const rows = [row({ description: 'MOBILE PAYMENT - THANK YOU', type: 'Expense' })]
    const rules = [rule({
      bill_id: null,
      rule_kind: 'transfer_recognizer',
      keyword: 'mobile payment - thank you',
      tx_type_override: 'Tranfser' as unknown as string  // typo on purpose
    })]

    // Act
    const out = categorize({ rows, rules, bills: [], categories: [] })

    // Assert
    expect(out[0]?.type).toBe('Expense')  // original type preserved
  })

  it('does NOT match when keyword is null even for transfer_recognizer', () => {
    // Arrange
    const r = rule({ rule_kind: 'transfer_recognizer', keyword: null, tx_type_override: 'Transfer' })

    // Act / Assert
    expect(ruleMatchesRow(r, row({ description: 'anything' }))).toBe(false)
  })
})
