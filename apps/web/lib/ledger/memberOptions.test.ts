import { describe, it, expect } from 'vitest'
import { buildMemberOptions } from './memberOptions'

describe('buildMemberOptions', () => {
  it('returns just Unassigned + Family when there are no members', () => {
    const opts = buildMemberOptions([])
    expect(opts).toEqual([
      { value: null, label: '(Unassigned)', kind: 'unassigned' },
      { value: 'Family', label: 'Family', kind: 'family' }
    ])
  })

  it('appends each member after Unassigned + Family in input order', () => {
    const opts = buildMemberOptions([
      { display_name: 'Alexis Lopez' },
      { display_name: 'Bob Smith' },
      { display_name: 'Carol Adams' }
    ])
    expect(opts.map(o => o.value)).toEqual([
      null,
      'Family',
      'Alexis Lopez',
      'Bob Smith',
      'Carol Adams'
    ])
    expect(opts.slice(2).every(o => o.kind === 'member')).toBe(true)
  })

  it('appends legacy values not present in the current roster', () => {
    const opts = buildMemberOptions(
      [{ display_name: 'Alexis Lopez' }],
      ['Former Member']
    )
    expect(opts.map(o => o.value)).toEqual([
      null,
      'Family',
      'Alexis Lopez',
      'Former Member'
    ])
    expect(opts[3]?.kind).toBe('member')
  })

  it('de-duplicates legacy values that match Family or an existing member', () => {
    const opts = buildMemberOptions(
      [{ display_name: 'Alexis Lopez' }],
      ['Family', 'Alexis Lopez', 'Former Member']
    )
    // 'Family' + 'Alexis Lopez' already covered; 'Former Member' is new.
    expect(opts.map(o => o.value)).toEqual([
      null,
      'Family',
      'Alexis Lopez',
      'Former Member'
    ])
  })

  it('skips empty display_names and empty legacy strings', () => {
    const opts = buildMemberOptions(
      [{ display_name: '' }, { display_name: 'Alexis Lopez' }],
      ['', 'Former Member']
    )
    expect(opts.map(o => o.value)).toEqual([
      null,
      'Family',
      'Alexis Lopez',
      'Former Member'
    ])
  })
})
