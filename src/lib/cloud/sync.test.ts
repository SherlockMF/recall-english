import { afterEach, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../../domain/types'
import { closeDatabase, getDatabase, putSettings, selectDatabaseAccount, setDatabaseTrackingEnabled } from '../db'
import { createCloudSync, type CloudSyncState, type CloudTransport } from './sync'
import { readCloudState } from './storage'
import type { CloudChange } from './types'

const account = '33333333-3333-4333-8333-333333333333'
afterEach(async () => {
  vi.unstubAllGlobals()
  setDatabaseTrackingEnabled(false)
  await selectDatabaseAccount(null)
  await closeDatabase()
  await new Promise<void>(resolve => { const request = indexedDB.deleteDatabase(`recall-english:${account}`); request.onsuccess = () => resolve() })
})

it('uses a valid cancellable Web Locks request in browsers that implement the API', async () => {
  await selectDatabaseAccount(account)
  const request = vi.fn(async (_name: string, options: { ifAvailable?: boolean; signal?: AbortSignal }, callback: () => Promise<void>) => {
    if (options.ifAvailable && options.signal) throw new DOMException('signal cannot be used with ifAvailable', 'NotSupportedError')
    await callback()
  })
  vi.stubGlobal('navigator', { onLine: true, locks: { request } })
  const pull = vi.fn(async () => ({ revision: 0, changes: [] }))
  const sync = createCloudSync({ transport: { pull, apply: vi.fn() }, onState: vi.fn(), onApplied: vi.fn(), isBusy: () => false })
  await sync.sync()
  sync.stop()
  expect(pull).toHaveBeenCalledOnce()
})

it('keeps offline writes and retries a CAS conflict without losing the other device edit', async () => {
  await selectDatabaseAccount(account)
  await putSettings(DEFAULT_SETTINGS)
  setDatabaseTrackingEnabled(true)
  await putSettings({ ...DEFAULT_SETTINGS, newItemsPerDay: 7 })
  let revision = 0
  let remote: CloudChange[] = []
  let calls = 0
  const transport: CloudTransport = {
    pull: async () => ({ revision, changes: remote }),
    apply: async (_version, changes) => {
      calls++
      if (calls === 1) { revision = 1; remote = [{ collection: 'settings', id: 'primary', data: { ...DEFAULT_SETTINGS, dailyMinutes: 25 }, revision }]; throw Object.assign(new Error('conflict'), { code: '40001' }) }
      expect(changes.find(change => change.collection === 'settings')?.data).toMatchObject({ newItemsPerDay: 7, dailyMinutes: 25 })
      revision++
      remote = changes.map(change => ({ ...change, revision }))
      return { revision }
    },
  }
  const applied = vi.fn()
  const sync = createCloudSync({ transport, onState: vi.fn(), onApplied: applied, isBusy: () => false })
  await sync.sync()
  sync.stop()
  expect((await readCloudState()).queue).toHaveLength(0)
  expect((await (await getDatabase()).get('settings', 'primary'))?.dailyMinutes).toBe(25)
  expect(calls).toBe(2)
})

it('retains pending edits on network failure and pauses cloud application during a study session', async () => {
  await selectDatabaseAccount(account)
  setDatabaseTrackingEnabled(true)
  await putSettings(DEFAULT_SETTINGS)
  const pull = vi.fn().mockRejectedValue(new TypeError('offline'))
  let busy = true
  const states: CloudSyncState[] = []
  const sync = createCloudSync({ transport: { pull, apply: vi.fn() }, onState: state => states.push(state), onApplied: vi.fn(), isBusy: () => busy })
  await sync.sync()
  expect(pull).not.toHaveBeenCalled()
  busy = false
  await sync.sync()
  sync.stop()
  expect((await readCloudState()).queue).toHaveLength(1)
  expect(states.at(-1)?.phase).toBe('offline')
})
