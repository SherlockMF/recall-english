import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { clearDatabase, closeDatabase, getUserDataSnapshot, initializeDatabase, recordReview } from '../db'
import { saveVoiceExpression } from './review'
import { buildDailyPlan } from '../scheduler'
import { exportBackupJson, parseBackupV3 } from '../backup'

afterEach(async () => { await clearDatabase(); await closeDatabase() })

it('saves selected speech to priority study without mastery and keeps progress on repeat', async () => {
  await initializeDatabase([], [])
  const input = { expression: 'I went home.', meaning: '我回家了。', original: 'I go home yesterday.', note: '使用过去时' }
  await saveVoiceExpression(input)
  const first = await getUserDataSnapshot()
  expect(first.vocabulary).toHaveLength(1)
  expect(first.vocabulary[0].listSlugs).toContain('my-vocabulary')
  expect(first.attempts).toHaveLength(0)
  expect(first.tracks.every(track => track.reps === 0)).toBe(true)
  const restored = parseBackupV3(await exportBackupJson())
  expect(restored.version).toBe(3)
  expect('memberships' in restored && restored.memberships[0].subcategory).toContain('使用过去时')
  const plan = buildDailyPlan({ settings: first.settings, items: first.vocabulary, tracks: first.tracks, attempts: [], timeEntries: [], now: new Date() })
  expect(plan.tasks.some(task => task.itemId === first.words[0].id)).toBe(true)
  await recordReview({ trackId: first.tracks[0].id, rating: 'good', desiredRetention: 0.9, attempt: { id: 'test-review', itemId: first.words[0].id, trackType: first.tracks[0].type, promptType: 'test', answer: 'test', hintLevel: 0, responseMs: 1000 } })
  const studied = await getUserDataSnapshot()
  await saveVoiceExpression(input)
  const again = await getUserDataSnapshot()
  expect(again.words).toHaveLength(1)
  expect(again.tracks).toEqual(studied.tracks)
  expect(again.attempts).toEqual(studied.attempts)
})

it('requires an actual meaning before writing any data', async () => {
  await expect(saveVoiceExpression({ expression: 'I went home.', meaning: '' })).rejects.toThrow('中文意思')
})
