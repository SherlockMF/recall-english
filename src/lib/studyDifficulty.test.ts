import { DEFAULT_SETTINGS, type ReviewAttempt, type SessionTask, type VocabularyItem } from '../domain/types'
import { buildDailyPlan, createInitialTracks } from './scheduler'
import { getStudyDifficulty, getVocabularyDifficulty, isNewLearningTask, refreshPendingNewTasks } from './studyDifficulty'

const now = new Date('2026-10-08T10:00:00Z')
function word(id: string, overrides: Partial<VocabularyItem> = {}): VocabularyItem {
  return { id, expression: id, lemma: id, senseKey: id, zhGloss: id, enDefinition: '', partOfSpeech: 'noun',
    acceptedZhAnswers: [], acceptedEnVariants: [], examples: [], collocations: [], source: 'seed', priority: 1,
    status: 'active', usagePrompts: [], createdAt: now.toISOString(), updatedAt: now.toISOString(),
    listSlugs: ['daily'], category: 'daily', ...overrides }
}
function answers(id: string, index: number, overrides: Partial<ReviewAttempt> = {}): ReviewAttempt[] {
  return (['receptive', 'productive'] as const).map((trackType, direction) => ({
    id: `${id}-${trackType}`, itemId: id, trackId: `${id}:${trackType}`, trackType, promptType: trackType,
    answer: id, rating: 'good', hintLevel: 0, responseMs: 3000,
    reviewedAt: new Date(now.getTime() - (10 - index) * 60000 + direction * 1000).toISOString(),
    evidenceVersion: 1, sessionId: 'session', retryCount: 0, evaluationSource: 'rules', correctness: 'correct',
    matchKind: 'exact', suggestedRating: 'good', wasPriorityStudy: false, wasNewItem: true, ...overrides,
  }))
}
function task(id: string, type: 'receptive' | 'productive' = 'receptive'): SessionTask {
  return { id: `${id}:${type}`, itemId: id, trackId: `${id}:${type}`, trackType: type, isNew: true }
}

describe('词级参考', () => {
  it('matches word and part of speech, supports manual overrides and labels unknown estimates', () => {
    expect(getVocabularyDifficulty(word('abandon', { partOfSpeech: 'verb' }))).toEqual({ level: 'B1', source: 'profile' })
    expect(getVocabularyDifficulty(word('timid', { partOfSpeech: 'adjective' }))).toEqual({ level: 'C1', source: 'profile' })
    expect(getVocabularyDifficulty(word('xyz-unknown'))).toEqual({ level: 'B2', source: 'estimated' })
    expect(getVocabularyDifficulty(word('abandon', { vocabularyLevel: 'C2' }))).toEqual({ level: 'C2', source: 'manual' })
  })
  it('keeps difficulty and known marks independent for different senses of the same spelling and POS', () => {
    const items = [word('interest-hobby', { expression: 'interest', lemma: 'interest', zhGloss: '兴趣', vocabularyLevel: 'A2', knownAt: now.toISOString() }),
      word('interest-finance', { expression: 'interest', lemma: 'interest', zhGloss: '利息', vocabularyLevel: 'B2' })]
    expect(items.map(getVocabularyDifficulty).map((difficulty) => difficulty.level)).toEqual(['A2', 'B2'])
    const plan = buildDailyPlan({ items, tracks: createInitialTracks(items, now), attempts: [], timeEntries: [], now, settings: DEFAULT_SETTINGS })
    expect([...new Set(plan.tasks.map((entry) => entry.itemId))]).toEqual(['interest-finance'])
  })
})

