import profiles from '../data/vocabularyLevels.json'
import { VOCABULARY_LEVELS, type LearningTrack, type ReviewAttempt, type SessionTask, type UserSettings, type VocabularyItem, type VocabularyLevel, type Word } from '../domain/types'
import { isExplicitFailure, isValidRecallSuccess } from './learningEvidence'

export const vocabularyLevelLabels: Record<VocabularyLevel, string> = {
  A1: 'A1 入门', A2: 'A2 基础', B1: 'B1 中级', B2: 'B2 中高级', C1: 'C1 高级', C2: 'C2 精通',
}
export function isVocabularyLevel(value: unknown): value is VocabularyLevel {
  return VOCABULARY_LEVELS.includes(value as VocabularyLevel)
}
const lexicon = profiles as Record<string, Record<string, VocabularyLevel>>
const posAliases: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', pron: 'pronoun', det: 'determiner', conj: 'conjunction' }
export function getVocabularyDifficulty(item: Pick<Word, 'expression' | 'lemma' | 'partOfSpeech' | 'vocabularyLevel'>): { level: VocabularyLevel; source: 'manual' | 'profile' | 'estimated' } {
  if (isVocabularyLevel(item.vocabularyLevel)) return { level: item.vocabularyLevel, source: 'manual' }
  const rawPos = item.partOfSpeech.trim().toLowerCase().replace(/\.$/, '')
  const pos = posAliases[rawPos] ?? rawPos
  for (const expression of [item.expression, item.lemma]) {
    const key = expression.trim().toLowerCase().replace(/\s+/g, ' ')
    const level = Object.hasOwn(lexicon, key) ? lexicon[key][pos] : undefined
    if (isVocabularyLevel(level)) return { level, source: 'profile' }
  }
  return { level: 'B2', source: 'estimated' }
}

export interface StudyDifficulty {
  level: VocabularyLevel
  easyStreak: number
  hardStreak: number
  changes: number
}

export function isNewLearningTask(task: SessionTask, tracks: LearningTrack[], attempts: ReviewAttempt[]) {
  if (task.trackType === 'usage' || (task.retryCount ?? 0) > 0) return false
  if (task.isNew) return true
  return tracks.find((track) => track.id === task.trackId)?.reps === 0
    && !attempts.some((attempt) => attempt.trackId === task.trackId)
    && attempts.some((attempt) => attempt.itemId === task.itemId && attempt.wasNewItem === true)
}

function eligibleDifficultySample(attempt: ReviewAttempt) {
  return attempt.wasNewItem === true && !attempt.wasOverride && attempt.retryCount === 0
    && attempt.evidenceVersion === 1 && attempt.correctness !== 'unverified' && attempt.wasPriorityStudy !== true
}
/** Replay saved first encounters; each new ordinary word contributes at most one event. */
export function getStudyDifficulty(settings: UserSettings, items: VocabularyItem[], attempts: ReviewAttempt[], now = new Date()): StudyDifficulty {
  let index = VOCABULARY_LEVELS.indexOf(isVocabularyLevel(settings.vocabularyLevel) ? settings.vocabularyLevel : 'B1')
  let easyStreak = 0; let hardStreak = 0; let changes = 0
  if (settings.adaptiveDifficulty === false) return { level: VOCABULARY_LEVELS[index], easyStreak, hardStreak, changes }
  const reset = settings.difficultyResetAt ? Date.parse(settings.difficultyResetAt) : 0
  const byItem = new Map(items.map((item) => [item.id, item]))
  const first = new Map<string, Map<string, ReviewAttempt>>()
  for (const attempt of [...attempts].filter((a) => Date.parse(a.reviewedAt) <= now.getTime())
    .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id))) {
    if (attempt.trackType === 'usage') continue
    const directions = first.get(attempt.itemId) ?? new Map<string, ReviewAttempt>()
    if (!directions.has(attempt.trackType)) directions.set(attempt.trackType, attempt)
    first.set(attempt.itemId, directions)
  }
  const events: { time: number; id: string; result: 'easy' | 'hard' | 'neutral' }[] = []
  for (const [id, directions] of first) {
    const item = byItem.get(id)
    if (!item) continue
    const samples = [...directions.values()]
    const initial = samples[0]
    if (Date.parse(initial.reviewedAt) < reset || initial.wasNewItem !== true
      || (initial.wasPriorityStudy ?? item.listSlugs.includes('my-vocabulary'))) continue
    const failure = samples.find((a) => eligibleDifficultySample(a) && (isExplicitFailure(a)
      || (a.correctness === 'correct' && a.hintLevel >= 2 && (a.evaluationSource === 'rules' || a.evaluationSource === 'llm'))))
    if (!failure && (samples.length !== 2 || !samples.every(eligibleDifficultySample))) continue
    const easy = !failure && samples.every((a) => isValidRecallSuccess(a) && a.rating === 'good'
      && a.responseMs > 0 && a.responseMs <= (a.trackType === 'receptive' ? 12000 : 15000))
    events.push({ id, time: failure ? Date.parse(failure.reviewedAt) : Math.max(...samples.map((a) => Date.parse(a.reviewedAt))),
      result: failure ? 'hard' : easy ? 'easy' : 'neutral' })
  }
  events.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id))
  for (const event of events) {
    if (event.result === 'easy') {
      easyStreak++; hardStreak = 0
      if (easyStreak >= 3) { if (index < 5) { index++; changes++ } easyStreak = 0 }
    } else if (event.result === 'hard') {
      hardStreak++; easyStreak = 0
      if (hardStreak >= 2) { if (index > 0) { index--; changes++ } hardStreak = 0 }
    } else { easyStreak = 0; hardStreak = 0 }
  }
  return { level: VOCABULARY_LEVELS[index], easyStreak, hardStreak, changes }
}

/** Keep all pending work for started words and priority words; replace only untouched ordinary slots. */
export function refreshPendingNewTasks(pending: SessionTask[], planned: SessionTask[], items: VocabularyItem[], started: ReadonlySet<string>) {
  const byItem = new Map(items.map((item) => [item.id, item]))
  const eligible = (task: SessionTask) => { const item = byItem.get(task.itemId); return item?.status === 'active' && !item.knownAt }
  const protectedTask = (task: SessionTask) => !task.isNew || started.has(task.itemId) || byItem.get(task.itemId)?.listSlugs.includes('my-vocabulary')
  const protectedIds = new Set(pending.filter((task) => eligible(task) && protectedTask(task)).map((task) => task.itemId))
  const replacements = planned.filter((task) => task.isNew && eligible(task) && !started.has(task.itemId) && !protectedIds.has(task.itemId))
  const result: SessionTask[] = []
  let replacementIndex = 0
  for (const task of pending) {
    if (eligible(task) && protectedTask(task)) result.push(task)
    else if (replacementIndex < replacements.length) result.push(replacements[replacementIndex++])
  }
  result.push(...replacements.slice(replacementIndex))
  return result
}
