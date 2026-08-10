import type { SystemListSlug } from '../../domain/types'
import { chatJson } from './client'

export interface EnrichmentDraft {
  zhGloss: string
  enDefinition: string
  partOfSpeech: string
  exampleEn: string
  exampleZh: string
  collocations: string[]
  acceptedZhAnswers: string[]
  acceptedEnVariants: string[]
}

export interface EnrichAssistInput {
  expression: string
  category: SystemListSlug
  existingDefinition?: string
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
}

export async function enrichWithLlm(input: EnrichAssistInput): Promise<EnrichmentDraft> {
  const payload = await chatJson({
    messages: [
      {
        role: 'system',
        content: [
          'You enrich English vocabulary for Malaysian university life, business, finance, and accounting.',
          'Return ONLY JSON with keys:',
          'zhGloss, enDefinition, partOfSpeech, exampleEn, exampleZh, collocations, acceptedZhAnswers, acceptedEnVariants.',
          'Keep one clear Chinese sense. Examples should be realistic and short.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          expression: input.expression,
          category: input.category,
          existingDefinition: input.existingDefinition ?? '',
        }),
      },
    ],
  })

  if (!payload || typeof payload !== 'object') throw new Error('invalid enrich payload')
  const record = payload as Record<string, unknown>
  const zhGloss = typeof record.zhGloss === 'string' ? record.zhGloss.trim() : ''
  if (!zhGloss) throw new Error('enrichment missing zhGloss')

  return {
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
  }
}
