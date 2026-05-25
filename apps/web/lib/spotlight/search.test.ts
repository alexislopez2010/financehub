import { describe, it, expect } from 'vitest'
import {
  searchEverything,
  type SpotlightCorpus,
  type SpotlightHit,
  type TransactionRow,
  type BillRow,
  type AccountRow,
  type CategoryRow
} from './search'

function makeTx(over: Partial<TransactionRow> = {}): TransactionRow {
  return {
    id: 't1',
    description: 'Costco Wholesale',
    category: 'Groceries',
    category_id: null,
    account: 'Chase Checking',
    member: 'Alex',
    date: '2026-05-15',
    amount: -123.45,
    type: 'Expense',
    ...over
  }
}

function makeBill(over: Partial<BillRow> = {}): BillRow {
  return {
    id: 'b1',
    name: 'Netflix',
    category: 'Subscriptions',
    frequency: 'Monthly',
    due_day: 7,
    budget_amount: 15.99,
    ...over
  }
}

function makeAccount(over: Partial<AccountRow> = {}): AccountRow {
  return {
    id: 'a1',
    name: 'Chase Checking',
    institution: 'Chase',
    account_type: 'checking',
    ...over
  }
}

function makeCategory(over: Partial<CategoryRow> = {}): CategoryRow {
  return {
    id: 'c1',
    name: 'Groceries',
    ...over
  }
}

function emptyCorpus(over: Partial<SpotlightCorpus> = {}): SpotlightCorpus {
  return {
    transactions: [],
    bills: [],
    accounts: [],
    categories: [],
    ...over
  }
}

