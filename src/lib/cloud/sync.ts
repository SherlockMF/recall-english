import type { ReviewAttempt } from '../../domain/types'
import { getAllReviewAttempts, getDatabaseAccount } from '../db'
import { applyCloudChanges, ensureCloudDependencies, readCloudState, resolveCloudConflict } from './storage'
import { mergeCloudRecord } from './merge'
import { CLOUD_DATA_CHANGED, cloudRecordId, type CloudChange, type CloudData, type QueueEntry } from './types'
import { validateCloudChanges } from './validation'

export interface CloudTransport {
  pull(revision: number, signal?: AbortSignal): Promise<{ revision: number; changes: CloudChange[] }>
  apply(revision: number, changes: Omit<CloudChange, 'revision'>[], signal?: AbortSignal): Promise<{ revision: number }>
}
export interface CloudConflict { entry: QueueEntry; remote: CloudData | null; label: string }
export interface CloudSyncState { phase: 'waiting' | 'syncing' | 'synced' | 'offline' | 'error' | 'conflict'; message: string; conflicts: CloudConflict[] }
interface SyncOptions { transport: CloudTransport; onState: (state: CloudSyncState) => void; onApplied: () => void; isBusy: () => boolean }
const order = { words: 0, lists: 1, memberships: 2, tracks: 3, attempts: 4, timeEntries: 5, settings: 6 }

export function createCloudSync({ transport, onState, onApplied, isBusy }: SyncOptions) {
  let stopped = false
  let running: Promise<void> | undefined
  let timer: ReturnType<typeof setInterval> | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  const controller = new AbortController()
  const account = getDatabaseAccount()
  const active = () => !stopped && account === getDatabaseAccount()
  const status = (phase: CloudSyncState['phase'], message: string, conflicts: CloudConflict[] = []) => { if (active()) onState({ phase, message, conflicts }) }
  const run = async () => {
    if (!active()) return
    if (isBusy()) { status('waiting', '当前操作结束后同步，修改已保存在本机。'); return }
    if (!navigator.onLine) { status('offline', '当前离线，修改已保存在本机，联网后继续同步。'); return }
    status('syncing', '正在同步…')
    try {
      for (let round = 0; round < 50 && active(); round++) {
        if (isBusy()) { status('waiting', '当前操作结束后同步，修改已保存在本机。'); return }
        let state = await readCloudState()
        const pulled = await transport.pull(state.revision, controller.signal)
        if (!active()) return
        if (isBusy()) { status('waiting', '当前操作结束后同步，修改已保存在本机。'); return }
        if (!Number.isSafeInteger(pulled.revision) || pulled.revision < state.revision) throw new Error('Invalid cloud revision')
        const changes = validateCloudChanges(pulled.changes)
        if (changes.some(change => change.revision > pulled.revision)) throw new Error('Invalid cloud revision')
        // Queue entries prevent an incoming snapshot from replacing unsent local changes.
        await applyCloudChanges(changes, pulled.revision)
        if (changes.length) onApplied()
        await ensureCloudDependencies()
        state = await readCloudState()
        if (!state.queue.length) { status('synced', '已同步'); return }
        const attempts = await getAllReviewAttempts()
        const mergedAttempts = [...new Map([...attempts, ...changes.filter(change => change.collection === 'attempts' && change.data).map(change => change.data as unknown as ReviewAttempt)].map(attempt => [attempt.id, attempt])).values()]
        const conflicts: CloudConflict[] = []
        const candidates = state.queue.map(entry => {
          const remote = state.remote.get(entry.id)
          const result = mergeCloudRecord(entry, remote, mergedAttempts)
          if (result.conflict) conflicts.push({ entry, remote: remote ?? null, label: String(entry.data?.expression ?? entry.data?.name ?? entry.key) })
          return { entry, data: result.data }
        })
        if (conflicts.length) { status('conflict', '检测到设备间修改冲突，双方内容均已保留。', conflicts); return }
        candidates.sort((a, b) => {
          if ((a.data === null) !== (b.data === null)) return a.data === null ? -1 : 1
          const direction = a.data === null ? -1 : 1
          return direction * (order[a.entry.collection] - order[b.entry.collection]) || a.entry.id.localeCompare(b.entry.id)
        })
        const batch = candidates.slice(0, 200)
        try {
          const committed = await transport.apply(state.revision, batch.map(({ entry, data }) => ({ collection: entry.collection, id: entry.key, data })), controller.signal)
          if (!active()) return
          if (isBusy()) { status('waiting', '云端已接收本批记录，当前操作结束后继续核对同步。'); return }
          if (!Number.isSafeInteger(committed.revision) || committed.revision <= state.revision) throw new Error('Invalid cloud commit')
          await applyCloudChanges(batch.map(({ entry, data }) => ({ collection: entry.collection, id: entry.key, data, revision: committed.revision })), committed.revision, new Map(batch.map(({ entry }) => [entry.id, { nonce: entry.nonce, localData: entry.data }])))
          onApplied()
        } catch (error) {
          if ((error as { code?: string }).code === '40001') continue
          throw error
        }
      }
      status('waiting', '本批同步已保存，剩余记录将继续上传。')
    } catch (error) {
      if (!active()) return
      if (error instanceof TypeError || !navigator.onLine) status('offline', '网络暂不可用，修改仍保存在本机，可重试同步。')
      else status('error', '同步未完成，本机数据已保留。请重试；若持续失败，请导出备份并联系管理员。')
    }
  }
  const sync = () => {
    if (running) return running
    running = (async () => {
      if (navigator.locks && account) await navigator.locks.request(`recall-cloud:${account}`, { signal: controller.signal }, run)
      else await run()
    })().catch(() => { status('error', '无法启动同步，请重新载入页面。本机修改已保留。') }).finally(() => { running = undefined })
    return running
  }
  const schedule = () => { clearTimeout(debounce); debounce = setTimeout(() => void sync(), 1000) }
  return {
    start() {
      window.addEventListener(CLOUD_DATA_CHANGED, schedule)
      window.addEventListener('online', schedule)
      timer = setInterval(() => void sync(), 30_000)
      void sync()
    },
    sync,
    stop() { stopped = true; controller.abort(); clearInterval(timer); clearTimeout(debounce); window.removeEventListener(CLOUD_DATA_CHANGED, schedule); window.removeEventListener('online', schedule) },
    async resolve(conflict: CloudConflict, keepLocal: boolean) {
      if (!active() || isBusy()) return
      await resolveCloudConflict(cloudRecordId(conflict.entry.collection, conflict.entry.key), conflict.entry.nonce, conflict.remote, keepLocal)
      onApplied()
      await sync()
    },
  }
}
