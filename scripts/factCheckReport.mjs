import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pack = JSON.parse(readFileSync(join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json'), 'utf8'))
const bundled = JSON.parse(readFileSync(join(root, 'src/data/bundledSeedWords.json'), 'utf8'))
const byExpr = new Map(bundled.map((w) => [w.expression.toLocaleLowerCase('en-US'), w]))

const EXPECTED = [
  ['asset', ['资产']],
  ['liability', ['负债', '责任']],
  ['equity', ['权益', '股权', '股本']],
  ['revenue', ['收入', '营收']],
  ['expense', ['费用', '开支']],
  ['profit', ['利润', '盈利']],
  ['depreciation', ['折旧']],
  ['amortisation', ['摊销']],
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
  ['income statement', ['利润表', '损益表', '收益表']],
  ['interest rate', ['利率']],
  ['inflation', ['通胀', '通货膨胀']],
  ['mortgage', ['按揭', '抵押']],
  ['collateral', ['抵押品', '担保品']],
  ['hedge', ['对冲', '套期']],
  ['portfolio', ['组合', '投资组合']],
  ['academic transcript', ['成绩单']],
]

const missingSense = []
for (const [expr, needles] of EXPECTED) {
  const w = byExpr.get(expr.toLocaleLowerCase('en-US'))
    ?? pack.words.find((x) => x.expression.toLocaleLowerCase('en-US') === expr.toLocaleLowerCase('en-US'))
  if (!w) {
    missingSense.push({ expression: expr, issue: 'missing' })
    continue
  }
  const blob = `${w.zhGloss}|${(w.acceptedZhAnswers || []).join('|')}`
  if (!needles.some((n) => blob.includes(n))) {
    missingSense.push({
      expression: w.expression,
      zhGloss: w.zhGloss,
      issue: 'sense_mismatch',
      expectedAnyOf: needles,
    })
  }
}

const placeholder = bundled.filter((w) =>
  /^(Business|Accounting|Finance|Daily) sense of/i.test(w.enDefinition || ''),
)

const patterns = [
  [/customary's/i, 'customary_for_customer'],
  [/custumer/i, 'custumer_typo'],
  [/recievable/i, 'recievable'],
  [/bussiness/i, 'bussiness'],
  [/finacial/i, 'finacial'],
  [/statment/i, 'statment'],
  [/balence/i, 'balence'],
  [/devidend/i, 'devidend'],
  [/collatoral/i, 'collatoral'],
  [/recieve/i, 'recieve'],
  [/seperate/i, 'seperate'],
  [/goverment/i, 'goverment'],
  [/enviroment/i, 'enviroment'],
]

const patternHits = []
for (const w of pack.words) {
  for (const [re, name] of patterns) {
    if (re.test(w.expression)) {
      patternHits.push({
        name,
        expression: w.expression,
        zh: w.zhGloss,
        en: w.enDefinition,
      })
    }
  }
}

const abrupt = bundled.filter((w) => {
  const en = (w.enDefinition || '').trim()
  return /an identif$/i.test(en)
    || /,\s*$/.test(en)
    || (en.length > 50
      && !/[.!?…)"”]$/.test(en)
      && /\s\w+$/.test(en)
      && !/\b(etc|Inc|Ltd|Co)\.$/i.test(en))
}).slice(0, 40)

const sensitive = bundled.filter((w) =>
  /^(rape|cock|pussy|ass|screw|shit|fuck|bitch)\b/i.test(w.expression),
).map((w) => ({
  e: w.expression,
  zh: w.zhGloss,
  en: String(w.enDefinition).slice(0, 180),
}))

const seedTs = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
const handIssues = []
for (const m of seedTs.matchAll(/expression:\s*'((?:\\'|[^'])*)'[\s\S]*?zh:\s*'((?:\\'|[^'])*)'[\s\S]*?definition:\s*'((?:\\'|[^'])*)'/g)) {
  const expression = m[1].replace(/\\'/g, "'")
  const zh = m[2].replace(/\\'/g, "'")
  const definition = m[3].replace(/\\'/g, "'")
  if (!zh.trim() || !definition.trim()) handIssues.push({ expression, issue: 'empty' })
  if (/[A-Za-z]{6,}/.test(zh) && !/IFRS|GAAP|ROI|KPI|ATM|Wi-?Fi/.test(zh)) {
    handIssues.push({ expression, zh, issue: 'zh_has_long_latin' })
  }
}

const report = {
  missingSense,
  patternHits,
  placeholderCount: placeholder.length,
  placeholderSamples: placeholder.slice(0, 12).map((w) => ({
    e: w.expression,
    en: w.enDefinition,
    zh: w.zhGloss,
  })),
  abruptDefs: abrupt.map((w) => ({ e: w.expression, en: w.enDefinition })),
  sensitive,
  handcraftedExpressionCount: [...seedTs.matchAll(/expression:\s*'/g)].length,
  handIssues,
}

writeFileSync(join(root, 'data/vocabulary-packs/_factcheck-report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
