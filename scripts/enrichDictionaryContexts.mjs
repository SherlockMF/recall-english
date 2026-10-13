/** Enrich only source-aligned English context; preserve the original Chinese learning units. */
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBilingualMeanings, chineseGlossTerms, normalizePartOfSpeech } from '../src/lib/youdao.ts'
import { lookupSenseEntry } from './buildDictionarySensePack.mjs'
import { loadHandcraftedSenses } from './lib/handcraftedSenses.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const normalize = (text) => String(text ?? '').normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
const hasContext = (meaning) => Boolean(meaning.definition?.trim() || meaning.example?.trim() || meaning.collocations?.length)
const compatible = (left, right) => normalizePartOfSpeech(left) === normalizePartOfSpeech(right)
  || left === 'expression' || right === 'expression'
const overlap = (left, right) => chineseGlossTerms(left).some((term) => chineseGlossTerms(right).includes(term))

function withSourceIdentities(result) {
  const meanings = buildBilingualMeanings(result.meanings.map((meaning) => ({ partOfSpeech: meaning.partOfSpeech,
    zhGloss: meaning.zhGloss, definition: meaning.definition, exampleEn: meaning.example, exampleZh: meaning.exampleZh })), [])
  return { ...result, schemaVersion: 3, meanings: result.meanings.map((meaning, index) => ({ ...meaning, senseKey: meanings[index].senseKey })) }
}

export function fillFromSeedContext(result, seeds) {
  return { ...result, meanings: result.meanings.map((meaning) => {
    if (hasContext(meaning)) return meaning
    const matches = seeds.filter((seed) => normalize(seed.expression) === normalize(result.word)
      && compatible(seed.partOfSpeech, meaning.partOfSpeech)
      && [seed.zhGloss, ...(seed.acceptedZhAnswers ?? [])].some((gloss) => overlap(meaning.zhGloss, gloss)))
    const candidates = [...new Map(matches.map((seed) => [normalize(seed.enDefinition), seed])).values()]
    if (candidates.length !== 1 || !candidates[0].enDefinition?.trim()) return meaning
    const candidate = candidates[0]
    const peerMatches = result.meanings.filter((peer) => compatible(candidate.partOfSpeech, peer.partOfSpeech)
      && [candidate.zhGloss, ...(candidate.acceptedZhAnswers ?? [])].some((gloss) => overlap(peer.zhGloss, gloss)))
    if (peerMatches.length !== 1) return meaning
    const example = candidate.examples?.find((item) => item.en?.trim())
    return { ...meaning, definition: candidate.enDefinition.trim(),
      ...(example ? { example: example.en, exampleZh: example.zh } : {}) }
  }) }
}

export function mergeSourceContext(current, incoming) {
  if (normalize(current.word) !== normalize(incoming.word)) return current
  return { ...current, meanings: current.meanings.map((meaning) => {
    if (hasContext(meaning)) return meaning
    let candidate = incoming.meanings.find((source) => meaning.senseKey && source.senseKey === meaning.senseKey)
    if (!candidate) {
      const matches = incoming.meanings.filter((source) => compatible(meaning.partOfSpeech, source.partOfSpeech)
        && overlap(meaning.zhGloss, source.zhGloss)
        && current.meanings.filter((peer) => compatible(peer.partOfSpeech, source.partOfSpeech)
          && overlap(peer.zhGloss, source.zhGloss)).length === 1)
      if (matches.length === 1) candidate = matches[0]
    }
    if (!candidate || !hasContext(candidate)) return meaning
    return { ...meaning, definition: meaning.definition || candidate.definition,
      ...(candidate.example ? { example: candidate.example, exampleZh: candidate.exampleZh } : {}),
      ...(candidate.collocations?.length ? { collocations: candidate.collocations } : {}) }
  }) }
}

