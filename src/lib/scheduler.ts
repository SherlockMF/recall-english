import { Rating, State, fsrs, type CardInput, type Grade } from 'ts-fsrs'
import type {
  LearningTrack,
  ReviewAttempt,
  ReviewRating,
  SessionTask,
  TrackType,
  UserSettings,
  VocabularyItem,
  Word,
} from '../domain/types'

export type SessionMode = 'core' | 'extension'
export type SchedulerDate = Date | string | number

const DAY_MS = 24 * 60 * 60 * 1000
const CORE_TASK_MINUTES = 0.75
const USAGE_TASK_MINUTES = 2
const CATEGORY_ORDER = ['daily', 'business', 'finance', 'accounting'] as const
const CORE_TRACK_TYPES: readonly TrackType[] = ['receptive', 'productive']

type MixedCategory = (typeof CATEGORY_ORDER)[number]

interface QueueCandidate {
  task: SessionTask
  phase: number
  dueAt: number
  priority: number
  minutes: number
}

interface BudgetSelection {
  selected: QueueCandidate[]
  remaining: QueueCandidate[]
  spent: number
}

interface CorePlan {
  tasks: QueueCandidate[]
  overflowDue: QueueCandidate[]
  newItems: VocabularyItem[]
}

function validDate(value: SchedulerDate | undefined, fallback: Date) {
  if (value === undefined) return new Date(fallback)
  const parsed = value instanceof Date ? new Date(value) : new Date(value)
  return Number.isNaN(parsed.getTime()) ? new Date(fallback) : parsed
}

function dateValue(value: string | undefined, fallback: number) {
  if (!value) return fallback
  const parsed = new Date(value).getTime()
  return Number.isNaN(parsed) ? fallback : parsed
}

function calendarDay(value: SchedulerDate) {
  const date = validDate(value, new Date())
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function trackId(itemId: string, type: TrackType) {
  return `${itemId}:${type}`
}

function initialTrack(itemId: string, type: TrackType, now: Date, unlocked: boolean): LearningTrack {
  return {
    id: trackId(itemId, type),
    itemId,
    type,
    due: now.toISOString(),
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: State.New,
    unlocked,
  }
}

/** Creates the two recall tracks for every item and an optional, initially locked usage track. */
export function createInitialTracks(items: Array<Pick<Word, 'id' | 'usagePrompts'>>, now: SchedulerDate = new Date()) {
  const reviewedAt = validDate(now, new Date())
  return items.flatMap((item) => {
    const tracks = [
      initialTrack(item.id, 'receptive', reviewedAt, true),
      initialTrack(item.id, 'productive', reviewedAt, true),
    ]
    if (item.usagePrompts.length > 0) {
      tracks.push(initialTrack(item.id, 'usage', reviewedAt, false))
    }
    return tracks
  })
}

/** Usage starts only after both directions have a recorded good review. */
export function canUnlockUsage(itemId: string, tracks: LearningTrack[]) {
  return CORE_TRACK_TYPES.every((type) => {
    const track = tracks.find((candidate) => candidate.itemId === itemId && candidate.type === type)
    return Boolean(track?.firstGoodAt || track?.lastGoodAt)
  })
}

/**
 * Unlocks newly eligible usage tracks and re-locks usage when core mastery is lost.
 * Newly unlocked tracks become due immediately.
 */
export function unlockEligibleUsageTracks(
  tracks: LearningTrack[],
  now: SchedulerDate = new Date(),
) {
  const unlockedAt = validDate(now, new Date())
  const nowValue = unlockedAt.getTime()

  return tracks.map((track) => {
    if (track.type !== 'usage') return track
    const eligible = canUnlockUsage(track.itemId, tracks)
    if (eligible) {
      if (track.unlocked) return track
      const currentDue = dateValue(track.due, nowValue)
      return {
        ...track,
        unlocked: true,
        due: new Date(Math.min(currentDue, nowValue)).toISOString(),
      }
    }
    if (!track.unlocked) return track
    return { ...track, unlocked: false }
  })
}

function activeItemMap(items: VocabularyItem[]) {
  return new Map(items.filter((item) => item.status === 'active').map((item) => [item.id, item]))
}

function isCoreTrack(track: LearningTrack) {
  return track.type === 'receptive' || track.type === 'productive'
}

function isFreshItem(itemId: string, tracks: LearningTrack[], attemptedItems: Set<string>) {
  if (attemptedItems.has(itemId)) return false
  const coreTracks = tracks.filter((track) => track.itemId === itemId && isCoreTrack(track))
  return coreTracks.length === 2 && coreTracks.every(
    (track) => track.reps === 0 && track.state === State.New,
  )
}

function compareItems(left: VocabularyItem, right: VocabularyItem) {
  if (left.priority !== right.priority) return left.priority - right.priority
  if (left.source !== right.source) return left.source === 'custom' ? -1 : 1
  const createdDifference = dateValue(left.createdAt, 0) - dateValue(right.createdAt, 0)
  return createdDifference || left.id.localeCompare(right.id)
}

function normalizedMix(settings: UserSettings) {
  const weights = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, Math.max(0, settings.contentMix[category] ?? 0)]),
  ) as Record<MixedCategory, number>
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0)
  if (total <= 0) return { daily: 0.25, business: 0.25, finance: 0.25, accounting: 0.25 }
  return Object.fromEntries(
    CATEGORY_ORDER.map((category) => [category, weights[category] / total]),
  ) as Record<MixedCategory, number>
}

