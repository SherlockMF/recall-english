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
  if (/^(Business|Accounting|Finance|Daily|Common English)\s+sense\s+of\b/i.test(word.enDefinition || '') || /\bsense of\b/i.test(word.enDefinition || '')) {
    fail(word.id, 'placeholder_definition', word.enDefinition)
  }
  if (/in (business|accounting|finance|daily) practice$/i.test(word.enDefinition || '')) {
    fail(word.id, 'practice_fallback_definition', word.enDefinition)
  }
  if (
    /used in (business|accounting|finance|daily) work$/i.test(word.enDefinition || '') ||
    /as used in study and work$/i.test(word.enDefinition || '') ||
    /the daily meaning of /i.test(word.enDefinition || '')
  ) {
    fail(word.id, 'work_fallback_definition', word.enDefinition)
  }
  if (/a measured level or proportion relating to/i.test(word.enDefinition || '')) {
    fail(word.id, 'rate_relating_fallback', word.enDefinition)
  }
  if (
    / relating to /i.test(word.enDefinition || '') &&
    !/^of or relating to/i.test(word.enDefinition || '') &&
    !/\(law\)/i.test(word.enDefinition || '') &&
    !/property resulting from being or relating to/i.test(word.enDefinition || '')
  ) {
    fail(word.id, 'composed_relating_definition', word.enDefinition)
  }
  if (/in commercial or accounting use$/i.test(word.enDefinition || '')) {
    fail(word.id, 'commercial_use_fallback', word.enDefinition)
  }
  if (/banking arrangement or institution role/i.test(word.enDefinition || '')) {
    fail(word.id, 'bank_role_fallback', word.enDefinition)
  }
  if (/^costs attributable to /i.test(word.enDefinition || '')) {
    fail(word.id, 'cost_attr_fallback', word.enDefinition)
  }
  if (/^an investor in /i.test(word.enDefinition || '')) {
    fail(word.id, 'investor_in_fallback', word.enDefinition)
  }
  if (/used in business and finance$/i.test(word.enDefinition || '')) {
    fail(word.id, 'business_finance_fallback', word.enDefinition)
  }
  if (/ in accounting and trade practice$/i.test(word.enDefinition || '')) {
    fail(word.id, 'trade_practice_fallback', word.enDefinition)
  }
  if (/[\u4e00-\u9fff]/.test(word.enDefinition || '')) {
    fail(word.id, 'chinese_in_en_definition', word.enDefinition)
  }
  for (const example of word.examples || []) {
    if (/Please notice .+ in context/i.test(example.en || '')) {
      fail(word.id, 'template_example', example.en)
    }
    if (
      !String(word.id).startsWith('v1-') &&
      /They chose to .+ after reviewing the risks|Do not .+ unless the contract allows it|Investors preferred a more .+ structure|Make sure the summary stays /i.test(
        example.en || '',
      )
    ) {
      fail(word.id, 'round9_hostile_template_example', example.en)
    }
    if (
      !String(word.id).startsWith('v1-') &&
      /Legal asked us to redefine the|The kickoff deck covers the|We escalated the .+ to the steering group|The deal model hinges on the|She explained the .+ in plain English|The briefing clarified the|We validated the .+ against source data|The memo defines the|Add the .+ to tomorrow.?s agenda|Two teams share ownership of the/i.test(
        example.en || '',
      )
    ) {
      fail(word.id, 'soft_bank_example', example.en)
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
  // Role / person collocations should not use pricing-hedge verbs
  if (
    !String(word.id).startsWith('v1-') &&
    /\b(investor|clerk|manager|attorney|wholesaler|entrepreneur)\b/i.test(word.expression || '') &&
    !/\b(fee|report|receipt|invoice|cost|rate)\b/i.test(word.expression || '') &&
    (word.collocations || []).some((col) => /^(model|hedge|post|price|fund|value) (a |an |the )/i.test(col))
  ) {
    fail(word.id, 'person_col_mismatch', word.collocations)
  }

  const variantsJoined = (word.acceptedEnVariants || []).join(' | ')
  const knownBadVariant = [
    /\bafioat\b/i,
    /\bstock lone\b/i,
    /\bstock ticket\b/i,
    /\bstiffing order\b/i,
    /\bresult's management\b/i,
    /\bun-audit balance sheet\b/i,
    /\bgenerally accounting\b/i,
    /\bsecurities and exchanges commission\b/i,
    /\bsuper annuation fund\b/i,
    /\bnon-bear bond\b/i,
    /\bestimate revenue\b/i,
    /\bapproximate of the cost\b/i,
    /\bamortization of bond issued expense\b/i,
  ]
  for (const pattern of knownBadVariant) {
    if (pattern.test(variantsJoined)) {
      fail(word.id, 'bad_accepted_en_variant', variantsJoined)
      break
    }
  }

  if (/[（(][^）)]*$/.test(String(word.zhGloss || '').trim())) {
    fail(word.id, 'zh_unclosed_paren', word.zhGloss)
  }

  if (!String(word.id).startsWith('v1-')) {
    const def = String(word.enDefinition || '')
    if (/the market in which .+ is bought, sold, or priced/i.test(def)) {
      fail(word.id, 'template_market_in_which', def)
    }
    if (/^credit related to /i.test(def) || /^a market associated with /i.test(def)) {
      fail(word.id, 'weak_composed_professional_def', def)
    }
    if (/a person or party involved in /i.test(def)) {
      fail(word.id, 'template_person_involved', def)
    }
    if (/the difference used to measure profitability of /i.test(def) && /margin/i.test(word.expression || '')) {
      fail(word.id, 'template_margin_profitability', def)
    }
    if (/a fee paid for /i.test(def) && /commission/i.test(word.expression || '') && /委员会|理事会/.test(word.zhGloss || '')) {
      fail(word.id, 'template_commission_as_fee', def)
    }
    if (/a debt security or bond arrangement related to /i.test(def) && /保证金|保函|保险|保单/.test(word.zhGloss || '')) {
      fail(word.id, 'template_bond_as_debt', def)
    }
  }

  const pos = String(word.partOfSpeech || '').toLocaleLowerCase('en-US')
  const nonNoun =
    /\badverb\b|\bpronoun\b|\bpreposition\b|\bconjunction\b|\bmodal\b|\binterjection\b|\bnumeral\b/.test(pos) ||
    (/\bverb\b/.test(pos) && !/phrase/.test(pos)) ||
    /\badjective\b|\badj\b/.test(pos)
  if (nonNoun) {
    const expr = String(word.expression || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    for (const example of word.examples || []) {
      const en = String(example.en || '')
      if (/Pair the .+ with a collocation|weekly drill recycles the |Before the quiz, revise the |Our notes group the |workbook asks you to translate the |Write one sentence that uses the /i.test(en)) {
        fail(word.id, 'pos_hostile_drill_example', en)
      }
      if (
        (/\badverb\b|\bpronoun\b|\bpreposition\b|\bconjunction\b|\bmodal\b/.test(pos) ||
          (/\bverb\b/.test(pos) && !/noun/.test(pos))) &&
        new RegExp(`\\bthe ${expr}\\b`, 'i').test(en)
      ) {
        // allow "confirm the order" style where expression is the verb governing a noun
        if (!(/\bverb\b/.test(pos) && new RegExp(`\\b${expr} the\\b`, 'i').test(en))) {
          fail(word.id, 'pos_hostile_article_example', en)
        }
      }
    }
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
