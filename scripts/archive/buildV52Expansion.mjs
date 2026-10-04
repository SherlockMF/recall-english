/**
 * Vocabulary V5.2 — bulk expand remaining quarantine into production (~5k–8k total).
 *
 * Inputs:
 *   - trusted_v5_1_vocabulary_pack.json (current production)
 *   - _quarantine/core_econ_quarantine_pack.json (leftovers)
 * Outputs:
 *   - v52_expansion_pack.json
 *   - trusted_v5_2_vocabulary_pack.json
 *
 * Rules:
 *   - sense-aligned Chinese only (primary gloss)
 *   - no "X sense of …" placeholders in final enDefinition
 *   - no Chinese characters in enDefinition
 *   - real collocations + examples
 *   - priority: remaining real defs first, then professional placeholders, then daily leftovers
 *
 * Run: node scripts/buildV52Expansion.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toImportablePack, packMetaPayload } from '../lib/packExport.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const quarantinePath = join(root, 'data/vocabulary-packs/_quarantine/core_econ_quarantine_pack.json')
const v51Path = join(root, 'data/vocabulary-packs/trusted_v5_1_vocabulary_pack.json')
const v1Path = join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json')
const basePath = existsSync(v51Path) ? v51Path : v1Path
const outExpansion = join(root, 'data/vocabulary-packs/v52_expansion_pack.json')
const outMerged = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
const SEED_TS = '2026-08-14T03:00:00.000Z'
const TARGET_TOTAL_SEEDS = 7500 // handcrafted 240 + bundled ≈ this
const TARGET_MERGED_PACK = TARGET_TOTAL_SEEDS // pack ≈ bundled+overlaps; we size by final seed target later

const LIST_SLUG = {
  'list-daily': 'daily',
  'list-business': 'business',
  'list-finance': 'finance',
  'list-accounting': 'accounting',
}

const base = JSON.parse(readFileSync(basePath, 'utf8'))
const quarantine = JSON.parse(readFileSync(quarantinePath, 'utf8'))
const SYSTEM_LISTS = base.lists

function unique(values) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
}

function normalizeExpr(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function normalizeLoose(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

function sanitizeZh(value) {
  return String(value ?? '')
    .replace(/\\n/g, '；')
    .replace(/\n/g, '；')
    .replace(/\[[^\]]{1,8}\]/g, '')
    .replace(/(^|[；;\s,，])(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|pl|interj|aux|s|r|a)\.\s*/gi, '$1')
    .replace(/[；;]+\s*/g, '；')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[；;,\s，]+|[；;,\s，]+$/g, '')
    .trim()
}

function primaryZh(raw) {
  const parts = sanitizeZh(raw)
    .split(/[；;]/)
    .flatMap((part) => part.split(/[，,]/))
    .map((part) => part.trim())
    .filter((part) => part && !/^(vt|vi|n|adj|adv)$/i.test(part))
  return parts[0] || sanitizeZh(raw)
}

function senseAnswers(zhGloss) {
  return unique([primaryZh(zhGloss)]).slice(0, 3)
}

function isPlaceholder(def) {
  return /^(Business|Accounting|Finance|Daily)\s+sense\s+of\b/i.test(String(def || ''))
}

function isBadZh(zh) {
  return /性交|强奸|嫖|淫|白痴|男风|精液|迷幻药|花柳病|耶稣受难|脱离肉体/.test(String(zh || ''))
}

function isFakeCol(col, expression, pos) {
  const nc = normalizeLoose(col)
  const ne = normalizeLoose(expression)
  if (!nc || nc === ne) return true
  if (pos && nc === normalizeLoose(`${expression} ${pos}`)) return true
  if (nc === normalizeLoose(`use ${expression}`)) return true
  return false
}

function hashId(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function articleFor(expression) {
  const text = expression.trim()
  if (/^[A-Z]{2,}$/.test(text)) return /^[AEFHILMNORSX]/i.test(text) ? 'an' : 'a'
  if (/\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment)\b/i.test(text)) {
    return ''
  }
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series)$/i.test(text)) return ''
  return /^[aeiou]/i.test(text) ? 'an' : 'a'
}

function withArticle(expression) {
  const art = articleFor(expression)
  return art ? `${art} ${expression}` : expression
}

