/**
 * One-off / CI-friendly pack inspector.
 * Usage: node scripts/inspectVocabularyPack.mjs [packJsonPath]
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = process.argv[2]
  ?? join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')

function normalizeExpression(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function loadHandcraftedExpressions() {
  const source = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
  const expressions = new Set()
  for (const match of source.matchAll(/expression:\s*'((?:\\'|[^'])*)'/g)) {
    expressions.add(normalizeExpression(match[1].replace(/\\'/g, "'")))
  }
  return expressions
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const wordIds = new Set(pack.words.map((w) => w.id))
const senseKeys = new Set(pack.words.map((w) => w.senseKey))
const exprs = new Set(pack.words.map((w) => normalizeExpression(w.expression)))
const listCounts = {}
for (const m of pack.memberships) {
  listCounts[m.listId] = (listCounts[m.listId] || 0) + 1
}
const orphanMemberships = pack.memberships.filter((m) => !wordIds.has(m.wordId)).length
const wordsWithoutMembership = pack.words.filter(
  (w) => !pack.memberships.some((m) => m.wordId === w.id),
).length
const emptyExamples = pack.words.filter((w) => !w.examples?.length).length
const emptyCollocations = pack.words.filter((w) => !w.collocations?.length).length
const literalBackslashN = pack.words.filter(
  (w) => w.zhGloss.includes('\\n') || w.acceptedZhAnswers?.some((a) => String(a).includes('\\n')),
).length
const bracketTags = pack.words.filter((w) => /\[[^\]]{1,8}\]/.test(w.zhGloss)).length
const sources = {}
const priorities = {}
for (const w of pack.words) {
  sources[w.source] = (sources[w.source] || 0) + 1
  priorities[w.priority] = (priorities[w.priority] || 0) + 1
}

const handcrafted = loadHandcraftedExpressions()
let skipped = 0
for (const w of pack.words) {
  if (handcrafted.has(normalizeExpression(w.expression))) skipped += 1
}

console.log(JSON.stringify({
  packPath,
  version: pack.version,
  kind: pack.kind,
  exportedAt: pack.exportedAt,
  words: pack.words.length,
  uniqueIds: wordIds.size,
  uniqueSenseKeys: senseKeys.size,
  uniqueExpressions: exprs.size,
  lists: pack.lists?.length ?? 0,
  memberships: pack.memberships.length,
  listCounts,
  orphanMemberships,
  wordsWithoutMembership,
  emptyExamples,
  emptyCollocations,
  literalBackslashN,
  bracketTags,
  sources,
  priorities,
  handcraftedOverlap: skipped,
  projectedBundledAdd: pack.words.length - skipped,
  projectedTotalSeed: 240 + (pack.words.length - skipped),
}, null, 2))