function categoryCounts(items: VocabularyItem[]) {
  const counts: Record<MixedCategory, number> = {
    daily: 0,
    business: 0,
    finance: 0,
    accounting: 0,
  }
  for (const item of items) {
    if (item.category !== 'my-vocabulary' && item.category in counts) {
      counts[item.category as MixedCategory] += 1
    }
  }
  return counts
}

function selectNewItems(
  candidates: VocabularyItem[],
  limit: number,
  settings: UserSettings,
  initialCounts: Record<MixedCategory, number> = {
    daily: 0,
    business: 0,
    finance: 0,
    accounting: 0,
  },
) {
  if (limit <= 0) return []
  const selected: VocabularyItem[] = []
  const sorted = [...candidates].sort(compareItems)
  const personal = sorted.filter((item) => item.category === 'my-vocabulary')

  while (personal.length > 0 && selected.length < limit) {
    selected.push(personal.shift()!)
  }
  if (selected.length >= limit) return selected

  const pools = Object.fromEntries(
    CATEGORY_ORDER.map((category) => [
      category,
      sorted.filter((item) => item.category === category),
    ]),
  ) as Record<MixedCategory, VocabularyItem[]>
  const counts = { ...initialCounts }
  const weights = normalizedMix(settings)

  while (selected.length < limit) {
    const available = CATEGORY_ORDER.filter((category) => pools[category].length > 0)
    if (available.length === 0) break
    const weighted = available.filter((category) => weights[category] > 0)
    const category = (weighted.length > 0 ? weighted : available).reduce((best, current) => {
      if (weights[best] <= 0) return current
      if (weights[current] <= 0) return best
      const bestScore = (counts[best] + 1) / weights[best]
      const currentScore = (counts[current] + 1) / weights[current]
      return currentScore < bestScore ? current : best
    })
    selected.push(pools[category].shift()!)
    counts[category] += 1
  }
  return selected
}

function compareCandidates(left: QueueCandidate, right: QueueCandidate) {
  if (left.phase !== right.phase) return left.phase - right.phase
  if (left.dueAt !== right.dueAt) return left.dueAt - right.dueAt
  if (left.priority !== right.priority) return left.priority - right.priority
  if (left.task.trackType !== right.task.trackType) {
    return CORE_TRACK_TYPES.indexOf(left.task.trackType) - CORE_TRACK_TYPES.indexOf(right.task.trackType)
  }
  return left.task.trackId.localeCompare(right.task.trackId)
}

/** Greedily preserves priority while avoiding adjacent tasks for the same vocabulary item. */
function separateItems(candidates: QueueCandidate[]) {
  const remaining = [...candidates].sort(compareCandidates)
  const ordered: QueueCandidate[] = []
  while (remaining.length > 0) {
    const previousItem = ordered.at(-1)?.task.itemId
    const currentPhase = remaining[0].phase
    let index = remaining.findIndex(
      (candidate) => candidate.phase === currentPhase && candidate.task.itemId !== previousItem,
    )
    if (index < 0) index = remaining.findIndex((candidate) => candidate.task.itemId !== previousItem)
    if (index < 0) index = 0
    ordered.push(remaining.splice(index, 1)[0])
  }
  return ordered
}

