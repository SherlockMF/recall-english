import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
} from 'idb'

import { ALL_VOCABULARY_LISTS, listIdForSlug } from '../data/vocabularyLists'
import {
  DEFAULT_SETTINGS,
  hydrateWord,
  normalizeLemma,
  primaryListSlug,
  type DictionaryCache,
  type DictionaryResult,
  type LearningTrack,
  type ListSlug,
  type ReviewAttempt,
  type SystemListSlug,
  type TrackType,
  type UserSettings,
  type VocabularyItem,
  type VocabularyList,
  type VocabularyStatus,
  type Word,
  type WordListItem,
} from '../domain/types'

export const DATABASE_NAME = 'recall-english'
export const DATABASE_VERSION = 2

export interface RecallEnglishDatabase extends DBSchema {
  words: {
    key: string
    value: Word
    indexes: {
      'by-expression': string
      'by-lemma': string
      'by-status': VocabularyStatus
    }
  }
  vocabularyLists: {
    key: string
    value: VocabularyList
    indexes: {
      'by-slug': string
    }
  }
  wordListItems: {
    key: string
    value: WordListItem
    indexes: {
      'by-word': string
      'by-list': string
    }
  }
  tracks: {
    key: string
    value: LearningTrack
    indexes: {
      'by-item': string
      'by-due': string
      'by-type': TrackType
    }
  }
  attempts: {
    key: string
    value: ReviewAttempt
    indexes: {
      'by-item': string
      'by-track': string
      'by-reviewed-at': string
    }
  }
  settings: {
    key: UserSettings['id']
    value: UserSettings
  }
  dictionaryCache: {
    key: string
    value: DictionaryCache
    indexes: {
      'by-cached-at': string
    }
  }
}

export interface DatabaseBatch {
  words?: Word[]
  lists?: VocabularyList[]
  memberships?: WordListItem[]
  deleteMembershipIds?: string[]
  tracks?: LearningTrack[]
  attempts?: ReviewAttempt[]
  settings?: UserSettings
  dictionaryCache?: DictionaryCache[]
}

export interface UserDataSnapshot {
  words: Word[]
  lists: VocabularyList[]
  memberships: WordListItem[]
  vocabulary: VocabularyItem[]
  tracks: LearningTrack[]
  attempts: ReviewAttempt[]
  settings: UserSettings
}

let databasePromise: Promise<IDBPDatabase<RecallEnglishDatabase>> | undefined

function createDefaultSettings(): UserSettings {
  return {
    ...DEFAULT_SETTINGS,
    contentMix: { ...DEFAULT_SETTINGS.contentMix },
  }
}

export function normalizeDictionaryQuery(query: string): string {
  return query.trim().toLocaleLowerCase('en-US')
}

function normalizeContentMix(raw: Record<string, number> | undefined): Record<SystemListSlug, number> {
  const defaults = DEFAULT_SETTINGS.contentMix
  if (!raw) return { ...defaults }
  const daily = Number(raw.daily)
  const business = Number(raw.business)
  const finance = Number(raw.finance)
  const accounting = Number(raw.accounting)
  const legacyFinance = Number.isFinite(finance) ? finance : defaults.finance
  return {
    daily: Number.isFinite(daily) ? daily : defaults.daily,
    business: Number.isFinite(business) ? business : defaults.business,
    finance: Number.isFinite(finance) ? finance : legacyFinance * 0.5,
    accounting: Number.isFinite(accounting) ? accounting : legacyFinance * 0.5,
  }
}

