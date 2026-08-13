/**
 * Heuristic factual / data-quality scan for vocabulary pack + bundled seeds.
 * Usage: node scripts/factCheckVocabulary.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function loadJson(rel) {
  return JSON.parse(readFileSync(join(root, rel), 'utf8'))
}

const pack = loadJson('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')
const bundled = loadJson('src/data/bundledSeedWords.json')
const memberships = loadJson('src/data/bundledSeedMemberships.json')

const POS_DEBRIS = /\b(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|pl)\.\s*/i
const BRACKET_TAG = /\[[^\]]{1,12}\]/
const LITERAL_BACKSLASH_N = /\\n/
const ONLY_PUNCT = /^[\s\p{P}\p{S}]+$/u
const HAS_CJK = /[\u3400-\u9fff]/
const MOSTLY_LATIN_ZH = /^[\x00-\x7F]{4,}$/

/** Obvious English↔Chinese mismatches: known wrong pairs to spot-check later via samples */
const SUSPICIOUS_GLOSS_PATTERNS = [
  { re: /强奸|鸡巴|阴茎|阴道|性交|色情/, label: 'nsfw_or_vulgar_zh' },
  { re: /地名|人名|商标/, label: 'meta_label_zh' },
]

function flagsForWord(w, source) {
  const flags = []
  const zh = String(w.zhGloss ?? '')
  const en = String(w.enDefinition ?? '')
  const expr = String(w.expression ?? '')

  if (!expr.trim()) flags.push('empty_expression')
  if (!zh.trim()) flags.push('empty_zh')
  if (!en.trim()) flags.push('empty_en_def')
  if (ONLY_PUNCT.test(zh)) flags.push('zh_only_punct')
  if (LITERAL_BACKSLASH_N.test(zh)) flags.push('zh_literal_backslash_n')
  if (BRACKET_TAG.test(zh)) flags.push('zh_bracket_tag')
  if (POS_DEBRIS.test(zh)) flags.push('zh_pos_debris')
  if (!HAS_CJK.test(zh)) flags.push('zh_no_cjk')
  if (MOSTLY_LATIN_ZH.test(zh.trim())) flags.push('zh_mostly_latin')
  if (zh.length > 80) flags.push('zh_very_long')
  if (en.length > 400) flags.push('en_very_long')
  if (expr.length > 80) flags.push('expression_very_long')
  if (/^\d+$/.test(expr)) flags.push('expression_numeric_only')
  if (/\s{2,}/.test(expr)) flags.push('expression_multi_space')

  for (const p of SUSPICIOUS_GLOSS_PATTERNS) {
    if (p.re.test(zh) || (w.acceptedZhAnswers || []).some((a) => p.re.test(String(a)))) {
      flags.push(p.label)
    }
  }

  // answers contaminated
  const answers = Array.isArray(w.acceptedZhAnswers) ? w.acceptedZhAnswers : []
  if (answers.some((a) => LITERAL_BACKSLASH_N.test(String(a)) || POS_DEBRIS.test(String(a)) || BRACKET_TAG.test(String(a)))) {
    flags.push('answer_debris')
  }
  if (answers.some((a) => !HAS_CJK.test(String(a)) && String(a).trim().length > 0)) {
    flags.push('answer_no_cjk')
  }

  // definition looks like it might be for acronym expansion mismatch
  if (/^[A-Z]{2,8}$/.test(expr) && en.length < 8) flags.push('acronym_thin_def')

  // lemma wildly different from expression (beyond casing/hyphen)
  const lemma = String(w.lemma ?? '').toLocaleLowerCase('en-US')
  const exprNorm = expr.toLocaleLowerCase('en-US')
  if (lemma && !exprNorm.includes(lemma.split(/\s+/)[0]) && !lemma.includes(exprNorm.split(/\s+/)[0])) {
    if (Math.abs(lemma.length - exprNorm.length) > 8) flags.push('lemma_expression_divergence')
  }

  return flags.map((f) => `${source}:${f}`)
}

function summarize(words, source) {
  const byFlag = {}
  const samples = {}
  for (const w of words) {
    const flags = flagsForWord(w, source)
    for (const f of flags) {
      byFlag[f] = (byFlag[f] || 0) + 1
      if (!samples[f]) samples[f] = []
      if (samples[f].length < 8) {
        samples[f].push({
          id: w.id,
          expression: w.expression,
          zhGloss: w.zhGloss,
          enDefinition: String(w.enDefinition || '').slice(0, 120),
          partOfSpeech: w.partOfSpeech,
          source: w.source,
        })
      }
    }
  }
  return { byFlag, samples }
}

