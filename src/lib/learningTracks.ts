import type { ListSlug, SystemListSlug } from '../domain/types'
import type { LearningEvidenceKey } from './learningEvidence'

/** Today-page learning tracks: taxonomy lists stay fine-grained in Library. */
export type LearningTrackId = 'daily' | 'business' | 'professional'

export interface LearningTrackDef {
  id: LearningTrackId
  label: string
  purpose: string
  lists: readonly SystemListSlug[]
  icon: 'book' | 'spark' | 'brain'
}

/**
 * Three primary practice tracks matching the product’s first goal:
 * Malaysian daily life, business communication, and finance/accounting study.
 * Future lists (travel, IELTS, …) should map into a track or stay Library-only.
 */
export const LEARNING_TRACKS: readonly LearningTrackDef[] = [
  {
    id: 'daily',
    label: '日常生活',
    purpose: '校园与本地生活',
    lists: ['daily'],
    icon: 'book',
  },
  {
    id: 'business',
    label: '商业英语',
    purpose: '沟通与创业场景',
    lists: ['business'],
    icon: 'spark',
  },
  {
    id: 'professional',
    label: '金融会计',
    purpose: '专业课与实习',
    lists: ['finance', 'accounting'],
    icon: 'brain',
  },
] as const

export interface LearningTrackSnapshot extends LearningTrackDef {
  learned: number
  total: number
}

/** Aggregate learning progress across the three Today-page tracks. */
export interface MapLearningProgress {
  /** Items with any review reps (> 未开始). */
  started: number
  /** Items with 双向可回忆 or 保持已验证 evidence. */
  usable: number
  /** Unique items in the three tracks. */
  total: number
}

export function snapshotLearningTracks(
  items: Array<{ id: string; listSlugs: readonly ListSlug[] }>,
  learnedItemIds: ReadonlySet<string>,
): LearningTrackSnapshot[] {
  return LEARNING_TRACKS.map((track) => {
    const ids = new Set(
      items
        .filter((item) => track.lists.some((list) => item.listSlugs.includes(list)))
        .map((item) => item.id),
    )
    let learned = 0
    for (const id of ids) {
      if (learnedItemIds.has(id)) learned += 1
    }
    return { ...track, learned, total: ids.size }
  })
}

export function countUniqueInTracks(
  items: Array<{ id: string; listSlugs: readonly ListSlug[] }>,
  tracks: readonly LearningTrackDef[] = LEARNING_TRACKS,
): number {
  const lists = new Set(tracks.flatMap((track) => track.lists))
  return new Set(
    items
      .filter((item) => item.listSlugs.some((slug) => lists.has(slug as SystemListSlug)))
      .map((item) => item.id),
  ).size
}

export function snapshotMapLearningProgress(
  items: Array<{ id: string; listSlugs: readonly ListSlug[] }>,
  stageByItemId: ReadonlyMap<string, LearningEvidenceKey | 'usable' | 'solid'>,
  tracks: readonly LearningTrackDef[] = LEARNING_TRACKS,
): MapLearningProgress {
  const lists = new Set(tracks.flatMap((track) => track.lists))
  const ids = new Set(
    items
      .filter((item) => item.listSlugs.some((slug) => lists.has(slug as SystemListSlug)))
      .map((item) => item.id),
  )

  let started = 0
  let usable = 0
  for (const id of ids) {
    const stage = stageByItemId.get(id) ?? 'new'
    if (stage !== 'new') started += 1
    if (stage === 'recall' || stage === 'retained' || stage === 'usable' || stage === 'solid') usable += 1
  }

  return { started, usable, total: ids.size }
}
