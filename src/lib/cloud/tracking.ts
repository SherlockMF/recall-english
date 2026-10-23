import type { IDBPDatabase, IDBPTransaction, StoreNames } from 'idb'
import type { RecallEnglishDatabase } from '../db'
import { CLOUD_DATA_CHANGED, COLLECTION_STORES, cloudRecordId, type CloudCollection, type CloudData } from './types'

type StoreName = StoreNames<RecallEnglishDatabase>
type WritableTransaction = IDBPTransaction<RecallEnglishDatabase, StoreName[], 'readwrite'>
interface StoreAccess {
  get(key: IDBValidKey): Promise<CloudData | undefined>
  getAll(): Promise<CloudData[]>
  put(value: unknown, key?: IDBValidKey): Promise<IDBValidKey>
  delete(key: IDBValidKey): Promise<void>
  clear(): Promise<void>
}
const byStore = new Map<string, CloudCollection>(Object.entries(COLLECTION_STORES).map(([collection, store]) => [store, collection as CloudCollection]))

export function trackDatabase(database: IDBPDatabase<RecallEnglishDatabase>, enabled: () => boolean) {
  const transaction = (names: StoreName | StoreName[], mode?: IDBTransactionMode, options?: IDBTransactionOptions) => {
    const originalNames = Array.isArray(names) ? names : [names]
    if (mode !== 'readwrite' || !enabled() || !originalNames.some(name => byStore.has(name))) {
      return database.transaction(originalNames, mode as 'readonly', options)
    }
    const raw = database.transaction([...new Set([...originalNames, 'cloudQueue' as const])], 'readwrite', options)
    const pending: Promise<unknown>[] = []
    const stores = new Map<string, StoreAccess>()
    let notified = false
    const completion = async () => {
      await Promise.all(pending)
      await raw.done
      if (!notified) { notified = true; window.dispatchEvent(new Event(CLOUD_DATA_CHANGED)) }
    }
    // Observe completion even when a caller uses individual database.put/delete shortcuts.
    void raw.done.then(completion).catch(() => undefined)
    const store = (name: StoreName): StoreAccess => {
      const cached = stores.get(name)
      if (cached) return cached
      const source = raw.objectStore(name) as unknown as StoreAccess
      const collection = byStore.get(name)
      if (!collection) return source
      const queue = raw.objectStore('cloudQueue')
      const mutate = async (key: string, data: CloudData | null, action: () => Promise<unknown>) => {
        const before = await source.get(key)
        await action()
        const id = cloudRecordId(collection, key)
        const existing = await queue.get(id)
        await queue.put({ id, collection, key, data, base: existing ? existing.base : before ?? null, nonce: crypto.randomUUID() })
      }
      const proxy = new Proxy(source, {
        get(target, property) {
          if (property === 'put') return (value: CloudData, key?: IDBValidKey) => {
            const id = String(key ?? value.id)
            const task = mutate(id, structuredClone(value), () => source.put(value, key)).then(() => id)
            pending.push(task)
            return task
          }
          if (property === 'delete') return (key: IDBValidKey) => {
            const task = mutate(String(key), null, () => source.delete(key))
            pending.push(task)
            return task
          }
          if (property === 'clear') return () => {
            const task = source.getAll().then(async records => {
              for (const record of records) await mutate(String(record.id), null, () => source.delete(String(record.id)))
            })
            pending.push(task)
            return task
          }
          const value = Reflect.get(target, property, target)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      stores.set(name, proxy)
      return proxy
    }
    return new Proxy(raw, {
      get(target, property) {
        if (property === 'objectStore') return store
        if (property === 'store') return originalNames.length === 1 ? store(originalNames[0]) : undefined
        if (property === 'done') return completion()
        const value = Reflect.get(target, property, target)
        return typeof value === 'function' ? value.bind(target) : value
      },
    }) as WritableTransaction
  }
  return new Proxy(database, {
    get(target, property) {
      if (property === 'transaction') return transaction
      if (['put', 'delete', 'clear'].includes(String(property))) return async (name: StoreName, ...args: unknown[]) => {
        const tx = transaction(name, 'readwrite') as WritableTransaction
        const source = tx.objectStore(name) as unknown as Record<string, (...values: unknown[]) => Promise<unknown>>
        const result = await source[String(property)](...args)
        await tx.done
        return result
      }
      const value = Reflect.get(target, property, target)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}
