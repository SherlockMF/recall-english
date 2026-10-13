import type { UsagePrompt, VocabularyItem } from '../../domain/types'
import { chatJson } from './client'

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function asPrompt(raw: unknown, expression: string, index: number): UsagePrompt | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const record = raw as Record<string, unknown>
  const type = record.type === 'cloze' || record.type === 'sentence' ? record.type : undefined
  const prompt = typeof record.prompt === 'string' ? record.prompt.trim() : ''
  const modelAnswer = typeof record.modelAnswer === 'string' ? record.modelAnswer.trim() : ''
  if (!type || !prompt || !modelAnswer) return undefined
  const checkpoints = Array.isArray(record.checkpoints)
    ? record.checkpoints.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [expression]
  const answer = typeof record.answer === 'string' && record.answer.trim()
    ? record.answer.trim()
    : type === 'cloze'
      ? expression
      : undefined
  return {
    id: makeId(`usage-ai-${index}`),
    type,
    prompt,
    answer,
    modelAnswer,
    checkpoints: checkpoints.length ? checkpoints : [expression],
  }
}

export async function generateUsagePromptsWithLlm(item: VocabularyItem): Promise<UsagePrompt[]> {
  const payload = await chatJson({
    retries: 1,
    messages: [
      {
        role: 'system',
        content: [
          'Create active-recall usage prompts for one English expression.',
          'Both prompts must test the specified lexical sense only. Do not switch to another meaning of the expression. State the intended sense in the Chinese sentence scenario.',
          'Return ONLY JSON: {"prompts":[...]} with exactly 2 items:',
          '1) type cloze with blank _____ and answer equal to the expression',
          '2) type sentence with a Chinese scenario prompt',
          'Each item needs: type, prompt, modelAnswer, checkpoints (must include the expression).',
          'Contexts: Malaysian campus life, startups, finance, or accounting depending on category.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          expression: item.expression,
          senseKey: item.senseKey,
          zhGloss: item.zhGloss,
          enDefinition: item.enDefinition,
          partOfSpeech: item.partOfSpeech,
          category: item.category,
          collocations: item.collocations,
        }),
      },
    ],
  })

  if (!payload || typeof payload !== 'object') throw new Error('invalid usage payload')
  const promptsRaw = (payload as { prompts?: unknown }).prompts
  if (!Array.isArray(promptsRaw)) throw new Error('usage prompts missing')

  const prompts = promptsRaw
    .map((entry, index) => asPrompt(entry, item.expression, index))
    .filter((entry): entry is UsagePrompt => Boolean(entry))

  if (prompts.length < 2) throw new Error('need two usage prompts')
  return prompts.slice(0, 2)
}

/** Local fallback when LLM is unavailable. */
export function buildFallbackUsagePrompts(expression: string, exampleEn?: string): UsagePrompt[] {
  const sample = exampleEn?.trim() || `I need to use “${expression}” in a real sentence.`
  return [
    {
      id: makeId('usage-fallback-0'),
      type: 'cloze',
      prompt: sample.replace(new RegExp(expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_____'),
      answer: expression,
      modelAnswer: sample.toLowerCase().includes(expression.toLowerCase())
        ? sample
        : `Please use ${expression} carefully.`,
      checkpoints: [expression],
    },
    {
      id: makeId('usage-fallback-1'),
      type: 'sentence',
      prompt: `用 “${expression}” 写一句你真实会说的话。`,
      modelAnswer: sample.toLowerCase().includes(expression.toLowerCase())
        ? sample
        : `I used ${expression} in today's discussion.`,
      checkpoints: [expression],
    },
  ]
}
