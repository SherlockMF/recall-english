import type { LearningTrack, ReviewAttempt, StudyTimeEntry, VocabularyItem } from '../domain/types'
import { deriveLearningEvidence, isIndependentEvidence, type LearningEvidence } from './learningEvidence'

const DAY_MS = 86_400_000

export function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export interface DelayedRecallStats { total: number; correct: number; rate: number | null }
export interface LearningStats {
  evidenceByItemId: Map<string, LearningEvidence>
  introducedToday: number
  practicedItems: number
  taskCount: number
  attemptCount: number
  activeMs: number
  recallCount: number
  retainedCount: number
  applicationCount: number
  delayedRecall: DelayedRecallStats
}
export interface LearningStatsInput {
  items: VocabularyItem[]
  tracks: LearningTrack[]
  attempts: ReviewAttempt[]
  timeEntries: StudyTimeEntry[]
  now: Date
}

function historicalAttempts(attempts: ReviewAttempt[], now: Date) {
  return [...new Map(attempts.filter((attempt) => Number.isFinite(Date.parse(attempt.reviewedAt))
    && Date.parse(attempt.reviewedAt) <= now.getTime()).map((attempt) => [attempt.id, attempt])).values()]
    .sort((left, right) => Date.parse(left.reviewedAt) - Date.parse(right.reviewedAt))
}

export function deriveDelayedRecall(attempts: ReviewAttempt[], now: Date): DelayedRecallStats {
  const previousByDirection = new Map<string, number>()
  let total = 0
  let correct = 0
  for (const attempt of historicalAttempts(attempts, now)) {
    if (attempt.trackType === 'usage') continue
    const key = `${attempt.itemId}:${attempt.trackType}`
    const at = Date.parse(attempt.reviewedAt)
    const previous = previousByDirection.get(key)
    if (previous !== undefined && at - previous >= DAY_MS && at >= now.getTime() - 7 * DAY_MS
      && (isIndependentEvidence(attempt) || (attempt.evidenceVersion === 1
        && attempt.hintLevel === 0 && !attempt.wasOverride && attempt.retryCount === 0
        && attempt.evaluationSource === 'reveal' && attempt.correctness === 'incorrect'))
      && (attempt.correctness === 'correct' || attempt.correctness === 'incorrect')) {
      total += 1
      if (attempt.correctness === 'correct') correct += 1
    }
    previousByDirection.set(key, at)
  }
  return { total, correct, rate: total > 0 ? correct / total : null }
}

/** Counts all first introductions, including paused or subsequently removed items. */
export function introducedItemIdsToday(attempts: ReviewAttempt[], now: Date) {
  const first = new Map<string, number>()
  for (const attempt of historicalAttempts(attempts, now)) {
    if (!first.has(attempt.itemId)) first.set(attempt.itemId, Date.parse(attempt.reviewedAt))
  }
  return new Set([...first.entries()].filter(([, at]) => localDateKey(new Date(at)) === localDateKey(now)).map(([id]) => id))
}

export function countIntroducedToday(attempts: ReviewAttempt[], now: Date) {
  return introducedItemIdsToday(attempts, now).size
}

export function activeMsForDate(timeEntries: StudyTimeEntry[], localDate: string) {
  const sessions = new Map<string, number>()
  for (const entry of timeEntries) {
    if (entry.localDate !== localDate || !Number.isFinite(entry.activeMs) || entry.activeMs < 0) continue
    sessions.set(entry.sessionId, Math.max(sessions.get(entry.sessionId) ?? 0, entry.activeMs))
  }
  return [...sessions.values()].reduce((sum, activeMs) => sum + activeMs, 0)
}

/** A shared projection of saved facts for Today, the learning map and session summaries. */
export function deriveLearningStats({ items, tracks, attempts, timeEntries, now }: LearningStatsInput): LearningStats {
  const history = historicalAttempts(attempts, now)
  const today = history.filter((attempt) => localDateKey(new Date(attempt.reviewedAt)) === localDateKey(now))
  const attemptsByItem = new Map<string, ReviewAttempt[]>()
  const tracksByItem = new Map<string, LearningTrack[]>()
  for (const attempt of history) {
    const grouped = attemptsByItem.get(attempt.itemId)
    if (grouped) grouped.push(attempt)
    else attemptsByItem.set(attempt.itemId, [attempt])
  }
  for (const track of tracks) {
    const grouped = tracksByItem.get(track.itemId)
    if (grouped) grouped.push(track)
    else tracksByItem.set(track.itemId, [track])
  }
  const evidenceByItemId = new Map(items.map((item) => [item.id,
    deriveLearningEvidence(item, tracksByItem.get(item.id) ?? [], attemptsByItem.get(item.id) ?? [], now)]))
  const evidence = [...evidenceByItemId.values()]
  return {
    evidenceByItemId,
    introducedToday: countIntroducedToday(history, now),
    practicedItems: new Set(today.map((attempt) => attempt.itemId)).size,
    taskCount: new Set(today.map((attempt) => `${attempt.itemId}:${attempt.trackType}:${attempt.promptId ?? attempt.promptType}`)).size,
    attemptCount: today.length,
    activeMs: activeMsForDate(timeEntries, localDateKey(now)),
    recallCount: evidence.filter((item) => item.key === 'recall' || item.key === 'retained').length,
    retainedCount: evidence.filter((item) => item.key === 'retained').length,
    applicationCount: evidence.filter((item) => item.application.clozePassed || item.application.sentencePassed).length,
    delayedRecall: deriveDelayedRecall(history, now),
  }
}
