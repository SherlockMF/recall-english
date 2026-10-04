import { describe, expect, it } from 'vitest'
import type { LearningTrack, ReviewAttempt, VocabularyItem } from '../domain/types'
import { getItemStage, groupTracksByItemId, greetingFor } from './presentation'

function atHour(hour: number) {
  return new Date(2026, 7, 13, hour, 0, 0)
}

describe('greetingFor', () => {
  it('uses morning before 11', () => {
    expect(greetingFor(atHour(7))).toBe('早上好')
    expect(greetingFor(atHour(10))).toBe('早上好')
  })

  it('uses noon from 11 through 13', () => {
    expect(greetingFor(atHour(11))).toBe('中午好')
    expect(greetingFor(atHour(12))).toBe('中午好')
    expect(greetingFor(atHour(13))).toBe('中午好')
  })

  it('uses afternoon from 14 through 17', () => {
    expect(greetingFor(atHour(14))).toBe('下午好')
    expect(greetingFor(atHour(17))).toBe('下午好')
  })

  it('uses evening from 18 onward', () => {
    expect(greetingFor(atHour(18))).toBe('晚上好')
    expect(greetingFor(atHour(22))).toBe('晚上好')
  })
})

describe('getItemStage', () => {
  const item = {
    id: 'word-1',
    expression: 'equity',
    lemma: 'equity',
    senseKey: 'ownership',
    zhGloss: '权益',
    enDefinition: 'ownership interest',
    partOfSpeech: 'noun',
    acceptedZhAnswers: ['权益'],
    acceptedEnVariants: ['equity'],
    examples: [],
    collocations: [],
    listSlugs: ['finance'],
    category: 'finance',
    source: 'seed',
    priority: 1,
    status: 'active',
    usagePrompts: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } satisfies VocabularyItem


  function track(
    type: 'receptive' | 'productive' | 'usage',
    overrides: Partial<LearningTrack> = {},
  ): LearningTrack {
    return {
      id: `${item.id}:${type}`,
      itemId: item.id,
      type,
      due: '2026-08-13T00:00:00.000Z',
      stability: 5,
      difficulty: 5,
      elapsedDays: 7,
      scheduledDays: 7,
      reps: 3,
      lapses: 0,
      state: 2,
      unlocked: true,
      firstGoodAt: '2026-08-01T00:00:00.000Z',
      lastGoodAt: '2026-08-10T00:00:00.000Z',
      lastReview: '2026-08-10T00:00:00.000Z',
      ...overrides,
    }
  }

  it('demotes solid/usable when the latest review is after the last good', () => {
    const tracks = [
      track('receptive'),
      track('productive'),
      track('usage', {
        lastReview: '2026-08-12T00:00:00.000Z',
        lastGoodAt: '2026-08-10T00:00:00.000Z',
      }),
    ]
    expect(getItemStage(item, tracks).key).toBe('learning')
  })

  it('resolves stage from a pre-grouped item track list without scanning siblings', () => {
    const other: LearningTrack = {
      ...track('receptive'),
      id: 'other:receptive',
      itemId: 'other-word',
    }
    const itemTracks = [track('receptive', { reps: 0, state: 0 }), track('productive', { reps: 0, state: 0 })]
    const byItem = groupTracksByItemId([...itemTracks, other])
    expect(byItem.get(item.id)).toEqual(itemTracks)
    expect(getItemStage(item, byItem.get(item.id) ?? []).key).toBe('new')
  })

  it('uses the shared answer evidence and labels basic recall without requiring usage', () => {
    const attempts: ReviewAttempt[] = (['receptive', 'productive'] as const).map((type) => ({
      id: type, itemId: item.id, trackId: `${item.id}:${type}`, trackType: type, promptType: type,
      answer: 'equity', rating: 'hard', hintLevel: 0, responseMs: 60000,
      reviewedAt: '2026-09-01T00:00:00.000Z', evidenceVersion: 1, retryCount: 0,
      evaluationSource: 'rules', correctness: 'correct', matchKind: 'exact',
    }))
    expect(getItemStage(item, [], attempts, new Date('2026-09-02T00:00:00.000Z')))
      .toEqual({ key: 'usable', label: '双向可回忆' })
  })
})
