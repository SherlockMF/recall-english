/**
 * Offline quality harness for production seeds / trusted V1 pack.
 * Run: node scripts/qualityHarnessVocabulary.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundled = JSON.parse(readFileSync(join(root, 'src/data/bundledSeedWords.json'), 'utf8'))
const trustedPath = [
  join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json'),
  join(root, 'data/vocabulary-packs/trusted_v5_1_vocabulary_pack.json'),
  join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json'),
].find((path) => existsSync(path))
if (!trustedPath) throw new Error('No trusted pack for quality harness')
const trusted = JSON.parse(readFileSync(trustedPath, 'utf8'))

function normalizeLoose(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

function isFakeCollocation(col, expression, partOfSpeech) {
  const nc = normalizeLoose(col)
  const ne = normalizeLoose(expression)
  if (!nc || !ne) return true
  if (nc === ne) return true
  if (partOfSpeech && nc === normalizeLoose(`${expression} ${partOfSpeech}`)) return true
  if (nc === normalizeLoose(`use ${expression}`)) return true
  return false
}

const hard = []
const warn = []

function fail(id, rule, detail) {
  hard.push({ id, rule, detail })
}

function flag(id, rule, detail) {
  warn.push({ id, rule, detail })
}

for (const word of bundled) {
  if (/^(Business|Accounting|Finance|Daily)\s+sense\s+of\b/i.test(word.enDefinition || '')) {
    fail(word.id, 'placeholder_definition', word.enDefinition)
  }
  if (/[\u4e00-\u9fff]/.test(word.enDefinition || '')) {
    fail(word.id, 'chinese_in_en_definition', word.enDefinition)
  }
  for (const example of word.examples || []) {
    if (/Please notice .+ in context/i.test(example.en || '')) {
      fail(word.id, 'template_example', example.en)
    }
  }
  for (const prompt of word.usagePrompts || []) {
    if (/Please notice .+ in context/i.test(prompt.prompt || '')) {
      fail(word.id, 'template_usage', prompt.prompt)
    }
  }
  const realCols = (word.collocations || []).filter(
    (col) => !isFakeCollocation(col, word.expression, word.partOfSpeech),
  )
  if (realCols.length < 2) {
    fail(word.id, 'fake_collocations', word.collocations)
  }
  if ((word.acceptedZhAnswers || []).length > 6) {
    flag(word.id, 'many_zh_answers', word.acceptedZhAnswers.length)
  }
}

const gold = [
  {
    id: null,
    expression: 'bad debt',
    test: (w) => /irrecoverable|written off|write off/i.test(w.enDefinition),
    rule: 'fact_bad_debt',
  },
  {
    expression: 'effective interest rate',
    test: (w) => /amortis|amortiz|discount/i.test(w.enDefinition) && !/^the actual annual interest rate after considering compounding$/i.test(w.enDefinition),
    rule: 'fact_eir',
  },
  {
    expression: 'inventory write-down',
    test: (w) => /net realisable value|net realizable value|NRV/i.test(w.enDefinition),
    rule: 'fact_inventory_writedown',
  },
  {
    expression: 'recoverable amount',
    test: (w) => /fair value less costs of disposal/i.test(w.enDefinition) && /value in use/i.test(w.enDefinition),
    rule: 'fact_recoverable_amount',
  },
]

const allWords = [...bundled]
// handcrafted facts checked in vitest; harness checks bundled V1 gold where present
for (const item of gold) {
  const word = allWords.find((w) => w.expression === item.expression)
  if (!word) {
    flag('missing', item.rule, item.expression)
    continue
  }
  if (!item.test(word)) fail(word.id, item.rule, word.enDefinition)
}

const report = {
  bundledWords: bundled.length,
  trustedWords: trusted.words.length,
  hardFailures: hard.length,
  warnings: warn.length,
  hard,
  warn: warn.slice(0, 200),
}

const outDir = join(root, 'data/vocabulary-packs/_export')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'v5-quality-report.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(JSON.stringify({
  bundledWords: report.bundledWords,
  hardFailures: report.hardFailures,
  warnings: report.warnings,
  hardSample: hard.slice(0, 10),
}, null, 2))

if (hard.length) process.exit(1)
