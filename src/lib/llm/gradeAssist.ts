import type { ReviewRating, TrackType, VocabularyItem } from '../../domain/types'
import { chatJson } from './client'

export interface GradeAssistInput {
  item: VocabularyItem
  trackType: TrackType
  answer: string
  hintLevel: number
  promptIndex?: number
  signal?: AbortSignal
}

export interface GradeAssistResult {
  correct: boolean
  rating: ReviewRating
  feedbackZh: string
}

function clampRating(rating: unknown, correct: boolean): ReviewRating {
  if (!correct) return 'again'
  if (rating === 'good' || rating === 'hard' || rating === 'again') return rating
  return correct ? 'hard' : 'again'
}

export async function gradeWithLlm(input: GradeAssistInput): Promise<GradeAssistResult> {
  const usage = input.item.usagePrompts[input.promptIndex ?? 0]
  const payload = await chatJson({
    signal: input.signal,
    timeoutMs: input.signal ? 60_000 : undefined,
    messages: [
      {
        role: 'system',
        content: [
          'You grade active English recall for Malaysian university / business / finance learners.',
          'Return ONLY JSON: {"correct":boolean,"rating":"again"|"hard"|"good","feedbackZh":string}',
          'correct=true only if meaning and required expression use are acceptable.',
          'rating: again=wrong/unusable, hard=acceptable but weak/awkward, good=natural.',
          'feedbackZh: one short Chinese sentence; if wrong, say what to fix; if right, optional polish tip.',
          'Do not reveal a full model answer unless correct=false and a short cue helps.',
        ].join(' '),
      },
      {
        role: 'user',
        content: JSON.stringify({
          trackType: input.trackType,
          expression: input.item.expression,
          zhGloss: input.item.zhGloss,
          enDefinition: input.item.enDefinition,
          acceptedEnVariants: input.item.acceptedEnVariants,
          acceptedZhAnswers: input.item.acceptedZhAnswers,
          collocations: input.item.collocations,
          usagePrompt: usage ?? null,
          learnerAnswer: input.answer,
          hintLevel: input.hintLevel,
        }),
      },
    ],
  })

  if (!payload || typeof payload !== 'object') {
    throw new Error('invalid grade payload')
  }
  const record = payload as Record<string, unknown>
  const correct = Boolean(record.correct)
  let rating = clampRating(record.rating, correct)
  if (correct && input.hintLevel >= 2) rating = 'again'
  else if (correct && input.hintLevel === 1 && rating === 'good') rating = 'hard'
  const feedbackZh = typeof record.feedbackZh === 'string' && record.feedbackZh.trim()
    ? record.feedbackZh.trim()
    : correct
      ? '语义可接受。'
      : '还不够准确，再试一次。'

  return { correct, rating, feedbackZh }
}
