import type { LearningTrack, ReviewAttempt, TrackType, VocabularyItem } from '../domain/types'

export type LearningEvidenceKey = 'new' | 'learning' | 'recall' | 'retained'

export interface EvidenceDetail {
  reviewedAt: string
  promptId?: string
  hintLevel: ReviewAttempt['hintLevel']
  evaluationSource: ReviewAttempt['evaluationSource']
  correctness: ReviewAttempt['correctness']
  retryCount: number | undefined
  wasOverride: boolean
  matchKind: ReviewAttempt['matchKind']
}

export interface DirectionEvidence {
  label: string
  successAt?: string
  retained: boolean
  details: EvidenceDetail[]
  missing: string[]
}

export interface LearningEvidence {
  key: LearningEvidenceKey
  label: string
  directions: { receptive: DirectionEvidence; productive: DirectionEvidence }
  application: { clozePassed: boolean; sentencePassed: boolean; label: string; details: EvidenceDetail[] }
  explanations: string[]
  legacyEvidence: boolean
  nextDue?: string
}

const SEVEN_DAYS_MS = 7 * 86_400_000
const stageLabels: Record<LearningEvidenceKey, string> = {
  new: '未开始', learning: '学习中', recall: '双向可回忆', retained: '保持已验证',
}

export function isIndependentEvidence(attempt: ReviewAttempt) {
  return attempt.evidenceVersion === 1 && attempt.hintLevel === 0
    && !attempt.wasOverride && attempt.retryCount === 0
    && (attempt.evaluationSource === 'rules' || attempt.evaluationSource === 'llm')
}

export function isValidRecallSuccess(attempt: ReviewAttempt) {
  return isIndependentEvidence(attempt) && attempt.correctness === 'correct'
    && (attempt.matchKind === 'exact' || attempt.matchKind === 'variant')
}

export function isExplicitFailure(attempt: ReviewAttempt) {
  return attempt.evidenceVersion === 1 && attempt.correctness === 'incorrect'
    && attempt.matchKind !== 'minor-typo'
    && (attempt.evaluationSource === 'rules' || attempt.evaluationSource === 'llm' || attempt.evaluationSource === 'reveal')
}

function detailsFor(attempts: ReviewAttempt[]): EvidenceDetail[] {
  return attempts.map((attempt) => ({
    reviewedAt: attempt.reviewedAt, promptId: attempt.promptId,
    hintLevel: attempt.hintLevel, evaluationSource: attempt.evaluationSource,
    correctness: attempt.correctness, retryCount: attempt.retryCount,
    wasOverride: Boolean(attempt.wasOverride), matchKind: attempt.matchKind,
  }))
}

function directionEvidence(attempts: ReviewAttempt[], type: TrackType): DirectionEvidence {
  const history = attempts.filter((attempt) => attempt.trackType === type)
  let successAt: string | undefined
  let successes = 0
  let retained = false
  let lastFailureAt: string | undefined
  for (let index = 0; index < history.length; index += 1) {
    const attempt = history[index]
    if (isExplicitFailure(attempt)) {
      successes = 0
      successAt = undefined
      retained = false
      lastFailureAt = attempt.reviewedAt
    } else if (isValidRecallSuccess(attempt)) {
      const previous = history[index - 1]
      if (successes > 0 && previous
        && Date.parse(attempt.reviewedAt) - Date.parse(previous.reviewedAt) >= SEVEN_DAYS_MS) {
        retained = true
      }
      successes += 1
      successAt = attempt.reviewedAt
    }
  }
  const latest = history.at(-1)
  let label = '尚未验证'
  if (successAt) label = retained ? '保持已验证' : '无提示成功'
  else if (lastFailureAt) label = '最近未通过'
  else if (latest?.hintLevel) label = '提示依赖'
  else if (latest?.matchKind === 'minor-typo') label = '轻微拼写错误，待验证'
  const missing: string[] = []
  if (!successAt) missing.push('需要一次首轮、无提示且未覆写的正确回忆')
  if (!retained) missing.push('尚缺两次有效成功，以及距此前最近一次同方向练习至少 7 天的成功')
  if (latest?.correctness === 'unverified') missing.push('最近作答尚未验证，不据此判定遗忘')
  if (latest?.hintLevel && successAt) missing.push('最近练习使用了提示，未新增独立回忆证据')
  return { label, successAt, retained, details: detailsFor(history), missing }
}

