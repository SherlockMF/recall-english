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

  it('classifies the meaning instead of treating every interest or stock sense as financial', () => {
    expect(inferCategoryFromDictionary('interest', 'a desire to learn about something 兴趣', 'noun')).toBeUndefined()
    expect(inferCategoryFromDictionary('interest', 'money paid for borrowing money 利息', 'noun')).toBe('finance')
    expect(inferCategoryFromDictionary('stock', 'a liquid made by cooking bones 高汤', 'noun')).toBeUndefined()
    expect(inferCategoryFromDictionary('merchant partnership', '商户合作', 'noun')).toBe('business')
    expect(inferCategoryFromDictionary('settlement statement', '商户结算对账单', 'noun')).toBe('accounting')
  })

  it('does not confuse investigation with investment or a taxi with tax', () => {
    for (const expression of ['investigate', 'investigation', 'investigator']) {
      expect(inferCategoryFromDictionary(expression, 'to examine a crime carefully 调查')).toBeUndefined()
    }
    expect(inferCategoryFromDictionary('investment', 'money put into a business')).toBe('finance')
    expect(inferCategoryFromDictionary('taxi', 'a car that carries passengers')).toBeUndefined()
  })
})
