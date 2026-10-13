import { SEED_CONTENT_REVISION } from '../data/seedContentRevision'

export type SystemListSlug = 'daily' | 'business' | 'finance' | 'accounting'
export type ListSlug = SystemListSlug | 'my-vocabulary'
export type VocabularySource = 'seed' | 'dictionary' | 'custom'
export type VocabularyStatus = 'active' | 'paused'
export type TrackType = 'receptive' | 'productive' | 'usage'
export type ReviewRating = 'again' | 'hard' | 'good'
export type HintLevel = 0 | 1 | 2 | 3
export type SpeechAccent = 'uk' | 'us'
export const VOCABULARY_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const
export type VocabularyLevel = (typeof VOCABULARY_LEVELS)[number]

export interface VocabularyExample {
  en: string
  zh: string
}

export interface UsagePrompt {
  id: string
  type: 'cloze' | 'sentence'
  prompt: string
  answer?: string
  modelAnswer: string
  checkpoints: string[]
}

/** Canonical lexical sense stored in IndexedDB `words` (id preserved across migrations). */
export interface Word {
  id: string
  expression: string
  lemma: string
  senseKey: string
  zhGloss: string
  enDefinition: string
  partOfSpeech: string
  acceptedZhAnswers: string[]
  acceptedEnVariants: string[]
  examples: VocabularyExample[]
  collocations: string[]
  source: VocabularySource
  priority: number
  status: VocabularyStatus
  /** Self-reported knowledge; does not create recall evidence or delete history. */
  knownAt?: string
  /** Optional personal override for lexical difficulty, separate from FSRS difficulty. */
  vocabularyLevel?: VocabularyLevel
  /** Explicit personal content changes; absent on legacy records. */
  contentEdited?: boolean
  ipaUk?: string
  ipaUs?: string
  audioUk?: string
  audioUs?: string
  synonyms?: string[]
  antonyms?: string[]
  usagePrompts: UsagePrompt[]
  createdAt: string
  updatedAt: string
}

/**
 * Hydrated study view: Word plus list membership.
 * `category` is the primary list slug for scheduler/contentMix (not stored on Word).
 */
export interface VocabularyItem extends Word {
  listSlugs: ListSlug[]
  category: ListSlug
  /** Free-text scenario note when the item is filed under a custom “其他” context. */
  scenarioNote?: string
}

export interface VocabularyList {
  id: string
  name: string
  slug: ListSlug
  description: string
  category: ListSlug
  isSystem: boolean
  createdAt: string
}

export interface WordListItem {
  id: string
  wordId: string
  listId: string
  priority: number
  subcategory?: string
  sortOrder: number
}

export interface LearningTrack {
  id: string
  itemId: string
  type: TrackType
  due: string
  stability: number
  difficulty: number
  elapsedDays: number
  scheduledDays: number
  reps: number
  lapses: number
  state: number
  lastReview?: string
  firstGoodAt?: string
  lastGoodAt?: string
  unlocked: boolean
}

export interface ReviewAttempt {
  id: string
  trackId: string
  itemId: string
  trackType: TrackType
  promptType: string
  answer: string
  rating: ReviewRating
  hintLevel: HintLevel
  responseMs: number
  reviewedAt: string
  wasOverride?: boolean
  /** Absent on legacy attempts: do not infer objective learning evidence from ratings. */
  evidenceVersion?: 1
  sessionId?: string
  retryCount?: number
  promptId?: string
  evaluationSource?: 'rules' | 'llm' | 'reveal'
  correctness?: 'correct' | 'incorrect' | 'unverified'
  matchKind?: 'exact' | 'variant' | 'minor-typo' | 'checkpoint' | 'incorrect'
  suggestedRating?: ReviewRating
  wasPriorityStudy?: boolean
  wasNewItem?: boolean
}

export interface StudyTimeEntry {
  id: string
  sessionId: string
  localDate: string
  activeMs: number
  updatedAt: string
}