function takeBudget(candidates: QueueCandidate[], minutes: number): BudgetSelection {
  const ordered = separateItems(candidates)
  if (minutes <= 0) return { selected: [], remaining: ordered, spent: 0 }
  let spent = 0
  let count = 0
  while (count < ordered.length && spent + ordered[count].minutes <= minutes + Number.EPSILON) {
    spent += ordered[count].minutes
    count += 1
  }
  return {
    selected: ordered.slice(0, count),
    remaining: ordered.slice(count),
    spent,
  }
}

function trackCandidate(
  track: LearningTrack,
  item: VocabularyItem,
  phase: number,
  mode: SessionMode,
  nowValue: number,
): QueueCandidate {
  const promptIndex = track.type === 'usage' && item.usagePrompts.length > 0
    ? track.reps % item.usagePrompts.length
    : undefined
  return {
    task: {
      id: `${mode}:${track.id}${promptIndex === undefined ? '' : `:${promptIndex}`}`,
      itemId: item.id,
      trackId: track.id,
      trackType: track.type,
      isNew: track.reps === 0 || track.state === State.New,
      promptIndex,
    },
    phase,
    dueAt: dateValue(track.due, nowValue),
    priority: item.priority,
    minutes: track.type === 'usage' ? USAGE_TASK_MINUTES : CORE_TASK_MINUTES,
  }
}

function newItemCandidates(
  selectedItems: VocabularyItem[],
  tracks: LearningTrack[],
  phase: number,
  mode: SessionMode,
  nowValue: number,
) {
  return selectedItems.flatMap((item) => CORE_TRACK_TYPES.map((type) => {
    const track = tracks.find(
      (candidate) => candidate.itemId === item.id && candidate.type === type && candidate.unlocked,
    )
    return track ? trackCandidate(track, item, phase, mode, nowValue) : undefined
  }).filter((candidate): candidate is QueueCandidate => Boolean(candidate)))
}

function introducedToday(attempts: ReviewAttempt[], activeItems: Map<string, VocabularyItem>, now: Date) {
  const firstAttempts = new Map<string, number>()
  for (const attempt of attempts) {
    if (!activeItems.has(attempt.itemId)) continue
    const reviewedAt = dateValue(attempt.reviewedAt, Number.POSITIVE_INFINITY)
    const previous = firstAttempts.get(attempt.itemId)
    if (previous === undefined || reviewedAt < previous) firstAttempts.set(attempt.itemId, reviewedAt)
  }
  const today = calendarDay(now)
  return [...firstAttempts.values()].filter((value) => calendarDay(value) === today).length
}

/**
 * Adapts the configured daily target to recent unaided performance and today's due workload.
 * The result is the total target for the day; queue construction subtracts items already started today.
 */
export function getAdaptiveNewItemTarget(
  settings: UserSettings,
  items: VocabularyItem[],
  tracks: LearningTrack[],
  attempts: ReviewAttempt[],
  now: SchedulerDate = new Date(),
) {
  const reviewedAt = validDate(now, new Date())
  const nowValue = reviewedAt.getTime()
  const activeItems = activeItemMap(items)
  const taskCapacity = Math.max(0, Math.floor(settings.coreMinutes / CORE_TASK_MINUTES))
  const dueCount = tracks.filter((track) => (
    activeItems.has(track.itemId)
    && track.unlocked
    && isCoreTrack(track)
    && track.state !== State.New
    && dateValue(track.due, Number.NEGATIVE_INFINITY) <= nowValue
  )).length
  const capacityForNewItems = Math.max(0, Math.floor((taskCapacity - dueCount) / 2))
  const baseline = Math.max(0, Math.floor(settings.newItemsPerDay))
  if (baseline === 0 || capacityForNewItems === 0) return 0

  const windowStart = nowValue - 7 * DAY_MS
  const recent = attempts.filter((attempt) => {
    const attemptAt = dateValue(attempt.reviewedAt, Number.NEGATIVE_INFINITY)
    return !attempt.wasOverride
      && activeItems.has(attempt.itemId)
      && attempt.trackType !== 'usage'
      && attemptAt >= windowStart
      && attemptAt <= nowValue
  })

  let target = baseline
  if (recent.length >= 10) {
    const recalled = recent.filter((attempt) => attempt.rating !== 'again').length / recent.length
    const unaidedGood = recent.filter(
      (attempt) => attempt.rating === 'good' && attempt.hintLevel === 0,
    ).length / recent.length
    if (recalled < 0.65 || unaidedGood < 0.4) {
      target = Math.floor(baseline * 0.5)
    } else if (recalled < 0.8 || unaidedGood < 0.6) {
      target = Math.max(1, Math.floor(baseline * 0.75))
    } else if (recalled >= 0.9 && unaidedGood >= 0.8 && dueCount <= taskCapacity * 0.25) {
      target = baseline + 1
    }
  }

  return Math.min(target, baseline + 2, capacityForNewItems)
}

