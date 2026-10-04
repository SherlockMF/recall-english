import { readFileSync } from 'node:fs'

const pack = JSON.parse(readFileSync('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json', 'utf8'))
const bundled = JSON.parse(readFileSync('public/data/bundledSeedWords.json', 'utf8'))

function hasA(w) {
  return /^a\.\s/i.test(w.zhGloss)
    || (w.acceptedZhAnswers || []).some((a) => /^a\.\s/i.test(a) || /(^|[；，\s])a\.\s/.test(a))
}

const packA = pack.words.filter(hasA).length
const bundledA = bundled.filter(hasA).length
const residualTypos = [
  'bank ratte',
  'accounting manaual',
  'ballon payment',
  'capital devidend',
  "customary's deposit",
].filter((e) => pack.words.some((w) => w.expression === e))

const deposit = pack.words.find((w) => w.expression === "customer's deposit")

console.log(JSON.stringify({
  packWords: pack.words.length,
  bundledWords: bundled.length,
  packADebris: packA,
  bundledADebris: bundledA,
  residualTypos,
  customerDepositEn: deposit?.enDefinition,
  balloon: pack.words.some((w) => w.expression === 'balloon payment'),
  bankRate: pack.words.some((w) => w.expression === 'bank rate'),
}, null, 2))
