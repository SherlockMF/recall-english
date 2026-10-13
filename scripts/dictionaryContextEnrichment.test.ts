import { describe, expect, it } from 'vitest'
import { fillFromSeedContext, mergeSourceContext } from './enrichDictionaryContexts.mjs'

const entry = { query: 'bank', word: 'bank', fetchedAt: '2026-10-11T00:00:00Z', meanings: [
  { partOfSpeech: 'noun', zhGloss: '银行', definition: '', synonyms: [], senseKey: 'dictionary:youdao:["noun","银行",0]' },
  { partOfSpeech: 'noun', zhGloss: '河岸', definition: '', synonyms: [], senseKey: 'dictionary:youdao:["noun","河岸",0]' },
] }

describe('source-aligned context enrichment', () => {
  it('fills context from a uniquely matching seed while preserving the original sense identity', () => {
    const filled = fillFromSeedContext(entry, [{ expression: 'bank', partOfSpeech: 'noun', zhGloss: '银行',
      enDefinition: 'a financial institution', examples: [{ en: 'The bank approved the loan.', zh: '银行批准了贷款。' }] }])
    expect(filled.meanings[0]).toMatchObject({ senseKey: entry.meanings[0].senseKey, definition: 'a financial institution', example: 'The bank approved the loan.' })
    expect(filled.meanings[1].definition).toBe('')
  })

  it('does not choose between different definitions sharing the same Chinese gloss', () => {
    const filled = fillFromSeedContext(entry, [
      { expression: 'bank', partOfSpeech: 'noun', zhGloss: '银行', enDefinition: 'an institution' },
      { expression: 'bank', partOfSpeech: 'noun', zhGloss: '银行', enDefinition: 'a building' },
    ])
    expect(filled.meanings[0].definition).toBe('')
  })

  it('merges only matching senses and never overwrites populated source fields', () => {
    const populated = { ...entry, meanings: entry.meanings.map((meaning, index) => index === 0 ? { ...meaning, definition: 'existing definition' } : meaning) }
    const enriched = mergeSourceContext(populated, { ...entry, meanings: entry.meanings.map((meaning, index) => ({ ...meaning, definition: index === 0 ? 'another definition' : 'the land beside a river' })) })
    expect(enriched.meanings[0].definition).toBe('existing definition')
    expect(enriched.meanings[1].definition).toBe('the land beside a river')
    expect(enriched.meanings.map((meaning: { senseKey: string }) => meaning.senseKey)).toEqual(entry.meanings.map((meaning) => meaning.senseKey))
  })
})