function migrateLegacyVocabularyRecord(raw: Record<string, unknown>): Word {
  const expression = String(raw.expression ?? '')
  return {
    id: String(raw.id),
    expression,
    lemma: typeof raw.lemma === 'string' && raw.lemma ? raw.lemma : normalizeLemma(expression),
    senseKey: String(raw.senseKey ?? ''),
    zhGloss: String(raw.zhGloss ?? ''),
    enDefinition: String(raw.enDefinition ?? ''),
    partOfSpeech: String(raw.partOfSpeech ?? 'expression'),
    acceptedZhAnswers: Array.isArray(raw.acceptedZhAnswers)
      ? raw.acceptedZhAnswers.map(String)
      : [],
    acceptedEnVariants: Array.isArray(raw.acceptedEnVariants)
      ? raw.acceptedEnVariants.map(String)
      : [],
    examples: Array.isArray(raw.examples)
      ? (raw.examples as Word['examples'])
      : [],
    collocations: Array.isArray(raw.collocations) ? raw.collocations.map(String) : [],
    source: raw.source === 'custom' || raw.source === 'dictionary' ? raw.source : 'seed',
    priority: Number(raw.priority) || 1,
    status: raw.status === 'paused' ? 'paused' : 'active',
    ipaUk: typeof raw.ipaUk === 'string' ? raw.ipaUk : undefined,
    ipaUs: typeof raw.ipaUs === 'string' ? raw.ipaUs : undefined,
    audioUk: typeof raw.audioUk === 'string' ? raw.audioUk : undefined,
    audioUs: typeof raw.audioUs === 'string' ? raw.audioUs : undefined,
    synonyms: Array.isArray(raw.synonyms) ? raw.synonyms.map(String) : undefined,
    antonyms: Array.isArray(raw.antonyms) ? raw.antonyms.map(String) : undefined,
    usagePrompts: Array.isArray(raw.usagePrompts)
      ? (raw.usagePrompts as Word['usagePrompts'])
      : [],
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    updatedAt: String(raw.updatedAt ?? new Date().toISOString()),
  }
}

function legacyCategoryToSlugs(category: unknown, expression: string): ListSlug[] {
  if (category === 'daily') return ['daily']
  if (category === 'business') return ['business']
  if (category === 'custom' || category === 'my-vocabulary') return ['my-vocabulary']
  if (category === 'accounting') return ['accounting']
  if (category === 'finance') {
    // Deferred import avoided — duplicate minimal split for upgrade path
    const key = expression.trim().toLocaleLowerCase('en-US')
    const accountingOnly = new Set([
      'asset', 'liability', 'revenue', 'expense', 'profit', 'loss',
      'accounts receivable', 'accounts payable', 'inventory', 'depreciation',
      'amortisation', 'accrual', 'prepayment', 'provision', 'impairment',
      'carrying amount', 'fair value', 'historical cost', 'materiality',
      'going concern', 'double-entry bookkeeping', 'debit', 'credit',
      'journal entry', 'general ledger', 'trial balance', 'financial statements',
      'statement of financial position', 'income statement', 'statement of cash flows',
      'retained earnings', 'share capital', 'cost of sales', 'gross profit',
      'operating profit', 'net profit', 'current ratio', 'interest expense',
      'budget', 'forecast', 'variance', 'break-even point', 'fixed cost',
      'variable cost', 'contribution margin', 'overhead', 'audit', 'auditor',
      'audit evidence', 'internal control', 'reconciliation', 'tax liability',
      'deferred tax', 'IFRS', 'recognition', 'measurement', 'disclosure',
    ])
    const both = new Set([
      'equity', 'cash flow', 'dividend', 'working capital', 'liquidity', 'solvency', 'leverage',
    ])
    if (both.has(key)) return ['finance', 'accounting']
    if (accountingOnly.has(key)) return ['accounting']
    return ['finance']
  }
  return ['my-vocabulary']
}

