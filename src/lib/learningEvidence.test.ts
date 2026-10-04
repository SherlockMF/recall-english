import { describe, expect, it } from 'vitest'
import type { ReviewAttempt, TrackType, VocabularyItem } from '../domain/types'
import { createInitialTracks } from './scheduler'
import { deriveLearningEvidence } from './learningEvidence'

const NOW = new Date('2026-09-10T12:00:00.000Z')
const item: VocabularyItem = {
  id: 'equity', expression: 'equity', lemma: 'equity', senseKey: 'ownership',
  zhGloss: '权益', enDefinition: 'ownership interest', partOfSpeech: 'noun',
  acceptedZhAnswers: ['权益'], acceptedEnVariants: [], examples: [], collocations: [],
  listSlugs: ['finance'], category: 'finance', source: 'seed', priority: 1, status: 'active',
  usagePrompts: [], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
}
function attempt(type: TrackType, date: string, overrides: Partial<ReviewAttempt> = {}): ReviewAttempt {
  return {
    id: `${type}:${date}`, itemId: item.id, trackId: `${item.id}:${type}`, trackType: type,
    promptType: type, answer: 'equity', rating: 'good', hintLevel: 0, responseMs: 3000,
    reviewedAt: date, evidenceVersion: 1, sessionId: 'session', retryCount: 0,
    evaluationSource: 'rules', correctness: 'correct', matchKind: 'exact', suggestedRating: 'good',
    ...overrides,
  }
}
const both = (date: string) => (['receptive', 'productive'] as const).map((type) => attempt(type, date))

describe('deriveLearningEvidence', () => {
  it('keeps scheduling timestamps as legacy evidence rather than proof of mastery', () => {
    const tracks = createInitialTracks([item], NOW).map((track) => ({ ...track, reps: 3,
      firstGoodAt: '2026-08-01T00:00:00.000Z', lastGoodAt: '2026-09-01T00:00:00.000Z' }))
    const result = deriveLearningEvidence(item, tracks, [], NOW)
    expect(result).toMatchObject({ key: 'learning', legacyEvidence: true })
    expect(result.directions.productive.successAt).toBeUndefined()
  })

  it('grants basic recall without usage prompts and accepts correct slow hard answers', () => {
    const result = deriveLearningEvidence(item, createInitialTracks([item], NOW), both('2026-09-01T00:00:00.000Z')
      .map((value) => ({ ...value, rating: 'hard' as const })), NOW)
    expect(result).toMatchObject({ key: 'recall', label: '双向可回忆', application: { clozePassed: false, sentencePassed: false } })
  })

  it.each([
    { hintLevel: 1 as const }, { wasOverride: true }, { retryCount: 1 },
    { correctness: 'unverified' as const }, { evidenceVersion: undefined }, { matchKind: 'minor-typo' as const },
  ])('does not promote prompted, overwritten, repeated, uncertain, historical or typo evidence: %j', (overrides) => {
    const attempts = both('2026-09-01T00:00:00.000Z').map((value) => ({ ...value, ...overrides }))
    expect(deriveLearningEvidence(item, [], attempts, NOW).key).toBe('learning')
  })

  it('requires seven days since the immediately preceding practice, not the first success', () => {
    const attempts = [...both('2026-09-01T00:00:00.000Z'), ...both('2026-09-08T00:00:00.000Z')]
    expect(deriveLearningEvidence(item, [], attempts, NOW).key).toBe('retained')
    const withIntervention = [...attempts, attempt('productive', '2026-09-07T00:00:00.000Z', { wasOverride: true })]
    const result = deriveLearningEvidence(item, [], withIntervention, NOW)
    expect(result.key).toBe('recall')
    expect(result.directions.productive.retained).toBe(false)
  })

  it('restarts both success requirements after a clear failure and leaves expiry and pause separate', () => {
    const attempts = [...both('2026-08-01T00:00:00.000Z'), ...both('2026-08-08T00:00:00.000Z')]
    const tracks = createInitialTracks([item], '2026-08-09T00:00:00.000Z')
    expect(deriveLearningEvidence({ ...item, status: 'paused' }, tracks, attempts, NOW).key).toBe('retained')
    attempts.push(attempt('productive', '2026-08-10T00:00:00.000Z', { correctness: 'incorrect', evaluationSource: 'reveal', hintLevel: 3 }))
    expect(deriveLearningEvidence(item, tracks, attempts, NOW).directions.productive.label).toBe('最近未通过')
    attempts.push(attempt('productive', '2026-08-18T00:00:00.000Z'))
    expect(deriveLearningEvidence(item, tracks, attempts, NOW).key).toBe('recall')
  })

  it('uncertain answers and future records never become explicit failures or new evidence', () => {
    const attempts = [...both('2026-09-01T00:00:00.000Z'), attempt('receptive', '2026-09-02T00:00:00.000Z', {
      correctness: 'unverified', rating: 'again', matchKind: 'incorrect',
    }), attempt('productive', '2026-09-20T00:00:00.000Z', { correctness: 'incorrect' })]
    expect(deriveLearningEvidence(item, [], attempts, NOW).key).toBe('recall')
  })

  it('separates cloze checks from AI assisted sentence verification and records actual prompt evidence', () => {
    const attempts = [attempt('usage', '2026-09-01T00:00:00.000Z', { promptType: 'cloze', promptId: 'cloze-a' }),
      attempt('usage', '2026-09-02T00:00:00.000Z', { promptType: 'sentence', matchKind: 'checkpoint', promptId: 'sentence-a' })]
    expect(deriveLearningEvidence(item, [], attempts, NOW).application).toMatchObject({ clozePassed: true, sentencePassed: false })
    attempts.push(attempt('usage', '2026-09-03T00:00:00.000Z', { promptType: 'sentence', evaluationSource: 'llm', promptId: 'sentence-a' }))
    expect(deriveLearningEvidence(item, [], attempts, NOW).application).toMatchObject({ clozePassed: true, sentencePassed: true })
    attempts.push(attempt('usage', '2026-09-04T00:00:00.000Z', { promptType: 'sentence', evaluationSource: 'llm', correctness: 'incorrect' }))
    expect(deriveLearningEvidence(item, [], attempts, NOW).application).toMatchObject({ clozePassed: true, sentencePassed: false })
  })
})
