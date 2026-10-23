import type { StoreNames } from 'idb'
import { getRawDatabase, type RecallEnglishDatabase } from '../db'
import { COLLECTION_STORES, cloudRecordId, type CloudChange, type CloudData } from './types'
import { mergeCloudRecord } from './merge'
import { unlockEligibleUsageTracks } from '../scheduler'

export async function readCloudState() {
  const database = await getRawDatabase()
  const tx = database.transaction(['cloudQueue', 'cloudMeta'], 'readonly')
  const [queue, meta] = await Promise.all([tx.objectStore('cloudQueue').getAll(), tx.objectStore('cloudMeta').getAll()])
  await tx.done
  const values = new Map(meta.map(record => [record.key, record.value]))
  return { queue, revision: Number(values.get('revision') ?? 0), sharedSeedIds: new Set((values.get('sharedSeedIds') ?? []) as string[]), remote: new Map(meta.filter(record => record.key.startsWith('remote:')).map(record => [record.key.slice(7), record.value as CloudData | null])) }
}

type Acknowledgement = { nonce: string; localData: CloudData | null }
export async function applyCloudChanges(changes: CloudChange[], revision: number, acknowledgements = new Map<string, Acknowledgement>()) {
  const database = await getRawDatabase()
  const stores: StoreNames<RecallEnglishDatabase>[] = [...Object.values(COLLECTION_STORES), 'cloudMeta', 'cloudQueue']
  const tx = database.transaction(stores, 'readwrite')
  for (const original of changes) {
    let change = original
    if (change.collection === 'words' && change.data?.source === 'seed' && (change.data.contentEdited === false || (change.data.contentEdited === undefined && change.data.updatedAt === change.data.createdAt))) {
      const current = await tx.objectStore('words').get(change.id)
      if (current?.source === 'seed' && (current.contentEdited === false || (current.contentEdited === undefined && current.updatedAt === current.createdAt))) {
        // Personal state must not restore lexical text from an older bundled revision.
        change = { ...change, data: { ...current, contentEdited: false, status: change.data.status, priority: change.data.priority, knownAt: change.data.knownAt, vocabularyLevel: change.data.vocabularyLevel, createdAt: change.data.createdAt, updatedAt: change.data.updatedAt } }
      }
    }
    const key = cloudRecordId(change.collection, change.id)
    const pending = await tx.objectStore('cloudQueue').get(key)
    await tx.objectStore('cloudMeta').put({ key: `remote:${key}`, value: change.data })
    if (pending) {
      const acknowledged = acknowledgements.get(key)
      if (!acknowledged) continue
      const nonce = acknowledged.nonce
      if (nonce !== pending.nonce) {
        if (pending.collection !== 'tracks') {
          const base = acknowledged.localData
          const merged = mergeCloudRecord({ ...pending, base }, change.data)
          if (!merged.conflict) {
            await tx.objectStore('cloudQueue').put({ ...pending, data: merged.data, base: change.data })
            const localStore = tx.objectStore(COLLECTION_STORES[pending.collection])
            if (merged.data === null) await localStore.delete(pending.key)
            else await (localStore.put as (data: unknown) => Promise<unknown>)(merged.data)
          }
        }
        continue
      }
      await tx.objectStore('cloudQueue').delete(key)
    }
    const store = tx.objectStore(COLLECTION_STORES[change.collection])
    if (change.data === null) await store.delete(change.id)
    else await (store.put as (data: unknown) => Promise<unknown>)(change.data)
  }
  const affected = new Set(changes.filter(change => change.data && ['attempts', 'tracks'].includes(change.collection)).map(change => String(change.data!.itemId)))
  for (const itemId of affected) {
    const tracks = await tx.objectStore('tracks').index('by-item').getAll(itemId)
    const attempts = await tx.objectStore('attempts').index('by-item').getAll(itemId)
    const reconciled = unlockEligibleUsageTracks(tracks, new Date(), attempts)
    for (let index = 0; index < reconciled.length; index++) {
      if (reconciled[index] !== tracks[index]) {
        await tx.objectStore('tracks').put(reconciled[index])
        const pending = await tx.objectStore('cloudQueue').get(cloudRecordId('tracks', reconciled[index].id))
        if (pending) await tx.objectStore('cloudQueue').put({ ...pending, data: reconciled[index] as unknown as CloudData, nonce: crypto.randomUUID() })
      }
    }
  }
  await tx.objectStore('cloudMeta').put({ key: 'revision', value: revision })
  await tx.done
}

export async function resolveCloudConflict(id: string, nonce: string, remote: CloudData | null, keepLocal: boolean) {
  const database = await getRawDatabase()
  const stores: StoreNames<RecallEnglishDatabase>[] = [...Object.values(COLLECTION_STORES), 'cloudQueue']
  const tx = database.transaction(stores, 'readwrite')
  const entry = await tx.objectStore('cloudQueue').get(id)
  if (!entry || entry.nonce !== nonce) { await tx.done; throw new Error('内容又有更新，请重新同步后处理冲突。') }
  if (keepLocal) await tx.objectStore('cloudQueue').put({ ...entry, base: remote, allowRestore: remote === null, nonce: crypto.randomUUID() })
  else {
    const store = tx.objectStore(COLLECTION_STORES[entry.collection])
    if (remote === null) await store.delete(entry.key)
    else await (store.put as (data: unknown) => Promise<unknown>)(remote)
    await tx.objectStore('cloudQueue').delete(id)
  }
  await tx.done
}

export async function ensureCloudDependencies() {
  const state = await readCloudState()
  const database = await getRawDatabase()
  const tx = database.transaction(['words', 'tracks', 'vocabularyLists', 'cloudQueue'], 'readwrite')
  const queue = tx.objectStore('cloudQueue')
  const add = async (collection: 'words' | 'tracks' | 'lists', key: string) => {
    const id = cloudRecordId(collection, key)
    if (state.remote.has(id) && state.remote.get(id) !== null) return
    if (await queue.get(id)) return
    const data = await tx.objectStore(COLLECTION_STORES[collection]).get(key)
    if (!data) throw new Error('关联学习资料缺失，请先导出备份并检查数据。')
    // Unchanged shared seeds are already present in the administrator-owned words table.
    if (collection === 'words' && state.sharedSeedIds.has(key) && !state.remote.has(id)) return
    await queue.put({ id, collection, key, data: data as unknown as CloudData, base: null, nonce: crypto.randomUUID() })
    if (collection === 'tracks' && 'itemId' in data) await add('words', data.itemId)
  }
  for (const entry of state.queue) {
    if (!entry.data) continue
    if (entry.collection === 'attempts') await add('tracks', String(entry.data.trackId))
    if (entry.collection === 'tracks') await add('words', String(entry.data.itemId))
    if (entry.collection === 'memberships') {
      await add('words', String(entry.data.wordId))
      await add('lists', String(entry.data.listId))
    }
  }
  await tx.done
}

export async function restoreCloudCache() {
  const state = await readCloudState()
  const changes = [...state.remote].map(([key, data]) => {
    const separator = key.indexOf(':')
    return { collection: key.slice(0, separator), id: key.slice(separator + 1), data, revision: state.revision } as CloudChange
  })
  await applyCloudChanges(changes, state.revision)
}
