/** Node.js 24: resumable, bounded lookup of the existing library's Chinese senses. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBilingualMeanings, parseYoudaoPayload } from '../src/lib/youdao.ts'
import { loadHandcraftedSenses } from './lib/handcraftedSenses.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const normalize = (value) => value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
const sleep = (ms) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms))

export async function lookupSenseEntry(query, options = {}) {
  const request = options.fetch ?? fetch
  const checkedAt = new Date().toISOString()
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await request(`https://dict.youdao.com/jsonapi?q=${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'))
        if (attempt < 2) {
          await sleep(options.retryDelayMs ?? (Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 60) * 1000 : 1000 * 2 ** attempt))
          continue
        }
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const payload = await response.json()
      const source = parseYoudaoPayload(payload, query)
      const input = typeof payload.input === 'string' ? payload.input : source.word
      if (normalize(input) !== normalize(query)) {
        return { query, status: 'different-headword', headword: input, checkedAt }
      }
      if (normalize(source.word) !== normalize(query)) {
        return { query, status: 'different-headword', headword: source.word, checkedAt }
      }
      if (!source.senses.length) return { query, status: 'not-found', checkedAt }
      const meanings = buildBilingualMeanings(source.senses, [])
      return { query, status: 'found', checkedAt, result: {
        schemaVersion: 3, query, word: query, meanings,
        ipaUk: source.ipaUk, ipaUs: source.ipaUs, phonetic: source.phonetic, fetchedAt: checkedAt,
      } }
    } catch (error) {
      if (attempt < 2) await sleep(options.retryDelayMs ?? 1000 * 2 ** attempt)
      else return { query, status: 'error', error: error instanceof Error ? error.message : String(error), checkedAt }
    }
  }
}

function writeJson(path, data) {
  const temporary = `${path}.tmp`
  writeFileSync(temporary, JSON.stringify(data))
  renameSync(temporary, path)
}

async function main() {
  const directory = join(root, 'data/dictionary-senses')
  mkdirSync(directory, { recursive: true })
  const journal = join(directory, 'lookups.jsonl')
  const bundled = JSON.parse(readFileSync(join(root, 'public/data/bundledSeedWords.json'), 'utf8'))
  const handcrafted = loadHandcraftedSenses(readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8'))
  const additionalFile = join(directory, 'additionalExpressions.json')
  const additional = existsSync(additionalFile) ? JSON.parse(readFileSync(additionalFile, 'utf8')) : []
  const queries = [...new Set([...bundled, ...handcrafted, ...additional.map((expression) => ({ expression }))]
    .map((word) => normalize(word.expression)))].sort()
  const records = new Map()
  if (existsSync(journal)) {
    for (const line of readFileSync(journal, 'utf8').split('\n').filter(Boolean)) {
      try { const entry = JSON.parse(line); records.set(normalize(entry.query), entry) }
      catch { /* An interrupted last journal write is retried. */ }
    }
  }
  const retryUnresolved = process.argv.includes('--retry-unresolved')
  const pending = queries.filter((query) => !records.has(query) || records.get(query).status === 'error'
    || (retryUnresolved && records.get(query).status !== 'found'))
  let cursor = 0
  let completed = 0
  console.log(JSON.stringify({ total: queries.length, cached: queries.length - pending.length, pending: pending.length }))
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < pending.length) {
      const query = pending[cursor++]
      const entry = await lookupSenseEntry(query)
      records.set(query, entry)
      appendFileSync(journal, `${JSON.stringify(entry)}\n`)
      completed++
      if (completed % 100 === 0 || completed === pending.length) {
        console.log(JSON.stringify({ completed, pending: pending.length, last: query, status: entry.status }))
      }
      await sleep(100)
    }
  }))
  const entries = queries.map((query) => records.get(query))
  const results = entries.filter((entry) => entry.status === 'found').map((entry) => entry.result)
  const content = results.map(({ fetchedAt: _fetchedAt, ...result }) => result)
  const revision = `3-${createHash('sha256').update(JSON.stringify(content)).digest('hex').slice(0, 16)}`
  const report = {
    sources: ['https://dict.youdao.com/jsonapi_s', 'https://dict.youdao.com/jsonapi'], generatedAt: new Date().toISOString(), revision,
    totalExpressions: queries.length, found: results.length,
    multipleSenses: results.filter((result) => result.meanings.length > 1).length,
    singleSense: results.filter((result) => result.meanings.length === 1).length,
    sourceSenses: results.reduce((sum, result) => sum + result.meanings.length, 0),
    unresolved: entries.filter((entry) => entry.status !== 'found'),
  }
  writeJson(join(root, 'public/data/bundledDictionarySenses.json'), { revision, results })
  writeJson(join(directory, 'report.json'), report)
  writeFileSync(join(root, 'src/data/dictionaryContentRevision.ts'), `/** Generated by scripts/buildDictionarySensePack.mjs. */\nexport const DICTIONARY_CONTENT_REVISION = '${revision}'\n`)
  console.log(JSON.stringify({ ...report, unresolved: report.unresolved.length }))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
