import type { HintLevel, ReviewRating, TrackType, VocabularyItem } from '../../domain/types'
import { gradeAttempt } from '../grading'
import { hasDeepseekApiKey } from './config'
import { DEEPSEEK_GRADE_TIMEOUT_MS } from './constants'
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
  /** Fired with the local rules result before a slow LLM call resolves. */
  onInterim?: (result: AssistEvaluationResult) => void
  /** Cap LLM wait for grading; defaults to DEEPSEEK_GRADE_TIMEOUT_MS. */
  llmTimeoutMs?: number
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

  const rulesMiss: AssistEvaluationResult = {
    rating: 'again',
    matched: false,
    message: rule.matchKind,
    source: 'rules',
  }

  if (!hasDeepseekApiKey()) {
    return rulesMiss
  }

  input.onInterim?.(rulesMiss)

  const controller = new AbortController()
  const timeoutMs = input.llmTimeoutMs ?? DEEPSEEK_GRADE_TIMEOUT_MS
  let timer: ReturnType<typeof setTimeout> | undefined

  try {
    const timedOut = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('grade-timeout'))
      }, timeoutMs)
    })
    const llm = await Promise.race([
      gradeWithLlm({
        item: input.item,
        trackType: input.trackType,
        answer: input.answer,
        hintLevel: input.hintLevel,
        promptIndex: input.promptIndex,
        signal: controller.signal,
      }),
      timedOut,
    ])
    return {
      rating: llm.rating,
      matched: llm.correct,
      message: 'llm',
      feedbackZh: llm.feedbackZh,
      source: 'llm',
    }
  } catch {
    return rulesMiss
  } finally {
    if (timer) clearTimeout(timer)
  }
}
