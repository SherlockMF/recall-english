import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AddView, type CustomItemDraft } from './components/AddView'
import { AppShell, type AppTab } from './components/AppShell'
import { LibraryView } from './components/LibraryView'
import { SettingsDialog } from './components/SettingsDialog'
import { StudySession, type EvaluationResult, type RateDetail } from './components/StudySession'
import { TodayView } from './components/TodayView'
import { handcraftedSeedMemberships, handcraftedSeedWords, loadSeedPack } from './data/seedVocabulary'
import { ALL_VOCABULARY_LISTS, listIdForSlug } from './data/vocabularyLists'
import {
  DEFAULT_SETTINGS,
  normalizeLemma,
  primaryListSlug,
  type HintLevel,
  type LearningTrack,
  type ListSlug,
  type ReviewAttempt,
  type ReviewRating,
  type SessionTask,
  type StudyTimeEntry,
  type SystemListSlug,
  type UserSettings,
  type VocabularyItem,
  type Word,
  type WordListItem,
} from './domain/types'
import { exportBackupJson, importBackup } from './lib/backup'
import {
  resolveListSlugsForEdit,
  type EditCategory,
} from './lib/listMembership'
import {
  exportVocabularyPackJson,
  importVocabularyPack,
} from './lib/vocabularyPack'
import {
  addWordToList,
  getLibrarySeedStatus,
  getUserDataSnapshot,
  getWordListItemsForWord,
  initializeDatabase,
  putLearningTracks,
  putSettings,
  putStudyTimeEntry,
  putWord,
  recordReview,
  writeBatch,
} from './lib/db'
import { lookupDictionary } from './lib/dictionary'
import { evaluateAssist } from './lib/llm/evaluateAssist'
import { hasDeepseekApiKey } from './lib/llm/config'
import { hintWithLlm } from './lib/llm/hints'
import { createSerialQueue } from './lib/serialQueue'
import { showToast } from './lib/toast'
import { escapeRegExp, uniqueStrings } from './lib/text'
import { enrichWithLlm } from './lib/llm/enrich'
import {
  buildFallbackUsagePrompts,
  generateUsagePromptsWithLlm,
} from './lib/llm/usageGenerate'
import {
  snapshotLearningTracks,
  snapshotMapLearningProgress,
} from './lib/learningTracks'
import { deriveLearningStats } from './lib/learningStats'
import {
  buildDailyPlan,
  createInitialTracks,
  type DailyPlan,
} from './lib/scheduler'

interface ActiveSession {
  id: string
  plan: DailyPlan
}

