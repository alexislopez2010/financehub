import { describe, it, expect } from 'vitest'
import { parseCsv } from './csv'

describe('parseCsv', () => {
  it('parses a simple LF-delimited CSV', () => {
    // Arrange
    const text = 'a,b,c\n1,2,3\n4,5,6'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.headers).toEqual(['a', 'b', 'c'])
    expect(result.rows).toEqual([['1', '2', '3'], ['4', '5', '6']])
    expect(result.hasMalformedRows).toBe(false)
  })

  it('parses CRLF line endings', () => {
    // Arrange
    const text = 'a,b\r\n1,2\r\n3,4\r\n'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.headers).toEqual(['a', 'b'])
    expect(result.rows).toEqual([['1', '2'], ['3', '4']])
    expect(result.hasMalformedRows).toBe(false)
  })

  it('strips BOM from start of file', () => {
    // Arrange
    const text = '﻿a,b\n1,2'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.headers).toEqual(['a', 'b'])
    expect(result.rows).toEqual([['1', '2']])
  })

  it('handles quoted fields with commas inside', () => {
    // Arrange
    const text = 'desc,amount\n"Smith, John",100\n"Doe, Jane",200'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toEqual([
      ['Smith, John', '100'],
      ['Doe, Jane', '200']
    ])
  })

  it('handles escaped double quotes inside quoted field', () => {
    // Arrange
    const text = 'desc\n"He said ""hi"""'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toEqual([['He said "hi"']])
  })

  it('trims trailing newline without adding an empty row', () => {
    // Arrange
    const text = 'a,b\n1,2\n'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toHaveLength(1)
    expect(result.hasMalformedRows).toBe(false)
  })

  it('skips empty rows (blank lines)', () => {
    // Arrange
    const text = 'a,b\n1,2\n\n3,4\n'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toEqual([['1', '2'], ['3', '4']])
    expect(result.hasMalformedRows).toBe(false)
  })

  it('flags malformed rows but still includes them', () => {
    // Arrange
    const text = 'a,b,c\n1,2,3\n4,5\n6,7,8,9'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.headers).toHaveLength(3)
    expect(result.rows).toHaveLength(3)
    expect(result.hasMalformedRows).toBe(true)
  })

  it('preserves original case of headers but trims whitespace', () => {
    // Arrange
    const text = '  Transaction Date , Amount \n01/01/2026,100'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.headers).toEqual(['Transaction Date', 'Amount'])
  })

  it('returns empty result for empty input', () => {
    // Arrange / Act
    const result = parseCsv('')

    // Assert
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
    expect(result.hasMalformedRows).toBe(false)
  })

  it('returns empty result for whitespace-only input', () => {
    // Arrange / Act
    const result = parseCsv('\n\n\n')

    // Assert
    expect(result.headers).toEqual([])
    expect(result.rows).toEqual([])
  })

  it('handles a single header row with no data', () => {
    // Arrange / Act
    const result = parseCsv('a,b,c')

    // Assert
    expect(result.headers).toEqual(['a', 'b', 'c'])
    expect(result.rows).toEqual([])
  })

  it('handles mixed quoted and unquoted cells in a single row', () => {
    // Arrange
    const text = 'date,desc,amount\n2026-01-01,"Apple, Inc.",100'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toEqual([['2026-01-01', 'Apple, Inc.', '100']])
  })

  it('preserves empty trailing cells', () => {
    // Arrange
    const text = 'a,b,c\n1,2,\n,,3'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toEqual([['1', '2', ''], ['', '', '3']])
    expect(result.hasMalformedRows).toBe(false)
  })

  it('handles newlines inside quoted fields', () => {
    // Arrange
    const text = 'desc,amount\n"line1\nline2",100'

    // Act
    const result = parseCsv(text)

    // Assert
    expect(result.rows).toEqual([['line1\nline2', '100']])
  })
})
