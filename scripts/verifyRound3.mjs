import { readFileSync } from 'node:fs'

const pack = JSON.parse(readFileSync('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json', 'utf8'))
const bundled = JSON.parse(readFileSync('src/data/bundledSeedWords.json', 'utf8'))

function enHasPos(w) {
  return /^\s*[navsr](\.|\s)/i.test(w.enDefinition || '')
}

const remainingTypos = [
  'bank ratte', 'ballon payment', 'formal invoice as form?',
].filter(() => false)

const checks = {
  packWords: pack.words.length,
  bundledWords: bundled.length,
  enPosLeft: pack.words.filter(enHasPos).slice(0, 8).map((w) => ({ e: w.expression, en: w.enDefinition })),
  enPosCount: pack.words.filter(enHasPos).length,
  bundledEnPos: bundled.filter(enHasPos).length,
  idiot: pack.words.filter((w) => /白痴|男风/.test(w.zhGloss) || (w.acceptedZhAnswers || []).some((a) => /白痴|男风/.test(a))).map((w) => w.expression),
  bis: pack.words.find((w) => w.id === 'econ-69233843b037a1')?.zhGloss,
  formal: pack.words.find((w) => w.expression === 'formal invoice')?.zhGloss,
  labour: pack.words.find((w) => w.expression === 'internal labour market')?.zhGloss,
  suretyVar: pack.words.find((w) => w.id === 'econ-e058f812ae6ba9')?.acceptedEnVariants,
  ought: pack.words.find((w) => w.expression === 'ought')?.enDefinition,
  paying: pack.words.some((w) => w.expression === 'paying agent'),
  balloon: pack.words.some((w) => w.expression === 'balloon payment'),
}

console.log(JSON.stringify(checks, null, 2))
