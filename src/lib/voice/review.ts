import { normalizeLemma, type Word } from '../../domain/types'
import { listIdForSlug } from '../../data/vocabularyLists'
import { addWordToList, getUserDataSnapshot, writeBatch } from '../db'
import { createInitialTracks } from '../scheduler'
import { createSerialQueue } from '../serialQueue'

export interface VoiceExpressionDraft { expression: string; meaning: string; original?: string; note?: string }
export type SaveVoiceExpression = (draft: VoiceExpressionDraft) => Promise<void>
const enqueue = createSerialQueue()

export const saveVoiceExpression: SaveVoiceExpression = draft => enqueue(async () => {
  const expression = draft.expression.trim()
  const meaning = draft.meaning.trim()
  if (!expression || expression.length > 1000) throw new Error('请填写 1—1000 字符的英文表达。')
  if (!meaning || meaning.length > 500) throw new Error('请填写 1—500 字符的中文意思，不要用纠错说明代替翻译。')
  const snapshot = await getUserDataSnapshot()
  const existing = snapshot.words.find(word => normalizeLemma(word.expression) === normalizeLemma(expression) && word.zhGloss.trim() === meaning)
  if (existing) {
    await addWordToList(existing.id, 'my-vocabulary', 0)
    // A repeated save never resets FSRS or silently changes a paused/known word.
    return
  }
  const now = new Date().toISOString()
  const id = `voice-${crypto.randomUUID()}`
  const word: Word = { id, expression, lemma: normalizeLemma(expression), senseKey: id, zhGloss: meaning, enDefinition: '',
    partOfSpeech: 'expression', acceptedZhAnswers: [meaning], acceptedEnVariants: [expression], examples: [{ en: expression, zh: meaning }],
    collocations: [], source: 'custom', priority: 0, status: 'active', usagePrompts: [], createdAt: now, updatedAt: now }
  await writeBatch({ words: [word], tracks: createInitialTracks([word]), memberships: [{
    id: `membership-${id}-my-vocabulary`, wordId: id, listId: listIdForSlug('my-vocabulary'), priority: 0, sortOrder: 0,
    subcategory: ['口语练习', draft.original ? `原句：${draft.original.slice(0, 1000)}` : '', draft.note?.slice(0, 1000)].filter(Boolean).join(' · '),
  }] })
})
