import { describe, it, expect } from 'vitest'
import { matchBills, transactionMatchesRule } from './billsMatch'
import type { BillRow, BillMatchRule, TransactionRow } from './types'

const HID = '00000000-0000-0000-0000-000000000001'

function bill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    household_id: HID,
    name: 'Anthropic',
    category: 'Entertainment & Subscriptions',
    account: null,
    due_day: 15,
    frequency: 'Monthly',
    budget_amount: 200,
    is_active: true,
    notes: null,
    ...over
  }
}

function rule(over: Partial<BillMatchRule> = {}): BillMatchRule {
  return {
    id: 'r1',
    household_id: HID,
    bill_id: 'b1',
    bill_name: null,
    category: null,
    sub_category: null,
    keyword: null,
    account_filter: null,
    rule_kind: 'name_keyword',
    ...over
  }
}

function tx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    household_id: HID,
    date: '2025-05-23',
    description: 'ANTHROPIC SUBSCRIPTION',
    amount: 200,
    type: 'Expense',
    category: 'Entertainment & Subscriptions',
    category_id: null,
    account: 'Chase Card',
    member: null,
    transfer_pair_id: null,
    ...over
  }
}

describe('transactionMatchesRule', () => {
  it('matches by keyword case-insensitively', () => {
    const r = rule({ keyword: 'anthropic', rule_kind: 'name_keyword' })
    expect(transactionMatchesRule(tx({ description: 'ANTHROPIC SUB' }), r)).toBe(true)
    expect(transactionMatchesRule(tx({ description: 'anthropic charge' }), r)).toBe(true)
    expect(transactionMatchesRule(tx({ description: 'OpenAI subscription' }), r)).toBe(false)
  })

  it('returns false for name_keyword rule with null keyword', () => {
    const r = rule({ keyword: null, rule_kind: 'name_keyword' })
    expect(transactionMatchesRule(tx(), r)).toBe(false)
  })

  it('category_map matches when transaction category equals rule category', () => {
    const r = rule({
      rule_kind: 'category_map',
      category: 'Housing',
      keyword: null
    })
    expect(transactionMatchesRule(tx({ category: 'Housing' }), r)).toBe(true)
    expect(transactionMatchesRule(tx({ category: 'Transportation' }), r)).toBe(false)
  })

  it('category_map respects keyword narrowing on the description', () => {
    const r = rule({
      rule_kind: 'category_map',
      category: 'Housing',
      keyword: 'firstenergy'
    })
    expect(transactionMatchesRule(tx({ category: 'Housing', description: 'FIRSTENERGY ELECTRIC' }), r)).toBe(true)
    expect(transactionMatchesRule(tx({ category: 'Housing', description: 'NJNG GAS' }), r)).toBe(false)
  })

  it('category_map returns false when rule.category is null', () => {
    const r = rule({ rule_kind: 'category_map', category: null })
    expect(transactionMatchesRule(tx(), r)).toBe(false)
  })

  it('account_filter narrows to a specific account', () => {
    const r = rule({ keyword: 'anthropic', account_filter: 'Chase Card', rule_kind: 'name_keyword' })
    expect(transactionMatchesRule(tx({ account: 'Chase Card' }), r)).toBe(true)
    expect(transactionMatchesRule(tx({ account: 'Amex' }), r)).toBe(false)
  })

  it('handles null transaction.description as empty string', () => {
    const r = rule({ keyword: 'anything', rule_kind: 'name_keyword' })
    // description shouldn't be null in practice (NOT NULL in DB) but be defensive
    expect(transactionMatchesRule(tx({ description: '' }), r)).toBe(false)
  })

  it('category_map sub_category filters the description', () => {
    const r = rule({
      rule_kind: 'category_map',
      category: 'Housing',
      sub_category: 'utilities'
    })
    expect(transactionMatchesRule(tx({ category: 'Housing', description: 'NJNG Utilities November' }), r)).toBe(true)
    expect(transactionMatchesRule(tx({ category: 'Housing', description: 'Mortgage' }), r)).toBe(false)
  })
})

