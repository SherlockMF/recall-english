import { describe, expect, it } from 'vitest'
import {
  countUniqueInTracks,
  snapshotLearningTracks,
  snapshotMapLearningProgress,
} from './learningTracks'

describe('learningTracks', () => {
  it('merges finance and accounting into one professional track', () => {
    const items = [
      { id: 'a', listSlugs: ['daily'] as const },
      { id: 'b', listSlugs: ['business'] as const },
      { id: 'c', listSlugs: ['finance'] as const },
      { id: 'd', listSlugs: ['accounting'] as const },
      { id: 'e', listSlugs: ['finance', 'accounting'] as const },
    ]
    const snapshots = snapshotLearningTracks(items, new Set(['a', 'e']))
    expect(snapshots.map((row) => ({
      id: row.id,
      learned: row.learned,
      total: row.total,
    }))).toEqual([
      { id: 'daily', learned: 1, total: 1 },
      { id: 'business', learned: 0, total: 1 },
      { id: 'professional', learned: 1, total: 3 },
    ])
    expect(countUniqueInTracks(items)).toBe(5)
  })

  it('summarizes started and usable progress without double-counting', () => {
    const items = [
      { id: 'a', listSlugs: ['daily'] as const },
      { id: 'b', listSlugs: ['business'] as const },
      { id: 'c', listSlugs: ['finance', 'accounting'] as const },
      { id: 'mine', listSlugs: ['my-vocabulary'] as const },
    ]
    const progress = snapshotMapLearningProgress(items, new Map([
      ['a', 'learning'],
      ['b', 'usable'],
      ['c', 'solid'],
      ['mine', 'usable'],
    ]))
    expect(progress).toEqual({ started: 3, usable: 2, total: 3 })
  })

  it('counts shared recall and retained evidence for basic learning-map progress', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ id, listSlugs: ['daily'] as const }))
    expect(snapshotMapLearningProgress(items, new Map([
      ['a', 'learning'], ['b', 'recall'], ['c', 'retained'],
    ]))).toEqual({ started: 3, usable: 2, total: 3 })
  })
})
