import type { SystemListSlug } from '../../domain/types'
import { chatJson } from './client'
import { DEEPSEEK_ENRICH_TIMEOUT_MS } from './constants'

export type EnrichCategory = SystemListSlug | 'other'

export interface EnrichmentDraft {
  expression: string
  zhGloss: string
  enDefinition: string
  partOfSpeech: string
  exampleEn: string
  exampleZh: string
  collocations: string[]
  acceptedZhAnswers: string[]
  acceptedEnVariants: string[]
  category: EnrichCategory
  scenarioNote?: string
}

export interface EnrichAssistInput {
  expression: string
  category: EnrichCategory
  existingDefinition?: string
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseCategory(value: unknown, fallback: EnrichCategory): EnrichCategory {
  if (
    value === 'daily'
    || value === 'business'
    || value === 'finance'
    || value === 'accounting'
    || value === 'other'
  ) {
    return value
  }
  return fallback
}

export async function enrichWithLlm(input: EnrichAssistInput): Promise<EnrichmentDraft> {
  const payload = await chatJson({
    timeoutMs: DEEPSEEK_ENRICH_TIMEOUT_MS,
    messages: [
      {
        role: 'system',
        content: [
          'You enrich English vocabulary for Malaysian university life, business, finance, and accounting.',
          'Return ONLY JSON with keys:',
          'expression, zhGloss, enDefinition, partOfSpeech, exampleEn, exampleZh, collocations, acceptedZhAnswers, acceptedEnVariants, category, scenarioNote.',
          'expression: correct the spelling if the input looks misspelled, otherwise keep it.',
          'category: one of daily|business|finance|accounting|other based on the sense (not the current UI selection).',
          'If category is other, set scenarioNote to a short Chinese label for the custom scenario; otherwise omit scenarioNote or use "".',
          'Keep one clear Chinese sense. Examples should be realistic and short.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          expression: input.expression,
          currentCategory: input.category,
          existingDefinition: input.existingDefinition ?? '',
        }),
      },
    ],
  })

  if (!payload || typeof payload !== 'object') throw new Error('invalid enrich payload')
  const record = payload as Record<string, unknown>
  const zhGloss = typeof record.zhGloss === 'string' ? record.zhGloss.trim() : ''
  if (!zhGloss) throw new Error('enrichment missing zhGloss')

  const expression = typeof record.expression === 'string' && record.expression.trim()
    ? record.expression.trim()
    : input.expression.trim()
  const category = parseCategory(record.category, input.category)
  const scenarioNote = typeof record.scenarioNote === 'string' ? record.scenarioNote.trim() : ''

  return {
    expression,
    zhGloss,
    enDefinition: typeof record.enDefinition === 'string' ? record.enDefinition.trim() : '',
    partOfSpeech: typeof record.partOfSpeech === 'string' && record.partOfSpeech.trim()
      ? record.partOfSpeech.trim()
      : 'expression',
    exampleEn: typeof record.exampleEn === 'string' ? record.exampleEn.trim() : '',
    exampleZh: typeof record.exampleZh === 'string' ? record.exampleZh.trim() : '',
    collocations: stringList(record.collocations),
    acceptedZhAnswers: stringList(record.acceptedZhAnswers),
    acceptedEnVariants: stringList(record.acceptedEnVariants),
    category,
    scenarioNote: category === 'other' ? (scenarioNote || undefined) : undefined,
  }
}
