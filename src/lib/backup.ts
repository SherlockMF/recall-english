import {
  type BackupV1,
  type BackupV2,
  type HintLevel,
  type LearningTrack,
  type ListSlug,
  type ReviewAttempt,
  type ReviewRating,
  type TrackType,
  type UsagePrompt,
  type UserSettings,
  type VocabularyCategory,
  type VocabularyExample,
  type VocabularyItem,
  type VocabularyList,
  type VocabularySource,
  type VocabularyStatus,
  type Word,
  type WordListItem,
  normalizeLemma,
} from '../domain/types'
import { ALL_VOCABULARY_LISTS, listIdForSlug } from '../data/vocabularyLists'
import { listSlugsForSeedCategory } from '../data/listAssignment'
import {
  getUserDataSnapshot,
  putSettings,
  replaceUserData,
} from './db'

type UnknownRecord = Record<string, unknown>

export class BackupValidationError extends Error {
  readonly path: string

  constructor(path: string, message: string) {
    super(`${path}: ${message}`)
    this.name = 'BackupValidationError'
    this.path = path
  }
}

export interface BackupImportSummary {
  vocabulary: number
  tracks: number
  attempts: number
  duplicatesRemoved: {
    vocabulary: number
    tracks: number
    attempts: number
  }
}

function fail(path: string, message: string): never {
  throw new BackupValidationError(path, message)
}

function objectAt(
  value: unknown,
  path: string,
  allowedKeys: readonly string[],
): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(path, '必须是对象')
  }
  const record = value as UnknownRecord
  const allowed = new Set(allowedKeys)
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, '不支持的字段')
  }
  return record
}

function stringAt(value: unknown, path: string, nonEmpty = false): asserts value is string {
  if (typeof value !== 'string' || (nonEmpty && value.trim().length === 0)) {
    fail(path, nonEmpty ? '必须是非空字符串' : '必须是字符串')
  }
}

function optionalStringAt(value: unknown, path: string): asserts value is string | undefined {
  if (value !== undefined) stringAt(value, path)
}

function booleanAt(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') fail(path, '必须是布尔值')
}

function finiteNumberAt(
  value: unknown,
  path: string,
  options: { integer?: boolean; min?: number; max?: number } = {},
): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(path, '必须是有限数字')
  }
  if (options.integer && !Number.isInteger(value)) fail(path, '必须是整数')
  if (options.min !== undefined && value < options.min) {
    fail(path, `不能小于 ${options.min}`)
  }
  if (options.max !== undefined && value > options.max) {
    fail(path, `不能大于 ${options.max}`)
  }
}

function dateAt(value: unknown, path: string): asserts value is string {
  stringAt(value, path, true)
  if (!value.includes('T') || Number.isNaN(Date.parse(value))) {
    fail(path, '必须是有效的 ISO 日期时间')
  }
}

function optionalDateAt(value: unknown, path: string): asserts value is string | undefined {
  if (value !== undefined) dateAt(value, path)
}

function literalAt<T extends string | number>(
  value: unknown,
  path: string,
  values: readonly T[],
): asserts value is T {
  if (!values.includes(value as T)) fail(path, `必须是 ${values.join('、')} 之一`)
}

function arrayAt<T>(
  value: unknown,
  path: string,
  validate: (entry: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) fail(path, '必须是数组')
  const result: T[] = []
  for (let index = 0; index < value.length; index += 1) {
    result.push(validate(value[index], `${path}[${index}]`))
  }
  return result
}

function validateString(value: unknown, path: string): string {
  stringAt(value, path)
  return value
}

function validateExample(value: unknown, path: string): VocabularyExample {
  const record = objectAt(value, path, ['en', 'zh'])
  stringAt(record.en, `${path}.en`)
  stringAt(record.zh, `${path}.zh`)
  return record as unknown as VocabularyExample
}

