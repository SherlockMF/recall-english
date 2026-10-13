import { createServer, type Server } from 'node:http'
import { WebSocketServer, WebSocket } from 'ws'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoiceHandler } from './qwenVoiceServer.mjs'

const servers: Server[] = []
const sockets: WebSocketServer[] = []
const events: Record<string, unknown>[] = []
let closeVoice: (() => void) | undefined
afterEach(async () => {
  closeVoice?.(); closeVoice = undefined; events.length = 0
  vi.useRealTimers()
  for (const socket of sockets.splice(0)) { for (const client of socket.clients) client.terminate(); socket.close() }
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) })))
})

async function serve(mode: 'normal' | 'disconnect' | 'slow' = 'normal') {
  const provider = new WebSocketServer({ port: 0, host: '127.0.0.1' })
  sockets.push(provider)
  await new Promise<void>((resolve) => provider.once('listening', resolve))
  provider.on('connection', (ws) => {
    const send = (value: unknown) => ws.send(JSON.stringify(value))
    send({ type: 'session.created' })
    ws.on('message', (data) => {
      const event = JSON.parse(data.toString()); events.push(event)
      if (event.type === 'session.update') send({ type: 'session.updated' })
      if (event.type === 'input_audio_buffer.commit') {
        send({ type: 'input_audio_buffer.committed', item_id: 'user-1' })
        send({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'user-1', transcript: 'A coffee, please.' })
      }
      if (event.type === 'response.create') {
        if (mode === 'disconnect') { ws.terminate(); return }
        if (mode === 'slow') return
        send({ type: 'response.audio.delta', delta: Buffer.from([0, 0, 1, 0]).toString('base64') })
        send({ type: 'response.audio_transcript.done', transcript: 'Of course.' })
        send({ type: 'response.done', response: { status: 'completed', usage: { input_tokens: 3, output_tokens: 2 } } })
      }
    })
  })
  const address = provider.address()
  if (typeof address === 'string') throw new Error('missing address')
  const voice = createVoiceHandler({ env: { DASHSCOPE_API_KEY: 'fake-test-key', DASHSCOPE_WORKSPACE_ID: 'fake-workspace' }, messageConnect: () => new WebSocket(`ws://127.0.0.1:${address.port}`) })
  closeVoice = voice.close
  const server = createServer((req, res) => { void voice(req, res).then((handled) => { if (!handled) { res.writeHead(404); res.end() } }) })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const local = server.address()
  if (!local || typeof local === 'string') throw new Error('missing address')
  return `http://127.0.0.1:${local.port}`
}

