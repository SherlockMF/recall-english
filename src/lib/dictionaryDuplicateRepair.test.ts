import { describe, expect, it } from 'vitest'
import type { Word } from '../domain/types'
import { planDictionaryDuplicateRepair } from './dictionaryDuplicateRepair'

const stamp = '2026-10-11T02:00:00.000Z'
const word: Word = { id: 'original', expression: 'test', lemma: 'test', senseKey: 'dictionary:test',
  zhGloss: '测试', enDefinition: 'a test', partOfSpeech: 'noun', acceptedZhAnswers: ['测试'], acceptedEnVariants: ['test'],
  source: 'dictionary', priority: 0, status: 'paused', examples: [], collocations: [], usagePrompts: [], createdAt: stamp, updatedAt: stamp }

describe('repair of untouched duplicate dictionary imports', () => {
  it('compares legacy and provider aliases while retaining earlier and reviewed records', () => {
    const original = { ...word, senseKey: 'dictionary:["noun","测试",""]', enDefinition: '', audioUk: 'https://dict.youdao.com/dictvoice?audio=test&type=1', createdAt: '2026-10-11T02:00:00Z', updatedAt: '2026-10-11T02:00:00Z' }
    const duplicate = { ...original, id: 'migration-duplicate', audioUk: undefined, senseKey: 'dictionary:youdao:["noun","测试",1]', createdAt: '2026-10-13T02:26:00Z', updatedAt: '2026-10-13T02:26:00Z' }
    const reviewed = { ...duplicate, id: 'reviewed-migration' }
    const aliases = new Map([original, duplicate, reviewed].map((entry) => [`test\u0000${entry.senseKey}`, 'test-source']))
    const repair = planDictionaryDuplicateRepair({ words: [original, duplicate, reviewed],
      tracks: [{ id: 'reviewed-track', itemId: reviewed.id, reps: 1, lapses: 0 }], attempts: [],
      memberships: [original, duplicate].map((entry, index) => ({ id: entry.id, wordId: entry.id, listId: 'list-daily', priority: 0, sortOrder: index })) },
      new Set(['test-source']), '2026-10-13T02:25:45.000Z', aliases)
    expect(repair.wordIds).toEqual([duplicate.id])
    expect(repair.trackIds).toEqual([])
  })

  it('removes only exact unused duplicates created during the affected import', () => {
    const words = [word, { ...word, id: 'duplicate' }, { ...word, id: 'edited', zhGloss: '用户改过' },
      { ...word, id: 'learned' }, { ...word, id: 'old', createdAt: '2026-10-08T00:00:00Z', updatedAt: '2026-10-08T00:00:00Z' }]
    const track = { id: 'learned-track', itemId: 'learned', reps: 3, lapses: 0 }
    const repair = planDictionaryDuplicateRepair({ words, tracks: [track], memberships: [], attempts: [] },
      new Set(['test\u0000dictionary:test']), '2026-10-11T01:57:30.188Z')
    expect(repair.wordIds.sort()).toEqual(['duplicate', 'original'])
    expect(repair.wordIds).not.toContain('old')
    expect(repair.wordIds).not.toContain('learned')
    expect(repair.wordIds).not.toContain('edited')
    expect(repair.trackIds).toEqual([])
  })

  it('keeps activated, prioritised and attempted records even when tracks still have zero repetitions', () => {
    const words = [word, { ...word, id: 'active', status: 'active' as const }, { ...word, id: 'attempted' }, { ...word, id: 'priority' }]
    const repair = planDictionaryDuplicateRepair({ words, tracks: [],
      memberships: [{ id: 'priority-list', wordId: 'priority', listId: 'list-my-vocabulary', priority: 0, sortOrder: 0 }],
      attempts: [{ itemId: 'attempted' }] }, new Set(['test\u0000dictionary:test']), '2026-10-11T01:57:30.188Z')
    expect(repair.wordIds).toEqual(['original'])
  })
})