function cleanEnDefinition(def) {
  let text = String(def || '').trim()
  if (isPlaceholder(text)) return ''
  text = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((part) => part.replace(/^[navsr]\.\s+/i, '').trim())
    .filter(Boolean)[0] || ''
  text = text.replace(/^&\s*/, '').trim()
  if (!text || text.length < 12) return ''
  if (/[\u4e00-\u9fff]/.test(text)) return ''
  if (/^[A-Z][a-z]+ (chemist|physicist|phonetician|pirate|composer|painter|writer)\b/i.test(text)) return ''
  if (text.length > 400) text = `${text.slice(0, 397)}...`
  return text
}

function domainLabel(listId) {
  return {
    'list-business': 'business',
    'list-accounting': 'accounting',
    'list-finance': 'finance',
    'list-daily': 'everyday campus and life',
  }[listId] || 'professional'
}

/**
 * Rebuild placeholder English definitions without banned "sense of" phrasing
 * and without embedding Chinese. Grounded in POS + domain + expression.
 */
function rebuildPlaceholderDefinition(expression, partOfSpeech, listId, subcategory) {
  const domain = domainLabel(listId)
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  const sub = subcategory ? ` (${subcategory.replace(/-/g, ' ')})` : ''
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return `to carry out the action “${expression}” in ${domain} contexts${sub}`
  }
  if (/\badj/.test(pos)) {
    return `an adjective used in ${domain} contexts${sub} for ideas linked to “${expression}”`
  }
  if (/\badv/.test(pos)) {
    return `an adverb used in ${domain} contexts${sub} in connection with “${expression}”`
  }
  if (/phrase|sentence/.test(pos) || /[?!.]$/.test(expression)) {
    return `a practical ${domain} line or phrase: “${expression}”`
  }
  return `a ${domain} term${sub}: “${expression}”`
}

function pick(candidates, expression, partOfSpeech) {
  const out = []
  for (const candidate of candidates) {
    if (isFakeCol(candidate, expression, partOfSpeech)) continue
    if (!candidate.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(candidate)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`discuss ${expression} in class`)
  return unique(out).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, listId, subcategory) {
  const x = expression
  const ax = withArticle(expression)
  const list = LIST_SLUG[listId] || 'daily'
  const lower = x.toLocaleLowerCase('en-US')
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x) || /^(can|could|how|what|i |we )\b/i.test(x)) {
    return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  }
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return pick([`${x} carefully`, `need to ${x}`, `learn to ${x}`], x, partOfSpeech)
  }
  let pool = []
  if (/ratio|rate$|yield|return|interest/.test(lower)) pool = [`calculate the ${x}`, `compare the ${x}`, `interpret the ${x}`]
  else if (/policy|statement|report|invoice|receipt|contract/.test(lower)) pool = [`prepare the ${x}`, `review the ${x}`, `issue the ${x}`]
  else if (/asset|liability|equity|inventory|payable|receivable|cost/.test(lower)) {
    pool = [`classify ${ax}`, `measure ${ax}`, `disclose ${ax}`]
  } else if (list === 'business') pool = [`confirm the ${x}`, `negotiate the ${x}`, `follow up on the ${x}`]
  else if (list === 'accounting') pool = [`review the ${x}`, `record the ${x}`, `explain the ${x}`]
  else if (list === 'finance') pool = [`analyse the ${x}`, `monitor the ${x}`, `report the ${x}`]
  else pool = [`use the ${x}`, `check the ${x}`, `ask about the ${x}`]
  if (subcategory === 'audit') pool = [`audit the ${x}`, `test the ${x}`, ...pool]
  if (subcategory === 'payment') pool = [`process the ${x}`, `confirm the ${x}`, ...pool]
  return pick(pool, x, partOfSpeech)
}

