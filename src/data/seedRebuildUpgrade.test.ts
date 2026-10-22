import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type Word } from '../domain/types'
import { clearDatabase, closeDatabase, getUserDataSnapshot, hydrateWord, initializeDatabase, writeBatch } from '../lib/db'
import { gradeAttempt } from '../lib/grading'
import { handcraftedSeedWords } from './seedVocabulary'

const published: Word[] = JSON.parse(readFileSync('public/data/bundledSeedWords.json', 'utf8'))
const pack: { words: Word[] } = JSON.parse(readFileSync('data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json', 'utf8'))
const expressions = ['accrual', 'attendance', 'deposit', 'discount rate', 'liquidity', 'transfer']
const source = expressions.map(expression => pack.words.find(word => word.expression === expression && word.id.startsWith('v1-'))!)

it('retains the six distinct source senses and keeps their Chinese grading separate', () => {
  const kept = published.filter(word => source.some(original => original.id === word.id))
  expect(kept).toHaveLength(6)
  const transfer = kept.find(word => word.expression === 'transfer')!
  expect(transfer.zhGloss).toBe('换乘')
  expect(gradeAttempt({ item: hydrateWord(transfer, []), trackType: 'receptive', answer: '转账' }).correct).toBe(false)
  expect(gradeAttempt({ item: hydrateWord(transfer, []), trackType: 'receptive', answer: '换乘' }).correct).toBe(true)
  const discount = kept.find(word => word.expression === 'discount rate')!
  expect(discount.zhGloss).toBe('央行贴现率')
  expect(discount.acceptedZhAnswers).not.toContain('折现率')
  expect(kept.find(word => word.expression === 'deposit')!.acceptedZhAnswers).not.toContain('押金')
  expect(kept.find(word => word.expression === 'attendance')!.acceptedZhAnswers).not.toContain('出勤率')
})

it('adds distinct senses once without deleting imported duplicates or changing earlier reviews and edits', async () => {
  try {
    const retained = published.filter(word => source.some(original => original.id === word.id))
    expect(retained).toHaveLength(6)
    const canonical = handcraftedSeedWords.filter(word => expressions.includes(word.expression))
    const imported = pack.words.find(word => word.expression === 'asset' && word.id.startsWith('v1-'))!
    const local = { ...imported, enDefinition: 'Personal imported asset explanation', contentEdited: true, status: 'paused' as const }
    await initializeDatabase([...canonical, local], [], undefined, { ...DEFAULT_SETTINGS, seedContentRevision: '5.3.1' })
    const before = await getUserDataSnapshot()
    const reviewed = before.tracks.map(track => ({ ...track, reps: 7, stability: 14 }))
    const transfer = canonical.find(word => word.expression === 'transfer')!
    const edited = { ...transfer, zhGloss: '我的转账释义', contentEdited: true, status: 'paused' as const }
    await writeBatch({ tracks: reviewed, words: [edited] })
    await initializeDatabase([...canonical, ...retained], [])
    const after = await getUserDataSnapshot()
    expect(after.words).toHaveLength(before.words.length + 6)
    expect(after.words.find(word => word.id === local.id)).toEqual(local)
    expect(after.words.find(word => word.id === edited.id)).toEqual(edited)
    expect(after.tracks.filter(track => reviewed.some(previous => previous.id === track.id))).toEqual(reviewed)
    await initializeDatabase([...canonical, ...retained], [])
    expect((await getUserDataSnapshot()).words).toEqual(after.words)
    expect((await getUserDataSnapshot()).tracks).toEqual(after.tracks)
  } finally {
    await clearDatabase()
    await closeDatabase()
  }
})
