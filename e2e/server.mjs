import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'
import { once } from 'node:events'

export default async function setup() {
  const directory = resolve(mkdtempSync(join(tmpdir(), 'recall-e2e-')))
  let child
  async function cleanup() {
    try {
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        const exited = once(child, 'exit')
        child.kill()
        await exited
      }
    } finally {
      assert.ok(directory.startsWith(resolve(tmpdir()) + sep) && basename(directory).startsWith('recall-e2e-'))
      rmSync(directory, { recursive: true, force: true })
    }
  }
  try {
    cpSync(resolve('dist'), join(directory, 'app'), { recursive: true })
    for (const name of ['shareLocalServer.mjs', 'qwenVoiceServer.mjs', 'qwenVoiceMessages.mjs']) {
      cpSync(resolve('scripts', name), join(directory, name === 'shareLocalServer.mjs' ? 'server.mjs' : name))
    }
    cpSync(resolve('node_modules/ws'), join(directory, 'node_modules/ws'), { recursive: true })
    child = spawn(process.execPath, [join(directory, 'server.mjs')], {
      cwd: directory,
      env: { ...process.env, PORT: '5188', DASHSCOPE_API_KEY: '', DASHSCOPE_WORKSPACE_ID: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await new Promise((resolveReady, reject) => {
      const timeout = setTimeout(() => reject(new Error('Acceptance server did not listen')), 10_000)
      child.stdout.on('data', chunk => {
        if (String(chunk).includes('http://127.0.0.1:5188')) { clearTimeout(timeout); resolveReady() }
      })
      child.once('error', error => { clearTimeout(timeout); reject(error) })
      child.once('exit', () => { clearTimeout(timeout); reject(new Error('Acceptance server exited before listen; check port 5188')) })
    })
    return cleanup
  } catch (error) { await cleanup(); throw error }
}
