import type { StudyTimeEntry } from '../domain/types'

export const IDLE_TIMEOUT_MS = 120_000

export function localStudyDate(value: number | Date = Date.now()) {
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Monotonic elapsed time drives durations; wall time only assigns the local day. */
export class StudyClock {
  private records = new Map<string, StudyTimeEntry>()
  private previous?: { wall: number; monotonic: number; enabled: boolean }
  private lastInteraction?: number
  idle = false

  constructor(private sessionId: string, entries: StudyTimeEntry[] = []) {
    for (const entry of entries.filter((candidate) => candidate.sessionId === sessionId)) {
      const current = this.records.get(entry.localDate)
      if (!current || current.activeMs < entry.activeMs) this.records.set(entry.localDate, { ...entry })
    }
  }

  get totalMs() { return this.entries().reduce((sum, entry) => sum + entry.activeMs, 0) }
  entries() { return [...this.records.values()].map((entry) => ({ ...entry })) }

  sample(wall: number, monotonic: number, enabled: boolean) {
    if (this.lastInteraction === undefined) this.lastInteraction = monotonic
    if (this.previous?.enabled) {
      const elapsed = Math.max(0, monotonic - this.previous.monotonic)
      const remaining = Math.max(0, IDLE_TIMEOUT_MS - (this.previous.monotonic - this.lastInteraction))
      this.add(this.previous.wall, Math.min(elapsed, remaining), wall)
    }
    this.idle = monotonic - this.lastInteraction >= IDLE_TIMEOUT_MS
    this.previous = { wall, monotonic, enabled }
    return this.totalMs
  }

  interact(wall: number, monotonic: number, enabled: boolean) {
    this.sample(wall, monotonic, enabled)
    this.lastInteraction = monotonic
    this.idle = false
  }

  private add(start: number, duration: number, updatedAt: number) {
    let cursor = start
    let remaining = duration
    while (remaining > 0) {
      const date = new Date(cursor)
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime()
      const part = Math.min(remaining, midnight - cursor)
      const localDate = localStudyDate(cursor)
      const current = this.records.get(localDate)
      this.records.set(localDate, {
        id: `${this.sessionId}:${localDate}`,
        sessionId: this.sessionId,
        localDate,
        activeMs: (current?.activeMs ?? 0) + part,
        updatedAt: new Date(updatedAt).toISOString(),
      })
      remaining -= part
      cursor += part
    }
  }
}
