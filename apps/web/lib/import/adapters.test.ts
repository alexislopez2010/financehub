import { describe, expect, it } from 'vitest'
import { ADAPTERS, amex, capitalOne, chase, detectAdapter, discover, generic } from './adapters'

describe('detectAdapter', () => {
  it('returns chase for Chase headers', () => {
    // Arrange
    const headers = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('Chase')
  })

  it('returns capitalOne for Capital One headers', () => {
    // Arrange
    const headers = ['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('Capital One')
  })

  it('returns discover for Discover headers', () => {
    // Arrange
    const headers = ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('Discover')
  })

  it('returns amex for AmEx headers (uses Card Member to disambiguate)', () => {
    // Arrange
    const headers = ['Date', 'Description', 'Amount', 'Card Member', 'Account #']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('American Express')
  })

  it('returns generic for unknown but well-formed headers', () => {
    // Arrange
    const headers = ['Date', 'Payee', 'Value']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('Generic CSV')
  })

  it('returns null when nothing matches', () => {
    // Arrange
    const headers = ['Foo', 'Bar', 'Baz']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result).toBeNull()
  })

  it('chase wins over generic when both could match', () => {
    // Arrange
    const headers = ['Transaction Date', 'Post Date', 'Description', 'Amount', 'Memo']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('Chase')
  })

  it('case-insensitive header matching', () => {
    // Arrange
    const headers = ['TRANSACTION DATE', 'post date', 'description', 'amount', 'memo']

    // Act
    const result = detectAdapter(headers)

    // Assert
    expect(result?.name).toBe('Chase')
  })

  it('exposes adapters array in priority order', () => {
    // Arrange / Act / Assert
    expect(ADAPTERS.map(a => a.name)).toEqual([
      'Chase',
      'Capital One',
      'Discover',
      'American Express',
      'Generic CSV'
    ])
  })
})

describe('chase adapter', () => {
  const headers = ['Transaction Date', 'Post Date', 'Description', 'Category', 'Type', 'Amount', 'Memo']

  it('matches its signature', () => {
    expect(chase.matches(headers)).toBe(true)
  })

  it('does not match if Memo is missing', () => {
    expect(chase.matches(['Transaction Date', 'Post Date', 'Amount'])).toBe(false)
  })

  it('does not match if Transaction Date is missing', () => {
    expect(chase.matches(['Post Date', 'Memo', 'Amount'])).toBe(false)
  })

  it('parses a sale as Expense with negative amount', () => {
    // Arrange
    const rows = [
      ['01/15/2026', '01/16/2026', 'NETFLIX', 'Entertainment', 'Sale', '-15.99', '']
    ]

    // Act
    const { parsed, skipped } = chase.parse(headers, rows)

    // Assert
    expect(skipped).toHaveLength(0)
    expect(parsed).toHaveLength(1)
    expect(parsed[0]).toEqual({
      date: '2026-01-15',
      description: 'NETFLIX',
      amount: -15.99,
      type: 'Expense',
      source: 'Chase'
    })
  })

  it('parses a payment as Refund with positive amount', () => {
    // Arrange
    const rows = [
      ['02/01/2026', '02/02/2026', 'AUTOMATIC PAYMENT', 'Payment', 'Payment', '500.00', '']
    ]

    // Act
    const { parsed } = chase.parse(headers, rows)

    // Assert
    expect(parsed[0]?.type).toBe('Refund')
    expect(parsed[0]?.amount).toBe(500)
  })

  it('falls back to amount-based type when Type cell is blank', () => {
    // Arrange
    const rows = [
      ['01/01/2026', '01/02/2026', 'STARBUCKS', 'Food', '', '-4.50', ''],
      ['01/03/2026', '01/04/2026', 'INTEREST', 'Other', '', '1.20', '']
    ]

    // Act
    const { parsed } = chase.parse(headers, rows)

    // Assert
    expect(parsed[0]?.type).toBe('Expense')
    expect(parsed[1]?.type).toBe('Income')
  })

  it('skips rows with bad dates', () => {
    // Arrange
    const rows = [['not-a-date', '', 'X', '', '', '-10', '']]

    // Act
    const { parsed, skipped } = chase.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.reason).toMatch(/Invalid date/)
  })

  it('skips rows with missing description', () => {
    // Arrange
    const rows = [['01/01/2026', '', '', '', '', '-10', '']]

    // Act
    const { parsed, skipped } = chase.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped[0]?.reason).toBe('Missing description')
  })

  it('skips rows with bad amount', () => {
    // Arrange
    const rows = [['01/01/2026', '', 'X', '', '', 'not-a-number', '']]

    // Act
    const { parsed, skipped } = chase.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped[0]?.reason).toMatch(/Invalid amount/)
  })

  it('handles two-digit years', () => {
    // Arrange
    const rows = [['01/15/26', '01/16/26', 'X', '', 'Sale', '-10', '']]

    // Act
    const { parsed } = chase.parse(headers, rows)

    // Assert
    expect(parsed[0]?.date).toBe('2026-01-15')
  })
})