/** Cross-check: expression appears in zh as English copy-paste error */
function englishCopiedAsZh(words) {
  const hits = []
  for (const w of words) {
    const zh = String(w.zhGloss || '')
    const expr = String(w.expression || '')
    if (expr.length >= 4 && zh.toLocaleLowerCase('en-US').includes(expr.toLocaleLowerCase('en-US'))) {
      hits.push({ id: w.id, expression: expr, zhGloss: zh })
    }
  }
  return hits.slice(0, 30)
}

/** Finance/accounting list membership vs keyword heuristics */
const ACCOUNTING_HINTS = /\b(debit|credit|ledger|journal|accrual|depreciation|amorti[sz]ation|receivable|payable|trial balance|ifrs|gaap|bookkeeping|invoice|inventory|asset|liabilit)\b/i
const FINANCE_HINTS = /\b(bond|equity|derivative|hedge|portfolio|valuation|ipo|yield|interest rate|capital market|securit)\b/i
const DAILY_HINTS = /\b(breakfast|toilet|roommate|canteen|bus stop|umbrella|laundry|homework)\b/i

function listMismatchCandidates(words, memberships) {
  const listByWord = new Map()
  for (const m of memberships) {
    const arr = listByWord.get(m.wordId) || []
    arr.push(m.listId)
    listByWord.set(m.wordId, arr)
  }
  const out = []
  for (const w of words) {
    const lists = listByWord.get(w.id) || []
    const text = `${w.expression} ${w.enDefinition} ${w.zhGloss}`
    const onlyDaily = lists.length === 1 && lists[0] === 'list-daily'
    const onlyBusiness = lists.length === 1 && lists[0] === 'list-business'
    if (onlyDaily && ACCOUNTING_HINTS.test(text)) {
      out.push({ id: w.id, expression: w.expression, lists, reason: 'accounting-ish in daily-only' })
    }
    if (onlyDaily && FINANCE_HINTS.test(text) && !DAILY_HINTS.test(text)) {
      out.push({ id: w.id, expression: w.expression, lists, reason: 'finance-ish in daily-only' })
    }
    if (onlyBusiness && ACCOUNTING_HINTS.test(w.expression) && /debit|credit|ledger|journal entry/i.test(w.expression)) {
      out.push({ id: w.id, expression: w.expression, lists, reason: 'core accounting term in business-only' })
    }
  }
  return out.slice(0, 40)
}

const packSummary = summarize(pack.words, 'pack')
const bundledSummary = summarize(bundled, 'bundled')
const copied = englishCopiedAsZh(bundled)
const listMismatches = listMismatchCandidates(bundled, memberships)

// Duplicate sense risk: same expression different id in pack (should be 0)
const byExpr = new Map()
for (const w of pack.words) {
  const k = w.expression.normalize('NFKC').trim().toLocaleLowerCase('en-US')
  byExpr.set(k, (byExpr.get(k) || 0) + 1)
}
const multiSense = [...byExpr.entries()].filter(([, n]) => n > 1)

// Handcrafted: parse expressions+zh from seedVocabulary.ts roughly
const seedTs = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
const handRows = []
for (const m of seedTs.matchAll(/expression:\s*'((?:\\'|[^'])*)'[\s\S]*?zh:\s*'((?:\\'|[^'])*)'[\s\S]*?definition:\s*'((?:\\'|[^'])*)'/g)) {
  handRows.push({
    expression: m[1].replace(/\\'/g, "'"),
    zh: m[2].replace(/\\'/g, "'"),
    definition: m[3].replace(/\\'/g, "'"),
  })
}

console.log(JSON.stringify({
  packWords: pack.words.length,
  bundledWords: bundled.length,
  handcraftedRowsParsed: handRows.length,
  multiSenseExpressions: multiSense.length,
  packFlags: packSummary.byFlag,
  bundledFlags: bundledSummary.byFlag,
  englishCopiedAsZhCount: englishCopiedAsZh(bundled).length,
  englishCopiedAsZhSamples: copied.slice(0, 15),
  listMismatchCount: listMismatchCandidates(bundled, memberships).length,
  listMismatchSamples: listMismatches,
  packFlagSamples: Object.fromEntries(
    Object.entries(packSummary.samples).filter(([k]) => !k.includes('zh_very_long') && !k.includes('en_very_long')),
  ),
  bundledFlagSamples: Object.fromEntries(
    Object.entries(bundledSummary.samples).filter(([k]) => !k.includes('zh_very_long')),
  ),
  nsfwPack: packSummary.samples['pack:nsfw_or_vulgar_zh'] || [],
  nsfwBundled: bundledSummary.samples['bundled:nsfw_or_vulgar_zh'] || [],
}, null, 2))