function validateUsagePrompt(value: unknown, path: string): UsagePrompt {
  const record = objectAt(value, path, [
    'id',
    'type',
    'prompt',
    'answer',
    'modelAnswer',
    'checkpoints',
  ])
  stringAt(record.id, `${path}.id`, true)
  literalAt(record.type, `${path}.type`, ['cloze', 'sentence'] as const)
  stringAt(record.prompt, `${path}.prompt`)
  optionalStringAt(record.answer, `${path}.answer`)
  stringAt(record.modelAnswer, `${path}.modelAnswer`)
  arrayAt(record.checkpoints, `${path}.checkpoints`, validateString)
  return record as unknown as UsagePrompt
}

function validateVocabularyItem(value: unknown, path: string): BackupV1['vocabulary'][number] {
  const record = objectAt(value, path, [
    'id',
    'expression',
    'senseKey',
    'zhGloss',
    'enDefinition',
    'partOfSpeech',
    'acceptedZhAnswers',
    'acceptedEnVariants',
    'examples',
    'collocations',
    'category',
    'source',
    'priority',
    'status',
    'phonetic',
    'audioUrl',
    'ipaUk',
    'ipaUs',
    'audioUk',
    'audioUs',
    'lemma',
    'usagePrompts',
    'createdAt',
    'updatedAt',
  ])
  stringAt(record.id, `${path}.id`, true)
  stringAt(record.expression, `${path}.expression`, true)
  stringAt(record.senseKey, `${path}.senseKey`, true)
  stringAt(record.zhGloss, `${path}.zhGloss`)
  stringAt(record.enDefinition, `${path}.enDefinition`)
  stringAt(record.partOfSpeech, `${path}.partOfSpeech`)
  arrayAt(record.acceptedZhAnswers, `${path}.acceptedZhAnswers`, validateString)
  arrayAt(record.acceptedEnVariants, `${path}.acceptedEnVariants`, validateString)
  arrayAt(record.examples, `${path}.examples`, validateExample)
  arrayAt(record.collocations, `${path}.collocations`, validateString)
  literalAt(record.category, `${path}.category`, [
    'daily',
    'finance',
    'business',
    'accounting',
    'custom',
    'my-vocabulary',
  ] as const)
  literalAt(record.source, `${path}.source`, [
    'seed',
    'custom',
    'dictionary',
  ] as const satisfies readonly VocabularySource[])
  finiteNumberAt(record.priority, `${path}.priority`, { min: 0 })
  literalAt(record.status, `${path}.status`, [
    'active',
    'paused',
  ] as const satisfies readonly VocabularyStatus[])
  optionalStringAt(record.phonetic, `${path}.phonetic`)
  optionalStringAt(record.audioUrl, `${path}.audioUrl`)
  optionalStringAt(record.ipaUk, `${path}.ipaUk`)
  optionalStringAt(record.ipaUs, `${path}.ipaUs`)
  optionalStringAt(record.audioUk, `${path}.audioUk`)
  optionalStringAt(record.audioUs, `${path}.audioUs`)
  optionalStringAt(record.lemma, `${path}.lemma`)
  arrayAt(record.usagePrompts, `${path}.usagePrompts`, validateUsagePrompt)
  dateAt(record.createdAt, `${path}.createdAt`)
  dateAt(record.updatedAt, `${path}.updatedAt`)
  return record as unknown as BackupV1['vocabulary'][number]
}