describe('capitalOne adapter', () => {
  const headers = ['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit']

  it('matches its signature', () => {
    expect(capitalOne.matches(headers)).toBe(true)
  })

  it('does not match without Posted Date', () => {
    expect(capitalOne.matches(['Transaction Date', 'Debit', 'Credit'])).toBe(false)
  })

  it('parses a charge as negative amount Expense', () => {
    // Arrange
    const rows = [
      ['03/05/2026', '03/06/2026', '1234', 'AMAZON', 'Shopping', '42.50', '']
    ]

    // Act
    const { parsed } = capitalOne.parse(headers, rows)

    // Assert
    expect(parsed[0]).toEqual({
      date: '2026-03-05',
      description: 'AMAZON',
      amount: -42.5,
      type: 'Expense',
      source: 'Capital One'
    })
  })

  it('parses a payment as positive amount Income', () => {
    // Arrange
    const rows = [
      ['03/10/2026', '03/11/2026', '1234', 'PAYMENT THANK YOU', 'Payment', '', '300.00']
    ]

    // Act
    const { parsed } = capitalOne.parse(headers, rows)

    // Assert
    expect(parsed[0]?.amount).toBe(300)
    expect(parsed[0]?.type).toBe('Income')
  })

  it('skips row with both debit and credit blank', () => {
    // Arrange
    const rows = [['03/15/2026', '03/16/2026', '1234', 'NOTHING', '', '', '']]

    // Act
    const { parsed, skipped } = capitalOne.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })

  it('skips row with bad date', () => {
    // Arrange
    const rows = [['bogus', '03/16/2026', '1234', 'X', '', '10', '']]

    // Act
    const { parsed, skipped } = capitalOne.parse(headers, rows)

    // Assert
    expect(skipped).toHaveLength(1)
    expect(parsed).toHaveLength(0)
  })

  it('skips row with bad amount', () => {
    // Arrange
    const rows = [['03/15/2026', '03/16/2026', '1234', 'X', '', 'oops', '']]

    // Act
    const { parsed, skipped } = capitalOne.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped).toHaveLength(1)
    expect(skipped[0]?.reason).toMatch(/Invalid amount/)
  })

  it('handles currency formatting in debit/credit cells', () => {
    // Arrange
    const rows = [['04/01/2026', '04/02/2026', '1', 'X', '', '$1,234.56', '']]

    // Act
    const { parsed } = capitalOne.parse(headers, rows)

    // Assert
    expect(parsed[0]?.amount).toBe(-1234.56)
  })

  it('treats parens in debit column as positive magnitude (Excel re-save defense)', () => {
    // Arrange — if a CSV is re-saved through Excel it may pick up accounting paren
    // notation. parseMoney("(42.50)") returns -42.50, which without Math.abs would
    // flip the sign: amount = 0 - (-42.50) = +42.50, mislabeled as Income.
    const rows = [
      ['04/15/2026', '04/16/2026', '1234', 'TARGET', 'Shopping', '(42.50)', '']
    ]

    // Act
    const { parsed } = capitalOne.parse(headers, rows)

    // Assert — must stay an Expense.
    expect(parsed[0]?.amount).toBe(-42.5)
    expect(parsed[0]?.type).toBe('Expense')
  })
})

