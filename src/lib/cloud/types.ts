export const COLLECTION_STORES = {
  words: 'words', lists: 'vocabularyLists', memberships: 'wordListItems',
  tracks: 'tracks', attempts: 'attempts', timeEntries: 'timeEntries', settings: 'settings',
} as const

export type CloudCollection = keyof typeof COLLECTION_STORES
export type CloudData = Record<string, unknown>
export interface CloudChange { collection: CloudCollection; id: string; data: CloudData | null; revision: number }
export interface QueueEntry {
  id: string
  collection: CloudCollection
  key: string
  data: CloudData | null
  base: CloudData | null
  nonce: string
  allowRestore?: boolean
}
export interface CloudMeta { key: string; value: unknown }
export const CLOUD_DATA_CHANGED = 'recall-cloud-data-changed'
export const cloudRecordId = (collection: CloudCollection, id: string) => `${collection}:${id}`
