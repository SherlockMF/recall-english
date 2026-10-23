import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type LearningTrack, type ReviewAttempt, type VocabularyList, type Word } from '../src/domain/types'
import { closeDatabase, deleteVocabularyItem, getDatabase, initializeDatabase, recordReview,
  selectDatabaseAccount, setDatabaseTrackingEnabled, writeBatch } from '../src/lib/db'
import { createInitialTracks, scheduleReview } from '../src/lib/scheduler'
import { createCloudSync, type CloudSyncState, type CloudTransport } from '../src/lib/cloud/sync'
import { readCloudState } from '../src/lib/cloud/storage'
import type { CloudChange } from '../src/lib/cloud/types'

const now = '2026-10-23T00:00:00.000Z'
const reviewedAt = '2026-10-23T01:00:00.000Z'
const sharedId = 'integration-shared-word'
const word = (id: string, source: Word['source'] = 'custom'): Word => ({
  id, expression: 'hello', lemma: 'hello', senseKey: id, zhGloss: '你好', enDefinition: 'a greeting',
  partOfSpeech: 'interjection', acceptedZhAnswers: ['你好'], acceptedEnVariants: ['hello'],
  examples: [], collocations: [], source, priority: 0, status: 'active', usagePrompts: [], createdAt: now, updatedAt: now,
})
const list = (id: string): VocabularyList => ({ id, name: id, slug: 'my-vocabulary', category: 'my-vocabulary',
  description: '', isSystem: false, createdAt: now })
const attempt = (id: string, track: LearningTrack): ReviewAttempt => ({ id, trackId: track.id, itemId: track.itemId,
  trackType: track.type, promptType: 'meaning', answer: '你好', rating: 'good', hintLevel: 0, responseMs: 1000,
  reviewedAt, desiredRetention: 0.9, trackBefore: track })

let db: PGlite
let account: string
let runningSync: ReturnType<typeof createCloudSync> | undefined

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)
  await db.exec(await readFile('supabase/migrations/202610230001_cloud.sql', 'utf8'))
  await db.query('insert into words(id,data) values ($1,$2::jsonb)', [sharedId, JSON.stringify(word(sharedId, 'seed'))])
}, 30_000)

beforeEach(async () => {
  account = crypto.randomUUID()
  await db.exec('reset role')
  await db.query('insert into auth.users(id) values ($1)', [account])
  await db.query('insert into app_memberships(user_id) values ($1)', [account])
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [account])
  await selectDatabaseAccount(account)
  setDatabaseTrackingEnabled(false)
  vi.stubGlobal('navigator', { onLine: true })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Integration tests must not access the network') }))
})

afterEach(async () => {
  runningSync?.stop()
  runningSync = undefined
  setDatabaseTrackingEnabled(false)
  await selectDatabaseAccount(null)
  await closeDatabase()
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(`recall-english:${account}`)
    request.addEventListener('success', () => resolve(), { once: true })
    request.addEventListener('error', () => reject(request.error), { once: true })
    request.addEventListener('blocked', () => reject(new Error('Account database remained open')), { once: true })
  })
  await db.exec('reset role')
  await db.query('delete from auth.users where id=$1', [account])
  vi.unstubAllGlobals()
})
afterAll(async () => { await db?.close() })

function sqlTransport() {
  const batches: Array<Omit<CloudChange, 'revision'>[]> = []
  const errors: unknown[] = []
  const transport: CloudTransport = {
    pull: async (revision) => {
      try {
        return (await db.query<{ result: { revision: number; changes: CloudChange[] } }>(
          'select cloud_pull($1) result', [revision])).rows[0].result
      } catch (error) { errors.push(error); throw error }
    },
    apply: async (revision, changes) => {
      batches.push(changes)
      try {
        return (await db.query<{ result: { revision: number } }>(
          'select cloud_apply($1,$2::jsonb) result', [revision, JSON.stringify(changes)])).rows[0].result
      } catch (error) { errors.push(error); throw error }
    },
  }
  const states: CloudSyncState[] = []
  runningSync = createCloudSync({ transport, onState: state => states.push(state), onApplied: () => {}, isBusy: () => false })
  return { batches, errors, states, sync: runningSync.sync }
}

