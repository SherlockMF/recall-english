import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const alice = '00000000-0000-0000-0000-000000000001'
const bob = '00000000-0000-0000-0000-000000000002'
const disabled = '00000000-0000-0000-0000-000000000003'
let db: PGlite
type Change = { collection: string; id: string; data: Record<string, unknown> | null }
type Pull = { revision: number; changes: Array<Change & { revision: number }> }

async function as(role: string, user?: string) {
  await db.exec(`reset role; set role ${role};`)
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user ?? ''])
}
async function apply(revision: number, changes: Change[]) {
  return (await db.query<{ result: { revision: number } }>(
    'select cloud_apply($1, $2::jsonb) as result', [revision, JSON.stringify(changes)])).rows[0].result
}
async function pull(revision = 0) {
  return (await db.query<{ result: Pull }>('select cloud_pull($1) as result', [revision])).rows[0].result
}
const change = (collection: string, id: string, rest = {}): Change => ({ collection, id, data: { id, ...rest } })

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
    insert into auth.users values ('${alice}'), ('${bob}'), ('${disabled}');
  `)
  await db.exec(await readFile('supabase/migrations/202610230001_cloud.sql', 'utf8'))
  await as('service_role')
  await db.query('insert into app_memberships(user_id, active) values ($1,true),($2,true),($3,false)', [alice, bob, disabled])
  await db.query('insert into words(id,data) values ($1,$2::jsonb)', ['shared', JSON.stringify({ id: 'shared', expression: 'shared' })])
}, 30_000)
afterAll(async () => { await db?.close() })

describe.sequential('Supabase database access and sync', () => {
  it('denies anonymous access and denies disabled users even to shared words/RPC', async () => {
    await as('anon')
    await expect(db.query('select * from words')).rejects.toMatchObject({ code: '42501' })
    await expect(pull()).rejects.toMatchObject({ code: '42501' })
    await as('authenticated', disabled)
    expect((await db.query('select * from words')).rows).toEqual([])
    expect((await db.query('select * from app_memberships')).rows).toEqual([])
    await expect(apply(0, [change('settings', 'primary')])).rejects.toMatchObject({ code: '42501' })
    await expect(pull()).rejects.toMatchObject({ code: '42501' })
  })

  it('provides active member access but never grants member/seed/sync privilege escalation', async () => {
    await as('authenticated', alice)
    expect((await db.query<{ user_id: string }>('select user_id from app_memberships')).rows).toEqual([{ user_id: alice }])
    expect((await db.query('select * from words')).rows).toHaveLength(1)
    await expect(db.query('update app_memberships set active = false')).rejects.toMatchObject({ code: '42501' })
    await expect(db.query("insert into words values ('bad', '{\"id\":\"bad\"}')")).rejects.toMatchObject({ code: '42501' })
    await expect(db.query("insert into user_settings(user_id,id,data,revision,deleted) values ($1,'primary','{\"id\":\"primary\"}',1,false)", [alice])).rejects.toMatchObject({ code: '42501' })
    await expect(db.query('select reserve_usage($1,$2,$3)', [alice, 'deepseek', crypto.randomUUID()])).rejects.toMatchObject({ code: '42501' })
  })

  it('allows ordinary profile editing only for the owner', async () => {
    await as('authenticated', alice)
    await db.query("insert into profiles(user_id,display_name) values ($1,'Alice')", [alice])
    await expect(db.query("insert into profiles(user_id,display_name) values ($1,'Bob')", [bob])).rejects.toMatchObject({ code: '42501' })
    await as('authenticated', bob)
    expect((await db.query('select * from profiles')).rows).toEqual([])
    expect((await db.query("update profiles set display_name='Changed' returning *")).rows).toEqual([])
  })

  it('atomically applies parent/child records including unmodified shared seed parents', async () => {
    await as('authenticated', alice)
    expect(await apply(0, [
      change('attempts', 'attempt', { trackId: 'track', itemId: 'private' }),
      change('tracks', 'track', { itemId: 'private', due: '2026-10-23' }),
      change('memberships', 'membership', { wordId: 'shared', listId: 'list' }),
      change('lists', 'list'), change('words', 'private'), change('settings', 'primary'),
      change('timeEntries', 'time', { sessionId: 's', localDate: '2026-10-23', activeMs: 200 }),
    ])).toEqual({ revision: 1 })
    const snapshot = await pull()
    expect(snapshot.revision).toBe(1)
    expect(snapshot.changes).toHaveLength(7)
    expect(snapshot.changes.find((row) => row.id === 'private')?.data).toEqual({ id: 'private' })
    expect(await pull(1)).toEqual({ revision: 1, changes: [] })
    await as('authenticated', bob)
    expect(await pull()).toEqual({ revision: 0, changes: [] })
    const privateRows = await Promise.all(['user_words', 'vocabulary_lists', 'word_list_items', 'learning_tracks',
      'review_attempts', 'study_time_entries', 'user_settings'].map((table) => db.query(`select * from ${table}`)))
    expect(privateRows.every((result) => result.rows.length === 0)).toBe(true)
  })

  it('rejects cross-user references, missing parents, and mismatched attempt/track words atomically', async () => {
    await as('authenticated', bob)
    await expect(apply(0, [change('tracks', 'foreign', { itemId: 'private' })])).rejects.toMatchObject({ code: '23503' })
    await expect(apply(0, [change('memberships', 'foreign', { wordId: 'shared', listId: 'list' })])).rejects.toMatchObject({ code: '23503' })
    await expect(apply(0, [change('attempts', 'foreign', { trackId: 'track', itemId: 'shared' })])).rejects.toMatchObject({ code: '23503' })
    expect(await pull()).toEqual({ revision: 0, changes: [] })
    await as('authenticated', alice)
    await expect(apply(1, [change('attempts', 'wrong-item', { trackId: 'track', itemId: 'shared' })])).rejects.toMatchObject({ code: '23503' })
    await expect(apply(1, [{ collection: 'words', id: 'shared', data: null }])).rejects.toMatchObject({ code: '23503' })
  })

  it('enforces CAS and propagates durable tombstones without repeating older changes', async () => {
    await as('authenticated', alice)
    await expect(apply(0, [change('settings', 'primary', { dailyMinutes: 999 })])).rejects.toMatchObject({ code: '40001' })
    expect(await apply(1, [{ collection: 'settings', id: 'primary', data: null }])).toEqual({ revision: 2 })
    expect(await pull(1)).toEqual({ revision: 2, changes: [{ collection: 'settings', id: 'primary', data: null, revision: 2 }] })
    expect((await pull()).changes.find((row) => row.id === 'primary')?.data).toBeNull()
    await expect(apply(2, [change('words', 'wrong', { id: 'other' })])).rejects.toMatchObject({ code: '22023' })
    await expect(apply(2, [change('unknown', 'bad')])).rejects.toMatchObject({ code: '22023' })
    await expect(apply(2, Array.from({ length: 201 }, (_, i) => change('words', `too-many-${i}`)))).rejects.toMatchObject({ code: '22023' })
    expect((await pull()).revision).toBe(2)
  })

  it('validates reference field types and prevents references to tombstoned parents', async () => {
    await as('authenticated', bob)
    await expect(apply(0, [change('tracks', 'numeric', { itemId: 12 })])).rejects.toMatchObject({ code: '22023' })
    await expect(apply(0, [change('attempts', 'empty', { itemId: 'shared', trackId: '' })])).rejects.toMatchObject({ code: '22023' })
    await apply(0, [change('words', 'removable'), change('lists', 'removable-list'),
      change('memberships', 'removable-member', { wordId: 'removable', listId: 'removable-list' })])
    await expect(apply(1, [{ collection: 'words', id: 'removable', data: null }])).rejects.toMatchObject({ code: '23503' })
    await expect(apply(1, [{ collection: 'lists', id: 'removable-list', data: null }])).rejects.toMatchObject({ code: '23503' })
    await apply(1, [{ collection: 'words', id: 'removable', data: null },
      { collection: 'lists', id: 'removable-list', data: null },
      { collection: 'memberships', id: 'removable-member', data: null }])
    await expect(apply(2, [change('tracks', 'deleted-parent', { itemId: 'removable' })])).rejects.toMatchObject({ code: '23503' })
    await expect(apply(2, [change('memberships', 'deleted-list', { wordId: 'shared', listId: 'removable-list' })])).rejects.toMatchObject({ code: '23503' })
  })

  it('only one competing update with the same revision can win', async () => {
    await as('authenticated', alice)
    const results = await Promise.allSettled([
      apply(2, [change('settings', 'primary', { dailyMinutes: 10 })]),
      apply(2, [change('settings', 'primary', { dailyMinutes: 20 })]),
    ])
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((row) => row.status === 'rejected')).toHaveLength(1)
    expect((await pull()).revision).toBe(3)
    await as('service_role')
    await db.query('update app_memberships set active=false where user_id=$1', [alice])
    await as('authenticated', alice)
    expect((await db.query('select * from user_words')).rows).toEqual([])
    await expect(pull()).rejects.toMatchObject({ code: '42501' })
  })

  it('reserves quotas atomically, with per-request idempotency and no content', async () => {
    await as('service_role')
    await db.query('update app_memberships set daily_deepseek_limit=2 where user_id=$1', [bob])
    const reserve = async (requestId: string, kind = 'deepseek', user = bob) =>
      (await db.query<{ result: { allowed: boolean; remaining: number } }>('select reserve_usage($1,$2,$3) result', [user, kind, requestId])).rows[0].result
    const request = crypto.randomUUID()
    expect(await Promise.all(Array.from({ length: 4 }, () => reserve(request))))
      .toEqual(Array.from({ length: 4 }, () => ({ allowed: true, remaining: 1 })))
    expect(await reserve(request)).toEqual({ allowed: true, remaining: 1 })
    const results = await Promise.all(Array.from({ length: 5 }, () => reserve(crypto.randomUUID())))
    expect(results.filter((row) => row.allowed)).toHaveLength(1)
    expect(results.every((row) => row.remaining === 0)).toBe(true)
    expect(await reserve(crypto.randomUUID(), 'voice_session')).toEqual({ allowed: true, remaining: 29 })
    expect(await reserve(crypto.randomUUID(), 'voice_message')).toEqual({ allowed: true, remaining: 99 })
    expect(await reserve(crypto.randomUUID(), 'deepseek', disabled)).toEqual({ allowed: false, remaining: 0 })
    await expect(reserve(crypto.randomUUID(), 'invalid')).rejects.toMatchObject({ code: '22023' })
    await expect(reserve(request, 'voice_message')).rejects.toMatchObject({ code: '22023' })
    const row = (await db.query('select * from usage_events limit 1')).rows[0]
    expect(Object.keys(row).sort()).toEqual(['allowed', 'kind', 'remaining', 'request_id', 'usage_date', 'user_id'].sort())
    await db.query("update usage_events set usage_date=(current_timestamp at time zone 'UTC')::date-1 where user_id=$1", [bob])
    expect(await reserve(crypto.randomUUID())).toEqual({ allowed: true, remaining: 1 })
    await db.query('update app_memberships set daily_voice_session_limit=0 where user_id=$1', [bob])
    expect(await reserve(crypto.randomUUID(), 'voice_session')).toEqual({ allowed: false, remaining: 0 })
    await as('authenticated', bob)
    expect((await db.query('select * from usage_events')).rows.length).toBeGreaterThan(0)
    await expect(db.query('delete from usage_events')).rejects.toMatchObject({ code: '42501' })
  })
})

describe('shared word seed upload', () => {
  it('uploads only fixed-id seed bodies in batches of at most 200 and stops on error', async () => {
    const { uploadSharedWords } = await import('./seedCloudWords.mjs')
    const batches: unknown[][] = []
    const client = { from: (table: string) => ({ upsert: async (rows: unknown[]) => {
      expect(table).toBe('words')
      batches.push(rows)
      return { error: null }
    } }) }
    const words = Array.from({ length: 401 }, (_, id) => ({ id: `seed-${id}`, source: 'seed' }))
    expect(await uploadSharedWords(client, words)).toBe(401)
    expect(batches.map((batch) => batch.length)).toEqual([200, 200, 1])
    expect(batches[0][0]).toEqual({ id: 'seed-0', data: words[0] })
    await expect(uploadSharedWords(client, [{ id: 'duplicate' }, { id: 'duplicate' }])).rejects.toThrow()
    const failedClient = { from: () => ({ upsert: async () => ({ error: { message: 'sensitive-provider-error' } }) }) }
    await expect(uploadSharedWords(failedClient, words)).rejects.toThrow('Shared word upload failed')
  })
})
