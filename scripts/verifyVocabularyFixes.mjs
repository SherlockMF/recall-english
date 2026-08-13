import { readFileSync } from 'node:fs'

const pack = JSON.parse(readFileSync('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json', 'utf8'))
const bundled = JSON.parse(readFileSync('src/data/bundledSeedWords.json', 'utf8'))

const packNoisy = pack.words.filter((w) =>
  String(w.zhGloss).includes('\\n') || /\[[^\]]{1,8}\]/.test(w.zhGloss),
).length
const bundledBad = bundled.filter((w) => {
  const blob = `${w.zhGloss}|${(w.acceptedZhAnswers || []).join('|')}`
  return /\\n|\[[^\]]{1,8}\]|性交|强奸|猥亵/.test(blob)
}).length

console.log(JSON.stringify({
  packWords: pack.words.length,
  bundledWords: bundled.length,
  noRape: !pack.words.some((w) => w.expression === 'rape'),
  customerDeposit: pack.words.some((w) => w.expression === "customer's deposit"),
  noCustomary: !pack.words.some((w) => /customary's/i.test(w.expression)),
  capitalDividend: pack.words.some((w) => w.expression === 'capital dividend'),
  noDevidend: !pack.words.some((w) => /devidend/i.test(w.expression)),
  goodsZh: pack.words.find((w) => w.expression === 'goods')?.zhGloss,
  goodsEn: pack.words.find((w) => w.expression === 'goods')?.enDefinition,
  packNoisyZh: packNoisy,
  bundledBad: bundledBad,
  inActiveUse: pack.words.some((w) => w.expression === 'fully depreciated assets in active use'),
}, null, 2))