function validateLearningTrack(value: unknown, path: string): LearningTrack {
  const record = objectAt(value, path, [
    'id',
    'itemId',
    'type',
    'due',
    'stability',
    'difficulty',
    'elapsedDays',
    'scheduledDays',
    'reps',
    'lapses',
    'state',
    'lastReview',
    'firstGoodAt',
    'lastGoodAt',
    'unlocked',
  ])
  stringAt(record.id, `${path}.id`, true)
  stringAt(record.itemId, `${path}.itemId`, true)
  literalAt(record.type, `${path}.type`, [
    'receptive',
    'productive',
    'usage',
  ] as const satisfies readonly TrackType[])
  dateAt(record.due, `${path}.due`)
  finiteNumberAt(record.stability, `${path}.stability`, { min: 0 })
  finiteNumberAt(record.difficulty, `${path}.difficulty`, { min: 0 })
  finiteNumberAt(record.elapsedDays, `${path}.elapsedDays`, { min: 0 })
  finiteNumberAt(record.scheduledDays, `${path}.scheduledDays`, { min: 0 })
  finiteNumberAt(record.reps, `${path}.reps`, { integer: true, min: 0 })
  finiteNumberAt(record.lapses, `${path}.lapses`, { integer: true, min: 0 })
  finiteNumberAt(record.state, `${path}.state`, { integer: true, min: 0 })
  optionalDateAt(record.lastReview, `${path}.lastReview`)
  optionalDateAt(record.firstGoodAt, `${path}.firstGoodAt`)
  optionalDateAt(record.lastGoodAt, `${path}.lastGoodAt`)
  booleanAt(record.unlocked, `${path}.unlocked`)
  return record as unknown as LearningTrack
}

function validateReviewAttempt(value: unknown, path: string): ReviewAttempt {
  const record = objectAt(value, path, [
    'id',
    'trackId',
    'itemId',
    'trackType',
    'promptType',
    'answer',
    'rating',
    'hintLevel',
    'responseMs',
    'reviewedAt',
    'wasOverride',
  ])
  stringAt(record.id, `${path}.id`, true)
  stringAt(record.trackId, `${path}.trackId`, true)
  stringAt(record.itemId, `${path}.itemId`, true)
  literalAt(record.trackType, `${path}.trackType`, [
    'receptive',
    'productive',
    'usage',
  ] as const satisfies readonly TrackType[])
  stringAt(record.promptType, `${path}.promptType`, true)
  stringAt(record.answer, `${path}.answer`)
  literalAt(record.rating, `${path}.rating`, [
    'again',
    'hard',
    'good',
  ] as const satisfies readonly ReviewRating[])
  literalAt(record.hintLevel, `${path}.hintLevel`, [
    0,
    1,
    2,
    3,
  ] as const satisfies readonly HintLevel[])
  finiteNumberAt(record.responseMs, `${path}.responseMs`, { min: 0 })
  dateAt(record.reviewedAt, `${path}.reviewedAt`)
  if (record.wasOverride !== undefined) {
    booleanAt(record.wasOverride, `${path}.wasOverride`)
  }
  return record as unknown as ReviewAttempt
}

function validateSettings(value: unknown, path: string): UserSettings {
  const record = objectAt(value, path, [
    'id',
    'coreMinutes',
    'extensionMinutes',
    'desiredRetention',
    'newItemsPerDay',
    'contentMix',
    'lastBackupAt',
  ])
  literalAt(record.id, `${path}.id`, ['primary'] as const)
  finiteNumberAt(record.coreMinutes, `${path}.coreMinutes`, { min: 0 })
  finiteNumberAt(record.extensionMinutes, `${path}.extensionMinutes`, { min: 0 })
  finiteNumberAt(record.desiredRetention, `${path}.desiredRetention`, {
    min: 0,
    max: 1,
  })
  finiteNumberAt(record.newItemsPerDay, `${path}.newItemsPerDay`, {
    integer: true,
    min: 0,
  })
  const contentMix = objectAt(record.contentMix, `${path}.contentMix`, [
    'daily',
    'finance',
    'business',
    'accounting',
  ])
  for (const category of ['daily', 'finance', 'business'] as const) {
    finiteNumberAt(contentMix[category], `${path}.contentMix.${category}`, {
      min: 0,
      max: 1,
    })
  }
  if (contentMix.accounting !== undefined) {
    finiteNumberAt(contentMix.accounting, `${path}.contentMix.accounting`, {
      min: 0,
      max: 1,
    })
  }
  const finance = contentMix.finance as number
  const accounting = (contentMix.accounting as number | undefined) ?? 0
  const mixTotal =
    (contentMix.daily as number) +
    finance +
    (contentMix.business as number) +
    accounting
  if (Math.abs(mixTotal - 1) > 0.001) {
    fail(`${path}.contentMix`, '内容占比之和必须为 1')
  }
  optionalDateAt(record.lastBackupAt, `${path}.lastBackupAt`)
  const normalizedAccounting = contentMix.accounting !== undefined
    ? (contentMix.accounting as number)
    : finance * 0.5
  const normalizedFinance = contentMix.accounting !== undefined
    ? finance
    : finance * 0.5
  return {
    ...(record as unknown as UserSettings),
    contentMix: {
      daily: contentMix.daily as number,
      business: contentMix.business as number,
      finance: normalizedFinance,
      accounting: normalizedAccounting,
    },
  }
}