function planCore(
  settings: UserSettings,
  items: VocabularyItem[],
  tracks: LearningTrack[],
  attempts: ReviewAttempt[],
  now: Date,
): CorePlan {
  const nowValue = now.getTime()
  const activeItems = activeItemMap(items)
  const attemptedItems = new Set(attempts.map((attempt) => attempt.itemId))
  const freshItems = [...activeItems.values()].filter(
    (item) => isFreshItem(item.id, tracks, attemptedItems),
  )
  const freshIds = new Set(freshItems.map((item) => item.id))
  const due = tracks
    .filter((track) => (
      activeItems.has(track.itemId)
      && track.unlocked
      && isCoreTrack(track)
      && !freshIds.has(track.itemId)
      && dateValue(track.due, Number.NEGATIVE_INFINITY) <= nowValue
    ))
    .map((track) => trackCandidate(track, activeItems.get(track.itemId)!, 0, 'core', nowValue))
  const dueSelection = takeBudget(due, Math.max(0, settings.coreMinutes))
  if (dueSelection.remaining.length > 0) {
    return { tasks: dueSelection.selected, overflowDue: dueSelection.remaining, newItems: [] }
  }

  const remainingMinutes = Math.max(0, settings.coreMinutes - dueSelection.spent)
  const timeSlots = Math.floor(remainingMinutes / (2 * CORE_TASK_MINUTES))
  const dailyTarget = getAdaptiveNewItemTarget(settings, items, tracks, attempts, now)
  const remainingTarget = Math.max(0, dailyTarget - introducedToday(attempts, activeItems, now))
  const selectedNewItems = selectNewItems(
    freshItems,
    Math.min(timeSlots, remainingTarget),
    settings,
  )
  const newTasks = newItemCandidates(selectedNewItems, tracks, 1, 'core', nowValue)
  return {
    tasks: separateItems([...dueSelection.selected, ...newTasks]),
    overflowDue: [],
    newItems: selectedNewItems,
  }
}

/** Builds a deterministic, time-bounded daily queue for the requested session mode. */
export function buildDailyQueue(
  settings: UserSettings,
  items: VocabularyItem[],
  tracks: LearningTrack[],
  attempts: ReviewAttempt[],
  now: SchedulerDate,
  mode: SessionMode,
): SessionTask[] {
  const reviewedAt = validDate(now, new Date())
  const corePlan = planCore(settings, items, tracks, attempts, reviewedAt)
  if (mode === 'core') return corePlan.tasks.map((candidate) => candidate.task)

  const nowValue = reviewedAt.getTime()
  const activeItems = activeItemMap(items)
  const extensionMinutes = Math.max(0, settings.extensionMinutes)
  const dueUsage = tracks
    .filter((track) => (
      track.type === 'usage'
      && activeItems.has(track.itemId)
      && (track.unlocked || canUnlockUsage(track.itemId, tracks))
      && dateValue(track.due, Number.NEGATIVE_INFINITY) <= nowValue
    ))
    .map((track) => trackCandidate(track, activeItems.get(track.itemId)!, 0, 'extension', nowValue))
  const usageSelection = takeBudget(dueUsage, extensionMinutes)
  if (usageSelection.remaining.length > 0) {
    return usageSelection.selected.map((candidate) => candidate.task)
  }

  let spent = usageSelection.spent
  const overflow = corePlan.overflowDue.map((candidate) => ({
    ...candidate,
    phase: 1,
    task: { ...candidate.task, id: candidate.task.id.replace(/^core:/, 'extension:') },
  }))
  const overflowSelection = takeBudget(overflow, extensionMinutes - spent)
  spent += overflowSelection.spent
  if (overflowSelection.remaining.length > 0) {
    return separateItems([...usageSelection.selected, ...overflowSelection.selected])
      .map((candidate) => candidate.task)
  }

  const attemptedItems = new Set(attempts.map((attempt) => attempt.itemId))
  const coreNewIds = new Set(corePlan.newItems.map((item) => item.id))
  const extraCandidates = [...activeItems.values()].filter((item) => (
    !coreNewIds.has(item.id) && isFreshItem(item.id, tracks, attemptedItems)
  ))
  const extraSlots = Math.min(
    3,
    Math.floor(Math.max(0, extensionMinutes - spent) / (2 * CORE_TASK_MINUTES)),
  )
  const extraItems = selectNewItems(
    extraCandidates,
    extraSlots,
    settings,
    categoryCounts(corePlan.newItems),
  )
  const extraTasks = newItemCandidates(extraItems, tracks, 2, 'extension', nowValue)
  return separateItems([
    ...usageSelection.selected,
    ...overflowSelection.selected,
    ...extraTasks,
  ]).map((candidate) => candidate.task)
}

