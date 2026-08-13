import type { LearningTrack, ListSlug, TrackType, VocabularyItem } from '../domain/types'

export const categoryLabels: Record<ListSlug | 'other', string> = {
  daily: '日常生活',
  business: '商业英语',
  finance: '金融英语',
  accounting: '会计英语',
  'my-vocabulary': '优先学习',
  other: '其他',
}

export const trackLabels: Record<TrackType, string> = {
  receptive: '理解意思',
  productive: '主动表达',
  usage: '真实使用',
}

export function greetingFor(date: Date) {
  const hour = date.getHours()
  if (hour < 11) return '早上好'
  if (hour < 14) return '中午好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

export function formatToday(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(date)
}

export type ItemStageKey = 'new' | 'learning' | 'usable' | 'solid'

function hasActiveGood(track: LearningTrack | undefined) {
  if (!track?.lastGoodAt) return false
  if (!track.lastReview) return true
  return new Date(track.lastReview).getTime() <= new Date(track.lastGoodAt).getTime()
}

function isSolidTrack(track: LearningTrack | undefined) {
  if (!hasActiveGood(track) || !track?.firstGoodAt || !track.lastGoodAt) return false
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  return new Date(track.lastGoodAt).getTime() - new Date(track.firstGoodAt).getTime() >= sevenDays
}

export function getItemStage(
  item: VocabularyItem,
  tracks: LearningTrack[],
): { key: ItemStageKey; label: string } {
  const itemTracks = tracks.filter((track) => track.itemId === item.id)
  const receptive = itemTracks.find((track) => track.type === 'receptive')
  const productive = itemTracks.find((track) => track.type === 'productive')
  const usage = itemTracks.find((track) => track.type === 'usage')

  if (!receptive?.reps && !productive?.reps) return { key: 'new', label: '未开始' }
  if (isSolidTrack(receptive) && isSolidTrack(productive) && hasActiveGood(usage)) {
    return { key: 'solid', label: '已稳固' }
  }
  if (hasActiveGood(receptive) && hasActiveGood(productive) && hasActiveGood(usage)) {
    return { key: 'usable', label: '会使用' }
  }
  return { key: 'learning', label: '学习中' }
}

export function expressionHint(expression: string, level: number) {
  const words = expression.split(/\s+/)
  if (level <= 0) return ''
  if (level === 1) {
    return words.map((word) => `${word[0] ?? ''}${'·'.repeat(Math.max(1, word.length - 1))}`).join(' ')
  }
  return `${words.length} 个词 / ${expression.length} 个字符`
}
