import { readFileSync } from 'node:fs'

const pack = JSON.parse(readFileSync('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json', 'utf8'))
const bundled = JSON.parse(readFileSync('src/data/bundledSeedWords.json', 'utf8'))
const mem = JSON.parse(readFileSync('src/data/bundledSeedMemberships.json', 'utf8'))
const seedTs = readFileSync('src/data/seedVocabulary.ts', 'utf8')

function find(expr) {
  const e = expr.toLowerCase()
  const b = bundled.find((w) => w.expression.toLowerCase() === e)
  const p = pack.words.find((w) => w.expression.toLowerCase() === e)
  const lists = b ? mem.filter((m) => m.wordId === b.id).map((m) => m.listId) : []
  const inHand = new RegExp(`expression:\\s*'${expr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'i').test(seedTs)
  return {
    expr,
    inHand,
    bundled: b && { zh: b.zhGloss, en: b.enDefinition, pos: b.partOfSpeech, lists },
    pack: p && { zh: p.zhGloss, en: p.enDefinition, source: p.source },
  }
}

const terms = [
  'depreciation',
  'cash flow',
  'amortisation',
  'amortization',
  'impairment',
  'provision',
  'accrual',
  'goodwill',
  'capital dividend',
  'capital devidend',
  'customer deposit',
  "customer's deposit",
  "customary's deposit",
]

const out = {
  terms: terms.map(find),
  depLike: bundled
    .filter((w) => /depreciat|amorti|impairment/i.test(w.expression))
    .map((w) => ({ e: w.expression, zh: w.zhGloss, en: w.enDefinition.slice(0, 120) })),
  bianzhi: bundled
    .filter((w) => w.zhGloss.includes('贬值'))
    .map((w) => ({ e: w.expression, zh: w.zhGloss })),
}

console.log(JSON.stringify(out, null, 2))