async function migrateV1ToV2(
  database: IDBPDatabase<RecallEnglishDatabase>,
  transaction: IDBPTransaction<
    RecallEnglishDatabase,
    ('words' | 'vocabularyLists' | 'wordListItems' | 'settings')[],
    'versionchange'
  >,
): Promise<void> {
  // Legacy v1 store is outside the typed v2 schema.
  const untypedDb = database as unknown as {
    objectStoreNames: DOMStringList
    deleteObjectStore: (name: string) => void
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyTx = transaction as any
  if (!legacyTx.objectStoreNames.contains('vocabulary')) return

  const vocabularyStore = legacyTx.objectStore('vocabulary')
  const legacyItems: Record<string, unknown>[] = await vocabularyStore.getAll()
  const wordStore = transaction.objectStore('words')
  const membershipStore = transaction.objectStore('wordListItems')
  const listStore = transaction.objectStore('vocabularyLists')

  for (const list of ALL_VOCABULARY_LISTS) {
    await listStore.put(list)
  }

  for (const raw of legacyItems) {
    const word = migrateLegacyVocabularyRecord(raw)
    await wordStore.put(word)
    const slugs = legacyCategoryToSlugs(raw.category, word.expression)
    for (const [index, slug] of slugs.entries()) {
      await membershipStore.put({
        id: `membership-${word.id}-${slug}`,
        wordId: word.id,
        listId: listIdForSlug(slug),
        priority: word.priority,
        sortOrder: index,
      })
    }
  }

  if (legacyTx.objectStoreNames.contains('settings')) {
    const settingsStore = legacyTx.objectStore('settings')
    const settings = await settingsStore.get('primary')
    if (settings) {
      await transaction.objectStore('settings').put({
        ...settings,
        contentMix: normalizeContentMix(settings.contentMix),
      })
    }
  }

  untypedDb.deleteObjectStore('vocabulary')
}

function createStores(
  database: IDBPDatabase<RecallEnglishDatabase>,
  oldVersion: number,
): void {
  if (oldVersion < 1) {
    // Fresh installs historically created these in v1; keep for completeness when jumping to v2.
  }

  if (!database.objectStoreNames.contains('tracks')) {
    const store = database.createObjectStore('tracks', { keyPath: 'id' })
    store.createIndex('by-item', 'itemId')
    store.createIndex('by-due', 'due')
    store.createIndex('by-type', 'type')
  }

  if (!database.objectStoreNames.contains('attempts')) {
    const store = database.createObjectStore('attempts', { keyPath: 'id' })
    store.createIndex('by-item', 'itemId')
    store.createIndex('by-track', 'trackId')
    store.createIndex('by-reviewed-at', 'reviewedAt')
  }

  if (!database.objectStoreNames.contains('settings')) {
    database.createObjectStore('settings', { keyPath: 'id' })
  }

  if (!database.objectStoreNames.contains('dictionaryCache')) {
    const store = database.createObjectStore('dictionaryCache', { keyPath: 'query' })
    store.createIndex('by-cached-at', 'cachedAt')
  }

  if (!database.objectStoreNames.contains('words')) {
    const store = database.createObjectStore('words', { keyPath: 'id' })
    store.createIndex('by-expression', 'expression')
    store.createIndex('by-lemma', 'lemma')
    store.createIndex('by-status', 'status')
  }

  if (!database.objectStoreNames.contains('vocabularyLists')) {
    const store = database.createObjectStore('vocabularyLists', { keyPath: 'id' })
    store.createIndex('by-slug', 'slug')
  }

  if (!database.objectStoreNames.contains('wordListItems')) {
    const store = database.createObjectStore('wordListItems', { keyPath: 'id' })
    store.createIndex('by-word', 'wordId')
    store.createIndex('by-list', 'listId')
  }
}

export function getDatabase(): Promise<IDBPDatabase<RecallEnglishDatabase>> {
  if (!databasePromise) {
    databasePromise = openDB<RecallEnglishDatabase>(DATABASE_NAME, DATABASE_VERSION, {
      async upgrade(database, oldVersion, _newVersion, transaction) {
        if (oldVersion < 1) {
          // Create legacy vocabulary only if we somehow open empty DB as v1 path — skip, go straight to v2 stores.
        }

        if (oldVersion === 1 && !database.objectStoreNames.contains('words')) {
          // Ensure v1 stores exist before migration helpers run (already present on real v1 DBs).
        }

        if (oldVersion < 1) {
          createStores(database, oldVersion)
          // Brand-new: also create temporary empty path — words already created.
        } else if (oldVersion < 2) {
          createStores(database, oldVersion)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await migrateV1ToV2(database, transaction as any)
        } else {
          createStores(database, oldVersion)
        }
      },
    })
    databasePromise.catch(() => {
      databasePromise = undefined
    })
  }

  return databasePromise
}

export async function initializeDatabase(
  seedWords: Word[] = [],
  seedMemberships: WordListItem[] = [],
  seedTracks: LearningTrack[] = [],
  settings: UserSettings = createDefaultSettings(),
  seedLists: VocabularyList[] = ALL_VOCABULARY_LISTS,
): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    ['words', 'vocabularyLists', 'wordListItems', 'tracks', 'settings'],
    'readwrite',
  )
  const wordStore = transaction.objectStore('words')
  const listStore = transaction.objectStore('vocabularyLists')
  const membershipStore = transaction.objectStore('wordListItems')

  for (const list of seedLists) {
    if (!(await listStore.get(list.id))) {
      await listStore.put(list)
    }
  }

  if ((await wordStore.count()) === 0) {
    for (const word of seedWords) {
      await wordStore.put(word)
    }
    for (const membership of seedMemberships) {
      await membershipStore.put(membership)
    }
    const trackStore = transaction.objectStore('tracks')
    for (const track of seedTracks) {
      await trackStore.put(track)
    }
  }

  const settingsStore = transaction.objectStore('settings')
  const existingSettings = await settingsStore.get('primary')
  if (!existingSettings) {
    await settingsStore.put(settings)
  } else {
    await settingsStore.put({
      ...existingSettings,
      contentMix: normalizeContentMix(existingSettings.contentMix),
    })
  }

  await transaction.done
}

