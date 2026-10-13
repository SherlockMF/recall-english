import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { extractArchive } from './lib/archive.mjs'
import { loadSeedPackFromDisk } from './lib/loadSeedPack.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { values } = parseArgs({ options: { 'skip-build': { type: 'boolean', default: false } } })
const directory = mkdtempSync(join(tmpdir(), 'engstudy-share-check-'))
let child
let stageRoot
try {
  const output = execFileSync(process.execPath, [join(root, 'scripts/exportShareBundle.mjs'),
    '--output-dir', directory, ...(values['skip-build'] ? ['--skip-build'] : [])], { cwd: root, encoding: 'utf8' })
  const metadata = JSON.parse(output.slice(output.lastIndexOf('\n{') + 1))
  stageRoot = resolve(metadata.stageRoot)
  const extracted = join(directory, 'extracted')
  extractArchive(metadata.zipPath, extracted)
  const entries = readdirSync(extracted, { recursive: true }).map(String)
  assert.deepEqual(entries.filter((entry) => /^\.env(?:$|\.)/.test(basename(entry))
    && basename(entry) !== '.env.example'), [], 'Credentials must never enter an archive')
  assert.ok(entries.includes('.env.example'), 'The credential template must be included')
  const seed = await loadSeedPackFromDisk(root)
  const packed = JSON.parse(readFileSync(join(extracted, 'vocabulary/recall-english-v53-complete-seed.json'), 'utf8'))
  assert.equal(JSON.stringify(packed.words), JSON.stringify(seed.words))
  assert.equal(JSON.stringify(packed.memberships), JSON.stringify(seed.memberships))

  child = spawn(process.execPath, [join(extracted, 'server.mjs')], { cwd: extracted,
    env: { ...process.env, PORT: '0', DASHSCOPE_API_KEY: '', DASHSCOPE_WORKSPACE_ID: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
  const port = await new Promise((resolvePort, reject) => {
    const timer = setTimeout(() => reject(new Error('Packaged server did not listen')), 10000)
    child.stdout.on('data', (chunk) => {
      const match = String(chunk).match(/127\.0\.0\.1:(\d+)/)
      if (match) { clearTimeout(timer); resolvePort(Number(match[1])) }
    })
    child.once('error', (error) => { clearTimeout(timer); reject(error) })
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Packaged server exited before listen')) })
  })
  const base = `http://127.0.0.1:${port}`
  const htmlResponse = await fetch(base)
  assert.equal(htmlResponse.status, 200)
  const html = await htmlResponse.text()
  const entry = html.match(/src="([^"]+\.js)"/)?.[1]
  assert.ok(entry, 'Missing application entry')
  assert.equal((await fetch(new URL(entry, base + '/'))).status, 200)
  await Promise.all(['bundledSeedWords.json', 'bundledSeedMemberships.json', 'bundledDictionarySenses.json'].map(async (name) => {
    const response = await fetch(`${base}/data/${name}`)
    assert.equal(response.status, 200)
    await response.json()
  }))
  const config = await fetch(`${base}/api/voice/config`)
  assert.equal(config.status, 200)
  assert.equal((await config.json()).configured, false)
  assert.equal((await fetch(`${base}/%`)).status, 400)
  assert.equal((await fetch(base)).status, 200)
  assert.equal(child.exitCode, null)
  console.log(JSON.stringify({ passed: true, words: packed.words.length, memberships: packed.memberships.length,
    archiveBytes: statSync(metadata.zipPath).size, checks: ['archive extraction', 'seed parity', 'no credentials',
      'application entry', 'dictionary assets', 'voice runtime', 'malformed URL isolation'] }, null, 2))
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    const exited = once(child, 'exit')
    child.kill()
    await exited
  }
  const temporary = resolve(directory)
  assert.ok(temporary.startsWith(resolve(tmpdir()) + sep) && basename(temporary).startsWith('engstudy-share-check-'))
  rmSync(temporary, { recursive: true, force: true })
  if (stageRoot) {
    assert.ok(stageRoot.startsWith(resolve(root, 'data/vocabulary-packs/_export') + sep)
      && basename(stageRoot).startsWith('share-stage-'))
    rmSync(stageRoot, { recursive: true, force: true })
  }
}
