import { readFileSync } from 'node:fs'

const pack = JSON.parse(readFileSync('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json', 'utf8'))
const bundled = JSON.parse(readFileSync('src/data/bundledSeedWords.json', 'utf8'))

function hasBadVariant(w) {
  return (w.acceptedEnVariants || []).some((v) =>
    /payable agent|cash and delivery|sales sales|improvementbudget|profit rata|imports'|application-for /i.test(v),
  )
}

const nsfw = pack.words.filter((w) =>
  /精液|迷幻药|花柳病|白痴|男风/.test(`${w.zhGloss}|${(w.acceptedZhAnswers || []).join('|')}`),
).map((w) => w.expression)

console.log(JSON.stringify({
  packWords: pack.words.length,
  bundledWords: bundled.length,
  badVariants: pack.words.filter(hasBadVariant).map((w) => w.expression),
  nsfw,
  apr: pack.words.find((w) => w.expression === 'annual percentage rate')?.zhGloss,
  visa: pack.words.find((w) => /student visa/.test(w.expression))?.zhGloss,
  teach: pack.words.find((w) => w.expression === 'teach')?.enDefinition?.slice(0, 80),
  formal: pack.words.find((w) => w.expression === 'formal invoice')?.zhGloss,
  paying: pack.words.find((w) => w.expression === 'paying agent')?.acceptedEnVariants,
  afloat: pack.words.some((w) => w.expression === 'sale afloat'),
  amidEn: pack.words.find((w) => w.expression === 'amid')?.enDefinition,
}, null, 2))