function slugByListId(lists: VocabularyList[]): Map<string, ListSlug> {
  return new Map(lists.map((list) => [list.id, list.slug]))
}

export function hydrateWords(
  words: Word[],
  memberships: WordListItem[],
  lists: VocabularyList[],
): VocabularyItem[] {
  const listMap = slugByListId(lists)
  const byWord = new Map<string, ListSlug[]>()
  const noteByWord = new Map<string, string>()
  for (const membership of memberships) {
    const slug = listMap.get(membership.listId)
    if (!slug) continue
    const current = byWord.get(membership.wordId) ?? []
    if (!current.includes(slug)) current.push(slug)
    byWord.set(membership.wordId, current)
    const note = membership.subcategory?.trim()
    if (note && !noteByWord.has(membership.wordId)) {
      noteByWord.set(membership.wordId, note)
    }
  }
  return words.map((word) => hydrateWord(word, byWord.get(word.id) ?? [], noteByWord.get(word.id)))
}

export async function getWord(id: string): Promise<Word | undefined> {
  return (await getDatabase()).get('words', id)
}

export async function getAllWords(): Promise<Word[]> {
  return (await getDatabase()).getAll('words')
}

export async function getWordsByStatus(status: VocabularyStatus): Promise<Word[]> {
  return (await getDatabase()).getAllFromIndex('words', 'by-status', status)
}

export async function putWord(word: Word): Promise<void> {
  await (await getDatabase()).put('words', word)
}

export async function putWords(words: Word[]): Promise<void> {
  await writeBatch({ words })
}

export async function getAllVocabularyLists(): Promise<VocabularyList[]> {
  return (await getDatabase()).getAll('vocabularyLists')
}

export async function putVocabularyList(list: VocabularyList): Promise<void> {
  await (await getDatabase()).put('vocabularyLists', list)
}

export async function getAllWordListItems(): Promise<WordListItem[]> {
  return (await getDatabase()).getAll('wordListItems')
}

export async function getWordListItemsForWord(wordId: string): Promise<WordListItem[]> {
  return (await getDatabase()).getAllFromIndex('wordListItems', 'by-word', wordId)
}

export async function getWordListItemsForList(listId: string): Promise<WordListItem[]> {
  return (await getDatabase()).getAllFromIndex('wordListItems', 'by-list', listId)
}