async function cloudRows(table: string) {
  return (await db.query<{ id: string; data: unknown; deleted: boolean }>(`select id,data,deleted from ${table} order by id`)).rows
}
async function expectSynced(harness: ReturnType<typeof sqlTransport>) {
  expect(harness.errors).toEqual([])
  expect(harness.states.at(-1)?.phase).toBe('synced')
  expect((await readCloudState()).queue).toHaveLength(0)
}

describe.sequential('real IndexedDB → sync engine → Supabase SQL integration', () => {
  it('syncs a first review after static initialization without copying the unchanged shared word', async () => {
    const shared = word(sharedId, 'seed')
    const tracks = createInitialTracks([shared], now)
    await initializeDatabase([shared], [], tracks)
    expect((await readCloudState()).queue).toHaveLength(0)
    setDatabaseTrackingEnabled(true)
    await recordReview({ trackId: tracks[0].id, rating: 'good', desiredRetention: 0.9,
      reviewedAt: new Date(reviewedAt), attempt: attempt('shared-first-review', tracks[0]) })
    const harness = sqlTransport()
    await harness.sync()
    await expectSynced(harness)
    expect(await cloudRows('user_words')).toEqual([])
    expect(await cloudRows('learning_tracks')).toHaveLength(1)
    expect((await cloudRows('review_attempts'))[0].data).toMatchObject({ id: 'shared-first-review', itemId: sharedId,
      desiredRetention: 0.9, trackBefore: { id: tracks[0].id, reps: 0 } })
    expect((await (await getDatabase()).get('tracks', tracks[0].id))?.reps).toBe(1)
    expect(await (await getDatabase()).get('words', sharedId)).toEqual(shared)
    expect((await readCloudState()).revision).toBeGreaterThan(0)
  })

  it('adds an initially unqueued personal dictionary word before uploading its first review', async () => {
    const personal = word('integration-dictionary', 'dictionary')
    const tracks = createInitialTracks([personal], now)
    await writeBatch({ words: [personal], tracks })
    expect((await readCloudState()).queue).toHaveLength(0)
    setDatabaseTrackingEnabled(true)
    await recordReview({ trackId: tracks[0].id, rating: 'good', desiredRetention: 0.9,
      reviewedAt: new Date(reviewedAt), attempt: attempt('dictionary-first-review', tracks[0]) })
    const harness = sqlTransport()
    await harness.sync()
    await expectSynced(harness)
    expect((await cloudRows('user_words'))[0].data).toEqual(personal)
    expect(await cloudRows('learning_tracks')).toHaveLength(1)
    expect((await cloudRows('review_attempts'))[0].data).toMatchObject({ itemId: personal.id })
    const database = await getDatabase()
    expect(await database.get('words', personal.id)).toEqual(personal)
    expect((await database.get('tracks', tracks[0].id))?.reps).toBe(1)
    expect(await database.get('attempts', 'dictionary-first-review')).toBeDefined()
  })

  it('uploads and deletes more than 200 parent/child records over multiple real CAS batches', async () => {
    const words = Array.from({ length: 61 }, (_, index) => word(`bulk-word-${index}`))
    const lists = words.map((_, index) => list(`bulk-list-${index}`))
    const tracks = words.map(item => createInitialTracks([item], now)[0])
    const attempts = tracks.map((track, index) => attempt(`bulk-attempt-${index}`, track))
    const memberships = words.map((item, index) => ({ id: `bulk-member-${index}`, wordId: item.id,
      listId: lists[index].id, priority: 0, sortOrder: 0 }))
    setDatabaseTrackingEnabled(true)
    await writeBatch({ words, lists, memberships, tracks, attempts })
    expect((await readCloudState()).queue).toHaveLength(305)
    const harness = sqlTransport()
    await harness.sync()
    await expectSynced(harness)
    expect(harness.batches.length).toBeGreaterThan(1)
    expect(harness.batches.every(batch => batch.length <= 200)).toBe(true)
    const tables = ['user_words', 'vocabulary_lists', 'word_list_items', 'learning_tracks', 'review_attempts']
    for (const rows of await Promise.all(tables.map(cloudRows))) {
      expect(rows).toHaveLength(61)
      expect(rows.every(row => !row.deleted && row.data !== null)).toBe(true)
    }
    const database = await getDatabase()
    expect(await database.count('words')).toBe(61)
    expect(await database.count('attempts')).toBe(61)
    await Promise.all(words.map(item => deleteVocabularyItem(item.id)))
    const tx = database.transaction('vocabularyLists', 'readwrite')
    await Promise.all(lists.map(item => tx.store.delete(item.id)))
    await tx.done
    expect((await readCloudState()).queue).toHaveLength(305)
    const previousBatches = harness.batches.length
    await harness.sync()
    await expectSynced(harness)
    expect(harness.batches.length - previousBatches).toBeGreaterThan(1)
    expect(harness.batches.slice(previousBatches).every(batch => batch.length <= 200 && batch.every(row => row.data === null))).toBe(true)
    for (const rows of await Promise.all(tables.map(cloudRows))) {
      expect(rows).toHaveLength(61)
      expect(rows.every(row => row.deleted && row.data === null)).toBe(true)
    }
    expect(await database.count('words')).toBe(0)
    expect(await database.count('vocabularyLists')).toBe(0)
    expect(await database.count('wordListItems')).toBe(0)
    expect(await database.count('tracks')).toBe(0)
    expect(await database.count('attempts')).toBe(0)
  }, 30_000)

  it('restores an empty device from the initial real cloud pull without creating an upload queue', async () => {
    const remoteWord = word('remote-word')
    const remoteList = list('remote-list')
    const beforeTrack = createInitialTracks([remoteWord], now)[0]
    const remoteTrack = scheduleReview(beforeTrack, 'good', reviewedAt, 0.9)
    const remoteAttempt = attempt('remote-attempt', beforeTrack)
    const remoteMembership = { id: 'remote-member', wordId: remoteWord.id, listId: remoteList.id, priority: 0, sortOrder: 0 }
    const remoteTime = { id: 'remote-time', sessionId: 'remote-session', localDate: '2026-10-23', activeMs: 1234, updatedAt: reviewedAt }
    const changes = [
      { collection: 'words', id: remoteWord.id, data: remoteWord },
      { collection: 'lists', id: remoteList.id, data: remoteList },
      { collection: 'memberships', id: remoteMembership.id, data: remoteMembership },
      { collection: 'tracks', id: remoteTrack.id, data: remoteTrack },
      { collection: 'attempts', id: remoteAttempt.id, data: remoteAttempt },
      { collection: 'settings', id: 'primary', data: DEFAULT_SETTINGS },
      { collection: 'timeEntries', id: remoteTime.id, data: remoteTime },
    ]
    await db.query('select cloud_apply(0,$1::jsonb)', [JSON.stringify(changes)])
    setDatabaseTrackingEnabled(true)
    expect((await readCloudState()).queue).toHaveLength(0)
    const harness = sqlTransport()
    await harness.sync()
    await expectSynced(harness)
    expect(harness.batches).toHaveLength(0)
    expect((await readCloudState()).revision).toBe(1)
    const database = await getDatabase()
    expect(await database.get('words', remoteWord.id)).toEqual(remoteWord)
    expect(await database.get('vocabularyLists', remoteList.id)).toEqual(remoteList)
    expect(await database.get('wordListItems', remoteMembership.id)).toEqual(remoteMembership)
    expect(await database.get('tracks', remoteTrack.id)).toEqual(remoteTrack)
    expect(await database.get('attempts', remoteAttempt.id)).toEqual(remoteAttempt)
    expect(await database.get('settings', 'primary')).toEqual(DEFAULT_SETTINGS)
    expect(await database.get('timeEntries', remoteTime.id)).toEqual(remoteTime)
    expect((await cloudRows('user_words'))[0].data).toEqual(remoteWord)
    expect(await cloudRows('review_attempts')).toHaveLength(1)
  })
})
