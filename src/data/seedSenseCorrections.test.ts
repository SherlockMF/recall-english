import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { SEED_CONTENT_REVISION } from './seedContentRevision'
import { clearDatabase, closeDatabase, getUserDataSnapshot, initializeDatabase, writeBatch } from '../lib/db'
import { DEFAULT_SETTINGS, type Word } from '../domain/types'

const words: Word[] = JSON.parse(readFileSync('public/data/bundledSeedWords.json', 'utf8'))
const get = (expression: string) => words.find(word => word.expression === expression)!

it('keeps definitions, POS and Chinese answers on the reviewed sense', () => {
  expect(get('somewhat')).toMatchObject({ partOfSpeech: 'adverb', zhGloss: '有点' })
  expect(get('somewhat').acceptedZhAnswers).not.toContain('某物')
  expect(get('fry').partOfSpeech).toBe('verb')
  expect(get('fit').partOfSpeech).toBe('verb')
  expect(get('lean').enDefinition).toMatch(/meat/i)
  expect(get('task').enDefinition).toMatch(/(?:piece|activity).*work|work.*(?:done|completed)/i)
  expect(get('please').enDefinition).toMatch(/polite|request/i)
  expect(get('secure').enDefinition).toMatch(/safe|worry|confident/i)
  expect(get('condemn').enDefinition).toMatch(/sentence|punishment/i)
  expect(get('reproduce').enDefinition).toMatch(/young|offspring/i)
  expect(get('cover').enDefinition).toMatch(/lid|object|container/i)
  expect(get('capture').zhGloss).toBe('捕获')
  expect(get('defend').zhGloss).toBe('保护')
  expect(get('admire').zhGloss).toBe('钦佩')
  expect(get('boost').enDefinition).toMatch(/increase|improvement/i)
})

it('does not present everyday actions as documents or thinking as a monetary amount', () => {
  const review = JSON.parse(readFileSync('data/vocabulary-packs/sense-review-2026-10-22.json', 'utf8'))
  const ids = new Set(review.findings.map((finding: { id: string }) => finding.id))
  const invalid = words.filter(word => ids.has(word.id)).flatMap(word => word.collocations
    .filter(value => ['bring', 'file'].some(verb => value === `${verb} the ${word.expression}`)
      || (['consideration', 'registration'].includes(word.expression) && value === `calculate the ${word.expression}`))
    .map(value => ({ expression: word.expression, collocation: value })))
  expect(invalid).toEqual([])
})

it('delivers corrected seed content to existing users while preserving edited content and reviewed tracks', async () => {
  try {
    const corrected = get('somewhat')
    await initializeDatabase([{ ...corrected, partOfSpeech: 'noun', zhGloss: '某物', contentEdited: false }], [], undefined,
      { ...DEFAULT_SETTINGS, seedContentRevision: '5.3.0' })
    const before = await getUserDataSnapshot()
    const reviewed = before.tracks.map(track => ({ ...track, reps: 8, stability: 20 }))
    await writeBatch({ tracks: reviewed })
    await initializeDatabase([corrected], [])
    expect((await getUserDataSnapshot()).words[0]).toMatchObject({ partOfSpeech: 'adverb', zhGloss: '有点' })
    expect((await getUserDataSnapshot()).tracks).toEqual(reviewed)
    const edited = { ...corrected, zhGloss: '我的个人解释', contentEdited: true }
    await writeBatch({ words: [edited] })
    await initializeDatabase([corrected], [], undefined,
      { ...DEFAULT_SETTINGS, seedContentRevision: `${SEED_CONTENT_REVISION}-next` })
    expect((await getUserDataSnapshot()).words[0]).toEqual(edited)
    expect(SEED_CONTENT_REVISION).not.toBe('5.3.0')
  } finally {
    await clearDatabase()
    await closeDatabase()
  }
})
