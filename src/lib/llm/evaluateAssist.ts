import type { HintLevel, ReviewRating, TrackType, VocabularyItem } from '../../domain/types'
import { gradeAttempt, type GradeMatchKind } from '../grading'
import { hasDeepseekApiKey } from './config'
import { DEEPSEEK_GRADE_TIMEOUT_MS } from './constants'
import { gradeWithLlm } from './gradeAssist'

export interface AssistEvaluationResult {
  rating: ReviewRating
  matched: boolean
  message?: string
  feedbackZh?: string
  source: 'rules' | 'llm' | 'reveal'
  correctness: 'correct' | 'incorrect' | 'unverified'
  matchKind: GradeMatchKind
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
  verifySentence?: boolean
}

export async function evaluateAssist(
  input: EvaluateAssistInput,
): Promise<AssistEvaluationResult> {
  if (input.revealed) {
    return { rating: 'again', matched: false, source: 'reveal', correctness: 'incorrect', matchKind: 'incorrect' }
  }

  const rule = gradeAttempt({
    item: input.item,
    trackType: input.trackType,
    answer: input.answer,
    hintLevel: input.hintLevel,
    responseMs: input.responseMs,
    promptIndex: input.promptIndex,
  })

  const isSentence = input.trackType === 'usage'
    && input.item.usagePrompts[input.promptIndex ?? 0]?.type === 'sentence'
  const rulesMiss: AssistEvaluationResult = {
    rating: rule.rating,
    matched: rule.correct,
    message: rule.matchKind,
    source: 'rules',
    matchKind: rule.matchKind,
    correctness: isSentence ? 'unverified' : rule.correct ? 'correct' : input.trackType === 'receptive' ? 'unverified' : 'incorrect',
  }

  if ((isSentence && !input.verifySentence) || (!isSentence && rule.correct) || !hasDeepseekApiKey()) {
    return rulesMiss
  }

  input.onInterim?.({ ...rulesMiss, correctness: 'unverified' })

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
      correctness: llm.correct ? 'correct' : 'incorrect',
      matchKind: llm.correct ? 'variant' : 'incorrect',
    }
  } catch (error) {
    if (!(error instanceof Error && error.message === 'grade-timeout')) {
      console.warn('LLM 判分失败，保留规则判分结果（correctness=unverified）。', error)
    }
    return { ...rulesMiss, correctness: 'unverified' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
