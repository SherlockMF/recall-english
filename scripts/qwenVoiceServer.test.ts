import { createServer, request as httpRequest, type Server } from 'node:http'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVoiceHandler } from './qwenVoiceServer.mjs'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const servers: Server[] = []
const directories: string[] = []
const env = { DASHSCOPE_API_KEY: 'test-key', DASHSCOPE_WORKSPACE_ID: 'test-workspace' }
const sdp = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'

async function serve(options: Parameters<typeof createVoiceHandler>[0] = {}) {
  const handler = createVoiceHandler(options)
  const server = createServer((req, res) => {
    void handler(req, res).then((handled) => { if (!handled) { res.writeHead(404); res.end() } return handled })
  })
  servers.push(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing port')
  return `http://127.0.0.1:${address.port}`
}

afterEach(async () => {
  vi.useRealTimers()
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.closeAllConnections()
    server.close(() => resolve())
  })))
  directories.splice(0).forEach((directory) => rmSync(directory, { recursive: true, force: true }))
})

describe('local Qwen voice endpoint', () => {
  it('saves UI credentials without returning them, restores them on restart, and clears overrides without changing env', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'engstudy-voice-test-'))
    directories.push(directory)
    const credentialFile = join(directory, '.env.voice.local.json')
    const upstream = vi.fn().mockResolvedValue(new Response(sdp))
    const base = await serve({ env: {}, fetch: upstream, credentialFile })
    const body = { apiKey: 'fake-ui-test-key', workspaceId: 'ui-workspace' }
    const saved = await fetch(`${base}/api/voice/config`, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    expect(saved.status).toBe(200)
    expect(await saved.text()).not.toContain(body.apiKey)
    expect(JSON.parse(readFileSync(credentialFile, 'utf8'))).toEqual(body)
    const call = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' }, body: sdp })
    expect(call.status).toBe(200)
    expect(upstream.mock.calls[0][0]).toContain('https://ui-workspace.cn-beijing.maas.aliyuncs.com/')
    expect(upstream.mock.calls[0][1].headers.Authorization).toBe(`Bearer ${body.apiKey}`)
    const restarted = await serve({ env, credentialFile })
    expect((await (await fetch(`${restarted}/api/voice/config`)).json()).configured).toBe(true)
    const cleared = await fetch(`${restarted}/api/voice/config`, { method: 'DELETE', headers: { Origin: restarted } })
    expect(cleared.status).toBe(200)
    expect((await cleared.json()).configured).toBe(false)
    const afterClearRestart = await serve({ env, credentialFile })
    expect((await (await fetch(`${afterClearRestart}/api/voice/config`)).json()).configured).toBe(false)
    expect(env.DASHSCOPE_API_KEY).toBe('test-key')
  })

  it('rejects cross-origin or malformed credential changes without overwriting active configuration', async () => {
    const base = await serve({ env })
    const foreign = await fetch(`${base}/api/voice/config`, { method: 'PUT', headers: { Origin: 'https://other.example', 'Content-Type': 'application/json' }, body: '{}' })
    expect(foreign.status).toBe(403)
    const invalid = await fetch(`${base}/api/voice/config`, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'fake-key', workspaceId: '../../other' }) })
    expect(invalid.status).toBe(400)
    expect((await (await fetch(`${base}/api/voice/config`)).json()).configured).toBe(true)
    const oversized = await fetch(`${base}/api/voice/config`, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: 'x'.repeat(9000) })
    expect(oversized.status).toBe(413)
  })

  it('reports persistence failure without returning secrets or applying an unsaved credential', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'engstudy-voice-test-'))
    directories.push(directory)
    const base = await serve({ env: {}, credentialFile: join(directory, 'missing', 'credentials.json') })
    const saved = await fetch(`${base}/api/voice/config`, { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: 'fake-private-key', workspaceId: 'test-workspace' }) })
    expect(saved.status).toBe(500)
    expect(await saved.text()).not.toContain('fake-private-key')
    expect((await (await fetch(`${base}/api/voice/config`)).json()).configured).toBe(false)
  })
  it('reports configuration without returning credentials', async () => {
    const base = await serve({ env })
    const res = await fetch(`${base}/api/voice/config`)
    expect(await res.json()).toEqual({ configured: true, model: 'qwen3.8-omni-flash-realtime', maxSeconds: null })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('rejects missing configuration before contacting the provider', async () => {
    const upstream = vi.fn()
    const base = await serve({ env: {}, fetch: upstream })
    const res = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' }, body: sdp })
    expect(res.status).toBe(503)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('rejects foreign origins and invalid SDP without a provider call', async () => {
    const upstream = vi.fn()
    const base = await serve({ env, fetch: upstream })
    for (const [origin, body, status] of [['https://other.example', sdp, 403], [base, 'not-sdp', 400], [base, 'x'.repeat(70_000), 413]] as const) {
      // Keep validation requests sequential; concurrent requests exercise the in-flight limiter instead.
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/sdp' }, body })
      expect(res.status).toBe(status)
    }
    expect(upstream).not.toHaveBeenCalled()
  })

  it('uses the fixed Beijing endpoint and sends only the offer upstream', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(sdp, { headers: { 'content-type': 'application/sdp' } }))
    const base = await serve({ env, fetch: upstream })
    const res = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' }, body: sdp })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe(sdp)
    expect(upstream.mock.calls[0][0]).toBe('https://test-workspace.cn-beijing.maas.aliyuncs.com/api/v1/webrtc/realtime?model=qwen3.8-omni-flash-realtime')
    expect(upstream.mock.calls[0][1]).toMatchObject({ body: sdp, headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/sdp' } })
  })

  it('times out an unfinished request body and releases the negotiation slot', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(sdp))
    const base = await serve({ env, fetch: upstream })
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const slow = httpRequest(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' } })
    const result = new Promise<number | undefined>((resolve) => slow.on('response', (response) => { response.resume(); resolve(response.statusCode) }))
    slow.on('error', () => undefined)
    try {
      slow.write('v=0\r\n')
      await vi.waitFor(() => expect(vi.getTimerCount()).toBe(1), { interval: 10 })
      await vi.advanceTimersByTimeAsync(20_000)
      expect(await result).toBe(504)
      slow.end()
      vi.useRealTimers()
      const next = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' }, body: sdp })
      expect(next.status).toBe(200)
      expect(upstream).toHaveBeenCalledTimes(1)
    } finally { slow.destroy(); vi.useRealTimers() }
  }, 3000)

  it('does not expose upstream errors and limits repeated connection attempts', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response('private upstream detail', { status: 401 }))
    const base = await serve({ env, fetch: upstream })
    for (let i = 0; i < 3; i++) {
      // Rate limiting counts completed attempts in order.
      // eslint-disable-next-line no-await-in-loop
      const res = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' }, body: sdp })
      expect(res.status).toBe(503)
      // eslint-disable-next-line no-await-in-loop
      expect(await res.text()).not.toContain('private upstream detail')
    }
    const fourth = await fetch(`${base}/api/voice/session`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/sdp' }, body: sdp })
    expect(fourth.status).toBe(429)
    expect(upstream).toHaveBeenCalledTimes(3)
  })
})
