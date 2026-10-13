import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, request } from 'node:http'
import { mkdtempSync, cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join, resolve, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { once } from 'node:events'
import { afterEach, describe, expect, it } from 'vitest'

let processUnderTest: ChildProcess | undefined
let directory: string | undefined

afterEach(async () => {
  if (processUnderTest && processUnderTest.exitCode === null && processUnderTest.signalCode === null) {
    const exited = once(processUnderTest, 'exit')
    processUnderTest.kill()
    await exited
  }
  if (directory) {
    const target = resolve(directory)
    if (!target.startsWith(resolve(tmpdir()) + sep)
      || !basename(target).startsWith('engstudy-share-test-')) throw new Error('Unsafe test cleanup path')
    rmSync(target, { recursive: true, force: true })
  }
})

async function start() {
  directory = mkdtempSync(join(tmpdir(), 'engstudy-share-test-'))
  mkdirSync(join(directory, 'app'))
  writeFileSync(join(directory, 'app', 'index.html'), '<h1>Recall test</h1>')
  for (const name of ['shareLocalServer.mjs', 'qwenVoiceServer.mjs', 'qwenVoiceMessages.mjs']) {
    cpSync(resolve('scripts', name), join(directory, name === 'shareLocalServer.mjs' ? 'server.mjs' : name))
  }
  cpSync(resolve('node_modules/ws'), join(directory, 'node_modules/ws'), { recursive: true })
  const reservation = createServer()
  await new Promise<void>((resolveListen) => reservation.listen(0, '127.0.0.1', resolveListen))
  const address = reservation.address()
  if (!address || typeof address === 'string') throw new Error('Missing test port')
  await new Promise<void>((resolveClose) => reservation.close(() => resolveClose()))
  const child = spawn(process.execPath, [join(directory, 'server.mjs')],
    { env: { ...process.env, PORT: String(address.port) }, stdio: ['ignore', 'pipe', 'pipe'] })
  processUnderTest = child
  const stdout = await new Promise<string>((resolveOutput, reject) => {
    const timer = setTimeout(() => reject(new Error('Server did not listen')), 5000)
    let output = ''
    child.stdout!.on('data', (chunk) => {
      output += String(chunk)
      if (output.includes('Close this window')) { clearTimeout(timer); resolveOutput(output) }
    })
    child.once('error', reject)
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Server exited before listen')) })
  })
  const port = Number(stdout.match(/127\.0\.0\.1:(\d+)/)?.[1])
  if (!port) throw new Error('Server must report its actual listening port')
  return `http://127.0.0.1:${port}`
}

function rawRequest(base: string, path: string) {
  return new Promise<number>((resolveStatus, reject) => {
    const req = request(new URL(base), { path }, (res) => { res.resume(); resolveStatus(res.statusCode!) })
    req.on('error', reject)
    req.end()
  })
}

describe('share server request isolation', () => {
  it('returns 400 for malformed URLs and keeps serving subsequent requests', async () => {
    const base = await start()
    expect(await rawRequest(base, '/%')).toBe(400)
    expect(await rawRequest(base, '/%E0%A4%A')).toBe(400)
    expect((await fetch(base)).status).toBe(200)
    expect(processUnderTest!.exitCode).toBeNull()
  })
})