export async function putWordListItem(item: WordListItem): Promise<void> {
  await (await getDatabase()).put('wordListItems', item)
}

export async function deleteWordListItem(id: string): Promise<void> {
  await (await getDatabase()).delete('wordListItems', id)
}

export async function isWordInList(wordId: string, listId: string): Promise<boolean> {
  const items = await getWordListItemsForWord(wordId)
  return items.some((item) => item.listId === listId)
}

export async function addWordToList(
  wordId: string,
  listSlug: ListSlug,
  priority = 1,
): Promise<WordListItem> {
  const listId = listIdForSlug(listSlug)
  const existing = await getWordListItemsForWord(wordId)
  const found = existing.find((item) => item.listId === listId)
  if (found) return found
  const membership: WordListItem = {
    id: `membership-${wordId}-${listSlug}`,
    wordId,
    listId,
    priority,
    sortOrder: existing.length,
  }
  await putWordListItem(membership)
  return membership
}

/** @deprecated Use getWord */
export async function getVocabularyItem(id: string): Promise<VocabularyItem | undefined> {
  const snapshot = await getUserDataSnapshot()
  return snapshot.vocabulary.find((item) => item.id === id)
}

/** @deprecated Use getAllWords + hydrate */
export async function getAllVocabulary(): Promise<VocabularyItem[]> {
  return (await getUserDataSnapshot()).vocabulary
}

/** @deprecated Use putWord */
export async function putVocabularyItem(item: VocabularyItem | Word): Promise<void> {
  const { listSlugs: _listSlugs, category: _category, ...word } = item as VocabularyItem
  await putWord(word)
}

export async function putVocabularyItems(items: Array<VocabularyItem | Word>): Promise<void> {
  await writeBatch({
    words: items.map((item) => {
      const { listSlugs: _a, category: _b, ...word } = item as VocabularyItem
      return word
    }),
  })
}

export async function deleteVocabularyItem(id: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    ['words', 'wordListItems', 'tracks', 'attempts'],
    'readwrite',
  )
  const trackStore = transaction.objectStore('tracks')
  const attemptStore = transaction.objectStore('attempts')
  const membershipStore = transaction.objectStore('wordListItems')
  const [trackIds, attemptIds, membershipIds] = await Promise.all([
    trackStore.index('by-item').getAllKeys(id),
    attemptStore.index('by-item').getAllKeys(id),
    membershipStore.index('by-word').getAllKeys(id),
  ])
  await Promise.all([
    transaction.objectStore('words').delete(id),
    ...trackIds.map((trackId) => trackStore.delete(trackId)),
    ...attemptIds.map((attemptId) => attemptStore.delete(attemptId)),
    ...membershipIds.map((membershipId) => membershipStore.delete(membershipId)),
  ])
  await transaction.done
}

export async function getLearningTrack(id: string): Promise<LearningTrack | undefined> {
  return (await getDatabase()).get('tracks', id)
}

export async function getAllLearningTracks(): Promise<LearningTrack[]> {
  return (await getDatabase()).getAll('tracks')
}

export async function getLearningTracksForItem(itemId: string): Promise<LearningTrack[]> {
  return (await getDatabase()).getAllFromIndex('tracks', 'by-item', itemId)
}

export async function getDueLearningTracks(dueBefore: string): Promise<LearningTrack[]> {
  return (await getDatabase()).getAllFromIndex(
    'tracks',
    'by-due',
    IDBKeyRange.upperBound(dueBefore),
  )
}

export async function putLearningTrack(track: LearningTrack): Promise<void> {
  await (await getDatabase()).put('tracks', track)
}

export async function putLearningTracks(tracks: LearningTrack[]): Promise<void> {
  await writeBatch({ tracks })
}

