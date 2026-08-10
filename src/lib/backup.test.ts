import 'fake-indexeddb/auto'

import { deleteDB } from 'idb'

import {
  DEFAULT_SETTINGS,
  type BackupV1,
  type LearningTrack,
  type ReviewAttempt,
  type Word,
} from '../domain/types'
import { ALL_VOCABULARY_LISTS, LIST_IDS } from '../data/vocabularyLists'
import {
  DATABASE_NAME,
  closeDatabase,
  getAllLearningTracks,
  getAllReviewAttempts,
  getAllVocabulary,
  getSettings,
  writeBatch,
} from './db'
import {
  BackupValidationError,
  exportBackup,
  importBackup,
  parseBackup,
  parseBackupV2,
  validateBackup,
  validateBackupV2,
} from './backup'

const older = '2026-08-09T00:00:00.000Z'
const newer = '2026-08-10T00:00:00.000Z'

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
    examples: [],
    collocations: ['current asset'],
    source: 'seed',
    priority: 1,
    status: 'active',
    usagePrompts: [],
    createdAt: older,
    updatedAt: older,
    ...overrides,
  }
}

function track(overrides: Partial<LearningTrack> = {}): LearningTrack {
  return {
    id: 'track-1',
    itemId: 'vocabulary-1',
    type: 'receptive',
    due: older,
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
    responseMs: 1_000,
    reviewedAt: newer,
    ...overrides,
  }
}

function backupV1(overrides: Partial<BackupV1> = {}): BackupV1 {
  return {
    version: 1,
    exportedAt: newer,
    vocabulary: [{
      ...word(),
      category: 'finance',
    }],
    tracks: [track()],
    attempts: [attempt()],
    settings: {
      ...DEFAULT_SETTINGS,
      contentMix: { daily: 0.4, finance: 0.35, business: 0.25, accounting: 0 },
    },
    ...overrides,
  }
}

describe('backup import and export', () => {
  beforeEach(async () => {
    await closeDatabase()
    await deleteDB(DATABASE_NAME)
  })

  afterEach(async () => {
    await closeDatabase()
    await deleteDB(DATABASE_NAME)
  })

  it('exports a validated V2 snapshot and records the backup time', async () => {
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
      settings: DEFAULT_SETTINGS,
    })

    const exported = await exportBackup(new Date(newer))

    expect(exported).toMatchObject({
      version: 2,
      exportedAt: newer,
      settings: { lastBackupAt: newer },
    })
    expect(exported.words).toHaveLength(1)
    expect(exported.memberships).toHaveLength(1)
    expect((await getSettings()).lastBackupAt).toBe(newer)
  })

  it('strictly rejects unknown or malformed fields before replacing stored data', async () => {
    await writeBatch({
      words: [word({ expression: 'keep me' })],
      lists: ALL_VOCABULARY_LISTS,
      memberships: [{
        id: 'membership-vocabulary-1-accounting',
        wordId: 'vocabulary-1',
        listId: LIST_IDS.accounting,
        priority: 1,
        sortOrder: 0,
      }],
    })
    const malformed = {
      ...backupV1(),
      tracks: [track({ itemId: 'missing-vocabulary' })],
      unexpected: true,
    }

    expect(() => parseBackup(JSON.stringify(malformed))).toThrow(BackupValidationError)
    await expect(importBackup(malformed)).rejects.toThrow('$.unexpected')
    expect(await getAllVocabulary()).toEqual([
      expect.objectContaining({ expression: 'keep me' }),
    ])
  })

  it('rejects malformed V2 backups before replacing stored data', async () => {
    await writeBatch({
      words: [word({ expression: 'keep me v2' })],
      lists: ALL_VOCABULARY_LISTS,
      memberships: [{
        id: 'membership-vocabulary-1-accounting',
        wordId: 'vocabulary-1',
        listId: LIST_IDS.accounting,
        priority: 1,
        sortOrder: 0,
      }],
    })

    const exported = await exportBackup()
    const malformedV2 = {
      ...exported,
      memberships: [{
        ...exported.memberships[0],
        wordId: 'missing-word',
      }],
    }

    expect(() => parseBackupV2(JSON.stringify(malformedV2))).toThrow(BackupValidationError)
    await expect(importBackup(malformedV2)).rejects.toThrow('引用了不存在的词条')
    expect(await getAllVocabulary()).toEqual([
      expect.objectContaining({ expression: 'keep me v2' }),
    ])
  })

  it('deduplicates the same sense while preserving different senses of one word', async () => {
    const duplicateVocabulary = {
      ...word(),
      id: 'vocabulary-duplicate',
      expression: ' Asset ',
      senseKey: 'FINANCE-NOUN-RESOURCE',
      zhGloss: '资产（更新）',
      updatedAt: newer,
      category: 'finance' as const,
    }
    const otherSense = {
      ...word(),
      id: 'vocabulary-other-sense',
      expression: 'asset',
      senseKey: 'useful-person-or-quality',
      zhGloss: '有用的人或品质',
      category: 'finance' as const,
    }
    const duplicateTrack = track({
      id: 'track-duplicate',
      itemId: 'vocabulary-duplicate',
    })
    const otherTrack = track({
      id: 'track-other',
      itemId: 'vocabulary-other-sense',
    })
    const duplicateAttempt = attempt({
      id: 'attempt-duplicate',
      trackId: 'track-duplicate',
      itemId: 'vocabulary-duplicate',
    })
    const otherAttempt = attempt({
      id: 'attempt-other',
      trackId: 'track-other',
      itemId: 'vocabulary-other-sense',
    })

    const summary = await importBackup(backupV1({
      vocabulary: [
        { ...word(), category: 'finance' },
        duplicateVocabulary,
        otherSense,
      ],
      tracks: [track(), duplicateTrack, otherTrack],
      attempts: [attempt(), duplicateAttempt, otherAttempt],
    }))

    expect(summary.vocabulary).toBe(2)
    expect(summary.tracks).toBe(2)
    expect(summary.duplicatesRemoved.vocabulary).toBe(1)
    expect(summary.duplicatesRemoved.tracks).toBe(1)
    expect(await getAllVocabulary()).toEqual([
      expect.objectContaining({
        id: 'vocabulary-1',
        zhGloss: '资产（更新）',
      }),
      expect.objectContaining({
        id: 'vocabulary-other-sense',
        zhGloss: '有用的人或品质',
      }),
    ])
    expect(await getAllLearningTracks()).toEqual([
      expect.objectContaining({ id: 'track-1', itemId: 'vocabulary-1' }),
      expect.objectContaining({ id: 'track-other', itemId: 'vocabulary-other-sense' }),
    ])
    expect(await getAllReviewAttempts()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'vocabulary-1' }),
        expect.objectContaining({ itemId: 'vocabulary-other-sense' }),
      ]),
    )
  })
})