function App() {
  const [tab, setTab] = useState<AppTab>('today')
  const [items, setItems] = useState<VocabularyItem[]>([])
  const [tracks, setTracks] = useState<LearningTrack[]>([])
  const [attempts, setAttempts] = useState<ReviewAttempt[]>([])
  const [timeEntries, setTimeEntries] = useState<StudyTimeEntry[]>([])
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [sessionError, setSessionError] = useState('')
  const [now, setNow] = useState(() => new Date())
  const enqueueReviewWrite = useRef(createSerialQueue()).current

  const refreshData = useCallback(async () => {
    const snapshot = await getUserDataSnapshot()
    setItems(snapshot.vocabulary)
    setTracks(snapshot.tracks)
    setAttempts(snapshot.attempts)
    setTimeEntries(snapshot.timeEntries)
    setSettings(snapshot.settings)
  }, [])

  useEffect(() => {
    let active = true
    async function boot() {
      try {
        // Returning users skip the ~12 MB seed pack: it is only fetched when
        // the library is empty or the stored seed revision has changed.
        const { needsBundledSeed } = await getLibrarySeedStatus()
        const seed = needsBundledSeed
          ? await loadSeedPack()
          : { words: handcraftedSeedWords, memberships: handcraftedSeedMemberships }
        await initializeDatabase(
          seed.words,
          seed.memberships,
          undefined,
          DEFAULT_SETTINGS,
          ALL_VOCABULARY_LISTS,
        )
        if (!active) return
        await refreshData()
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : '无法打开本地学习数据。')
      } finally {
        if (active) setLoading(false)
      }
    }
    void boot()
    return () => { active = false }
  }, [refreshData])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(interval)
  }, [])

  const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const stats = useMemo(() => deriveLearningStats({ items, tracks, attempts, timeEntries, now }), [items, tracks, attempts, timeEntries, now])
  const dailyPlan = useMemo(() => buildDailyPlan({ settings, items, tracks, attempts, timeEntries, now }), [settings, items, tracks, attempts, timeEntries, now])

  const learningTrackSnapshots = useMemo(() => {
    const learnedItemIds = new Set(
      tracks.filter((track) => track.reps > 0).map((track) => track.itemId),
    )
    return snapshotLearningTracks(items, learnedItemIds)
  }, [items, tracks])

  const mapProgress = useMemo(() => {
    const stageByItemId = new Map(
      items.map((item) => [
        item.id,
        stats.evidenceByItemId.get(item.id)?.key ?? 'new',
      ] as const),
    )
    return snapshotMapLearningProgress(items, stageByItemId)
  }, [items, stats.evidenceByItemId])

  const recentWords = useMemo(() => {
    const seen = new Set<string>()
    return [...attempts]
      .sort((a, b) => new Date(b.reviewedAt).getTime() - new Date(a.reviewedAt).getTime())
      .flatMap((attempt) => {
        if (seen.has(attempt.itemId)) return []
        const item = itemMap.get(attempt.itemId)
        if (!item) return []
        seen.add(attempt.itemId)
        return [{
          expression: item.expression,
          zhGloss: item.zhGloss,
          stage: stats.evidenceByItemId.get(item.id)?.label ?? '未开始',
        }]
      })
      .slice(0, 6)
  }, [attempts, itemMap, stats.evidenceByItemId])

  function startSession() {
    const current = new Date()
    if (current.toDateString() !== now.toDateString()) {
      void rebuildSession()
      return
    }
    setSession({ id: makeId('session'), plan: dailyPlan })
  }

  async function rebuildSession(additionalMinutes = 0) {
    try {
      const snapshot = await getUserDataSnapshot()
      const current = new Date()
      const plan = buildDailyPlan({ settings: snapshot.settings, items: snapshot.vocabulary, tracks: snapshot.tracks, attempts: snapshot.attempts, timeEntries: snapshot.timeEntries, now: current, additionalMinutes })
      setItems(snapshot.vocabulary)
      setTracks(snapshot.tracks)
      setAttempts(snapshot.attempts)
      setTimeEntries(snapshot.timeEntries)
      setSettings(snapshot.settings)
      setNow(current)
      setSessionError('')
      setSession({ id: makeId('session'), plan })
      return true
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '暂时无法读取学习计划，请重试。')
      return false
    }
  }

  const saveStudyTime = useCallback(async (entry: StudyTimeEntry) => {
    const saved = await putStudyTimeEntry(entry)
    setTimeEntries((current) => [...current.filter((candidate) => candidate.id !== saved.id), saved])
  }, [])

  const evaluateTask = useCallback(async (
    task: SessionTask,
    item: VocabularyItem,
    answer: string,
    hintLevel: HintLevel,
    revealed: boolean,
    responseMs: number,
    options?: {
      onInterim?: (result: EvaluationResult) => void
      verifySentence?: boolean
    },
  ): Promise<EvaluationResult> => {
    const result = await evaluateAssist({
      item,
      trackType: task.trackType,
      answer,
      hintLevel,
      responseMs,
      revealed,
      promptIndex: task.promptIndex,
      verifySentence: options?.verifySentence,
      onInterim: options?.onInterim,
    })
    return result
  }, [])

  const resolveHint = useCallback(async (
    task: SessionTask,
    item: VocabularyItem,
    hintLevel: HintLevel,
  ) => {
    if (!hasDeepseekApiKey()) {
      throw new Error('no-key')
    }
    return hintWithLlm({
      item,
      trackType: task.trackType,
      hintLevel,
      promptIndex: task.promptIndex,
    })
  }, [])

  const ensureUsageItem = useCallback(async (item: VocabularyItem) => {
    if (item.usagePrompts.length >= 2) return item
    let prompts = item.usagePrompts
    try {
      if (hasDeepseekApiKey()) {
        prompts = await generateUsagePromptsWithLlm(item)
      } else {
        prompts = buildFallbackUsagePrompts(item.expression, item.examples[0]?.en)
      }
    } catch {
      prompts = buildFallbackUsagePrompts(item.expression, item.examples[0]?.en)
    }
    const updated: VocabularyItem = {
      ...item,
      usagePrompts: prompts,
      updatedAt: new Date().toISOString(),
    }
    await putWord(stripHydration(updated))
    setItems((current) => current.map((candidate) => (
      candidate.id === updated.id ? { ...updated, listSlugs: candidate.listSlugs, category: candidate.category } : candidate
    )))
    return updated
  }, [])

  async function enrichDraft(expression: string, category: SystemListSlug | 'other', existingDefinition?: string) {
    return enrichWithLlm({ expression, category, existingDefinition })
  }

  async function handleRate(
    task: SessionTask,
    rating: ReviewRating,
    detail: RateDetail,
  ) {
    const result = await enqueueReviewWrite(() => recordReview({
      trackId: task.trackId,
      rating,
      reviewedAt: new Date(detail.reviewedAt),
      desiredRetention: settings.desiredRetention,
      attempt: {
        id: detail.attemptId,
        itemId: task.itemId,
        trackType: task.trackType,
        promptType: detail.promptType,
        answer: detail.answer,
        hintLevel: detail.hintLevel,
        responseMs: detail.responseMs,
        wasOverride: detail.wasOverride || undefined,
        evidenceVersion: detail.evidenceVersion,
        sessionId: detail.sessionId,
        retryCount: detail.retryCount,
        promptId: detail.promptId,
        evaluationSource: detail.evaluationSource,
        correctness: detail.correctness,
        matchKind: detail.matchKind,
        suggestedRating: detail.suggestedRating,
      },
    }))
    const changedById = new Map(result.tracks.map((track) => [track.id, track]))
    setTracks((current) => current.map((track) => changedById.get(track.id) ?? track))
    setAttempts((current) => [...current.filter((attempt) => attempt.id !== result.attempt.id), result.attempt])
    setNow(new Date())
  }

  async function addCustomItem(draft: CustomItemDraft) {
    const duplicate = items.some((item) => (
      normalizeText(item.expression) === normalizeText(draft.expression)
      && normalizeText(item.zhGloss) === normalizeText(draft.zhGloss)
    ))
    if (duplicate) return { ok: false, message: '这个表达的相同义项已经在词库中。你可以直接编辑原词条。' }

    const { word, memberships, item } = customItemFromDraft(draft)
    const itemTracks = createInitialTracks([word], new Date())
    await writeBatch({ words: [word], memberships, tracks: itemTracks })
    setItems((current) => [item, ...current])
    setTracks((current) => [...current, ...itemTracks])
    return { ok: true, message: `已把 “${item.expression}” 加入优先学习。` }
  }

  async function addToMyVocabulary(item: VocabularyItem) {
    try {
      await addWordToList(item.id, 'my-vocabulary', item.priority)
      await refreshData()
      return { ok: true as const, message: `已加入优先学习：${item.expression}` }
    } catch (error) {
      const message = error instanceof Error ? error.message : '加入优先学习失败。'
      showToast(message, 'error')
      return { ok: false as const, message }
    }
  }

  async function bulkAdd(
    rows: { expression: string; zhGloss: string }[],
    category: SystemListSlug,
  ) {
    const existing = new Set(items.map((item) => `${normalizeText(item.expression)}::${normalizeText(item.zhGloss)}`))
    const addedWords: Word[] = []
    const addedMemberships: WordListItem[] = []
    const addedItems: VocabularyItem[] = []
    let skipped = 0
    for (const row of rows) {
      const key = `${normalizeText(row.expression)}::${normalizeText(row.zhGloss)}`
      if (!row.expression.trim() || !row.zhGloss.trim() || existing.has(key)) {
        skipped += 1
        continue
      }
      existing.add(key)
      const built = customItemFromDraft({
        expression: row.expression,
        zhGloss: row.zhGloss,
        enDefinition: '',
        partOfSpeech: 'expression',
        category,
        exampleEn: '',
        exampleZh: '',
        collocations: [],
      })
      addedWords.push(built.word)
      addedMemberships.push(...built.memberships)
      addedItems.push(built.item)
    }
    if (addedWords.length) {
      const newTracks = createInitialTracks(addedWords, new Date())
      await writeBatch({ words: addedWords, memberships: addedMemberships, tracks: newTracks })
      setItems((current) => [...addedItems, ...current])
      setTracks((current) => [...current, ...newTracks])
    }
    return { added: addedWords.length, skipped }
  }

  async function toggleStatus(item: VocabularyItem) {
    const updatedWord: Word = stripHydration({
      ...item,
      status: item.status === 'active' ? 'paused' : 'active',
      updatedAt: new Date().toISOString(),
    })
    try {
      await putWord(updatedWord)
    } catch (error) {
      showToast(error instanceof Error ? `保存暂停状态失败：${error.message}` : '保存暂停状态失败。', 'error')
      return
    }
    setItems((current) => current.map((candidate) => (
      candidate.id === item.id
        ? { ...candidate, ...updatedWord, listSlugs: candidate.listSlugs, category: candidate.category }
        : candidate
    )))
  }

  async function updateItem(
    id: string,
    patch: {
      zhGloss: string
      enDefinition: string
      partOfSpeech: string
      examples: VocabularyItem['examples']
      collocations: string[]
      category: EditCategory
      scenarioNote?: string
    },
  ) {
    const current = items.find((item) => item.id === id)
    if (!current) return
    const usagePrompts = current.usagePrompts.length
      ? current.usagePrompts
      : buildUsagePrompts(current.expression, patch.examples)
    const listSlugs = resolveListSlugsForEdit(current.listSlugs, current.category, patch.category)
    const { category: _editCategory, scenarioNote: patchScenarioNote, ...contentPatch } = patch
    const scenarioNote = patch.category === 'other'
      ? (patchScenarioNote?.trim() || current.scenarioNote)
      : undefined
    const updated: VocabularyItem = {
      ...current,
      ...contentPatch,
      listSlugs,
      category: primaryListSlug(listSlugs),
      scenarioNote,
      acceptedZhAnswers: uniqueStrings([patch.zhGloss, ...current.acceptedZhAnswers]),
      usagePrompts,
      updatedAt: new Date().toISOString(),
    }
    const hasUsageTrack = tracks.some((track) => track.itemId === id && track.type === 'usage')
    const newUsageTrack = !hasUsageTrack && usagePrompts.length
      ? createInitialTracks([updated], new Date()).filter((track) => track.type === 'usage')
      : []
    const existingMemberships = await getWordListItemsForWord(id)
    const nextMembershipIds = new Set(listSlugs.map((slug) => `membership-${id}-${slug}`))
    const deleteMembershipIds = existingMemberships
      .filter((membership) => !nextMembershipIds.has(membership.id))
      .map((membership) => membership.id)
    const memberships = listSlugs.map((slug, index) => ({
      id: `membership-${id}-${slug}`,
      wordId: id,
      listId: listIdForSlug(slug),
      priority: updated.priority,
      sortOrder: index,
      subcategory: slug === 'my-vocabulary' ? scenarioNote : undefined,
    }))
    await writeBatch({
      words: [stripHydration(updated)],
      memberships,
      deleteMembershipIds,
      tracks: newUsageTrack,
    })
    setItems((all) => all.map((item) => item.id === id ? updated : item))
    if (newUsageTrack.length) setTracks((all) => [...all, ...newUsageTrack])
  }

  async function saveSettings(updated: UserSettings) {
    await putSettings(updated)
    setSettings(updated)
  }

  async function downloadBackup() {
    try {
      const json = await exportBackupJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `recall-english-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      await refreshData()
    } catch (error) {
      showToast(error instanceof Error ? `导出学习备份失败：${error.message}` : '导出学习备份失败。', 'error')
    }
  }

  async function restoreBackup(content: string) {
    try {
      const summary = await importBackup(content)
      await refreshData()
      return {
        ok: true,
        message: `导入完成：${summary.vocabulary} 个义项、${summary.attempts} 次回忆。`,
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '备份文件无效，未修改当前数据。',
      }
    }
  }

  async function downloadVocabularyPack() {
    try {
      const json = await exportVocabularyPackJson()
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `recall-english-vocabulary-${new Date().toISOString().slice(0, 10)}.json`
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      showToast(error instanceof Error ? `导出词库失败：${error.message}` : '导出词库失败。', 'error')
    }
  }

  async function restoreVocabularyPack(content: string) {
    try {
      const summary = await importVocabularyPack(content)
      await refreshData()
      return {
        ok: true,
        message: `词库合并完成：新增 ${summary.added}、更新 ${summary.updated}、未变 ${summary.unchanged}；新增归属 ${summary.membershipsAdded}。`,
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '词库文件无效，未修改当前数据。',
      }
    }
  }

  if (loading) return <LoadingScreen />
  if (loadError) return <ErrorScreen message={loadError} onRetry={() => window.location.reload()} />

  return (
    <>
      {sessionError && <div className="session-open-error" role="alert">
        <span>{sessionError}</span>
        <button type="button" onClick={() => setSessionError('')}>关闭提示后重试</button>
      </div>}
      <AppShell
        activeTab={tab}
        onChangeTab={(nextTab) => {
          setTab(nextTab)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
        onOpenSettings={() => setSettingsOpen(true)}
      >
        {tab === 'today' && (
          <TodayView
            plan={dailyPlan}
            stats={stats}
            mapProgress={mapProgress}
            now={now}
            onStart={startSession}
            onContinue={() => void rebuildSession(5)}
            recentWords={recentWords}
            tracks={learningTrackSnapshots}
          />
        )}
        {tab === 'add' && (
          <AddView
            onAdd={addCustomItem}
            onBulkAdd={bulkAdd}
            onEnrich={enrichDraft}
            onLookup={lookupDictionary}
          />
        )}
        {tab === 'library' && (
          <LibraryView
            items={items}
            onAddToMyVocabulary={addToMyVocabulary}
            onToggleStatus={toggleStatus}
            onUpdate={updateItem}
            evidenceByItemId={stats.evidenceByItemId}
          />
        )}
      </AppShell>

      {session && (
        <StudySession
          ensureUsageItem={ensureUsageItem}
          evaluate={evaluateTask}
          initialTasks={session.plan.tasks}
          items={items}
          key={session.id}
          mode="core"
          sessionId={session.id}
          dailyMinutes={settings.dailyMinutes}
          usedTodayMs={session.plan.usedMs}
          initialBudgetMs={session.plan.remainingMs}
          timeEntries={timeEntries}
          onSaveTime={saveStudyTime}
          onContinue={() => rebuildSession(5)}
          onDayChange={() => rebuildSession()}
          canVerifySentence={hasDeepseekApiKey()}
          learningStats={stats}
          onExit={() => {
            setSession(null)
            setTab('today')
            setNow(new Date())
          }}
          onFinish={() => { void refreshData().catch((error) => setSessionError(error instanceof Error ? error.message : '读取学习结果失败。')) }}
          onRate={handleRate}
          onSpeechAccentChange={(accent) => {
            void saveSettings({ ...settings, speechAccent: accent })
          }}
          resolveHint={resolveHint}
          speechAccent={settings.speechAccent}
          tracks={tracks}
          usableThisWeek={stats.applicationCount}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          attemptCount={attempts.length}
          onClose={() => setSettingsOpen(false)}
          onExport={downloadBackup}
          onExportVocabulary={downloadVocabularyPack}
          onImport={restoreBackup}
          onImportVocabulary={restoreVocabularyPack}
          onSave={saveSettings}
          settings={settings}
          vocabularyCount={items.length}
        />
      )}
    </>
  )
}

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <span className="loading-mark">R</span>
      <strong>Recall English</strong>
      <p>正在准备你的本地记忆库…</p>
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="loading-screen error-screen">
      <span className="loading-mark">!</span>
      <strong>本地数据暂时打不开</strong>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry} type="button">重新载入</button>
    </div>
  )
}

function stripHydration(item: VocabularyItem | Word): Word {
  const {
    listSlugs: _listSlugs,
    category: _category,
    scenarioNote: _scenarioNote,
    ...word
  } = item as VocabularyItem
  return word
}

function uniqueListSlugs(values: ListSlug[]): ListSlug[] {
  return [...new Set(values)]
}

function customItemFromDraft(draft: CustomItemDraft): {
  word: Word
  memberships: WordListItem[]
  item: VocabularyItem
} {
  const now = new Date().toISOString()
  const expression = draft.expression.trim()
  const examples = draft.exampleEn.trim()
    ? [{ en: draft.exampleEn.trim(), zh: draft.exampleZh.trim() }]
    : []
  const id = makeId('custom')
  const scenarioNote = draft.category === 'other' ? draft.scenarioNote?.trim() : undefined
  const listSlugs = draft.category === 'other'
    ? uniqueListSlugs(['my-vocabulary'])
    : uniqueListSlugs([draft.category, 'my-vocabulary'])
  const word: Word = {
    id,
    expression,
    lemma: normalizeLemma(expression),
    senseKey: `${slugify(expression)}-${slugify(draft.zhGloss).slice(0, 28) || Date.now()}`,
    zhGloss: draft.zhGloss.trim(),
    enDefinition: draft.enDefinition.trim(),
    partOfSpeech: draft.partOfSpeech.trim() || 'expression',
    acceptedZhAnswers: uniqueStrings([draft.zhGloss.trim()]),
    acceptedEnVariants: uniqueStrings([expression]),
    examples,
    collocations: uniqueStrings(draft.collocations),
    source: draft.source ?? 'custom',
    priority: 0,
    status: 'active',
    ipaUk: draft.ipaUk,
    ipaUs: draft.ipaUs,
    audioUk: draft.audioUk,
    audioUs: draft.audioUs,
    usagePrompts: buildUsagePrompts(expression, examples),
    createdAt: now,
    updatedAt: now,
  }
  const memberships = listSlugs.map((slug, index) => ({
    id: `membership-${id}-${slug}`,
    wordId: id,
    listId: listIdForSlug(slug),
    priority: 0,
    sortOrder: index,
    subcategory: scenarioNote,
  }))
  return {
    word,
    memberships,
    item: {
      ...word,
      listSlugs,
      category: draft.category === 'other' ? 'my-vocabulary' : draft.category,
      scenarioNote,
    },
  }
}

function buildUsagePrompts(expression: string, examples: VocabularyItem['examples']) {
  const example = examples.find((candidate) => normalizeText(candidate.en).includes(normalizeText(expression)))
  if (!example) return []
  const blanked = example.en.replace(new RegExp(escapeRegExp(expression), 'i'), '_____')
  return [
    {
      id: `${slugify(expression)}-cloze`,
      type: 'cloze' as const,
      prompt: blanked,
      answer: expression,
      modelAnswer: example.en,
      checkpoints: [expression],
    },
    {
      id: `${slugify(expression)}-sentence`,
      type: 'sentence' as const,
      prompt: `想一个你会真实使用 “${expression}” 的场景，并写出完整句子。`,
      modelAnswer: example.en,
      checkpoints: [expression],
    },
  ]
}

function normalizeText(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, '')
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
}

function makeId(prefix: string) {
  const uuid = globalThis.crypto?.randomUUID?.()
  return `${prefix}-${uuid ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export default App
