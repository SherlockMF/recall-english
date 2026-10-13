import { describe, expect, it } from 'vitest'
import { resolveListSlugsForEdit } from './listMembership'

describe('resolveListSlugsForEdit', () => {
  it('does not restore priority when editing a custom word removed from priority study', () => {
    expect(resolveListSlugsForEdit([], 'my-vocabulary', 'business')).toEqual(['business'])
    expect(resolveListSlugsForEdit([], 'my-vocabulary', 'other')).toEqual([])
  })
  it('keeps dual system memberships when primary category is unchanged', () => {
    expect(resolveListSlugsForEdit(
      ['finance', 'accounting'],
      'finance',
      'finance',
    )).toEqual(['finance', 'accounting'])
  })

  it('keeps non-primary system memberships when primary changes', () => {
    expect(resolveListSlugsForEdit(
      ['finance', 'accounting', 'my-vocabulary'],
      'finance',
      'daily',
    )).toEqual(['accounting', 'daily', 'my-vocabulary'])
  })

  it('keeps my-vocabulary-only custom words as other without adding daily', () => {
    expect(resolveListSlugsForEdit(
      ['my-vocabulary'],
      'my-vocabulary',
      'other',
    )).toEqual(['my-vocabulary'])
  })

  it('adds a system list when moving from other to a category', () => {
    expect(resolveListSlugsForEdit(
      ['my-vocabulary'],
      'my-vocabulary',
      'business',
    )).toEqual(['business', 'my-vocabulary'])
  })
})