export async function deleteLearningTrack(id: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(['tracks', 'attempts'], 'readwrite')
  const attemptStore = transaction.objectStore('attempts')
  const attemptIds = await attemptStore.index('by-track').getAllKeys(id)
  await Promise.all([
    transaction.objectStore('tracks').delete(id),
    ...attemptIds.map((attemptId) => attemptStore.delete(attemptId)),
  ])
  await transaction.done
}

export async function getReviewAttempt(id: string): Promise<ReviewAttempt | undefined> {
  return (await getDatabase()).get('attempts', id)
}

export async function getAllReviewAttempts(): Promise<ReviewAttempt[]> {
  return (await getDatabase()).getAll('attempts')
}

export async function getReviewAttemptsForItem(itemId: string): Promise<ReviewAttempt[]> {
  return (await getDatabase()).getAllFromIndex('attempts', 'by-item', itemId)
}

export async function putReviewAttempt(attempt: ReviewAttempt): Promise<void> {
  await (await getDatabase()).put('attempts', attempt)
}

export async function putReviewAttempts(attempts: ReviewAttempt[]): Promise<void> {
  await writeBatch({ attempts })
}

export async function deleteReviewAttempt(id: string): Promise<void> {
  await (await getDatabase()).delete('attempts', id)
}

export async function getSettings(): Promise<UserSettings> {
  const stored = await (await getDatabase()).get('settings', 'primary')
  if (!stored) return createDefaultSettings()
  return {
    ...stored,
    contentMix: normalizeContentMix(stored.contentMix),
  }
}

export async function putSettings(settings: UserSettings): Promise<void> {
  await (await getDatabase()).put('settings', {
    ...settings,
    contentMix: normalizeContentMix(settings.contentMix),
  })
}

export async function getDictionaryCache(
  query: string,
): Promise<DictionaryCache | undefined> {
  const normalizedQuery = normalizeDictionaryQuery(query)
  if (!normalizedQuery) return undefined
  return (await getDatabase()).get('dictionaryCache', normalizedQuery)
}

export async function setDictionaryCache(
  query: string,
  result: DictionaryResult,
  cachedAt = new Date().toISOString(),
): Promise<void> {
  const normalizedQuery = normalizeDictionaryQuery(query)
  if (!normalizedQuery) return
  await (await getDatabase()).put('dictionaryCache', {
    query: normalizedQuery,
    result,
    cachedAt,
  })
}

export async function deleteDictionaryCache(query: string): Promise<void> {
  const normalizedQuery = normalizeDictionaryQuery(query)
  if (!normalizedQuery) return
  await (await getDatabase()).delete('dictionaryCache', normalizedQuery)
}

export async function clearDictionaryCache(): Promise<void> {
  await (await getDatabase()).clear('dictionaryCache')
}

export async function writeBatch(batch: DatabaseBatch): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    [
      'words',
      'vocabularyLists',
      'wordListItems',
      'tracks',
      'attempts',
      'settings',
      'dictionaryCache',
    ],
    'readwrite',
  )

  for (const word of batch.words ?? []) {
    await transaction.objectStore('words').put(word)
  }
  for (const list of batch.lists ?? []) {
    await transaction.objectStore('vocabularyLists').put(list)
  }
  for (const membership of batch.memberships ?? []) {
    await transaction.objectStore('wordListItems').put(membership)
  }
  for (const membershipId of batch.deleteMembershipIds ?? []) {
    await transaction.objectStore('wordListItems').delete(membershipId)
  }
  for (const track of batch.tracks ?? []) {
    await transaction.objectStore('tracks').put(track)
  }
  for (const attempt of batch.attempts ?? []) {
    await transaction.objectStore('attempts').put(attempt)
  }
  if (batch.settings) {
    await transaction.objectStore('settings').put({
      ...batch.settings,
      contentMix: normalizeContentMix(batch.settings.contentMix),
    })
  }
  for (const cacheEntry of batch.dictionaryCache ?? []) {
    const query = normalizeDictionaryQuery(cacheEntry.query)
    if (query) {
      await transaction.objectStore('dictionaryCache').put({
        ...cacheEntry,
        query,
      })
    }
  }

  await transaction.done
}