describe('searchEverything', () => {
  describe('empty/whitespace queries', () => {
    it('returns empty for empty string', () => {
      expect(searchEverything(emptyCorpus({ transactions: [makeTx()] }), '')).toEqual([])
    })

    it('returns empty for whitespace-only query', () => {
      expect(searchEverything(emptyCorpus({ transactions: [makeTx()] }), '   \t  ')).toEqual([])
    })
  })

  describe('case-insensitive matching', () => {
    it('matches uppercase query against lowercase data and vice versa', () => {
      const result = searchEverything(
        emptyCorpus({ transactions: [makeTx({ description: 'costco wholesale' })] }),
        'COSTCO'
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.kind).toBe('transaction')
    })

    it('matches mixed-case substrings', () => {
      const result = searchEverything(
        emptyCorpus({ bills: [makeBill({ name: 'Netflix' })] }),
        'fLiX'
      )
      expect(result).toHaveLength(1)
      expect(result[0]!.kind).toBe('bill')
    })
  })

  describe('AND semantics across tokens', () => {
    it('requires every token to match somewhere (possibly different fields)', () => {
      const tx = makeTx({ description: 'Costco Gas Station', category: 'Auto' })
      const result = searchEverything(emptyCorpus({ transactions: [tx] }), 'costco gas')
      expect(result).toHaveLength(1)
    })

    it('tokens may match across different fields', () => {
      const tx = makeTx({ description: 'Costco', category: 'Gas' })
      const result = searchEverything(emptyCorpus({ transactions: [tx] }), 'costco gas')
      expect(result).toHaveLength(1)
    })

    it('excludes rows missing any token', () => {
      const tx = makeTx({ description: 'Costco Wholesale', category: 'Groceries', account: 'Chase', member: 'Alex' })
      const result = searchEverything(emptyCorpus({ transactions: [tx] }), 'costco banana')
      expect(result).toHaveLength(0)
    })
  })

  describe('scoring', () => {
    it('scores a token higher when the matched field is shorter (closer to a full-word hit)', () => {
      const shortTx = makeTx({ id: 'short', description: 'Netflix', category: '', account: '', member: '' })
      const longTx = makeTx({ id: 'long', description: 'Netflix annual recurring subscription invoice for 2026', category: '', account: '', member: '' })
      const result = searchEverything(emptyCorpus({ transactions: [shortTx, longTx] }), 'netflix')
      // Both should match; shorter field gives the higher score.
      const short = result.find(h => h.id === 'short')
      const long = result.find(h => h.id === 'long')
      expect(short).toBeDefined()
      expect(long).toBeDefined()
      expect(short!.score).toBeGreaterThan(long!.score)
    })

    it('sums score across multiple matched tokens', () => {
      const oneToken = searchEverything(
        emptyCorpus({ transactions: [makeTx({ description: 'Costco Gas' })] }),
        'costco'
      )
      const twoTokens = searchEverything(
        emptyCorpus({ transactions: [makeTx({ description: 'Costco Gas' })] }),
        'costco gas'
      )
      expect(twoTokens[0]!.score).toBeGreaterThan(oneToken[0]!.score)
    })
  })

  describe('caps per group', () => {
    it('returns at most 8 transactions', () => {
      const txs = Array.from({ length: 20 }, (_, i) =>
        makeTx({ id: `t${i}`, description: `Netflix Charge ${i}` })
      )
      const result = searchEverything(emptyCorpus({ transactions: txs }), 'netflix')
      expect(result.filter(h => h.kind === 'transaction')).toHaveLength(8)
    })

    it('returns at most 5 bills', () => {
      const bills = Array.from({ length: 10 }, (_, i) =>
        makeBill({ id: `b${i}`, name: `Netflix Plan ${i}` })
      )
      const result = searchEverything(emptyCorpus({ bills }), 'netflix')
      expect(result.filter(h => h.kind === 'bill')).toHaveLength(5)
    })

    it('returns at most 5 accounts', () => {
      const accounts = Array.from({ length: 10 }, (_, i) =>
        makeAccount({ id: `a${i}`, name: `Chase Account ${i}` })
      )
      const result = searchEverything(emptyCorpus({ accounts }), 'chase')
      expect(result.filter(h => h.kind === 'account')).toHaveLength(5)
    })

    it('returns at most 5 categories', () => {
      const categories = Array.from({ length: 10 }, (_, i) =>
        makeCategory({ id: `c${i}`, name: `Groceries ${i}` })
      )
      const result = searchEverything(emptyCorpus({ categories }), 'groceries')
      expect(result.filter(h => h.kind === 'category')).toHaveLength(5)
    })
  })

  describe('sort within group', () => {
    it('higher score first', () => {
      const result = searchEverything(
        emptyCorpus({
          transactions: [
            makeTx({ id: 'long', description: 'Netflix annual subscription invoice 2026', category: '', account: '', member: '' }),
            makeTx({ id: 'short', description: 'Netflix', category: '', account: '', member: '' })
          ]
        }),
        'netflix'
      )
      const txHits = result.filter(h => h.kind === 'transaction')
      expect(txHits[0]!.id).toBe('short')
      expect(txHits[1]!.id).toBe('long')
    })

    it('alphabetical label tie-break for equal scores', () => {
      const result = searchEverything(
        emptyCorpus({
          categories: [
            makeCategory({ id: 'c-z', name: 'Zoo' }),
            makeCategory({ id: 'c-a', name: 'Aoo' }),
            makeCategory({ id: 'c-m', name: 'Moo' })
          ]
        }),
        'oo'
      )
      const cats = result.filter(h => h.kind === 'category')
      expect(cats.map(h => h.label)).toEqual(['Aoo', 'Moo', 'Zoo'])
    })
  })

  describe('output order', () => {
    it('orders kinds: transactions, bills, accounts, categories', () => {
      const result = searchEverything(
        {
          transactions: [makeTx({ description: 'foo tx' })],
          bills: [makeBill({ name: 'foo bill' })],
          accounts: [makeAccount({ name: 'foo account' })],
          categories: [makeCategory({ name: 'foo cat' })]
        },
        'foo'
      )
      expect(result.map(h => h.kind)).toEqual(['transaction', 'bill', 'account', 'category'])
    })
  })

  describe('deep links', () => {
    it('transaction href uses first description-matched token encoded', () => {
      const result = searchEverything(
        emptyCorpus({ transactions: [makeTx({ description: 'Costco Wholesale' })] }),
        'costco'
      )
      expect(result[0]!.href).toBe('/ledger?q=costco')
    })

    it('transaction href encodes special characters', () => {
      const result = searchEverything(
        emptyCorpus({ transactions: [makeTx({ description: "Joe's Diner" })] }),
        "joe's"
      )
      expect(result[0]!.href).toBe(`/ledger?q=${encodeURIComponent("joe's")}`)
    })

    it('transaction href falls back to full query when description did not match', () => {
      const tx = makeTx({ description: 'Walmart', category: 'Groceries', account: '', member: '' })
      const result = searchEverything(emptyCorpus({ transactions: [tx] }), 'groceries')
      // description has no match; the matched token came from category.
      expect(result[0]!.href).toBe('/ledger?q=groceries')
    })

    it('bill href uses focus=<id>', () => {
      const result = searchEverything(
        emptyCorpus({ bills: [makeBill({ id: 'bill-uuid', name: 'Netflix' })] }),
        'netflix'
      )
      expect(result[0]!.href).toBe('/bills?focus=bill-uuid')
    })

    it('account href uses focus=<id>', () => {
      const result = searchEverything(
        emptyCorpus({ accounts: [makeAccount({ id: 'acct-uuid', name: 'Chase' })] }),
        'chase'
      )
      expect(result[0]!.href).toBe('/accounts?focus=acct-uuid')
    })

    it('category href uses category=<id>', () => {
      const result = searchEverything(
        emptyCorpus({ categories: [makeCategory({ id: 'cat-uuid', name: 'Groceries' })] }),
        'groceries'
      )
      expect(result[0]!.href).toBe('/ledger?category=cat-uuid')
    })
  })

  describe('detail line', () => {
    it('transaction detail: "<MMM D> · <signed amount>"', () => {
      const result = searchEverything(
        emptyCorpus({
          transactions: [makeTx({ description: 'Netflix', date: '2026-05-15', amount: -123.45 })]
        }),
        'netflix'
      )
      expect(result[0]!.detail).toBe('May 15 · -$123.45')
    })

    it('transaction detail formats positive amounts without minus sign', () => {
      const result = searchEverything(
        emptyCorpus({
          transactions: [makeTx({ description: 'Refund', date: '2026-01-03', amount: 50 })]
        }),
        'refund'
      )
      expect(result[0]!.detail).toBe('Jan 3 · $50.00')
    })

    it('bill detail: "<frequency> · day <due_day>"', () => {
      const result = searchEverything(
        emptyCorpus({ bills: [makeBill({ name: 'Netflix', frequency: 'Monthly', due_day: 7 })] }),
        'netflix'
      )
      expect(result[0]!.detail).toBe('Monthly · day 7')
    })

    it('account detail uses institution when present, else type', () => {
      const withInst = searchEverything(
        emptyCorpus({ accounts: [makeAccount({ name: 'Chase', institution: 'Chase Bank', account_type: 'checking' })] }),
        'chase'
      )
      expect(withInst[0]!.detail).toBe('Chase Bank')

      const withoutInst = searchEverything(
        emptyCorpus({ accounts: [makeAccount({ id: 'a2', name: 'Cash', institution: null, account_type: 'cash' })] }),
        'cash'
      )
      expect(withoutInst[0]!.detail).toBe('cash')
    })

    it('category detail is omitted', () => {
      const result = searchEverything(
        emptyCorpus({ categories: [makeCategory({ name: 'Groceries' })] }),
        'groceries'
      )
      expect(result[0]!.detail).toBeUndefined()
    })
  })

  describe('searchable fields per kind', () => {
    it('transaction searches description, category, account, member', () => {
      const tx = makeTx({
        description: 'X1',
        category: 'X2',
        account: 'X3',
        member: 'X4'
      })
      expect(searchEverything(emptyCorpus({ transactions: [tx] }), 'X1')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ transactions: [tx] }), 'X2')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ transactions: [tx] }), 'X3')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ transactions: [tx] }), 'X4')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ transactions: [tx] }), 'X5')).toHaveLength(0)
    })

    it('bill searches name, category, frequency', () => {
      const bill = makeBill({ name: 'X1', category: 'X2', frequency: 'X3' })
      expect(searchEverything(emptyCorpus({ bills: [bill] }), 'X1')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ bills: [bill] }), 'X2')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ bills: [bill] }), 'X3')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ bills: [bill] }), 'X4')).toHaveLength(0)
    })

    it('account searches name, institution, account_type', () => {
      const acct = makeAccount({ name: 'X1', institution: 'X2', account_type: 'X3' })
      expect(searchEverything(emptyCorpus({ accounts: [acct] }), 'X1')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ accounts: [acct] }), 'X2')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ accounts: [acct] }), 'X3')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ accounts: [acct] }), 'X4')).toHaveLength(0)
    })

    it('category searches only name', () => {
      const cat = makeCategory({ name: 'X1' })
      expect(searchEverything(emptyCorpus({ categories: [cat] }), 'X1')).toHaveLength(1)
      expect(searchEverything(emptyCorpus({ categories: [cat] }), 'X2')).toHaveLength(0)
    })
  })

  describe('hit shape', () => {
    it('returns expected SpotlightHit fields for a transaction', () => {
      const result = searchEverything(
        emptyCorpus({
          transactions: [makeTx({ id: 'tx-uuid', description: 'Costco', date: '2026-05-15', amount: -50 })]
        }),
        'costco'
      )
      const hit: SpotlightHit = result[0]!
      expect(hit.kind).toBe('transaction')
      expect(hit.id).toBe('tx-uuid')
      expect(hit.label).toBe('Costco')
      expect(hit.href).toBe('/ledger?q=costco')
      expect(hit.score).toBeGreaterThan(0)
    })

    it('uses the row name/description as label per kind', () => {
      const result = searchEverything(
        {
          transactions: [makeTx({ id: 'T', description: 'Tx Label' })],
          bills: [makeBill({ id: 'B', name: 'Bill Label' })],
          accounts: [makeAccount({ id: 'A', name: 'Account Label' })],
          categories: [makeCategory({ id: 'C', name: 'Category Label' })]
        },
        'label'
      )
      const byKind = Object.fromEntries(result.map(h => [h.kind, h.label]))
      expect(byKind.transaction).toBe('Tx Label')
      expect(byKind.bill).toBe('Bill Label')
      expect(byKind.account).toBe('Account Label')
      expect(byKind.category).toBe('Category Label')
    })
  })

  describe('null-safe field handling', () => {
    it('handles null transaction fields without crashing', () => {
      const tx = makeTx({
        description: 'Real Description',
        category: null,
        account: null,
        member: null,
        category_id: null
      })
      const result = searchEverything(emptyCorpus({ transactions: [tx] }), 'real')
      expect(result).toHaveLength(1)
    })

    it('handles null bill fields', () => {
      const bill = makeBill({ name: 'BillName', category: null, frequency: null, due_day: null })
      const result = searchEverything(emptyCorpus({ bills: [bill] }), 'billname')
      expect(result).toHaveLength(1)
    })

    it('handles null account institution', () => {
      const acct = makeAccount({ name: 'AcctName', institution: null, account_type: 'cash' })
      const result = searchEverything(emptyCorpus({ accounts: [acct] }), 'acctname')
      expect(result).toHaveLength(1)
    })
  })
})