export function validateBackup(value: unknown): asserts value is BackupV1 {
  const record = objectAt(value, '$', [
    'version',
    'exportedAt',
    'vocabulary',
    'tracks',
    'attempts',
    'settings',
  ])
  if (record.version !== 1) fail('$.version', '仅支持版本 1')
  dateAt(record.exportedAt, '$.exportedAt')
  arrayAt(record.vocabulary, '$.vocabulary', validateVocabularyItem)
  arrayAt(record.tracks, '$.tracks', validateLearningTrack)
  arrayAt(record.attempts, '$.attempts', validateReviewAttempt)
  validateSettings(record.settings, '$.settings')
}

function decodeBackup(input: unknown): unknown {
  if (typeof input !== 'string') return input
  try {
    return JSON.parse(input) as unknown
  } catch {
    fail('$', '不是有效的 JSON')
  }
}

function semanticPart(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function vocabularyIdentity(item: BackupV1['vocabulary'][number]): string {
  return `${semanticPart(item.expression)}\u0000${semanticPart(item.senseKey)}`
}

function preferVocabulary(
  left: BackupV1['vocabulary'][number],
  right: BackupV1['vocabulary'][number],
): BackupV1['vocabulary'][number] {
  return Date.parse(right.updatedAt) > Date.parse(left.updatedAt) ? right : left
}

function trackIdentity(track: LearningTrack): string {
  return `${track.itemId}\u0000${track.type}`
}

function preferTrack(left: LearningTrack, right: LearningTrack): LearningTrack {
  const leftReview = left.lastReview ? Date.parse(left.lastReview) : -1
  const rightReview = right.lastReview ? Date.parse(right.lastReview) : -1
  if (leftReview !== rightReview) return rightReview > leftReview ? right : left
  return right.reps > left.reps ? right : left
}

export function deduplicateBackup(backup: BackupV1): BackupV1 {
  const vocabulary: BackupV1['vocabulary'] = []
  const vocabularyByIdentity = new Map<string, { index: number; id: string }>()
  const vocabularyIdentityById = new Map<string, string>()
  const itemIdMap = new Map<string, string>()

  for (const item of backup.vocabulary) {
    const identity = vocabularyIdentity(item)
    const priorIdentity = vocabularyIdentityById.get(item.id)
    if (priorIdentity && priorIdentity !== identity) {
      fail('$.vocabulary', `词条 ID ${item.id} 指向了不同词义`)
    }
    vocabularyIdentityById.set(item.id, identity)

    const existing = vocabularyByIdentity.get(identity)
    if (!existing) {
      vocabularyByIdentity.set(identity, { index: vocabulary.length, id: item.id })
      itemIdMap.set(item.id, item.id)
      vocabulary.push(item)
      continue
    }

    itemIdMap.set(item.id, existing.id)
    const preferred = preferVocabulary(vocabulary[existing.index], item)
    vocabulary[existing.index] = { ...preferred, id: existing.id }
  }

  const canonicalItemIds = new Set(vocabulary.map((item) => item.id))
  const tracks: LearningTrack[] = []
  const trackByIdentity = new Map<string, { index: number; id: string }>()
  const trackIdentityById = new Map<string, string>()
  const trackIdMap = new Map<string, string>()

  for (const sourceTrack of backup.tracks) {
    const itemId = itemIdMap.get(sourceTrack.itemId) ?? sourceTrack.itemId
    if (!canonicalItemIds.has(itemId)) {
      fail('$.tracks', `学习轨道 ${sourceTrack.id} 引用了不存在的词条`)
    }
    const track = { ...sourceTrack, itemId }
    const identity = trackIdentity(track)
    const priorIdentity = trackIdentityById.get(track.id)
    if (priorIdentity && priorIdentity !== identity) {
      fail('$.tracks', `轨道 ID ${track.id} 指向了不同任务`)
    }
    trackIdentityById.set(track.id, identity)

    const existing = trackByIdentity.get(identity)
    if (!existing) {
      trackByIdentity.set(identity, { index: tracks.length, id: track.id })
      trackIdMap.set(track.id, track.id)
      tracks.push(track)
      continue
    }

    trackIdMap.set(track.id, existing.id)
    const preferred = preferTrack(tracks[existing.index], track)
    tracks[existing.index] = { ...preferred, id: existing.id, itemId }
  }

  const canonicalTracks = new Map(tracks.map((track) => [track.id, track]))
  const attempts: ReviewAttempt[] = []
  const attemptIndexById = new Map<string, number>()

  for (const sourceAttempt of backup.attempts) {
    const itemId = itemIdMap.get(sourceAttempt.itemId) ?? sourceAttempt.itemId
    const trackId = trackIdMap.get(sourceAttempt.trackId) ?? sourceAttempt.trackId
    const track = canonicalTracks.get(trackId)
    if (!track || !canonicalItemIds.has(itemId)) {
      fail('$.attempts', `复习记录 ${sourceAttempt.id} 引用了不存在的数据`)
    }
    if (track.itemId !== itemId || track.type !== sourceAttempt.trackType) {
      fail('$.attempts', `复习记录 ${sourceAttempt.id} 与学习轨道不一致`)
    }
    const attempt = { ...sourceAttempt, itemId, trackId }
    const existingIndex = attemptIndexById.get(attempt.id)
    if (existingIndex === undefined) {
      attemptIndexById.set(attempt.id, attempts.length)
      attempts.push(attempt)
      continue
    }

    const existing = attempts[existingIndex]
    if (
      existing.itemId !== attempt.itemId ||
      existing.trackId !== attempt.trackId ||
      existing.trackType !== attempt.trackType
    ) {
      fail('$.attempts', `复习记录 ID ${attempt.id} 指向了不同任务`)
    }
    if (Date.parse(attempt.reviewedAt) > Date.parse(existing.reviewedAt)) {
      attempts[existingIndex] = attempt
    }
  }

  return {
    ...backup,
    vocabulary,
    tracks,
    attempts,
  }
}

export function parseBackup(input: unknown): BackupV1 {
  const decoded = decodeBackup(input)
  validateBackup(decoded)
  return deduplicateBackup(decoded)
}

function stripHydrationFields(item: BackupV1['vocabulary'][number] | Word): Word {
  const record = item
  return {
    id: record.id,
    expression: record.expression,
    lemma: 'lemma' in record && record.lemma ? record.lemma : normalizeLemma(record.expression),
    senseKey: record.senseKey,
    zhGloss: record.zhGloss,
    enDefinition: record.enDefinition,
    partOfSpeech: record.partOfSpeech,
    acceptedZhAnswers: record.acceptedZhAnswers,
    acceptedEnVariants: record.acceptedEnVariants,
    examples: record.examples,
    collocations: record.collocations,
    source: record.source === 'dictionary' ? 'dictionary' : record.source === 'custom' ? 'custom' : 'seed',
    priority: record.priority,
    status: record.status,
    ipaUk: record.ipaUk,
    ipaUs: record.ipaUs,
    audioUk: record.audioUk,
    audioUs: record.audioUs,
    synonyms: record.synonyms,
    antonyms: record.antonyms,
    usagePrompts: record.usagePrompts,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}

function membershipsFromV1Vocabulary(
  items: BackupV1['vocabulary'],
): WordListItem[] {
  const memberships: WordListItem[] = []
  for (const [index, item] of items.entries()) {
    const category = String(item.category)
    let slugs: ListSlug[]
    if (category === 'my-vocabulary' || category === 'custom') {
      slugs = ['my-vocabulary']
    } else if (category === 'accounting') {
      slugs = ['accounting']
    } else if (category === 'daily' || category === 'business' || category === 'finance') {
      slugs = listSlugsForSeedCategory(category, item.expression)
    } else {
      slugs = ['my-vocabulary']
    }
    for (const [slugIndex, slug] of slugs.entries()) {
      memberships.push({
        id: `membership-${item.id}-${slug}`,
        wordId: item.id,
        listId: listIdForSlug(slug),
        priority: item.priority,
        sortOrder: index * 10 + slugIndex,
      })
    }
  }
  return memberships
}

export async function exportBackup(now = new Date()): Promise<BackupV2> {
  const snapshot = await getUserDataSnapshot()
  const exportedAt = now.toISOString()
  const settings: UserSettings = {
    ...snapshot.settings,
    contentMix: { ...snapshot.settings.contentMix },
    lastBackupAt: exportedAt,
  }
  await putSettings(settings)

  return {
    version: 2,
    exportedAt,
    words: snapshot.words,
    lists: snapshot.lists.length ? snapshot.lists : ALL_VOCABULARY_LISTS,
    memberships: snapshot.memberships,
    tracks: snapshot.tracks,
    attempts: snapshot.attempts,
    settings,
  }
}

export async function exportBackupJson(space = 2): Promise<string> {
  return JSON.stringify(await exportBackup(), null, space)
}

export async function importBackup(input: unknown): Promise<BackupImportSummary> {
  const decoded = decodeBackup(input) as { version?: number }
  if (decoded && typeof decoded === 'object' && decoded.version === 2) {
    const record = decoded as BackupV2
    await replaceUserData({
      words: record.words,
      lists: record.lists?.length ? record.lists : ALL_VOCABULARY_LISTS,
      memberships: record.memberships,
      tracks: record.tracks,
      attempts: record.attempts,
      settings: record.settings,
    })
    return {
      vocabulary: record.words.length,
      tracks: record.tracks.length,
      attempts: record.attempts.length,
      duplicatesRemoved: { vocabulary: 0, tracks: 0, attempts: 0 },
    }
  }

  validateBackup(decoded)
  const backup = deduplicateBackup(decoded as BackupV1)
  const words = backup.vocabulary.map((item) => stripHydrationFields(item))
  const memberships = membershipsFromV1Vocabulary(backup.vocabulary)
  await replaceUserData({
    words,
    lists: ALL_VOCABULARY_LISTS,
    memberships,
    tracks: backup.tracks,
    attempts: backup.attempts,
    settings: backup.settings,
  })

  return {
    vocabulary: backup.vocabulary.length,
    tracks: backup.tracks.length,
    attempts: backup.attempts.length,
    duplicatesRemoved: {
      vocabulary: (decoded as BackupV1).vocabulary.length - backup.vocabulary.length,
      tracks: (decoded as BackupV1).tracks.length - backup.tracks.length,
      attempts: (decoded as BackupV1).attempts.length - backup.attempts.length,
    },
  }
}
