import type { HintLevel, TrackType, VocabularyItem } from '../../domain/types'
import { chatJson } from './client'

export interface HintAssistInput {
  item: VocabularyItem
  trackType: TrackType
  hintLevel: HintLevel
  promptIndex?: number
}

export async function hintWithLlm(input: HintAssistInput): Promise<string> {
  const usage = input.item.usagePrompts[input.promptIndex ?? 0]
  const payload = await chatJson({
    retries: 1,
    messages: [
      {
        role: 'system',
        content: [
          'You write progressive recall hints for English learners.',
          'Return ONLY JSON: {"hint":string}',
          'hintLevel 1: gentle cue (POS, scenario, first-letter style). Do NOT reveal the full answer.',
          'hintLevel 2: stronger cue still avoiding exact full answer when possible.',
          'Write the hint in concise Chinese, may include short English fragments.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          trackType: input.trackType,
          hintLevel: input.hintLevel,
          expression: input.item.expression,
          zhGloss: input.item.zhGloss,
          enDefinition: input.item.enDefinition,
          partOfSpeech: input.item.partOfSpeech,
          usagePrompt: usage ?? null,
        }),
      },
    ],
  })

  if (!payload || typeof payload !== 'object') throw new Error('invalid hint payload')
  const hint = (payload as { hint?: unknown }).hint
  if (typeof hint !== 'string' || !hint.trim()) throw new Error('empty hint')
  return hint.trim()
}
