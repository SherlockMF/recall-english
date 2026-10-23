import type { LearningTrack, ReviewAttempt } from '../../domain/types'
import { scheduleReview } from '../scheduler'
import type { CloudData, QueueEntry } from './types'

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value) ?? 'undefined'
}
export const sameCloudData = (left: unknown, right: unknown) => canonical(left) === canonical(right)

export function mergeCloudRecord(entry: QueueEntry, remote: CloudData | null | undefined, attempts: ReviewAttempt[] = []): { data: CloudData | null; conflict: boolean } {
  const { data: local, base } = entry
  if (remote === undefined || sameCloudData(local, remote)) return { data: local, conflict: false }
  if (remote === null && local !== null && !entry.allowRestore) return { data: local, conflict: true }
  if (sameCloudData(base, remote)) return { data: local, conflict: false }
  if (sameCloudData(local, base)) return { data: remote, conflict: false }
  if (local === null || remote === null) return { data: local, conflict: true }
  if (entry.collection === 'timeEntries') return { data: Number(local.activeMs) >= Number(remote.activeMs) ? local : remote, conflict: false }
  if (entry.collection === 'attempts') return { data: local, conflict: true }
  if (entry.collection === 'tracks') {
    const baseline = base as unknown as LearningTrack | null
    if (!baseline) return { data: local, conflict: true }
    const history = [...new Map(attempts.filter(attempt => attempt.trackId === local.id).map(attempt => [attempt.id, attempt])).values()]
    const events = history.filter(attempt => attempt.trackBefore && attempt.desiredRetention !== undefined)
      .sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id))
    if (events.length < 2) return { data: local, conflict: true }
    let track = events.reduce((oldest, event) => event.trackBefore!.reps < oldest.reps ? event.trackBefore! : oldest, baseline)
    const cutoff = track.lastReview ? Date.parse(track.lastReview) : Number.NEGATIVE_INFINITY
    if (history.some(event => (!event.trackBefore || event.desiredRetention === undefined) && Date.parse(event.reviewedAt) >= cutoff)) return { data: local, conflict: true }
    for (const event of events) {
      if (track.lastReview && Date.parse(event.reviewedAt) < Date.parse(track.lastReview)) return { data: local, conflict: true }
      track = scheduleReview(track, event.rating, event.reviewedAt, event.desiredRetention)
    }
    if (track.reps < Math.max(Number(local.reps), Number(remote.reps))) return { data: local, conflict: true }
    return { data: track as unknown as CloudData, conflict: false }
  }
  const merged: CloudData = {}
  let conflict = false
  for (const key of new Set([...Object.keys(base ?? {}), ...Object.keys(local), ...Object.keys(remote)])) {
    const localChanged = !sameCloudData(local[key], base?.[key])
    const remoteChanged = !sameCloudData(remote[key], base?.[key])
    if (key === 'updatedAt') merged[key] = [local[key], remote[key]].filter(value => typeof value === 'string').sort().at(-1)
    else if (localChanged && remoteChanged && !sameCloudData(local[key], remote[key])) {
      conflict = true
      merged[key] = local[key]
    } else merged[key] = localChanged ? local[key] : remote[key]
  }
  return { data: merged, conflict }
}