describe('连续首轮表现调整难度', () => {
  const items = ['one', 'two', 'three', 'four', 'five', 'six'].map((id) => word(id, { vocabularyLevel: 'B1' }))
  it('raises after three distinct fast bilingual successes, lowers after two explicit failures', () => {
    const easy = items.slice(0, 3).flatMap((item, i) => answers(item.id, i))
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, easy, now).level).toBe('B2')
    const hard = items.slice(3, 5).flatMap((item, i) => answers(item.id, i + 3, { correctness: 'incorrect', matchKind: 'incorrect', rating: 'again', suggestedRating: 'again' }))
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, [...easy, ...hard], now).level).toBe('B1')
  })
  it('raises for easy lower-level filler too and editing lexical levels never rewrites saved performance', () => {
    const easy = items.slice(0, 3).flatMap((item, i) => answers(item.id, i))
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items.map((item) => ({ ...item, vocabularyLevel: 'A1' })), easy, now).level).toBe('B2')
    const ignored = answers('four', 2, { wasOverride: true })
    const third = answers('three', 3)
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, [...easy.slice(0, 4), ...ignored, ...third], now).level).toBe('B2')
  })
  it('does not call an unfinished old track new learning; carries proven first encounters across sessions', () => {
    const tracks = createInitialTracks([items[0]], now).map((track) => track.type === 'receptive' ? { ...track, reps: 4 } : track)
    const unfinished = { ...task(items[0].id, 'productive'), isNew: false }
    expect(isNewLearningTask(unfinished, tracks, [])).toBe(false)
    expect(isNewLearningTask(unfinished, tracks, answers(items[0].id, 0).slice(0, 1))).toBe(true)
    expect(isNewLearningTask({ ...unfinished, retryCount: 1 }, tracks, answers(items[0].id, 0))).toBe(false)
  })
  it('does not count retries, old reviews, priority, overrides or unverified evidence', () => {
    for (const patch of [{ retryCount: 1 }, { wasPriorityStudy: true }, { wasOverride: true }, { correctness: 'unverified' as const }]) {
      expect(getStudyDifficulty(DEFAULT_SETTINGS, items, items.flatMap((item, i) => answers(item.id, i, patch)), now).level).toBe('B1')
    }
    const first = items.flatMap((item, i) => answers(item.id, i, { responseMs: 60000 }))
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, [...first, ...items.flatMap((item, i) => answers(item.id, i + 1))], now).level).toBe('B1')
  })
  it('ignores half-finished successes, uses persisted first failures once, resets on settings changes and respects boundaries', () => {
    const incomplete = items.map((item, i) => answers(item.id, i)[0])
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, incomplete, now).level).toBe('B1')
    const easy = items.flatMap((item, i) => answers(item.id, i))
    expect(getStudyDifficulty({ ...DEFAULT_SETTINGS, difficultyResetAt: now.toISOString() }, items, easy, now).level).toBe('B1')
    expect(getStudyDifficulty({ ...DEFAULT_SETTINGS, adaptiveDifficulty: false }, items, easy, now).level).toBe('B1')
    expect(getStudyDifficulty({ ...DEFAULT_SETTINGS, vocabularyLevel: 'C2' }, items, easy, now).level).toBe('C2')
    const failures = items.slice(0, 2).map((item, i) => answers(item.id, i, { correctness: 'incorrect', matchKind: 'incorrect', rating: 'again' })[0])
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, failures, now).level).toBe('A2')
    expect(getStudyDifficulty({ ...DEFAULT_SETTINGS, vocabularyLevel: 'A1' }, items, failures, now).level).toBe('A1')
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, [...failures, ...failures.map((attempt) => ({ ...attempt, id: `${attempt.id}-retry`, retryCount: 1 }))], now).level).toBe('A2')
    const laterUnverified = items.slice(0, 2).map((item, i) => answers(item.id, i + 3, { correctness: 'unverified', wasOverride: true })[1])
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, [...failures, ...laterUnverified], now).level).toBe('A2')
    const hinted = items.slice(0, 2).map((item, i) => answers(item.id, i, { hintLevel: 2, rating: 'again' })[0])
    expect(getStudyDifficulty(DEFAULT_SETTINGS, items, hinted, now).level).toBe('A2')
  })
})

describe('固定额度与队列补位', () => {
  it('finishes the first three ordinary words before introducing later words so the same session can adapt', () => {
    const items = ['w1', 'w2', 'w3', 'w4', 'w5'].map((id) => word(id, { vocabularyLevel: 'B1' }))
    const input = { items, tracks: createInitialTracks(items, now), attempts: [], timeEntries: [], now, settings: DEFAULT_SETTINGS }
    const plan = buildDailyPlan(input)
    expect(plan.tasks.slice(0, 6).every((t) => ['w1', 'w2', 'w3'].includes(t.itemId))).toBe(true)
    expect(plan.tasks.slice(6).map((t) => t.itemId)).toEqual(['w4', 'w5', 'w4', 'w5'])
    const done = items.slice(0, 3).flatMap((item, i) => answers(item.id, i))
    const harder = word('harder', { vocabularyLevel: 'B2' })
    const nextPlan = buildDailyPlan({ ...input, items: [...items, harder], tracks: createInitialTracks([...items, harder], now), attempts: done })
    expect(nextPlan.introducedToday + nextPlan.newItemCount).toBe(5)
    expect([...new Set(nextPlan.tasks.filter((t) => t.isNew).map((t) => t.itemId))]).toEqual(['harder', 'w4'])
  })
  it('prefers target level across categories, fills with neighbors, priority overrides difficulty, known words are excluded', () => {
    const items = [word('easy', { vocabularyLevel: 'A1' }), word('target', { vocabularyLevel: 'B1', category: 'finance', listSlugs: ['finance'] }),
      word('priority', { vocabularyLevel: 'A1', listSlugs: ['daily', 'my-vocabulary'] }), word('known', { knownAt: now.toISOString(), vocabularyLevel: 'B1' })]
    const plan = buildDailyPlan({ items, tracks: createInitialTracks(items, now), attempts: [], timeEntries: [], now,
      settings: { ...DEFAULT_SETTINGS, newItemsPerDay: 3 } })
    expect([...new Set(plan.tasks.map((t) => t.itemId))]).toEqual(['priority', 'target', 'easy'])
    expect(plan.newItemCount).toBe(3)
    const due = createInitialTracks(items, now).map((t) => ({ ...t, reps: 1, state: 2 }))
    expect(buildDailyPlan({ items, tracks: due, attempts: [], timeEntries: [], now, settings: DEFAULT_SETTINGS }).tasks.some((t) => t.itemId === 'known')).toBe(false)
  })
  it('preserves started directions and retries; swaps only untouched ordinary words and fills skipped slots', () => {
    const items = [word('started'), word('old'), word('new'), word('priority', { listSlugs: ['my-vocabulary'] }), word('known', { knownAt: now.toISOString() })]
    const pending = [task('priority'), task('started', 'productive'), { ...task('started'), id: 'retry', isNew: false, retryCount: 1 }, task('old'), task('old', 'productive')]
    const planned = [task('new'), task('new', 'productive')]
    const merged = refreshPendingNewTasks(pending, planned, items, new Set(['started']))
    expect(merged.map((t) => t.itemId)).toEqual(['priority', 'started', 'started', 'new', 'new'])
    expect(refreshPendingNewTasks([task('known')], planned, items, new Set()).map((t) => t.itemId)).toEqual(['new', 'new'])
  })
})