async function post(base: string, path: string, body: unknown) {
  return fetch(`${base}${path}`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

describe('voice message gateway', () => {
  it('keeps a message session usable beyond five minutes, including a long gap between messages', async () => {
    const base = await serve()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    const created = await post(base, '/api/voice/messages', { instructions: 'Practice English.' })
    const session = await created.json()
    expect(session.maxSeconds).toBe(null)
    await vi.advanceTimersByTimeAsync(600_000)
    expect((await post(base, `/api/voice/messages/${session.id}/turns`, { id: 'later', audio: Buffer.alloc(32000).toString('base64') })).status).toBe(200)
  })
  it('uses Manual mode, waits for commit acknowledgement, and deduplicates retries', async () => {
    const base = await serve()
    const created = await post(base, '/api/voice/messages', { instructions: 'Practice ordering coffee.' })
    expect(created.status).toBe(201)
    const session = await created.json()
    expect(JSON.stringify(session)).not.toContain('fake-test-key')
    expect(events[0]).toMatchObject({ type: 'session.update', session: { turn_detection: null } })
    const body = { id: 'message-1', audio: Buffer.alloc(32000).toString('base64') }
    const first = await post(base, `/api/voice/messages/${session.id}/turns`, body)
    expect(first.status).toBe(200)
    const result = await first.json()
    expect(result.userText).toBe('A coffee, please.')
    expect(result.text).toBe('Of course.')
    expect(result.audio).toBe(Buffer.from([0, 0, 1, 0]).toString('base64'))
    expect(events.filter((event) => event.type === 'response.create')).toHaveLength(1)
    const retry = await post(base, `/api/voice/messages/${session.id}/turns`, body)
    expect(await retry.json()).toEqual(result)
    expect(events.filter((event) => event.type === 'response.create')).toHaveLength(1)
    const conflict = await post(base, `/api/voice/messages/${session.id}/turns`, { ...body, audio: Buffer.alloc(32002).toString('base64') })
    expect(conflict.status).toBe(409)
    expect((await fetch(`${base}/api/voice/messages/${session.id}`, { method: 'DELETE', headers: { Origin: base } })).status).toBe(204)
    expect((await post(base, `/api/voice/messages/${session.id}/turns`, body)).status).toBe(410)
  })
  it('rejects foreign origins and invalid audio before asking the model for a reply', async () => {
    const base = await serve()
    expect((await fetch(`${base}/api/voice/messages`, { method: 'POST', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' })).status).toBe(403)
    const session = await (await post(base, '/api/voice/messages', { instructions: 'Practice English.' })).json()
    expect((await post(base, `/api/voice/messages/${session.id}/turns`, { id: 'bad', audio: 'invalid' })).status).toBe(400)
    expect(events.filter((event) => event.type === 'response.create')).toHaveLength(0)
  })
  it('accepts a full 60 second message, rejects oversized and malformed bodies, and keeps the session usable', async () => {
    const base = await serve()
    const session = await (await post(base, '/api/voice/messages', { instructions: 'Practice English.' })).json()
    const path = `/api/voice/messages/${session.id}/turns`
    expect((await post(base, path, null)).status).toBe(400)
    expect((await post(base, path, { id: 'short', audio: Buffer.alloc(31998).toString('base64') })).status).toBe(400)
    expect((await post(base, path, { id: 'oversized', audio: 'A'.repeat(2600000) })).status).toBe(413)
    expect((await post(base, path, { id: 'full-minute', audio: Buffer.alloc(1920000).toString('base64') })).status).toBe(200)
    expect(events.filter((event) => event.type === 'response.create')).toHaveLength(1)
  })
  it('releases a disconnected upstream and allows a new session without exposing provider errors', async () => {
    const base = await serve('disconnect')
    const session = await (await post(base, '/api/voice/messages', { instructions: 'Practice English.' })).json()
    const request = { id: 'm-1', audio: Buffer.alloc(32000).toString('base64') }
    const failed = await post(base, `/api/voice/messages/${session.id}/turns`, request)
    expect(failed.status).toBe(502)
    expect(JSON.stringify(await failed.json())).not.toContain('fake-test-key')
    expect((await post(base, `/api/voice/messages/${session.id}/turns`, request)).status).toBe(410)
    expect((await post(base, '/api/voice/messages', { instructions: 'Practice again.' })).status).toBe(201)
  })
  it('ends a pending turn on DELETE and rejects concurrent new messages without duplicating a reply', async () => {
    const base = await serve('slow')
    const session = await (await post(base, '/api/voice/messages', { instructions: 'Practice English.' })).json()
    const path = `/api/voice/messages/${session.id}/turns`
    const pending = post(base, path, { id: 'm-1', audio: Buffer.alloc(32000).toString('base64') })
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => { if (events.some((event) => event.type === 'response.create')) { clearInterval(timer); resolve() } }, 10)
    })
    expect((await post(base, path, { id: 'm-2', audio: Buffer.alloc(32000).toString('base64') })).status).toBe(409)
    expect((await fetch(`${base}/api/voice/messages/${session.id}`, { method: 'DELETE', headers: { Origin: base } })).status).toBe(204)
    expect((await pending).status).toBe(502)
    expect(events.filter((event) => event.type === 'response.create')).toHaveLength(1)
  })
})
