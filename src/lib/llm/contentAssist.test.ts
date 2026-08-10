import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VocabularyItem } from '../../domain/types'
import { clearDeepseekApiKey, setDeepseekApiKey } from './config'
import { enrichWithLlm } from './enrich'
import { hintWithLlm } from './hints'
import { generateUsagePromptsWithLlm } from './usageGenerate'

function baseItem(): VocabularyItem {
  return {
    id: 'w1',
    expression: 'invoice',
    lemma: 'invoice',
    senseKey: 'invoice',
    zhGloss: '发票',
    enDefinition: 'a bill for goods or services',
    partOfSpeech: 'noun',
    acceptedZhAnswers: [],
    acceptedEnVariants: [],
    examples: [],
    collocations: [],
    source: 'custom',
    priority: 1,
    status: 'active',
    usagePrompts: [],
    listSlugs: ['accounting'],
    category: 'accounting',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('llm content helpers', () => {
  afterEach(() => {
    clearDeepseekApiKey()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('parses hint text from llm json', async () => {
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"hint":"先想会计单据这个词"}' } }],
      }),
    }))
    await expect(hintWithLlm({
      item: baseItem(),
      trackType: 'productive',
      hintLevel: 1,
    })).resolves.toBe('先想会计单据这个词')
  })

  it('parses enrichment draft', async () => {
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              zhGloss: '发票',
              enDefinition: 'a document requesting payment',
              partOfSpeech: 'noun',
              exampleEn: 'Please send the invoice today.',
              exampleZh: '请今天把发票发过来。',
              collocations: ['issue an invoice', 'overdue invoice'],
              acceptedZhAnswers: ['账单'],
              acceptedEnVariants: ['tax invoice'],
            }),
          },
        }],
      }),
    }))
    const draft = await enrichWithLlm({ expression: 'invoice', category: 'accounting' })
    expect(draft.zhGloss).toBe('发票')
    expect(draft.collocations).toContain('issue an invoice')
  })

  it('parses two usage prompts', async () => {
    setDeepseekApiKey('sk-test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              prompts: [
                {
                  type: 'cloze',
                  prompt: 'Please email the _____ before Friday.',
                  answer: 'invoice',
                  modelAnswer: 'Please email the invoice before Friday.',
                  checkpoints: ['invoice'],
                },
                {
                  type: 'sentence',
                  prompt: '提醒供应商补发发票。',
                  modelAnswer: 'Could you resend the invoice?',
                  checkpoints: ['invoice'],
                },
              ],
            }),
          },
        }],
      }),
    }))
    const prompts = await generateUsagePromptsWithLlm(baseItem())
    expect(prompts).toHaveLength(2)
    expect(prompts[0]?.type).toBe('cloze')
    expect(prompts[1]?.type).toBe('sentence')
    expect(prompts[0]?.id).toBeTruthy()
  })
})