describe('matchBills', () => {
  it('returns one result per input bill, in order', () => {
    const bills = [bill({ id: 'b1', name: 'A' }), bill({ id: 'b2', name: 'B' })]
    const results = matchBills(bills, [], [])
    expect(results).toHaveLength(2)
    expect(results[0]!.bill.id).toBe('b1')
    expect(results[1]!.bill.id).toBe('b2')
  })

  it('empty arrays produce empty matches', () => {
    const results = matchBills([bill({})], [tx()], [])
    expect(results[0]!.matchedTransactions).toHaveLength(0)
    expect(results[0]!.totalAmount).toBe(0)
    expect(results[0]!.count).toBe(0)
  })

  it('unions multiple rules per bill (any rule match → included)', () => {
    const b = bill({ id: 'tucker', name: 'Tucker Carlson Network' })
    const rules = [
      rule({ id: 'r1', bill_id: 'tucker', keyword: 'tucker', rule_kind: 'name_keyword' }),
      rule({ id: 'r2', bill_id: 'tucker', keyword: 'tcn', rule_kind: 'name_keyword' })
    ]
    const txs = [
      tx({ id: 't1', description: 'TUCKER CARLSON' }),
      tx({ id: 't2', description: 'TCN MONTHLY' }),
      tx({ id: 't3', description: 'NETFLIX' })
    ]
    const result = matchBills([b], txs, rules)[0]!
    expect(result.matchedTransactions.map(t => t.id).sort()).toEqual(['t1', 't2'])
    expect(result.count).toBe(2)
  })

  it('inactive bills produce empty matches even with matching rules + transactions', () => {
    const b = bill({ id: 'b1', is_active: false })
    const rules = [rule({ keyword: 'anthropic' })]
    const txs = [tx()]
    const result = matchBills([b], txs, rules)[0]!
    expect(result.matchedTransactions).toHaveLength(0)
    expect(result.totalAmount).toBe(0)
  })

  it('resolves rules by bill_id when present', () => {
    const b = bill({ id: 'b1' })
    const r = rule({ bill_id: 'b1', bill_name: null, keyword: 'anthropic' })
    const result = matchBills([b], [tx()], [r])[0]!
    expect(result.count).toBe(1)
  })

  it('falls back to bill_name when rule.bill_id is null', () => {
    const b = bill({ id: 'b1', name: 'Claude AI / Anthropic' })
    const r = rule({ bill_id: null, bill_name: 'Claude AI / Anthropic', keyword: 'anthropic' })
    const result = matchBills([b], [tx()], [r])[0]!
    expect(result.count).toBe(1)
  })

  it('totalAmount uses absolute values', () => {
    const b = bill({ id: 'b1' })
    const r = rule({ bill_id: 'b1', keyword: 'anthropic' })
    const txs = [
      tx({ id: 't1', amount: 200, description: 'Anthropic' }),
      tx({ id: 't2', amount: -200, description: 'Anthropic refund' })
    ]
    const result = matchBills([b], txs, [r])[0]!
    expect(result.totalAmount).toBe(400)
  })

  it('multi-account: one bill matched against two cards via separate rules', () => {
    // Best Buy Card billed via two distinct keywords on potentially different accounts.
    const b = bill({ id: 'bb', name: 'Best Buy Card' })
    const rules = [
      rule({ id: 'r1', bill_id: 'bb', keyword: 'best buy', account_filter: 'Chase Card' }),
      rule({ id: 'r2', bill_id: 'bb', keyword: 'comenity', account_filter: 'Amex' })
    ]
    const txs = [
      tx({ id: 't1', description: 'BEST BUY', account: 'Chase Card' }),
      tx({ id: 't2', description: 'BEST BUY', account: 'Amex' }),  // wrong account for the chase rule
      tx({ id: 't3', description: 'COMENITY PAY', account: 'Amex' }),
      tx({ id: 't4', description: 'COMENITY PAY', account: 'Chase Card' })  // wrong account for the amex rule
    ]
    const result = matchBills([b], txs, rules)[0]!
    expect(result.matchedTransactions.map(t => t.id).sort()).toEqual(['t1', 't3'])
  })

  it('does not match bills against transactions when the rule has no overlap', () => {
    const b = bill({ id: 'b1' })
    const rules = [rule({ keyword: 'firstenergy' })]
    const txs = [tx({ description: 'ANTHROPIC SUB' })]
    const result = matchBills([b], txs, rules)[0]!
    expect(result.count).toBe(0)
  })
})