export async function getUserDataSnapshot(): Promise<UserDataSnapshot> {
  const database = await getDatabase()
  const transaction = database.transaction(
    ['words', 'vocabularyLists', 'wordListItems', 'tracks', 'attempts', 'settings'],
    'readonly',
  )
  const [words, lists, memberships, tracks, attempts, storedSettings] = await Promise.all([
    transaction.objectStore('words').getAll(),
    transaction.objectStore('vocabularyLists').getAll(),
    transaction.objectStore('wordListItems').getAll(),
    transaction.objectStore('tracks').getAll(),
    transaction.objectStore('attempts').getAll(),
    transaction.objectStore('settings').get('primary'),
  ])
  await transaction.done

  const ensuredLists = lists.length > 0 ? lists : ALL_VOCABULARY_LISTS
  const settings = storedSettings
    ? { ...storedSettings, contentMix: normalizeContentMix(storedSettings.contentMix) }
    : createDefaultSettings()

  return {
    words,
    lists: ensuredLists,
    memberships,
    vocabulary: hydrateWords(words, memberships, ensuredLists),
    tracks,
    attempts,
    settings,
  }
}

export async function replaceUserData(data: {
  words: Word[]
  lists: VocabularyList[]
  memberships: WordListItem[]
  tracks: LearningTrack[]
  attempts: ReviewAttempt[]
  settings: UserSettings
}): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    ['words', 'vocabularyLists', 'wordListItems', 'tracks', 'attempts', 'settings'],
    'readwrite',
  )
  const wordStore = transaction.objectStore('words')
  const listStore = transaction.objectStore('vocabularyLists')
  const membershipStore = transaction.objectStore('wordListItems')
  const trackStore = transaction.objectStore('tracks')
  const attemptStore = transaction.objectStore('attempts')
  const settingsStore = transaction.objectStore('settings')

  await Promise.all([
    wordStore.clear(),
    listStore.clear(),
    membershipStore.clear(),
    trackStore.clear(),
    attemptStore.clear(),
    settingsStore.clear(),
  ])

  for (const list of data.lists) await listStore.put(list)
  for (const word of data.words) await wordStore.put(word)
  for (const membership of data.memberships) await membershipStore.put(membership)
  for (const track of data.tracks) await trackStore.put(track)
  for (const attempt of data.attempts) await attemptStore.put(attempt)
  await settingsStore.put({
    ...data.settings,
    contentMix: normalizeContentMix(data.settings.contentMix),
  })
  await transaction.done
}

export async function clearUserData(): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    ['words', 'vocabularyLists', 'wordListItems', 'tracks', 'attempts', 'settings'],
    'readwrite',
  )
  await Promise.all([
    transaction.objectStore('words').clear(),
    transaction.objectStore('vocabularyLists').clear(),
    transaction.objectStore('wordListItems').clear(),
    transaction.objectStore('tracks').clear(),
    transaction.objectStore('attempts').clear(),
    transaction.objectStore('settings').clear(),
  ])
  await transaction.done
}

export async function clearDatabase(): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction(
    [
      'words',
      'vocabularyLists',
      'wordListItems',
      'tracks',
      'attempts',
      'settings',
      'dictionaryCache',
    ],
    'readwrite',
  )
  await Promise.all([
    transaction.objectStore('words').clear(),
    transaction.objectStore('vocabularyLists').clear(),
    transaction.objectStore('wordListItems').clear(),
    transaction.objectStore('tracks').clear(),
    transaction.objectStore('attempts').clear(),
    transaction.objectStore('settings').clear(),
    transaction.objectStore('dictionaryCache').clear(),
  ])
  await transaction.done
}

export async function closeDatabase(): Promise<void> {
  const currentDatabasePromise = databasePromise
  databasePromise = undefined
  if (currentDatabasePromise) {
    const database = await currentDatabasePromise
    database.close()
  }
}

export { primaryListSlug, hydrateWord }
