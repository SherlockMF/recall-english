import { describe, expect, it } from 'vitest'
import { inferCategoryFromDictionary } from './inferCategory'

describe('inferCategoryFromDictionary', () => {
  it('maps financial leverage to finance', () => {
    expect(inferCategoryFromDictionary(
      'leverage',
      'the use of borrowed capital to increase potential return',
      'noun',
    )).toBe('finance')
  })

  it('maps audit terms to accounting', () => {
    expect(inferCategoryFromDictionary(
      'reconciliation',
      'the process of comparing two sets of records',
      'noun',
    )).toBe('accounting')
  })

  it('returns undefined for generic daily words', () => {
    expect(inferCategoryFromDictionary(
      'apartment',
      'a set of rooms for living in',
      'noun',
    )).toBeUndefined()
  })
})
