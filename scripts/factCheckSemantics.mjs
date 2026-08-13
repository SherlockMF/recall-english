/**
 * Deeper semantic spot-checks: known-word glossary + random sample review helpers.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pack = JSON.parse(readFileSync(join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json'), 'utf8'))
const bundled = JSON.parse(readFileSync(join(root, 'src/data/bundledSeedWords.json'), 'utf8'))
const byExpr = new Map(bundled.map((w) => [w.expression.toLocaleLowerCase('en-US'), w]))

/** Expected Chinese sense fragments for common terms — flag if none appear in gloss/answers. */
const EXPECTED = [
  ['asset', ['资产']],
  ['liability', ['负债', '责任']],
  ['equity', ['权益', '股权', '股本']],
  ['revenue', ['收入', '营收']],
  ['expense', ['费用', '开支']],
  ['profit', ['利润', '盈利']],
  ['depreciation', ['折旧']],
  ['amortisation', ['摊销'], ['amortization']],
  ['accounts receivable', ['应收']],
  ['accounts payable', ['应付']],
  ['inventory', ['存货', '库存']],
  ['dividend', ['股息', '红利']],
  ['liquidity', ['流动性', '变现']],
  ['leverage', ['杠杆']],
  ['budget', ['预算']],
  ['audit', ['审计', '稽核']],
  ['invoice', ['发票', '账单']],
  ['cash flow', ['现金流']],
  ['working capital', ['营运资本', '营运资金', '流动资金']],
  ['fair value', ['公允价值']],
  ['going concern', ['持续经营']],
  ['balance sheet', ['资产负债表', '平衡表']],
  ['income statement', ['利润表', '损益表', '收益表']],
  ['interest rate', ['利率']],
  ['inflation', ['通胀', '通货膨胀']],
  ['mortgage', ['按揭', '抵押']],
  ['collateral', ['抵押品', '担保品']],
  ['hedge', ['对冲', '套期']],
  ['portfolio', ['组合', '投资组合']],
  ['IPO', ['上市', '首次公开']],
  ['GDP', ['生产总值', 'GDP', '国内生产']],
  ['VAT', ['增值税', 'VAT']],
  ['ROI', ['投资回报', '回报率', 'ROI']],
  ['KPI', ['关键绩效', '关键业绩', 'KPI']],
  ['academic transcript', ['成绩单']],
  ['tuition fee', ['学费']],
  ['office hours', ['办公时间', '答疑']],
]

const missingSense = []
for (const row of EXPECTED) {
  const [expr, needles, alts = []] = row
  const keys = [expr, ...alts].map((k) => k.toLocaleLowerCase('en-US'))
  const w = keys.map((k) => byExpr.get(k)).find(Boolean)
    ?? pack.words.find((x) => keys.includes(x.expression.toLocaleLowerCase('en-US')))
  if (!w) {
    missingSense.push({ expression: expr, issue: 'not_in_bundled_or_pack' })
    continue
  }
  const blob = `${w.zhGloss}|${(w.acceptedZhAnswers || []).join('|')}|${w.enDefinition}`
  if (!needles.some((n) => blob.includes(n))) {
    missingSense.push({
      expression: w.expression,
      zhGloss: w.zhGloss,
      enDefinition: w.enDefinition,
      issue: 'expected_zh_sense_missing',
      expectedAnyOf: needles,
    })
  }
}

/** Flag defs that look like wrong headword: definition mentions another lemma strongly */
function defHeadwordMismatch(words) {
  const hits = []
  for (const w of words) {
    const expr = w.expression.toLocaleLowerCase('en-US')
    const def = String(w.enDefinition || '').toLocaleLowerCase('en-US')
    // ECDICT sometimes has "see xxx" or completely unrelated — catch "abbr. of" weirdness
    if (/^(see |cf\.|variant of )/i.test(w.enDefinition || '')) {
      hits.push({ expression: w.expression, enDefinition: w.enDefinition, why: 'pointer_def' })
    }
    // Chinese gloss contains obvious wrong script mix of Japanese kana only
    if (/[\u3040-\u30ff]/.test(w.zhGloss || '')) {
      hits.push({ expression: w.expression, zhGloss: w.zhGloss, why: 'kana_in_zh' })
    }
    // expression is multiword but definition is for single unrelated short word pattern hard
    if (expr.includes(' ') && def.length > 20) {
      const first = expr.split(/\s+/)[0]
      // if def starts with "a/an/the X" where X is not related
    }
  }
  return hits.slice(0, 50)
}

/** Find likely typo expressions via simple patterns */
function typoCandidates(words) {
  const out = []
  for (const w of words) {
    const e = w.expression
    if (/customary's/i.test(e)) out.push({ e, zh: w.zhGloss, en: w.enDefinition, why: 'customary\'s typo?' })
    if (/\b(recieve|occured|seperate|definately|goverment|bussiness|accomodat|enviroment|wich|teh)\b/i.test(e)) {
      out.push({ e, zh: w.zhGloss, en: w.enDefinition, why: 'common_typo' })
    }
    if (/[A-Za-z]+'[a-z]+s\b/.test(e) && /credit rating|balance|statement/i.test(e)) {
      out.push({ e, zh: w.zhGloss, en: w.enDefinition, why: 'possessive_odd' })
    }
    // double spaces / leading trailing
    if (e !== e.trim() || /\s{2}/.test(e)) out.push({ e, why: 'whitespace' })
  }
  return out
}

/** Random stratified sample for manual-looking output */
function sample(words, n, seed = 13) {
  let x = seed
  const rnd = () => {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    return x / 0x7fffffff
  }
  const idx = new Set()
  while (idx.size < Math.min(n, words.length)) idx.add(Math.floor(rnd() * words.length))
  return [...idx].map((i) => {
    const w = words[i]
    return {
      expression: w.expression,
      zhGloss: w.zhGloss,
      enDefinition: w.enDefinition,
      partOfSpeech: w.partOfSpeech,
      source: w.source,
    }
  })
}

const pointerOrKana = defHeadwordMismatch(bundled)
const typos = typoCandidates([...pack.words])

// Compare pack vs bundled for entries that still look wrong after clean
const stillWeird = bundled.filter((w) => {
  const zh = w.zhGloss || ''
  return zh.length > 60 || /地名|人名|商标|强奸|鸡巴|阴茎|阴道|性交|色情/.test(zh)
})

console.log(JSON.stringify({
  missingSense,
  pointerOrKana,
  typos,
  stillWeird,
  randomSample50: sample(bundled.filter((w) => w.source === 'seed' || true), 50),
  coreCustomSample: sample(pack.words.filter((w) => w.source === 'custom'), 30, 7),
}, null, 2))
