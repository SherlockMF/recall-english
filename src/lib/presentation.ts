import type { LearningTrack, ListSlug, TrackType, VocabularyItem } from '../domain/types'

export const categoryLabels: Record<ListSlug | 'other', string> = {
  daily: '日常生活',
  business: '商业英语',
  finance: '金融英语',
  accounting: '会计英语',
  'my-vocabulary': '我的词库',
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

export function getItemStage(item: VocabularyItem, tracks: LearningTrack[]) {
  const itemTracks = tracks.filter((track) => track.itemId === item.id)
  const receptive = itemTracks.find((track) => track.type === 'receptive')
  const productive = itemTracks.find((track) => track.type === 'productive')
  const usage = itemTracks.find((track) => track.type === 'usage')

  if (!receptive?.reps && !productive?.reps) return { key: 'new', label: '未开始' }
  const sevenDays = 7 * 24 * 60 * 60 * 1000
  const receptiveSolid = receptive?.lastGoodAt && receptive.firstGoodAt
    ? new Date(receptive.lastGoodAt).getTime() - new Date(receptive.firstGoodAt).getTime() >= sevenDays
    : false
  const productiveSolid = productive?.lastGoodAt && productive.firstGoodAt
    ? new Date(productive.lastGoodAt).getTime() - new Date(productive.firstGoodAt).getTime() >= sevenDays
    : false
  if (receptiveSolid && productiveSolid && usage?.lastGoodAt) {
    return { key: 'solid', label: '已稳固' }
  }
  if (receptive?.lastGoodAt && productive?.lastGoodAt && usage?.lastGoodAt) {
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
