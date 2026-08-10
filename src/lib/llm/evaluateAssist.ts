import type { HintLevel, ReviewRating, TrackType, VocabularyItem } from '../../domain/types'
import { gradeAttempt } from '../grading'
import { hasDeepseekApiKey } from './config'
import { gradeWithLlm } from './gradeAssist'

export interface AssistEvaluationResult {
  rating: ReviewRating
  matched: boolean
  message?: string
  feedbackZh?: string
  source: 'rules' | 'llm' | 'reveal'
}

export interface EvaluateAssistInput {
  item: VocabularyItem
  trackType: TrackType
  answer: string
  hintLevel: HintLevel
  responseMs: number
  revealed: boolean
  promptIndex?: number
}

export async function evaluateAssist(
  input: EvaluateAssistInput,
): Promise<AssistEvaluationResult> {
  if (input.revealed) {
    return { rating: 'again', matched: false, source: 'reveal' }
  }

  const rule = gradeAttempt({
    item: input.item,
    trackType: input.trackType,
    answer: input.answer,
    hintLevel: input.hintLevel,
    responseMs: input.responseMs,
    promptIndex: input.promptIndex,
  })

  if (rule.correct) {
    return {
      rating: rule.rating,
      matched: true,
      message: rule.matchKind,
      source: 'rules',
    }
  }

  if (!hasDeepseekApiKey()) {
    return {
      rating: 'again',
      matched: false,
      message: rule.matchKind,
      source: 'rules',
    }
  }

  try {
    const llm = await gradeWithLlm({
      item: input.item,
      trackType: input.trackType,
      answer: input.answer,
      hintLevel: input.hintLevel,
      promptIndex: input.promptIndex,
    })
    return {
      rating: llm.rating,
      matched: llm.correct,
      message: 'llm',
      feedbackZh: llm.feedbackZh,
      source: 'llm',
    }
  } catch {
    return {
      rating: 'again',
      matched: false,
      message: rule.matchKind,
      source: 'rules',
    }
  }
}
