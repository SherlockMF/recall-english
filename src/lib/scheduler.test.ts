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

  it('builds extension in usage, core-overflow, then at most three extra-item phases', () => {
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
      settings({ coreMinutes: 0.75, extensionMinutes: 10, newItemsPerDay: 2 }),
      items,
      tracks,
      [],
      NOW,
      'extension',
    )

    expect(queue[0]).toMatchObject({ itemId: 'usage-item', trackType: 'usage' })
    expect(queue[1]).toMatchObject({ itemId: 'due-b', trackType: 'receptive' })
    expect(queue.some((task) => task.itemId === 'due-a')).toBe(false)
    const extraTasks = queue.filter((task) => task.isNew)
    expect(new Set(extraTasks.map((task) => task.itemId)).size).toBe(3)
    expect(extraTasks).toHaveLength(6)
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

  it('reduces new material after a weak week and cautiously raises it after strong work', () => {
    const weak = Array.from({ length: 10 }, (_, index) => makeAttempt(index, 'learned', {
      rating: index < 5 ? 'again' : 'hard',
      hintLevel: index < 7 ? 2 : 1,
    }))
    const strong = Array.from({ length: 10 }, (_, index) => makeAttempt(index, 'learned'))
    const configured = settings({ coreMinutes: 30, newItemsPerDay: 6 })

    expect(getAdaptiveNewItemTarget(configured, allItems, tracks, weak, NOW)).toBe(3)
    expect(getAdaptiveNewItemTarget(configured, allItems, tracks, strong, NOW)).toBe(7)
  })

  it('pauses new material when due reviews consume the core budget', () => {
    const dueTracks = [
      makeTrack('learned', 'receptive', { due: '2026-08-09T00:00:00.000Z' }),
      makeTrack('learned', 'productive', { due: '2026-08-09T00:00:00.000Z' }),
      ...createInitialTracks(fresh, NOW),
    ]
    expect(getAdaptiveNewItemTarget(
      settings({ coreMinutes: 1, newItemsPerDay: 6 }),
      allItems,
      dueTracks,
      [],
      NOW,
    )).toBe(0)
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
  })

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
