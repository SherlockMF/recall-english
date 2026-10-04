import { State } from 'ts-fsrs'
import { DEFAULT_SETTINGS } from '../domain/types'
import type {
  LearningTrack,
  ReviewAttempt,
  TrackType,
  UserSettings,
  VocabularyCategory,
  VocabularyItem,
} from '../domain/types'
import {
  buildDailyQueue,
  buildDailyPlan,
  canUnlockUsage,
  createInitialTracks,
  getAdaptiveNewItemTarget,
  requeueFailedTask,
  scheduleReview,
  unlockEligibleUsageTracks,
} from './scheduler'

const NOW = new Date('2026-08-10T00:00:00.000Z')

function makeItem(
  id: string,
  category: VocabularyCategory = 'daily',
  overrides: Partial<VocabularyItem> = {},
): VocabularyItem {
  return {
    id,
    expression: id,
    lemma: id,
    senseKey: `${id}-sense`,
    zhGloss: `${id}-中文`,
    enDefinition: `${id} definition`,
    partOfSpeech: 'noun',
    acceptedZhAnswers: [],
    acceptedEnVariants: [],
    examples: [],
    collocations: [],
    listSlugs: [category],
    category,
    source: 'seed',
    priority: 1,
    status: 'active',
    usagePrompts: [],
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeTrack(
  itemId: string,
  type: TrackType,
  overrides: Partial<LearningTrack> = {},
): LearningTrack {
  return {
    id: `${itemId}:${type}`,
    itemId,
    type,
    due: NOW.toISOString(),
    stability: 4,
    difficulty: 5,
    elapsedDays: 2,
    scheduledDays: 2,
    reps: 2,
    lapses: 0,
    state: State.Review,
    lastReview: '2026-08-08T00:00:00.000Z',
    unlocked: true,
    ...overrides,
  }
}

function makeAttempt(
  index: number,
  itemId: string,
  overrides: Partial<ReviewAttempt> = {},
): ReviewAttempt {
  return {
    id: `attempt-${index}`,
    trackId: `${itemId}:productive`,
    itemId,
    trackType: 'productive',
    promptType: 'productive',
    answer: itemId,
    rating: 'good',
    hintLevel: 0,
    responseMs: 3_000,
    reviewedAt: new Date(NOW.getTime() - index * 60_000).toISOString(),
    ...overrides,
  }
}

function settings(overrides: Partial<UserSettings> = {}): UserSettings {
  return { ...DEFAULT_SETTINGS, ...overrides }
}

describe('createInitialTracks and usage unlocking', () => {
  it('creates two core tracks and only creates a locked usage track when prompts exist', () => {
    const plain = makeItem('plain')
    const usable = makeItem('usable', 'business', {
      usagePrompts: [{
        id: 'prompt-1',
        type: 'cloze',
        prompt: 'We need to ___ today.',
        answer: 'break even',
        modelAnswer: 'We need to break even today.',
        checkpoints: ['break even'],
      }],
    })

    const tracks = createInitialTracks([plain, usable], NOW)

    expect(tracks).toHaveLength(5)
    expect(tracks.filter((track) => track.itemId === 'plain').map((track) => track.type))
      .toEqual(['receptive', 'productive'])
    expect(tracks.find((track) => track.id === 'usable:usage')).toMatchObject({
      state: State.New,
      reps: 0,
      unlocked: false,
      due: NOW.toISOString(),
    })
  })

  it('unlocks usage only after both recall directions have a good review', () => {
    const item = makeItem('usable', 'daily', {
      usagePrompts: [{
        id: 'prompt',
        type: 'sentence',
        prompt: 'Write a sentence.',
        modelAnswer: 'This is usable.',
        checkpoints: ['usable'],
      }],
    })
    const tracks = createInitialTracks([item], '2026-08-20T00:00:00.000Z').map((track) => (
      track.type === 'receptive' || track.type === 'productive'
        ? { ...track, firstGoodAt: '2026-08-09T00:00:00.000Z' }
        : track
    ))

    expect(canUnlockUsage(item.id, tracks)).toBe(true)
    const unlocked = unlockEligibleUsageTracks(tracks, NOW)
    expect(unlocked.find((track) => track.type === 'usage')).toMatchObject({
      unlocked: true,
      due: NOW.toISOString(),
    })
    expect(tracks.find((track) => track.type === 'usage')?.unlocked).toBe(false)
  })
})

describe('buildDailyQueue', () => {
  it('puts overdue core work first, separates the same item, and mixes new categories', () => {
    const items = [
      makeItem('due-a'),
      makeItem('due-b'),
      makeItem('new-daily', 'daily'),
      makeItem('new-finance', 'finance'),
      makeItem('new-business', 'business'),
      makeItem('paused', 'daily', { status: 'paused', priority: 99 }),
    ]
    const freshTracks = createInitialTracks(items.slice(2), NOW)
    const tracks = [
      makeTrack('due-a', 'receptive', { due: '2026-08-07T00:00:00.000Z' }),
      makeTrack('due-a', 'productive', { due: '2026-08-09T00:00:00.000Z' }),
      makeTrack('due-b', 'receptive', { due: '2026-08-08T00:00:00.000Z' }),
      makeTrack('due-b', 'productive', { due: '2026-08-12T00:00:00.000Z' }),
      ...freshTracks,
    ]
    const queue = buildDailyQueue(
      settings({
        coreMinutes: 10,
        newItemsPerDay: 3,
        contentMix: { daily: 0.25, business: 0.25, finance: 0.25, accounting: 0.25 },
      }),
      items,
      tracks,
      [],
      NOW,
      'core',
    )

    expect(queue.slice(0, 3).map((task) => task.trackId)).toEqual([
      'due-a:receptive',
      'due-b:receptive',
      'due-a:productive',
    ])
    expect(queue.slice(0, 3).every((task) => !task.isNew)).toBe(true)
    expect(queue.some((task) => task.itemId === 'paused')).toBe(false)
    expect(queue.slice(3).filter((task) => task.isNew)).toHaveLength(6)
    expect(new Set(queue.slice(3).map((task) => task.itemId))).toEqual(new Set([
      'new-daily',
      'new-finance',
      'new-business',
    ]))
    for (let index = 1; index < queue.length; index += 1) {
      expect(queue[index].itemId).not.toBe(queue[index - 1].itemId)
    }
  })

  it('uses the same daily budget and hard new-item limit for both legacy session modes', () => {
    const usageItem = makeItem('usage-item', 'daily', {
      usagePrompts: [{
        id: 'usage-prompt',
        type: 'cloze',
        prompt: 'Use ___.',
        answer: 'usage-item',
        modelAnswer: 'Use usage-item.',
        checkpoints: ['usage-item'],
      }],
    })
    const dueA = makeItem('due-a')
    const dueB = makeItem('due-b')
    const freshItems = [
      makeItem('extra-d1', 'daily'),
      makeItem('extra-d2', 'daily'),
      makeItem('extra-f1', 'finance'),
      makeItem('extra-b1', 'business'),
    ]
    const items = [usageItem, dueA, dueB, ...freshItems]
    const tracks = [
      makeTrack('usage-item', 'receptive', { due: '2026-08-20T00:00:00.000Z', firstGoodAt: '2026-08-01T00:00:00.000Z' }),
      makeTrack('usage-item', 'productive', { due: '2026-08-20T00:00:00.000Z', firstGoodAt: '2026-08-02T00:00:00.000Z' }),
      makeTrack('usage-item', 'usage', { due: '2026-08-09T00:00:00.000Z' }),
      makeTrack('due-a', 'receptive', { due: '2026-08-07T00:00:00.000Z' }),
      makeTrack('due-a', 'productive', { due: '2026-08-20T00:00:00.000Z' }),
      makeTrack('due-b', 'receptive', { due: '2026-08-08T00:00:00.000Z' }),
      makeTrack('due-b', 'productive', { due: '2026-08-20T00:00:00.000Z' }),
      ...createInitialTracks(freshItems, NOW),
    ]

    const queue = buildDailyQueue(
      settings({ dailyMinutes: 10, coreMinutes: 0.75, extensionMinutes: 10, newItemsPerDay: 2 }),
      items,
      tracks,
      [],
      NOW,
      'extension',
    )

    expect(queue.slice(0, 3).map((task) => task.itemId)).toEqual(['due-a', 'due-b', 'usage-item'])
    const extraTasks = queue.filter((task) => task.isNew)
    expect(new Set(extraTasks.map((task) => task.itemId)).size).toBe(2)
    expect(extraTasks).toHaveLength(4)
    expect(queue).toEqual(buildDailyQueue(settings({ dailyMinutes: 10, newItemsPerDay: 2 }), items, tracks, [], NOW, 'core'))
  })

  it('uses lower numeric priority first within a content category', () => {
    const first = makeItem('priority-one', 'daily', { priority: 1 })
    const later = makeItem('priority-two', 'daily', { priority: 2 })
    const items = [later, first]
    const queue = buildDailyQueue(
      settings({ coreMinutes: 3, newItemsPerDay: 1, contentMix: { daily: 1, business: 0, finance: 0, accounting: 0 } }),
      items,
      createInitialTracks(items, NOW),
      [],
      NOW,
      'core',
    )

    expect(new Set(queue.map((task) => task.itemId))).toEqual(new Set(['priority-one']))
  })

  it('counts newly introduced items by local calendar day, not UTC day', () => {
    const now = new Date(2026, 7, 13, 10, 0, 0)
    const earlierSameLocalDay = new Date(2026, 7, 13, 1, 0, 0)
    const items = [
      makeItem('already-started', 'daily', { priority: 1 }),
      makeItem('still-fresh-a', 'daily', { priority: 2 }),
      makeItem('still-fresh-b', 'daily', { priority: 3 }),
    ]
    const tracks = createInitialTracks(items, now)
    const attempts = [makeAttempt(0, 'already-started', {
      reviewedAt: earlierSameLocalDay.toISOString(),
    })]

    const queue = buildDailyQueue(
      settings({
        coreMinutes: 10,
        newItemsPerDay: 2,
        contentMix: { daily: 1, business: 0, finance: 0, accounting: 0 },
      }),
      items,
      tracks,
      attempts,
      now,
      'core',
    )

    const freshQueued = new Set(
      queue
        .filter((task) => task.itemId === 'still-fresh-a' || task.itemId === 'still-fresh-b')
        .map((task) => task.itemId),
    )
    expect(freshQueued).toEqual(new Set(['still-fresh-a']))
  })
})

describe('adaptive target', () => {
  const item = makeItem('learned')
  const fresh = Array.from({ length: 10 }, (_, index) => makeItem(`fresh-${index}`))
  const allItems = [item, ...fresh]
  const tracks = [
    makeTrack('learned', 'receptive', { due: '2026-08-20T00:00:00.000Z' }),
    makeTrack('learned', 'productive', { due: '2026-08-20T00:00:00.000Z' }),
    ...createInitialTracks(fresh, NOW),
  ]

  it('reduces new material from delayed evidence and never raises the configured cap', () => {
    const initial = Array.from({ length: 10 }, (_, index) => makeAttempt(index, `word-${index}`, {
      reviewedAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString(),
    }))
    const strong = [...initial, ...Array.from({ length: 10 }, (_, index) => makeAttempt(index + 10, `word-${index}`, {
      evidenceVersion: 1, retryCount: 0, evaluationSource: 'rules', correctness: 'correct', matchKind: 'exact',
    }))]
    const weak = strong.map((attempt, index) => index >= 10 && index < 15
      ? { ...attempt, correctness: 'incorrect' as const } : attempt)
    const configured = settings({ coreMinutes: 30, newItemsPerDay: 6 })

    expect(getAdaptiveNewItemTarget(configured, allItems, tracks, weak, NOW)).toBe(3)
    expect(getAdaptiveNewItemTarget(configured, allItems, tracks, strong, NOW)).toBe(6)
  })

  it('pauses new material when due reviews consume the core budget', () => {
    const dueTracks = [
      makeTrack('learned', 'receptive', { due: '2026-08-09T00:00:00.000Z' }),
      makeTrack('learned', 'productive', { due: '2026-08-09T00:00:00.000Z' }),
      ...createInitialTracks(fresh, NOW),
    ]
    expect(buildDailyPlan({ settings: settings({ dailyMinutes: 1, newItemsPerDay: 6 }),
      items: allItems, tracks: dueTracks, attempts: [], timeEntries: [], now: NOW,
    }).newItemCount).toBe(0)
  })

  it.each([
    { total: 9, correct: 0, baseline: 5, target: 5 },
    { total: 10, correct: 6, baseline: 5, target: 2 },
    { total: 20, correct: 13, baseline: 5, target: 3 },
    { total: 10, correct: 8, baseline: 5, target: 5 },
    { total: 10, correct: 7, baseline: 1, target: 0 },
  ])('uses sample thresholds and integer rounding: %j', ({ total, correct, baseline, target }) => {
    const attempts = Array.from({ length: total }, (_, index) => [
      makeAttempt(index, `sample-${index}`, { reviewedAt: new Date(NOW.getTime() - 2 * 86_400_000).toISOString() }),
      makeAttempt(index + total, `sample-${index}`, { reviewedAt: NOW.toISOString(),
        evidenceVersion: 1, retryCount: 0, evaluationSource: 'rules',
        correctness: index < correct ? 'correct' : 'incorrect', matchKind: 'exact' }),
    ]).flat()
    expect(getAdaptiveNewItemTarget(settings({ newItemsPerDay: baseline }), allItems, tracks, attempts, NOW)).toBe(target)
  })
})

describe('buildDailyPlan', () => {
  it('shares recorded recall and application time across sessions and only grants explicit continuation', () => {
    const items = Array.from({ length: 20 }, (_, index) => makeItem(`fresh-${index}`))
    const tracks = createInitialTracks(items, NOW)
    const localDate = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`
    const input = { items, tracks, settings: settings({ dailyMinutes: 20, newItemsPerDay: 10 }), attempts: [], now: NOW,
      timeEntries: [
        { id: 'a', sessionId: 'a', localDate, activeMs: 8 * 60000, updatedAt: NOW.toISOString() },
        { id: 'b', sessionId: 'b', localDate, activeMs: 7 * 60000, updatedAt: NOW.toISOString() },
      ] }
    const plan = buildDailyPlan(input)
    expect(plan).toMatchObject({ usedMs: 15 * 60000, remainingMs: 5 * 60000, newItemCount: 3, totalTasks: 6, estimatedMinutes: 4.5 })
    expect(buildDailyPlan({ ...input, timeEntries: [], additionalMinutes: 5 }).remainingMs).toBe(5 * 60000)
    const exhausted = { ...input, timeEntries: [...input.timeEntries,
      { id: 'c', sessionId: 'c', localDate, activeMs: 5 * 60000, updatedAt: NOW.toISOString() }] }
    expect(buildDailyPlan(exhausted).tasks).toEqual([])
    expect(buildDailyPlan({ ...exhausted, additionalMinutes: 5 }).remainingMs).toBe(5 * 60000)
  })

  it('never refunds new-item allowance when an introduced word is paused', () => {
    const items = [makeItem('started', 'daily', { status: 'paused' }), makeItem('fresh')]
    const plan = buildDailyPlan({ items, tracks: createInitialTracks(items, NOW),
      settings: settings({ newItemsPerDay: 1 }), attempts: [makeAttempt(0, 'started')], timeEntries: [], now: NOW })
    expect(plan).toMatchObject({ introducedToday: 1, remainingNewItems: 0, newItemCount: 0, totalTasks: 0 })
  })

  it('schedules the unfinished direction of an introduced item even with a zero new-item cap', () => {
    const items = [makeItem('partial'), makeItem('fresh')]
    const tracks = createInitialTracks(items, NOW).map((track) => track.id === 'partial:productive'
      ? makeTrack('partial', 'productive', { due: '2026-08-20T00:00:00.000Z' }) : track)
    const plan = buildDailyPlan({ items, tracks, settings: settings({ newItemsPerDay: 0 }),
      attempts: [makeAttempt(0, 'partial')], timeEntries: [], now: NOW })
    expect(plan.tasks.map((task) => task.trackId)).toEqual(['partial:receptive'])
    expect(plan).toMatchObject({ newItemCount: 0, reviewTaskCount: 1, reviewItemCount: 1 })
  })

  it('does not add fresh tasks before due work when the due tasks share an item', () => {
    const items = [makeItem('due'), makeItem('fresh')]
    const tracks = [makeTrack('due', 'receptive'), makeTrack('due', 'productive'), ...createInitialTracks([items[1]], NOW)]
    const plan = buildDailyPlan({ items, tracks, settings: settings({ newItemsPerDay: 1 }),
      attempts: [], timeEntries: [], now: NOW })
    expect(plan.tasks.slice(0, 2).map((task) => task.itemId)).toEqual(['due', 'due'])
  })

  it('balances today’s newly introduced categories without importing previous days into the mix', () => {
    const items = [makeItem('old-daily'), makeItem('fresh-daily'), makeItem('fresh-business', 'business')]
    const tracks = [...createInitialTracks(items.slice(1), NOW),
      makeTrack('old-daily', 'receptive', { due: '2026-08-20T00:00:00.000Z' }),
      makeTrack('old-daily', 'productive', { due: '2026-08-20T00:00:00.000Z' })]
    const plan = buildDailyPlan({ items, tracks, settings: settings({ newItemsPerDay: 1,
      contentMix: { daily: 0.5, business: 0.5, finance: 0, accounting: 0 } }),
      attempts: [makeAttempt(0, 'old-daily', { reviewedAt: '2026-08-09T00:00:00.000Z' })], timeEntries: [], now: NOW })
    expect(new Set(plan.tasks.map((task) => task.itemId))).toEqual(new Set(['fresh-daily']))
  })

  it.each([
    { remainingMinutes: 1, selected: ['recall-a:receptive'], overflow: 2 },
    { remainingMinutes: 1.5, selected: ['recall-a:receptive', 'recall-b:productive'], overflow: 1 },
  ])('skips a usage task that does not fit and preserves the priority of smaller due tasks: %j', ({ remainingMinutes, selected, overflow }) => {
    const usage = makeItem('usage', 'daily', { usagePrompts: [{ id: 'usage-prompt', type: 'cloze',
      prompt: 'Use ___.', answer: 'usage', modelAnswer: 'Use usage.', checkpoints: ['usage'] }] })
    const items = [usage, makeItem('recall-a'), makeItem('recall-b'), makeItem('fresh')]
    const tracks = [
      makeTrack('usage', 'usage', { due: '2026-08-01T00:00:00.000Z' }),
      makeTrack('recall-a', 'receptive', { due: '2026-08-02T00:00:00.000Z' }),
      makeTrack('recall-b', 'productive', { due: '2026-08-03T00:00:00.000Z' }),
      ...createInitialTracks([items[3]], NOW),
    ]
    const localDate = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, '0')}-${String(NOW.getDate()).padStart(2, '0')}`
    const plan = buildDailyPlan({ items, tracks, settings: settings({ dailyMinutes: 5, newItemsPerDay: 1 }),
      attempts: [], timeEntries: [{ id: 'session', sessionId: 'session', localDate,
        activeMs: (5 - remainingMinutes) * 60000, updatedAt: NOW.toISOString() }], now: NOW })
    expect(plan.tasks.map((task) => task.trackId)).toEqual(selected)
    expect(plan.overflowDueCount).toBe(overflow)
    expect(plan.estimatedMinutes).toBe(selected.length * 0.75)
    expect(plan.newItemCount).toBe(0)
  })
})

describe('evidence-aware usage unlocking', () => {
  const item = makeItem('usage', 'daily', { usagePrompts: [{ id: 'p', type: 'sentence',
    prompt: 'Write a sentence', modelAnswer: 'usage', checkpoints: ['usage'] }] })
  const tracks = createInitialTracks([item], NOW)
  const attempts = (['receptive', 'productive'] as const).map((type, index) => makeAttempt(index, item.id, {
    trackId: `${item.id}:${type}`, trackType: type, evidenceVersion: 1, retryCount: 0,
    evaluationSource: 'rules', correctness: 'correct', matchKind: 'exact', rating: 'hard',
  }))
  it('unlocks from correct slow recall and does not accept self-rated or hinted success', () => {
    expect(unlockEligibleUsageTracks(tracks, NOW, attempts).find((track) => track.type === 'usage')?.unlocked).toBe(true)
    expect(unlockEligibleUsageTracks(tracks, NOW, attempts.map((attempt) => ({ ...attempt, hintLevel: 1 })))
      .find((track) => track.type === 'usage')?.unlocked).toBe(false)
  })
  it('preserves historical eligibility, but locks after a new explicit failure until recovery', () => {
    const unlocked = tracks.map((track) => ({ ...track, unlocked: true }))
    expect(unlockEligibleUsageTracks(unlocked, NOW, []).find((track) => track.type === 'usage')?.unlocked).toBe(true)
    const failed = [...attempts, makeAttempt(20, item.id, { reviewedAt: NOW.toISOString(),
      evidenceVersion: 1, retryCount: 0, evaluationSource: 'reveal', correctness: 'incorrect', hintLevel: 3 })]
    expect(unlockEligibleUsageTracks(unlocked, NOW, failed).find((track) => track.type === 'usage')?.unlocked).toBe(false)
  })
})

describe('review scheduling and retry placement', () => {
  it('maps the three UI ratings through FSRS and persists good timestamps', () => {
    const base = createInitialTracks([makeItem('word')], NOW)[0]
    const hard = scheduleReview(base, 'hard', NOW, 0.9)
    const good = scheduleReview(base, 'good', NOW, 0.9)

    expect(good.reps).toBe(1)
    expect(good.state).toBe(State.Review)
    expect(new Date(good.due).getTime()).toBeGreaterThan(NOW.getTime())
    expect(good.firstGoodAt).toBe(NOW.toISOString())
    expect(good.lastGoodAt).toBe(NOW.toISOString())
    expect(good.stability).toBeGreaterThan(hard.stability)
    expect(hard.firstGoodAt).toBeUndefined()

    const lapsedAt = new Date(good.due)
    const lapsed = scheduleReview(good, 'again', lapsedAt, 0.9)
    expect(lapsed.lapses).toBe(good.lapses + 1)
    expect(lapsed.lastReview).toBe(lapsedAt.toISOString())
    expect(lapsed.firstGoodAt).toBeUndefined()
    expect(lapsed.lastGoodAt).toBeUndefined()

    const recovered = scheduleReview(lapsed, 'good', new Date(lapsedAt.getTime() + 60_000), 0.9)
    expect(recovered.firstGoodAt).toBe(recovered.lastGoodAt)
    expect(recovered.firstGoodAt).not.toBe(good.firstGoodAt)
  })

  it('clears good timestamps after again, but not after hard', () => {
    const base = createInitialTracks([makeItem('word')], NOW)[0]
    const good = scheduleReview(base, 'good', NOW, 0.9)
    const later = new Date(NOW.getTime() + 8 * 24 * 60 * 60 * 1000)
    const solid = scheduleReview(good, 'good', later, 0.9)
    const hard = scheduleReview(solid, 'hard', new Date(later.getTime() + 60_000), 0.9)

    expect(solid.firstGoodAt).toBe(NOW.toISOString())
    expect(solid.lastGoodAt).toBe(later.toISOString())
    expect(hard.firstGoodAt).toBe(NOW.toISOString())
    expect(hard.lastGoodAt).toBe(later.toISOString())
    expect(hard.lastReview).toBe(new Date(later.getTime() + 60_000).toISOString())
  })

  it('re-locks usage after again removes core good timestamps', () => {
    const item = makeItem('usable', 'daily', {
      usagePrompts: [{
        id: 'prompt',
        type: 'sentence',
        prompt: 'Write a sentence.',
        modelAnswer: 'This is usable.',
        checkpoints: ['usable'],
      }],
    })
    const seeded = createInitialTracks([item], NOW).map((track) => (
      track.type === 'usage'
        ? { ...track, unlocked: true, firstGoodAt: NOW.toISOString(), lastGoodAt: NOW.toISOString() }
        : {
          ...track,
          firstGoodAt: NOW.toISOString(),
          lastGoodAt: NOW.toISOString(),
        }
    ))
    const afterAgain = scheduleReview(
      seeded.find((track) => track.type === 'receptive')!,
      'again',
      new Date(NOW.getTime() + 60_000),
      0.9,
    )
    const replaced = seeded.map((track) => track.id === afterAgain.id ? afterAgain : track)
    const synced = unlockEligibleUsageTracks(replaced, new Date(NOW.getTime() + 60_000))

    expect(synced.find((track) => track.type === 'usage')?.unlocked).toBe(false)
  })
})

describe('requeueFailedTask', () => {
  it('requeues a failed task after a gap without mutating the pending queue', () => {
    const failed = {
      id: 'failed',
      itemId: 'failed-item',
      trackId: 'failed-item:productive',
      trackType: 'productive' as const,
      isNew: false,
    }
    const pending = ['a', 'b', 'c'].map((itemId) => ({
      id: itemId,
      itemId,
      trackId: `${itemId}:receptive`,
      trackType: 'receptive' as const,
      isNew: false,
    }))

    const result = requeueFailedTask(pending, failed, 2)

    expect(pending).toHaveLength(3)
    expect(result[2]).toMatchObject({ itemId: 'failed-item', retryCount: 1 })
    expect(result[2].id).toBe('failed:retry:1')
  })
})
