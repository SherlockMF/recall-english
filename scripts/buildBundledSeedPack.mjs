/**
 * Build bundled seed JSON from the vocabulary pack.
 *
 * Source: data/vocabulary-packs/all_batches_combined_vocabulary_pack.json
 * Output: src/data/bundledSeedWords.json + bundledSeedMemberships.json
 *
 * Skips pack entries whose expression already exists in the handcrafted seed
 * (seedVocabulary.ts), so the curated 240 stay authoritative.
 *
 * Run: node scripts/buildBundledSeedPack.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_TIMESTAMP = '2026-08-13T00:00:00.000Z'

function normalizeExpression(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function loadHandcraftedExpressions() {
  const source = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
  const expressions = new Set()
  for (const match of source.matchAll(/expression:\s*'((?:\\'|[^'])*)'/g)) {
    expressions.add(normalizeExpression(match[1].replace(/\\'/g, "'")))
  }
  return expressions
}

function buildUsagePrompts(wordId, expression, exampleEn) {
  const sample = exampleEn?.trim() || `I need to use “${expression}” in a real sentence.`
  const cloze = sample.replace(new RegExp(escapeRegExp(expression), 'i'), '_____')
  return [
    {
      id: `${wordId}-cloze`,
      type: 'cloze',
      prompt: `Complete the sentence: ${cloze}`,
      answer: expression,
      modelAnswer: sample,
      checkpoints: [expression],
    },
    {
      id: `${wordId}-sentence`,
      type: 'sentence',
      prompt: `用 “${expression}” 写一句你真实会说的话。`,
      modelAnswer: sample,
      checkpoints: [expression],
    },
  ]
}

function ensureExamples(word) {
  const examples = Array.isArray(word.examples) ? word.examples.map((item) => ({
    en: String(item.en ?? ''),
    zh: String(item.zh ?? ''),
  })).filter((item) => item.en.trim() && item.zh.trim()) : []

  if (examples.length === 0) {
    examples.push({
      en: `Please notice ${word.expression} in context.`,
      zh: `请在语境中注意「${word.zhGloss}」。`,
    })
  }
  if (examples.length === 1) {
    examples.push({
      en: `${word.expression} matters in real study and work contexts.`,
      zh: `在真实学习与工作场景中要注意「${word.zhGloss}」。`,
    })
  }
  return examples.slice(0, 2)
}

function ensureCollocations(word) {
  const fromPack = Array.isArray(word.collocations) ? word.collocations : []
  const filled = unique([
    ...fromPack,
    word.expression,
    word.lemma && word.lemma !== word.expression ? word.lemma : '',
    word.partOfSpeech ? `${word.expression} (${word.partOfSpeech})` : '',
  ])
  if (filled.length >= 2) return filled.slice(0, 3)
  return unique([word.expression, `use ${word.expression}`]).slice(0, 2)
}

const packPath = join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const existing = loadHandcraftedExpressions()

const words = []
const skipped = []

for (const word of pack.words) {
  const key = normalizeExpression(word.expression)
  if (existing.has(key)) {
    skipped.push(word.expression)
    continue
  }

  const examples = ensureExamples(word)
  const next = {
    id: word.id,
    expression: word.expression,
    lemma: word.lemma || word.expression.toLocaleLowerCase('en-US'),
    senseKey: word.senseKey,
    zhGloss: word.zhGloss,
    enDefinition: word.enDefinition,
    partOfSpeech: word.partOfSpeech,
    acceptedZhAnswers: unique([word.zhGloss, ...(word.acceptedZhAnswers ?? [])]),
    acceptedEnVariants: unique([word.expression, ...(word.acceptedEnVariants ?? [])]),
    examples,
    collocations: ensureCollocations(word),
    source: 'seed',
    priority: Number.isFinite(word.priority) ? word.priority : 1,
    status: 'active',
    usagePrompts: buildUsagePrompts(word.id, word.expression, examples[0]?.en),
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }
  if (word.ipaUk) next.ipaUk = word.ipaUk
  if (word.ipaUs) next.ipaUs = word.ipaUs
  if (word.audioUk) next.audioUk = word.audioUk
  if (word.audioUs) next.audioUs = word.audioUs
  if (Array.isArray(word.synonyms) && word.synonyms.length) next.synonyms = word.synonyms
  if (Array.isArray(word.antonyms) && word.antonyms.length) next.antonyms = word.antonyms
  words.push(next)
}

const keptIds = new Set(words.map((word) => word.id))
const memberships = pack.memberships
  .filter((item) => keptIds.has(item.wordId))
  .map((item) => {
    const membership = {
      id: item.id,
      wordId: item.wordId,
      listId: item.listId,
      priority: Number.isFinite(item.priority) ? item.priority : 1,
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : 0,
    }
    if (typeof item.subcategory === 'string' && item.subcategory.trim()) {
      membership.subcategory = item.subcategory.trim()
    }
    return membership
  })

const wordsOut = join(root, 'src/data/bundledSeedWords.json')
const membershipsOut = join(root, 'src/data/bundledSeedMemberships.json')
writeFileSync(wordsOut, `${JSON.stringify(words, null, 2)}\n`)
writeFileSync(membershipsOut, `${JSON.stringify(memberships, null, 2)}\n`)

console.log(JSON.stringify({
  packWords: pack.words.length,
  added: words.length,
  skippedHandcraftedOverlap: skipped.length,
  memberships: memberships.length,
  wordsOut,
  membershipsOut,
}, null, 2))