const FSRS_RATINGS: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
}

/** Applies one UI rating to a persisted LearningTrack through ts-fsrs. */
export function scheduleReview(
  track: LearningTrack,
  rating: ReviewRating,
  now: SchedulerDate = new Date(),
  desiredRetention = 0.9,
): LearningTrack {
  const reviewedAt = validDate(now, new Date())
  const state = Object.values(State).includes(track.state) ? track.state as State : State.New
  const card: CardInput = {
    due: validDate(track.due, reviewedAt),
    stability: state === State.New ? 0 : Math.max(0.01, track.stability),
    difficulty: state === State.New ? 0 : Math.min(10, Math.max(1, track.difficulty)),
    elapsed_days: Math.max(0, track.elapsedDays),
    scheduled_days: Math.max(0, track.scheduledDays),
    learning_steps: 0,
    reps: Math.max(0, track.reps),
    lapses: Math.max(0, track.lapses),
    state,
    last_review: track.lastReview ? validDate(track.lastReview, reviewedAt) : undefined,
  }
  const scheduler = fsrs({
    request_retention: Math.min(0.97, Math.max(0.7, desiredRetention)),
    enable_fuzz: false,
    enable_short_term: false,
  })
  const result = scheduler.next(card, reviewedAt, FSRS_RATINGS[rating]).card
  const reviewedIso = reviewedAt.toISOString()
  const wasGood = rating === 'good'
  // Only full misses reset mastery timestamps; hard still shortens interval via FSRS
  // and demotes display while lastReview is newer than lastGoodAt.
  const demoteMastery = rating === 'again'

  return {
    ...track,
    due: result.due.toISOString(),
    stability: result.stability,
    difficulty: result.difficulty,
    elapsedDays: result.elapsed_days,
    scheduledDays: result.scheduled_days,
    reps: result.reps,
    lapses: result.lapses,
    state: result.state,
    lastReview: result.last_review?.toISOString() ?? reviewedIso,
    firstGoodAt: wasGood
      ? track.firstGoodAt ?? reviewedIso
      : demoteMastery
        ? undefined
        : track.firstGoodAt,
    lastGoodAt: wasGood
      ? reviewedIso
      : demoteMastery
        ? undefined
        : track.lastGoodAt,
  }
}

/** Reinserts a failed task after other material without mutating the pending queue. */
export function requeueFailedTask(
  pending: SessionTask[],
  failed: SessionTask,
  minimumGap = 2,
) {
  const retryCount = (failed.retryCount ?? 0) + 1
  const retry: SessionTask = {
    ...failed,
    id: `${failed.id}:retry:${retryCount}`,
    retryCount,
  }
  const result = [...pending]
  const start = Math.min(result.length, Math.max(0, Math.floor(minimumGap)))
  let insertionIndex = -1
  for (let index = start; index <= result.length; index += 1) {
    const before = result[index - 1]
    const after = result[index]
    if (before?.itemId !== failed.itemId && after?.itemId !== failed.itemId) {
      insertionIndex = index
      break
    }
  }
  result.splice(insertionIndex < 0 ? result.length : insertionIndex, 0, retry)
  return result
}
