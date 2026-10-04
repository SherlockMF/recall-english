import { describe, expect, it } from 'vitest'
import type { ReviewAttempt, StudyTimeEntry, VocabularyItem } from '../domain/types'
import { deriveLearningStats, localDateKey } from './learningStats'

const NOW = new Date(2026, 8, 10, 12)
const DAY = 86_400_000
function attempt(id: string, itemId: string, at: number, overrides: Partial<ReviewAttempt> = {}): ReviewAttempt {
  return { id, itemId, trackId: `${itemId}:productive`, trackType: 'productive', promptType: 'productive',
    answer: itemId, rating: 'good', hintLevel: 0, responseMs: 3000, reviewedAt: new Date(at).toISOString(),
    evidenceVersion: 1, sessionId: 'session', retryCount: 0, evaluationSource: 'rules',
    correctness: 'correct', matchKind: 'exact', suggestedRating: 'good', ...overrides }
}
const run = (attempts: ReviewAttempt[], timeEntries: StudyTimeEntry[] = [], items: VocabularyItem[] = []) =>
  deriveLearningStats({ items, tracks: [], attempts, timeEntries, now: NOW })

describe('deriveLearningStats', () => {
  it('counts first introduction globally, distinct items and tasks, and every saved attempt including retries', () => {
    const at = NOW.getTime()
    const attempts = [attempt('a', 'started-earlier', at - DAY), attempt('b', 'started-earlier', at - 1000),
      attempt('c', 'paused', at - 1000), attempt('d', 'paused', at, { retryCount: 1 }),
      attempt('e', 'paused', at, { trackId: 'paused:receptive', trackType: 'receptive' }),
      attempt('future', 'future', at + DAY)]
    expect(run(attempts)).toMatchObject({ introducedToday: 1, practicedItems: 2, taskCount: 3, attemptCount: 4 })
  })

  it('uses only recent delayed unaided first recall samples and all preceding practice for the gap', () => {
    const at = NOW.getTime()
    const attempts = [
      attempt('a0', 'a', at - 2 * DAY), attempt('a1', 'a', at, { rating: 'hard' }),
      attempt('b0', 'b', at - 2 * DAY), attempt('b1', 'b', at, { correctness: 'incorrect' }),
      attempt('c0', 'c', at - 2 * DAY), attempt('c1', 'c', at - 1000, { wasOverride: true }), attempt('c2', 'c', at),
      attempt('d0', 'd', at - 2 * DAY), attempt('d1', 'd', at, { retryCount: 1 }),
      attempt('e0', 'e', at - 2 * DAY), attempt('e1', 'e', at, { hintLevel: 1 }),
      attempt('f0', 'f', at - 2 * DAY), attempt('f1', 'f', at, { evidenceVersion: undefined }),
      attempt('g0', 'g', at - 2 * DAY), attempt('g1', 'g', at, { correctness: 'unverified' }),
      attempt('h0', 'h', at - 10 * DAY), attempt('h1', 'h', at - 8 * DAY),
      attempt('new', 'new', at),
    ]
    expect(run(attempts).delayedRecall).toEqual({ total: 2, correct: 1, rate: 0.5 })
  })

  it('measures today from time entries, deduplicating cumulative saves instead of summing responseMs', () => {
    const entries: StudyTimeEntry[] = [
      { id: 'session:today', sessionId: 'session', localDate: localDateKey(NOW), activeMs: 480000, updatedAt: NOW.toISOString() },
      { id: 'session:today', sessionId: 'session', localDate: localDateKey(NOW), activeMs: 900000, updatedAt: NOW.toISOString() },
      { id: 'yesterday', sessionId: 'session', localDate: localDateKey(new Date(NOW.getTime() - DAY)), activeMs: 800000, updatedAt: NOW.toISOString() },
    ]
    expect(run([attempt('a', 'a', NOW.getTime(), { responseMs: 999999 })], entries).activeMs).toBe(900000)
    expect(run([]).delayedRecall.rate).toBeNull()
  })

  it('includes an unaided delayed reveal as a failed recall sample', () => {
    const at = NOW.getTime()
    const attempts = [attempt('previous', 'word', at - 2 * DAY), attempt('forgot', 'word', at, {
      evaluationSource: 'reveal', correctness: 'incorrect', rating: 'again', hintLevel: 0,
    })]
    expect(run(attempts).delayedRecall).toEqual({ total: 1, correct: 0, rate: 0 })
  })
})