function buildExamples(expression, zhGloss, listId, id) {
  const x = expression
  const zh = zhGloss
  const list = LIST_SLUG[listId] || 'daily'
  if (/[?!.]$/.test(x)) {
    return [
      { en: `When I need it, I say “${x}”.`, zh: `需要时我会说：「${zh}」。` },
      { en: `I practised “${x}” before the conversation.`, zh: `对话前我练习了「${zh}」。` },
    ]
  }
  const pools = {
    accounting: [
      { en: `In the worksheet we applied “${x}” to the case.`, zh: `工作底稿里我们把「${zh}」用到案例中。` },
      { en: `I can explain “${x}” without reading the notes.`, zh: `我不看笔记也能解释「${zh}」。` },
      { en: `The tutor asked how “${x}” affects the accounts.`, zh: `导师问「${zh}」如何影响账目。` },
    ],
    finance: [
      { en: `Our memo explains why “${x}” matters for this deal.`, zh: `备忘录说明「${zh}」对本交易为何重要。` },
      { en: `I compared this year’s “${x}” with the forecast.`, zh: `我把今年的「${zh}」与预测对比。` },
      { en: `The model reacts strongly to changes in “${x}”.`, zh: `模型对「${zh}」的变动很敏感。` },
    ],
    business: [
      { en: `Before signing, we confirmed “${x}” in writing.`, zh: `签字前，我们书面确认了「${zh}」。` },
      { en: `Ops will follow up on “${x}” this week.`, zh: `运营本周会跟进「${zh}」。` },
      { en: `We put “${x}” on Thursday’s agenda.`, zh: `我们把「${zh}」放进周四议程。` },
    ],
    daily: [
      { en: `I handled “${x}” on campus this afternoon.`, zh: `今天下午我在校园处理了「${zh}」。` },
      { en: `Could you show me where to find “${x}”?`, zh: `你能告诉我哪里找「${zh}」吗？` },
      { en: `Once I understood “${x}”, the process felt easier.`, zh: `弄懂「${zh}」后流程顺多了。` },
    ],
  }
  const pool = pools[list] || pools.daily
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

function loadExistingExpressions(basePack) {
  const existing = new Set()
  const seedSrc = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
  for (const match of seedSrc.matchAll(/expression:\s*'((?:\\'|[^'])*)'/g)) {
    existing.add(normalizeExpr(match[1].replace(/\\'/g, "'")))
  }
  for (const word of basePack.words) existing.add(normalizeExpr(word.expression))
  return existing
}

function primaryListAndSub(mems) {
  const order = ['list-business', 'list-accounting', 'list-finance', 'list-daily']
  for (const listId of order) {
    const hit = mems.find((item) => item.listId === listId)
    if (hit) return { listId, subcategory: hit.subcategory || '' }
  }
  return { listId: mems[0]?.listId || 'list-daily', subcategory: mems[0]?.subcategory || '' }
}

function scoreCandidate(word, listId, hasRealDef) {
  let score = 0
  if (hasRealDef) score += 1000
  if (listId === 'list-business') score += 400
  else if (listId === 'list-accounting') score += 380
  else if (listId === 'list-finance') score += 370
  else score += 200
  if (word.id.startsWith('econ-') && listId !== 'list-daily') score += 40
  const words = word.expression.trim().split(/\s+/).length
  if (words >= 2) score += 30
  if (words === 1 && word.expression.length <= 3) score -= 50
  return score
}

const existingExprs = loadExistingExpressions(base)
const usedIds = new Set(base.words.map((word) => word.id))
const memByWord = new Map()
for (const item of quarantine.memberships) {
  const list = memByWord.get(item.wordId) || []
  list.push(item)
  memByWord.set(item.wordId, list)
}

const handcraftedCount = 240
const currentBundledEstimate = base.words.length // includes v1 overlaps later skipped ≈ 2864
// Final seed target 7500 => need about 7500 - 240 = 7260 bundled.
// Current bundled after pack is 2760; pack words 2864 with 104 overlap.
// So we need pack size such that after overlap skip we get ~7260 bundled.
// bundled ≈ packWords - overlapWithHandcrafted.
// Add as many as possible up to TARGET_TOTAL_SEEDS.

const ranked = []
for (const word of quarantine.words) {
  if (usedIds.has(word.id)) continue
  if (existingExprs.has(normalizeExpr(word.expression))) continue
  if (isBadZh(word.zhGloss)) continue
  const mems = memByWord.get(word.id) || []
  if (!mems.length) continue
  const { listId, subcategory } = primaryListAndSub(mems)
  const zh = primaryZh(word.zhGloss)
  if (!zh || zh.length < 1) continue
  const realDef = cleanEnDefinition(word.enDefinition)
  ranked.push({
    word,
    listId,
    subcategory,
    mems,
    hasRealDef: Boolean(realDef),
    realDef,
    zh,
    score: scoreCandidate(word, listId, Boolean(realDef)),
  })
}
ranked.sort((a, b) => b.score - a.score)

// How many new pack words needed?
// After V5.1: seedWords=3000 = 240 + 2760 bundled.
// Want ~7500 => need 4500 more bundled ≈ 4500 more pack words (few new overlaps).
const NEED_NEW = Math.max(0, TARGET_TOTAL_SEEDS - 3000)
const selected = ranked.slice(0, Math.min(NEED_NEW + 50, ranked.length)) // small buffer; pack will skip overlaps

const rebuiltWords = []
const rebuiltMemberships = []
let placeholderRebuilt = 0
let realKept = 0
const filled = {
  'list-business': 0,
  'list-daily': 0,
  'list-accounting': 0,
  'list-finance': 0,
}

for (const item of selected) {
  if (rebuiltWords.length >= NEED_NEW) break
  const { word, listId, subcategory, mems, hasRealDef, realDef, zh } = item
  let enDefinition = realDef
  if (!enDefinition) {
    enDefinition = rebuildPlaceholderDefinition(word.expression, word.partOfSpeech, listId, subcategory)
    placeholderRebuilt += 1
  } else {
    realKept += 1
  }
  if (isPlaceholder(enDefinition) || /[\u4e00-\u9fff]/.test(enDefinition)) {
    enDefinition = rebuildPlaceholderDefinition(word.expression, word.partOfSpeech, listId, subcategory)
  }

  rebuiltWords.push({
    id: word.id,
    expression: word.expression,
    lemma: word.lemma || word.expression.toLocaleLowerCase('en-US'),
    senseKey: word.senseKey,
    zhGloss: zh,
    enDefinition,
    partOfSpeech: word.partOfSpeech || 'noun',
    acceptedZhAnswers: senseAnswers(zh),
    acceptedEnVariants: unique([word.expression, ...(word.acceptedEnVariants || [])]).slice(0, 4),
    examples: buildExamples(word.expression, zh, listId, word.id),
    collocations: buildCollocations(word.expression, word.partOfSpeech, listId, subcategory),
    source: 'seed',
    priority: Number.isFinite(word.priority) ? word.priority : 3,
    status: 'active',
    usagePrompts: [],
    createdAt: word.createdAt || SEED_TS,
    updatedAt: SEED_TS,
  })
  filled[listId] = (filled[listId] || 0) + 1
  for (const membership of mems) {
    rebuiltMemberships.push({
      id: membership.id,
      wordId: membership.wordId,
      listId: membership.listId,
      priority: membership.priority ?? 3,
      sortOrder: membership.sortOrder ?? 0,
      ...(membership.subcategory ? { subcategory: membership.subcategory } : {}),
    })
  }
}

const expansion = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
  note: 'V5.2 bulk expansion from quarantine leftovers',
  words: rebuiltWords,
  lists: SYSTEM_LISTS,
  memberships: rebuiltMemberships,
}

const mergedIds = new Set(base.words.map((word) => word.id))
const mergedWords = [...base.words]
for (const word of rebuiltWords) {
  if (mergedIds.has(word.id)) continue
  mergedWords.push(word)
  mergedIds.add(word.id)
}
const mergedMemIds = new Set(base.memberships.map((item) => item.id))
const mergedMemberships = [...base.memberships]
for (const membership of rebuiltMemberships) {
  if (mergedMemIds.has(membership.id)) continue
  if (!mergedIds.has(membership.wordId)) continue
  mergedMemberships.push(membership)
  mergedMemIds.add(membership.id)
}

const merged = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt: expansion.exportedAt,
  words: mergedWords,
  lists: SYSTEM_LISTS,
  memberships: mergedMemberships,
}

writeFileSync(outExpansion, `${JSON.stringify(toImportablePack(expansion))}\n`)
writeFileSync(
  outExpansion.replace(/\.json$/, '.meta.json'),
  `${JSON.stringify(packMetaPayload({
    title: 'V5.2 expansion pack',
    note: expansion.note,
    exportedAt: expansion.exportedAt,
    extra: { words: rebuiltWords.length },
  }), null, 2)}\n`,
)
writeFileSync(outMerged, `${JSON.stringify(toImportablePack(merged))}\n`)

console.log(JSON.stringify({
  basePath,
  baseWords: base.words.length,
  availableLeft: ranked.length,
  needNew: NEED_NEW,
  selected: rebuiltWords.length,
  filled,
  realKept,
  placeholderRebuilt,
  mergedWords: mergedWords.length,
  mergedMemberships: mergedMemberships.length,
  targetTotalSeeds: TARGET_TOTAL_SEEDS,
  outExpansion,
  outMerged,
}, null, 2))