describe('discover adapter', () => {
  const headers = ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category']

  it('matches its signature', () => {
    expect(discover.matches(headers)).toBe(true)
  })

  it('does not match without Trans. Date', () => {
    expect(discover.matches(['Transaction Date', 'Post Date', 'Amount'])).toBe(false)
  })

  it('parses positive CSV amount as negative Expense (flip sign)', () => {
    // Arrange
    const rows = [
      ['05/01/2026', '05/02/2026', 'TARGET', '23.45', 'Shopping']
    ]

    // Act
    const { parsed } = discover.parse(headers, rows)

    // Assert
    expect(parsed[0]).toEqual({
      date: '2026-05-01',
      description: 'TARGET',
      amount: -23.45,
      type: 'Expense',
      source: 'Discover'
    })
  })

  it('parses negative CSV amount as positive Refund', () => {
    // Arrange
    const rows = [
      ['05/05/2026', '05/06/2026', 'CREDIT', '-10.00', 'Other']
    ]

    // Act
    const { parsed } = discover.parse(headers, rows)

    // Assert
    expect(parsed[0]?.amount).toBe(10)
    expect(parsed[0]?.type).toBe('Refund')
  })

  it('skips bad rows', () => {
    // Arrange
    const rows = [['bad', '', '', 'x', '']]

    // Act
    const { parsed, skipped } = discover.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})

describe('amex adapter', () => {
  const headers = ['Date', 'Description', 'Amount', 'Card Member', 'Account #']

  it('matches its signature', () => {
    expect(amex.matches(headers)).toBe(true)
  })

  it('does not match without Card Member', () => {
    expect(amex.matches(['Date', 'Description', 'Amount'])).toBe(false)
  })

  it('flips sign on amounts (positive CSV → negative Expense)', () => {
    // Arrange
    const rows = [
      ['06/15/2026', 'WHOLE FOODS', '87.32', 'JOHN DOE', '12345']
    ]

    // Act
    const { parsed } = amex.parse(headers, rows)

    // Assert
    expect(parsed[0]?.amount).toBe(-87.32)
    expect(parsed[0]?.type).toBe('Expense')
    expect(parsed[0]?.source).toBe('American Express')
  })

  it('parses refund (negative CSV → positive Refund)', () => {
    // Arrange
    const rows = [['06/20/2026', 'RETURN', '-15.00', 'JOHN DOE', '12345']]

    // Act
    const { parsed } = amex.parse(headers, rows)

    // Assert
    expect(parsed[0]?.amount).toBe(15)
    expect(parsed[0]?.type).toBe('Refund')
  })

  it('skips bad rows', () => {
    // Arrange
    const rows = [['', 'X', '10', 'JOHN', '1']]

    // Act
    const { parsed, skipped } = amex.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})

describe('generic adapter', () => {
  it('matches when date + description + amount columns are present (case-insensitive)', () => {
    expect(generic.matches(['date', 'payee', 'value'])).toBe(true)
    expect(generic.matches(['Posted Date', 'Memo', 'Amount'])).toBe(true)
  })

  it('does not match when missing one of the three required columns', () => {
    expect(generic.matches(['Date', 'Payee'])).toBe(false)
    expect(generic.matches(['Date', 'Amount'])).toBe(false)
    expect(generic.matches(['Description', 'Amount'])).toBe(false)
  })

  it('parses rows with Chase-style sign convention', () => {
    // Arrange
    const headers = ['Date', 'Payee', 'Amount']
    const rows = [['07/01/2026', 'COFFEE', '-5.00']]

    // Act
    const { parsed } = generic.parse(headers, rows)

    // Assert
    expect(parsed[0]?.amount).toBe(-5)
    expect(parsed[0]?.type).toBe('Expense')
    expect(parsed[0]?.source).toBe('Generic CSV')
  })

  it('treats positive amount as Income', () => {
    // Arrange
    const headers = ['Date', 'Description', 'Amount']
    const rows = [['07/02/2026', 'DEPOSIT', '1000']]

    // Act
    const { parsed } = generic.parse(headers, rows)

    // Assert
    expect(parsed[0]?.type).toBe('Income')
  })

  it('skips bad rows', () => {
    // Arrange
    const headers = ['Date', 'Payee', 'Amount']
    const rows = [['bogus', 'X', '1']]

    // Act
    const { parsed, skipped } = generic.parse(headers, rows)

    // Assert
    expect(parsed).toHaveLength(0)
    expect(skipped).toHaveLength(1)
  })
})