async function main() {
  const directory = join(root, 'data/dictionary-senses')
  const journal = join(directory, 'lookups.jsonl')
  const original = JSON.parse(readFileSync(join(root, 'public/data/bundledDictionarySenses.json'), 'utf8'))
  const records = new Map()
  const baseline = new Map()
  if (existsSync(journal)) for (const line of readFileSync(journal, 'utf8').split('\n').filter(Boolean)) {
    try {
      const record = JSON.parse(line)
      records.set(normalize(record.query), record)
      if (record.status === 'found' && record.result.schemaVersion < 3) baseline.set(normalize(record.query), record)
    }
    catch { /* An interrupted journal line is not used. */ }
  }
  const seeds = [...JSON.parse(readFileSync(join(root, 'public/data/bundledSeedWords.json'), 'utf8')),
    ...loadHandcraftedSenses(readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8'))]
  const seedsByWord = new Map()
  for (const seed of seeds) {
    const bucket = seedsByWord.get(normalize(seed.expression)) ?? []
    bucket.push(seed)
    seedsByWord.set(normalize(seed.expression), bucket)
  }
  const rebuild = process.argv.includes('--rebuild-contexts')
  if (rebuild && baseline.size !== original.results.length) throw new Error('Cannot rebuild without every original source record.')
  const before = original.results.reduce((sum, result) => sum + (rebuild ? baseline.get(normalize(result.query)).result : result)
    .meanings.filter((meaning) => !hasContext(meaning)).length, 0)
  const pending = []
  for (const entry of original.results) {
    const key = normalize(entry.query)
    const record = records.get(key) ?? { query: entry.query, status: 'found', result: entry }
    if (rebuild) {
      record.result = baseline.get(key).result
      delete record.contextCheckedAt
      delete record.contextStatus
    }
    record.result = fillFromSeedContext(withSourceIdentities(record.result), seedsByWord.get(key) ?? [])
    records.set(key, record)
    if (record.result.meanings.some((meaning) => !hasContext(meaning))
      && (!record.contextCheckedAt || record.contextStatus === 'error' || process.argv.includes('--retry-missing'))) pending.push(record)
    else appendFileSync(journal, `\n${JSON.stringify(record)}\n`)
  }
  let cursor = 0
  let completed = 0
  console.log(JSON.stringify({ missingBefore: before, queriesToEnrich: pending.length }))
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (cursor < pending.length) {
      const record = pending[cursor++]
      const outcome = await lookupSenseEntry(record.query)
      record.contextCheckedAt = new Date().toISOString()
      record.contextStatus = outcome.status
      if (outcome.status === 'found') record.result = mergeSourceContext(record.result, outcome.result)
      appendFileSync(journal, `\n${JSON.stringify(record)}\n`)
      completed++
      if (completed % 100 === 0 || completed === pending.length) console.log(JSON.stringify({ completed, total: pending.length, last: record.query }))
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100))
    }
  }))
  const unresolved = []
  for (const entry of original.results) {
    const record = records.get(normalize(entry.query))
    if (rebuild) record.result.meanings = record.result.meanings.map((meaning) => {
      const previous = entry.meanings.find((old) => old.senseKey === meaning.senseKey)
      return previous?.definition && previous.definition !== meaning.definition
        ? { ...meaning, supersededDefinition: previous.supersededDefinition ?? previous.definition }
        : previous?.supersededDefinition ? { ...meaning, supersededDefinition: previous.supersededDefinition } : meaning
    })
    appendFileSync(journal, `\n${JSON.stringify(record)}\n`)
    for (const meaning of record.result.meanings) if (!hasContext(meaning)) unresolved.push({ expression: entry.word,
      senseKey: meaning.senseKey, partOfSpeech: meaning.partOfSpeech, zhGloss: meaning.zhGloss,
      reason: record.contextStatus === 'error' ? 'source-request-failed' : 'no-unambiguous-source-context' })
  }
  const report = { generatedAt: new Date().toISOString(), missingBefore: before, filled: before - unresolved.length,
    remaining: unresolved.length, unresolved }
  writeFileSync(join(directory, 'context-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, unresolved: unresolved.length }))
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
