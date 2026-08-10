import 'fake-indexeddb/auto'

import { deleteDB } from 'idb'

import {
  DEFAULT_SETTINGS,
  type DictionaryResult,
  type LearningTrack,
  type ReviewAttempt,
  type Word,
} from '../domain/types'
import { ALL_VOCABULARY_LISTS, LIST_IDS } from '../data/vocabularyLists'
import {
  DATABASE_NAME,
  clearDatabase,
  closeDatabase,
  deleteVocabularyItem,
  getAllLearningTracks,
  getAllReviewAttempts,
  getAllVocabulary,
  getDictionaryCache,
  getDueLearningTracks,
  getSettings,
  initializeDatabase,
  replaceUserData,
  setDictionaryCache,
  writeBatch,
} from './db'

const timestamp = '2026-08-10T00:00:00.000Z'

function word(overrides: Partial<Word> = {}): Word {
  return {
    id: 'vocabulary-1',
    expression: 'asset',
    lemma: 'asset',
    senseKey: 'finance-noun-resource',
    zhGloss: '资产',
    enDefinition: 'A resource with economic value.',
    partOfSpeech: 'noun',
    acceptedZhAnswers: ['资产'],
    acceptedEnVariants: ['asset'],
    examples: [{ en: 'Cash is a current asset.', zh: '现金是流动资产。' }],
    collocations: ['current asset'],
    source: 'seed',
    priority: 1,
    status: 'active',
    usagePrompts: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

function track(overrides: Partial<LearningTrack> = {}): LearningTrack {
  return {
    id: 'track-1',
    itemId: 'vocabulary-1',
    type: 'receptive',
    due: timestamp,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    unlocked: true,
    ...overrides,
  }
}

function attempt(overrides: Partial<ReviewAttempt> = {}): ReviewAttempt {
  return {
    id: 'attempt-1',
    trackId: 'track-1',
    itemId: 'vocabulary-1',
    trackType: 'receptive',
    promptType: 'definition',
    answer: '资产',
    rating: 'good',
    hintLevel: 0,
    responseMs: 1_200,
    reviewedAt: timestamp,
    ...overrides,
  }
}

describe('IndexedDB persistence', () => {
  beforeEach(async () => {
    await closeDatabase()
    await deleteDB(DATABASE_NAME)
  })

  afterEach(async () => {
    await closeDatabase()
    await deleteDB(DATABASE_NAME)
  })

  it('seeds only while the words store is empty', async () => {
    await initializeDatabase(
      [word()],
      [{
        id: 'membership-vocabulary-1-accounting',
        wordId: 'vocabulary-1',
        listId: LIST_IDS.accounting,
        priority: 1,
        sortOrder: 0,
      }],
      [track()],
    )

    await writeBatch({
      words: [word({ expression: 'asset (edited)' })],
    })
    await initializeDatabase(
      [word({ expression: 'replacement seed' })],
      [],
      [track({ id: 'replacement-track' })],
    )

    expect(await getAllVocabulary()).toEqual([
      expect.objectContaining({
        expression: 'asset (edited)',
        listSlugs: ['accounting'],
        category: 'accounting',
      }),
    ])
    expect(await getAllLearningTracks()).toHaveLength(1)
    expect(await getSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('writes related records in a batch and queries due tracks', async () => {
    await writeBatch({
      words: [word()],
      lists: ALL_VOCABULARY_LISTS,
      memberships: [{
        id: 'membership-vocabulary-1-accounting',
        wordId: 'vocabulary-1',
        listId: LIST_IDS.accounting,
        priority: 1,
        sortOrder: 0,
      }],
      tracks: [track()],
      attempts: [attempt()],
      settings: { ...DEFAULT_SETTINGS, newItemsPerDay: 8 },
    })

    expect(await getAllVocabulary()).toHaveLength(1)
    expect(await getAllLearningTracks()).toHaveLength(1)
    expect(await getAllReviewAttempts()).toEqual([attempt()])
    expect(await getDueLearningTracks('2026-08-10T12:00:00.000Z')).toEqual([track()])
    expect((await getSettings()).newItemsPerDay).toBe(8)

    await deleteVocabularyItem('vocabulary-1')
    expect(await getAllVocabulary()).toEqual([])
    expect(await getAllLearningTracks()).toEqual([])
    expect(await getAllReviewAttempts()).toEqual([])
  })

  it('keeps dictionaryCache separate from words and user-data replacement', async () => {
    const result: DictionaryResult = {
      query: 'Asset',
      word: 'asset',
      meanings: [
        {
          partOfSpeech: 'noun',
          definition: 'A resource with economic value.',
          synonyms: [],
        },
      ],
      fetchedAt: timestamp,
    }
    await setDictionaryCache('  AsSeT ', result, timestamp)

    expect(await getDictionaryCache('asset')).toEqual({
      query: 'asset',
      result,
      cachedAt: timestamp,
    })

    await replaceUserData({
      words: [word()],
      lists: ALL_VOCABULARY_LISTS,
      memberships: [{
        id: 'membership-vocabulary-1-accounting',
        wordId: 'vocabulary-1',
        listId: LIST_IDS.accounting,
        priority: 1,
        sortOrder: 0,
      }],
      tracks: [track()],
      attempts: [attempt()],
      settings: DEFAULT_SETTINGS,
    })
    expect(await getDictionaryCache('ASSET')).toBeDefined()
    expect(await getAllVocabulary()).toHaveLength(1)

    await clearDatabase()
    expect(await getAllVocabulary()).toEqual([])
    expect(await getDictionaryCache('asset')).toBeUndefined()
  })
})
