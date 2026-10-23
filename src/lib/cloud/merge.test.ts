import { expect, it } from 'vitest'
import { mergeCloudRecord } from './merge'
import { createInitialTracks, scheduleReview } from '../scheduler'
import type { ReviewAttempt } from '../../domain/types'
import type { CloudData, QueueEntry } from './types'

const entry = (data: CloudData | null, base: CloudData | null, collection: QueueEntry['collection'] = 'settings'): QueueEntry => ({ id: `${collection}:primary`, key: 'primary', collection, data, base, nonce: 'first' })

it('merges independent field edits and exposes overlapping edits without losing either side', () => {
  const base = { id: 'primary', dailyMinutes: 15, newItemsPerDay: 5 }
  expect(mergeCloudRecord(entry({ ...base, dailyMinutes: 20 }, base), { ...base, newItemsPerDay: 7 }).data).toEqual({ ...base, dailyMinutes: 20, newItemsPerDay: 7 })
  const conflict = mergeCloudRecord(entry({ ...base, newItemsPerDay: 8 }, base), { ...base, newItemsPerDay: 7 })
  expect(conflict.conflict).toBe(true)
  expect(conflict.data).toMatchObject({ newItemsPerDay: 8 })
})

it('distinguishes a missing cloud record from a deletion and does not resurrect a remote deletion', () => {
  const base = { id: 'primary', value: 1 }
  expect(mergeCloudRecord(entry({ ...base, value: 2 }, base), undefined).conflict).toBe(false)
  expect(mergeCloudRecord(entry({ ...base, value: 2 }, base), null).conflict).toBe(true)
  expect(mergeCloudRecord(entry(null, base), base).data).toBeNull()
})

it('counts cumulative study checkpoints once and never reduces recorded time', () => {
  const base = { id: 'session:date', activeMs: 100, updatedAt: '2026-10-23T00:00:00Z' }
  expect(mergeCloudRecord(entry({ ...base, activeMs: 300 }, base, 'timeEntries'), { ...base, activeMs: 200 }).data?.activeMs).toBe(300)
})

it('replays both concurrent reviews from their shared FSRS baseline in a stable order', () => {
  const before = createInitialTracks([{ id: 'word', usagePrompts: [] }], '2026-10-22T00:00:00Z')[0]
  const attempt = (id: string, date: string): ReviewAttempt => ({ id, trackId: before.id, itemId: 'word', trackType: 'receptive', promptType: 'meaning', answer: 'a', hintLevel: 0, responseMs: 1, rating: 'good', reviewedAt: date, desiredRetention: 0.9, trackBefore: before })
  const first = attempt('first', '2026-10-23T01:00:00Z')
  const second = attempt('second', '2026-10-23T02:00:00Z')
  const local = scheduleReview(before, 'good', first.reviewedAt)
  const remote = scheduleReview(before, 'good', second.reviewedAt)
  const result = mergeCloudRecord(entry(local as unknown as CloudData, before as unknown as CloudData, 'tracks'), remote as unknown as CloudData, [second, first])
  expect(result.conflict).toBe(false)
  expect(result.data).toEqual(scheduleReview(local, 'good', second.reviewedAt))
  expect(result.data?.reps).toBe(2)
})

it('does not guess scheduling state when imported legacy reviews lack a replay baseline', () => {
  const before = createInitialTracks([{ id: 'word', usagePrompts: [] }], '2026-10-22T00:00:00Z')[0]
  const local = scheduleReview(before, 'good', '2026-10-23T01:00:00Z')
  const remote = scheduleReview(before, 'again', '2026-10-23T02:00:00Z')
  expect(mergeCloudRecord(entry(local as unknown as CloudData, before as unknown as CloudData, 'tracks'), remote as unknown as CloudData).conflict).toBe(true)
})

it('retains an older offline branch even when the current local baseline has more repetitions', () => {
  const initial = createInitialTracks([{ id: 'word', usagePrompts: [] }], '2026-10-01T00:00:00Z')[0]
  const events: ReviewAttempt[] = []
  const next = (before: typeof initial, id: string, day: number) => {
    const reviewedAt = `2026-10-${String(day).padStart(2, '0')}T00:00:00Z`
    events.push({ id, itemId: 'word', trackId: initial.id, trackType: 'receptive', promptType: 'meaning', answer: 'a', hintLevel: 0, responseMs: 1, rating: 'good', reviewedAt, trackBefore: before, desiredRetention: 0.9 })
    return scheduleReview(before, 'good', reviewedAt)
  }
  const baseline = next(next(initial, 'a1', 2), 'a2', 3)
  next(next(next(initial, 'b1', 4), 'b2', 5), 'b3', 6)
  const remote = events.reduce((track, event) => scheduleReview(track, 'good', event.reviewedAt), initial)
  const local = next(next(next(baseline, 'a3', 7), 'a4', 8), 'a5', 9)
  const expected = events.reduce((track, event) => scheduleReview(track, 'good', event.reviewedAt), initial)
  const result = mergeCloudRecord(entry(local as unknown as CloudData, baseline as unknown as CloudData, 'tracks'), remote as unknown as CloudData, events)
  expect(result.conflict).toBe(false)
  expect(result.data).toEqual(expected)
  expect(result.data?.reps).toBe(8)
})

it('does not overwrite immutable review evidence that happens to have the same id', () => {
  expect(mergeCloudRecord(entry({ id: 'attempt', answer: 'local' }, null, 'attempts'), { id: 'attempt', answer: 'remote' }).conflict).toBe(true)
})