function applicationEvidence(attempts: ReviewAttempt[]): LearningEvidence['application'] {
  const history = attempts.filter((attempt) => attempt.trackType === 'usage')
  let clozePassed = false
  let sentencePassed = false
  for (const attempt of history) {
    if (attempt.promptType === 'cloze') {
      if (isExplicitFailure(attempt)) clozePassed = false
      else if (isValidRecallSuccess(attempt)) clozePassed = true
    } else if (attempt.promptType === 'sentence') {
      if (isExplicitFailure(attempt)) sentencePassed = false
      else if (isIndependentEvidence(attempt) && attempt.correctness === 'correct'
        && attempt.evaluationSource === 'llm') sentencePassed = true
    }
  }
  const label = [clozePassed ? '填空通过' : '填空尚未验证',
    sentencePassed ? '造句经 AI 辅助验证' : '造句待验证'].join('；')
  return { clozePassed, sentencePassed, label, details: detailsFor(history) }
}

/** Scheduling estimates and self ratings never substitute for saved answer evidence. */
export function deriveLearningEvidence(
  item: VocabularyItem,
  tracks: LearningTrack[],
  attempts: ReviewAttempt[],
  now: Date = new Date(),
): LearningEvidence {
  const nowMs = now.getTime()
  const itemTracks = tracks.filter((track) => track.itemId === item.id)
  const history = [...new Map(attempts.filter((attempt) => attempt.itemId === item.id
    && Number.isFinite(Date.parse(attempt.reviewedAt)) && Date.parse(attempt.reviewedAt) <= nowMs)
    .map((attempt) => [attempt.id, attempt])).values()]
    .sort((left, right) => Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt))
  const receptive = directionEvidence(history, 'receptive')
  const productive = directionEvidence(history, 'productive')
  const started = history.length > 0 || itemTracks.some((track) => track.reps > 0)
  const key: LearningEvidenceKey = receptive.retained && productive.retained ? 'retained'
    : receptive.successAt && productive.successAt ? 'recall' : started ? 'learning' : 'new'
  const application = applicationEvidence(history)
  const legacyEvidence = history.some((attempt) => attempt.evidenceVersion !== 1)
    || (itemTracks.some((track) => track.reps > 0) && history.length === 0)
  const nextDue = itemTracks.filter((track) => track.unlocked && Number.isFinite(Date.parse(track.due)))
    .sort((left, right) => Date.parse(left.due) - Date.parse(right.due))[0]?.due
  const explanations = [
    `理解意思：${receptive.label}${receptive.successAt ? `（${new Date(receptive.successAt).toLocaleDateString('zh-CN')}）` : ''}`,
    ...receptive.missing.map((reason) => `理解意思：${reason}`),
    `主动表达：${productive.label}${productive.successAt ? `（${new Date(productive.successAt).toLocaleDateString('zh-CN')}）` : ''}`,
    ...productive.missing.map((reason) => `主动表达：${reason}`),
    application.label,
    '保持验证采用 7 天间隔规则，不代表永久掌握；应用验证不等同于迁移能力证明。',
  ]
  if (legacyEvidence) explanations.push('旧记录保留排程进度，证据字段有限，无法据此授予已验证状态。')
  if (item.status === 'paused') explanations.push('此表达已暂停，历史能力证据仍保留。')
  if (nextDue) explanations.push(`下次复习：${new Date(nextDue).toLocaleString('zh-CN')}；到期本身不表示遗忘。`)
  return { key, label: stageLabels[key], directions: { receptive, productive }, application,
    explanations, legacyEvidence, nextDue }
}
