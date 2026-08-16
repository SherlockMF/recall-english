import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VocabularyItem } from '../../domain/types'
import { clearDeepseekApiKey, setDeepseekApiKey } from './config'
import { evaluateAssist, type AssistEvaluationResult } from './evaluateAssist'

function item(overrides: Partial<VocabularyItem> = {}): VocabularyItem {
  return {
    id: 'w1',
    expression: 'cash flow',
    lemma: 'cash flow',
    senseKey: 'cash-flow',
    zhGloss: '现金流',
    enDefinition: 'money moving in and out of a business',
    partOfSpeech: 'noun',
    acceptedZhAnswers: ['现金流量'],
    acceptedEnVariants: ['cashflow'],
    examples: [{ en: 'Watch your cash flow.', zh: '留意你的现金流。' }],
    collocations: ['positive cash flow'],
    source: 'seed',
    priority: 1,
    status: 'active',
    usagePrompts: [{
      id: 'u1',
      type: 'sentence',
      prompt: '向导师解释本月现金流压力。',
      modelAnswer: 'Our cash flow is tight this month.',
      checkpoints: ['cash flow'],
    }],
    listSlugs: ['finance'],
    category: 'finance',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('evaluateAssist', () => {
  afterEach(() => {
    clearDeepseekApiKey()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('uses rules and skips fetch when the answer already matches', async () => {
    setDeepseekApiKey('sk-test')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await evaluateAssist({
      item: item(),
      trackType: 'productive',
      answer: 'cash flow',
      hintLevel: 0,
      responseMs: 1_000,
      revealed: false,
    })

    expect(result.matched).toBe(true)
    expect(result.rating).toBe('good')
    expect(result.source).toBe('rules')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('calls llm when rules miss and maps feedback', async () => {
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              correct: true,
              rating: 'hard',
              feedbackZh: '意思对，但搭配略生硬。',
            }),
          },
        }],
      }),
    }))

    const result = await evaluateAssist({
      item: item(),
      trackType: 'usage',
      answer: 'Cashflow looks tight for our campus cafe this month.',
      hintLevel: 0,
      responseMs: 8_000,
      revealed: false,
      promptIndex: 0,
    })

    expect(result.source).toBe('llm')
    expect(result.matched).toBe(true)
    expect(result.rating).toBe('hard')
    expect(result.feedbackZh).toContain('意思对')
  })

  it('keeps again when llm fails after a rule miss', async () => {
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const result = await evaluateAssist({
      item: item(),
      trackType: 'productive',
      answer: 'money stream',
      hintLevel: 0,
      responseMs: 2_000,
      revealed: false,
    })

    expect(result.source).toBe('rules')
    expect(result.matched).toBe(false)
    expect(result.rating).toBe('again')
  })

  it('returns reveal again without calling llm', async () => {
    setDeepseekApiKey('sk-test')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await evaluateAssist({
      item: item(),
      trackType: 'receptive',
      answer: '',
      hintLevel: 3,
      responseMs: 1_000,
      revealed: true,
    })

    expect(result).toMatchObject({ rating: 'again', matched: false, source: 'reveal' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('emits a rules interim result before a slow llm finishes', async () => {
    setDeepseekApiKey('sk-test')
    let resolveFetch!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveFetch = resolve
    })))
    const interim: AssistEvaluationResult[] = []

    const pending = evaluateAssist({
      item: item(),
      trackType: 'productive',
      answer: 'money stream',
      hintLevel: 0,
      responseMs: 2_000,
      revealed: false,
      onInterim: (result) => { interim.push(result) },
    })

    await vi.waitFor(() => {
      expect(interim).toEqual([
        expect.objectContaining({ source: 'rules', matched: false, rating: 'again' }),
      ])
    })

    resolveFetch({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              correct: true,
              rating: 'hard',
              feedbackZh: '接近了。',
            }),
          },
        }],
      }),
    })

    const result = await pending
    expect(result).toMatchObject({ source: 'llm', matched: true, rating: 'hard' })
  })

  it('falls back to rules when llm exceeds the assist timeout', async () => {
    vi.useFakeTimers()
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Promise(() => undefined)))

    const pending = evaluateAssist({
      item: item(),
      trackType: 'productive',
      answer: 'money stream',
      hintLevel: 0,
      responseMs: 2_000,
      revealed: false,
      llmTimeoutMs: 50,
    })

    await vi.advanceTimersByTimeAsync(50)
    const result = await pending
    expect(result).toMatchObject({ source: 'rules', matched: false, rating: 'again' })
    vi.useRealTimers()
  })
})
