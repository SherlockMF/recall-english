import { expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
// @ts-expect-error Node build helper is an ESM JavaScript module.
import { loadHandcraftedSenses, overlapsHandcraftedSense } from './lib/handcraftedSenses.mjs'

const source = `const rows = [{
  expression: 'interest', sense: 'curiosity', zh: '兴趣', definition: 'wanting to learn about something', partOfSpeech: 'noun'
}, {
  expression: "don't mind", sense: 'accept', zh: '不介意', definition: 'not to object', partOfSpeech: 'verb phrase'
}]`

it('retains the same expression with a different meaning or part of speech', () => {
  const handcrafted = loadHandcraftedSenses(source)
  expect(overlapsHandcraftedSense({ expression: 'interest', zhGloss: '利息', enDefinition: 'money on loans', partOfSpeech: 'noun' }, handcrafted)).toBe(false)
  expect(overlapsHandcraftedSense({ expression: 'interest', zhGloss: '兴趣', enDefinition: 'to attract attention', partOfSpeech: 'verb' }, handcrafted)).toBe(false)
})

it('excludes a true overlap and understands quoted expressions', () => {
  const handcrafted = loadHandcraftedSenses(source)
  expect(handcrafted).toHaveLength(2)
  expect(overlapsHandcraftedSense({ expression: ' Interest ', zhGloss: '兴趣', enDefinition: 'wanting to learn about something', partOfSpeech: 'noun' }, handcrafted)).toBe(true)
  expect(handcrafted[1].expression).toBe("don't mind")
})

it('retains differing definitions even when their Chinese translations coincide', () => {
  const handcrafted = [{ expression: 'bank', zhGloss: '银行', enDefinition: 'a financial institution', partOfSpeech: 'noun' }]
  expect(overlapsHandcraftedSense({ expression: 'bank', zhGloss: '银行', enDefinition: 'a building housing a financial institution', partOfSpeech: 'noun' }, handcrafted)).toBe(false)
})

it('reads every literal row in the current production handwritten vocabulary', () => {
  const actual = loadHandcraftedSenses(readFileSync('src/data/seedVocabulary.ts', 'utf8'))
  expect(actual).toHaveLength(240)
  expect(actual.some((sense: { expression: string }) => sense.expression === 'budget')).toBe(true)
})