export interface UserSettings {
  id: 'primary'
  dailyMinutes: number
  /** Legacy settings retained for backup compatibility. */
  coreMinutes: number
  extensionMinutes: number
  desiredRetention: number
  newItemsPerDay: number
  contentMix: Record<SystemListSlug, number>
  /** Preferred UK/US accent for study playback. */
  speechAccent: SpeechAccent
  vocabularyLevel?: VocabularyLevel
  adaptiveDifficulty?: boolean
  difficultyResetAt?: string
  /**
   * When this differs from the app’s bundled `SEED_CONTENT_REVISION`,
   * `initializeDatabase` refreshes seed Word bodies by id (tracks kept).
   */
  seedContentRevision?: string
  /** Supplemental dictionary senses are merged without refreshing seed bodies. */
  dictionaryContentRevision?: string
  lastBackupAt?: string
}

export interface DictionaryMeaning {
  /** Exact automated source definition withdrawn by a verified content correction. */
  supersededDefinition?: string
  /** Stable source identity retained when a learner edits this meaning before saving. */
  senseKey?: string
  partOfSpeech: string
  definition: string
  /** Short Chinese gloss for this sense, when a bilingual source provided one. */
  zhGloss?: string
  example?: string
  exampleZh?: string
  synonyms: string[]
  collocations?: string[]
  antonyms?: string[]
}

export interface DictionaryResult {
  /** Cache schema marker — ignore older entries that lack bilingual senses. */
  schemaVersion?: number
  query: string
  word: string
  phonetic?: string
  audioUrl?: string
  ipaUk?: string
  ipaUs?: string
  audioUk?: string
  audioUs?: string
  meanings: DictionaryMeaning[]
  fetchedAt: string
}

export interface DictionaryCache {
  query: string
  result: DictionaryResult
  cachedAt: string
}

export interface BackupV1 {
  version: 1
  exportedAt: string
  vocabulary: Array<Word & {
    category: ListSlug | 'custom'
    phonetic?: string
    audioUrl?: string
    listSlugs?: ListSlug[]
  }>
  tracks: LearningTrack[]
  attempts: ReviewAttempt[]
  settings: UserSettings & { contentMix: Record<string, number> }
}

export interface BackupV2 {
  version: 2
  exportedAt: string
  words: Word[]
  lists: VocabularyList[]
  memberships: WordListItem[]
  tracks: LearningTrack[]
  attempts: ReviewAttempt[]
  settings: UserSettings
}

export interface BackupV3 extends Omit<BackupV2, 'version'> {
  version: 3
  timeEntries: StudyTimeEntry[]
}

/** Vocabulary-only pack (no learning progress). Distinct from BackupV1/V2. */
export interface VocabularyPackV1 {
  version: 1
  kind: 'vocabulary-pack'
  exportedAt: string
  words: Word[]
  lists: VocabularyList[]
  memberships: WordListItem[]
}

export interface SessionTask {
  id: string
  itemId: string
  trackId: string
  trackType: TrackType
  isNew: boolean
  promptIndex?: number
  retryCount?: number
}

export interface SessionSummary {
  total: number
  noHintGood: number
  again: number
  usageCompleted: number
  usableThisWeek: number
}

export const SYSTEM_LIST_ORDER: readonly SystemListSlug[] = [
  'daily',
  'business',
  'finance',
  'accounting',
] as const

export const DEFAULT_SETTINGS: UserSettings = {
  id: 'primary',
  dailyMinutes: 15,
  coreMinutes: 15,
  extensionMinutes: 15,
  desiredRetention: 0.9,
  newItemsPerDay: 5,
  contentMix: { daily: 0.35, business: 0.25, finance: 0.2, accounting: 0.2 },
  speechAccent: 'uk',
  vocabularyLevel: 'B1',
  adaptiveDifficulty: true,
  // Single source of truth for the seed stamp lives in seedContentRevision.
  seedContentRevision: SEED_CONTENT_REVISION,
}

export function normalizeLemma(expression: string): string {
  return expression.trim().toLocaleLowerCase('en-US')
}

export function primaryListSlug(listSlugs: ListSlug[]): ListSlug {
  for (const slug of SYSTEM_LIST_ORDER) {
    if (listSlugs.includes(slug)) return slug
  }
  if (listSlugs.includes('my-vocabulary')) return 'my-vocabulary'
  return 'my-vocabulary'
}

export function hydrateWord(
  word: Word,
  listSlugs: ListSlug[],
  scenarioNote?: string,
): VocabularyItem {
  return {
    ...word,
    listSlugs,
    category: primaryListSlug(listSlugs),
    scenarioNote: scenarioNote?.trim() || undefined,
  }
}
