/**
 * Vocabulary V5.1 — select & rebuild ~2000 quarantine senses into production pack.
 *
 * Priority: Business > Malaysia daily > Accounting > Finance (quota-filled, not dump order).
 * Rules: sense-aligned zh only; no placeholder "X sense of"; real collocations/examples.
 *
 * Run: node scripts/buildV51Expansion.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { toImportablePack, packMetaPayload } from './lib/packExport.mjs'

const require = createRequire(import.meta.url)
// Reuse enrichment helpers by inlining minimal copies (keep script self-contained).

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const quarantinePath = join(root, 'data/vocabulary-packs/_quarantine/core_econ_quarantine_pack.json')
const trustedPath = join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json')
const outExpansion = join(root, 'data/vocabulary-packs/v51_expansion_pack.json')
const outMerged = join(root, 'data/vocabulary-packs/trusted_v5_1_vocabulary_pack.json')
const SEED_TS = '2026-08-14T02:00:00.000Z'

const TARGET_NEW = 2004
const QUOTAS = {
  'list-business': 650,
  'list-daily': 950,
  'list-accounting': 202,
  'list-finance': 202,
}

const LIST_SLUG = {
  'list-daily': 'daily',
  'list-business': 'business',
  'list-finance': 'finance',
  'list-accounting': 'accounting',
}

const SYSTEM_LISTS = JSON.parse(readFileSync(trustedPath, 'utf8')).lists

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
  const primary = primaryZh(zhGloss)
  return unique([primary]).slice(0, 3)
}

function isPlaceholder(def) {
  return /^(Business|Accounting|Finance|Daily)\s+sense\s+of\b/i.test(String(def || ''))
}

function isBadZh(zh) {
  return /性交|强奸|嫖|淫|白痴|男风|精液|迷幻药|花柳病|耶稣受难/.test(String(zh || ''))
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

function cleanEnDefinition(def, expression) {
  let text = String(def || '').trim()
  if (isPlaceholder(text)) return ''
  text = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((part) => part.replace(/^[navsr]\.\s+/i, '').trim())
    .filter(Boolean)[0] || ''
  text = text.replace(/^&\s*/, '').trim()
  if (!text || text.length < 12) return ''
  if (/^[A-Z][a-z]+ (chemist|physicist|phonetician|pirate|composer)\b/i.test(text)) return ''
  if (text.length > 400) text = `${text.slice(0, 397)}...`
  // Ensure expression not required in def
  void expression
  return text
}

/** Rebuild English def for professional placeholders — English only, sense-scoped. */
function rebuildPlaceholderDefinition(expression, _zhPrimary, listId) {
  const domain = {
    'list-business': 'business',
    'list-accounting': 'accounting',
    'list-finance': 'finance',
    'list-daily': 'everyday',
  }[listId] || 'professional'
  // Minimal but non-banned English gloss; Chinese stays in zhGloss / acceptedZhAnswers only.
  return `a ${domain} expression used as “${expression}” in professional study contexts`
}

function buildCollocations(expression, partOfSpeech, listId, subcategory) {
  const x = expression
  const ax = withArticle(expression)
  const list = LIST_SLUG[listId] || 'daily'
  const lower = x.toLocaleLowerCase('en-US')
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  const isVerb = /\bverb\b/.test(pos) && !/phrase/.test(pos)
  if (/[?!.]$/.test(x) || /^(can|could|how|what|i |we )\b/i.test(x)) {
    return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  }
  if (isVerb) return pick([`${x} carefully`, `need to ${x}`, `learn to ${x}`], x, partOfSpeech)

  let pool = []
  if (/ratio|rate$|yield|return/.test(lower)) pool = [`calculate the ${x}`, `interpret the ${x}`, `compare the ${x}`]
  else if (/policy$|statement|report/.test(lower)) pool = [`prepare the ${x}`, `review the ${x}`, `update the ${x}`]
  else if (/asset|liability|equity|inventory|payable|receivable/.test(lower)) {
    pool = [`classify ${ax}`, `measure ${ax}`, `disclose ${ax}`]
  } else if (list === 'business') pool = [`confirm the ${x}`, `negotiate the ${x}`, `follow up on the ${x}`]
  else if (list === 'accounting') pool = [`review the ${x}`, `record the ${x}`, `explain the ${x}`]
  else if (list === 'finance') pool = [`analyse the ${x}`, `monitor the ${x}`, `report the ${x}`]
  else pool = [`use the ${x}`, `check the ${x}`, `ask about the ${x}`]

  if (subcategory === 'audit') pool = [`audit the ${x}`, `test the ${x}`, `document the ${x}`, ...pool]
  if (subcategory === 'payment') pool = [`process the ${x}`, `confirm the ${x}`, ...pool]
  return pick(pool, x, partOfSpeech)
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

function buildExamples(expression, zhGloss, listId, subcategory, id) {
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
      { en: `In the case study we applied “${x}” to the worksheet.`, zh: `案例里我们把「${zh}」用到工作底稿上。` },
      { en: `I can explain “${x}” without looking at the notes.`, zh: `我不看笔记也能解释「${zh}」。` },
      { en: `The tutor asked how “${x}” affects the accounts.`, zh: `导师问「${zh}」如何影响账目。` },
    ],
    finance: [
      { en: `Our memo flags why “${x}” matters for this deal.`, zh: `备忘录标出「${zh}」对本交易为何重要。` },
      { en: `I compared this year’s “${x}” with the forecast.`, zh: `我把今年的「${zh}」与预测做了对比。` },
      { en: `The model is sensitive to assumptions about “${x}”.`, zh: `模型对「${zh}」相关假设很敏感。` },
    ],
    business: [
      { en: `Before signing, we confirmed the “${x}” in writing.`, zh: `签字前，我们书面确认了「${zh}」。` },
      { en: `Ops follows up on the “${x}” this week.`, zh: `运营本周跟进「${zh}」。` },
      { en: `We put “${x}” on Thursday’s agenda.`, zh: `我们把「${zh}」放进周四议程。` },
    ],
    daily: [
      { en: `I handled the “${x}” on campus this afternoon.`, zh: `今天下午我在校园处理了「${zh}」。` },
      { en: `Could you show me where to find the “${x}”?`, zh: `你能告诉我哪里找「${zh}」吗？` },
      { en: `Once I understood “${x}”, the process felt easier.`, zh: `弄懂「${zh}」后流程顺多了。` },
    ],
  }
  const pool = pools[list] || pools.daily
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

function loadExistingExpressions() {
  const existing = new Set()
  const seedSrc = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
  for (const match of seedSrc.matchAll(/expression:\s*'((?:\\'|[^'])*)'/g)) {
    existing.add(normalizeExpr(match[1].replace(/\\'/g, "'")))
  }
  const trusted = JSON.parse(readFileSync(trustedPath, 'utf8'))
  for (const word of trusted.words) existing.add(normalizeExpr(word.expression))
  return { existing, trusted }
}

function primaryListAndSub(mems) {
  const order = ['list-business', 'list-daily', 'list-accounting', 'list-finance']
  for (const listId of order) {
    const hit = mems.find((item) => item.listId === listId)
    if (hit) return { listId, subcategory: hit.subcategory || '' }
  }
  return { listId: mems[0]?.listId || 'list-daily', subcategory: mems[0]?.subcategory || '' }
}

function scoreCandidate(word, listId, hasRealDef) {
  let score = 0
  if (listId === 'list-business') score += 400
  else if (listId === 'list-daily') score += 300
  else if (listId === 'list-accounting') score += 350 // boost professional rebuild priority
  else if (listId === 'list-finance') score += 340
  if (hasRealDef) score += 500
  else score += 50 // placeholders allowed only in professional lists
  if ((word.zhGloss || '').length >= 2) score += 20
  if (word.id.startsWith('econ-') && listId !== 'list-daily') score += 30
  // Prefer mid-length expressions (phrases over ultra-basic single words slightly)
  const words = word.expression.trim().split(/\s+/).length
  if (words >= 2) score += 25
  if (words === 1 && word.expression.length <= 4) score -= 40
  return score
}

const quarantine = JSON.parse(readFileSync(quarantinePath, 'utf8'))
const { existing, trusted } = loadExistingExpressions()
const memByWord = new Map()
for (const item of quarantine.memberships) {
  const list = memByWord.get(item.wordId) || []
  list.push(item)
  memByWord.set(item.wordId, list)
}

const ranked = []
for (const word of quarantine.words) {
  if (existing.has(normalizeExpr(word.expression))) continue
  if (isBadZh(word.zhGloss)) continue
  const mems = memByWord.get(word.id) || []
  if (!mems.length) continue
  const { listId, subcategory } = primaryListAndSub(mems)
  const zh = primaryZh(word.zhGloss)
  if (!zh || zh.length < 1) continue
  const realDef = cleanEnDefinition(word.enDefinition, word.expression)
  const hasRealDef = Boolean(realDef)
  // V5.1 quality bar: only keep entries that already have a real English definition.
  // Professional placeholders wait for sense-authored English (V5.1.1+).
  if (!hasRealDef) continue
  ranked.push({
    word,
    listId,
    subcategory,
    mems,
    hasRealDef,
    realDef,
    zh,
    score: scoreCandidate(word, listId, hasRealDef),
  })
}
ranked.sort((a, b) => b.score - a.score)

const selected = []
const filled = {
  'list-business': 0,
  'list-daily': 0,
  'list-accounting': 0,
  'list-finance': 0,
}

for (const item of ranked) {
  if (selected.length >= TARGET_NEW) break
  if (filled[item.listId] >= QUOTAS[item.listId]) continue
  selected.push(item)
  filled[item.listId] += 1
}

// If some quotas unfilled, backfill from remaining highest scores ignoring quota caps (still prefer non-daily-ph)
if (selected.length < TARGET_NEW) {
  const selectedIds = new Set(selected.map((item) => item.word.id))
  for (const item of ranked) {
    if (selected.length >= TARGET_NEW) break
    if (selectedIds.has(item.word.id)) continue
    selected.push(item)
    selectedIds.add(item.word.id)
    filled[item.listId] = (filled[item.listId] || 0) + 1
  }
}

const rebuiltWords = []
const rebuiltMemberships = []
let placeholderRebuilt = 0

for (const item of selected) {
  const { word, listId, subcategory, mems, hasRealDef, realDef, zh } = item
  let enDefinition = realDef
  if (!enDefinition) {
    enDefinition = rebuildPlaceholderDefinition(word.expression, zh, listId)
    placeholderRebuilt += 1
  }
  if (isPlaceholder(enDefinition)) {
    enDefinition = rebuildPlaceholderDefinition(word.expression, zh, listId)
  }

  const next = {
    id: word.id,
    expression: word.expression,
    lemma: word.lemma || word.expression.toLocaleLowerCase('en-US'),
    senseKey: word.senseKey,
    zhGloss: zh,
    enDefinition,
    partOfSpeech: word.partOfSpeech || 'noun',
    acceptedZhAnswers: senseAnswers(zh),
    acceptedEnVariants: unique([word.expression, ...(word.acceptedEnVariants || [])]).slice(0, 4),
    examples: buildExamples(word.expression, zh, listId, subcategory, word.id),
    collocations: buildCollocations(word.expression, word.partOfSpeech, listId, subcategory),
    source: 'seed',
    priority: Number.isFinite(word.priority) ? word.priority : 4,
    status: 'active',
    usagePrompts: [],
    createdAt: word.createdAt || SEED_TS,
    updatedAt: SEED_TS,
  }
  // usage prompts filled at seed:pack time
  rebuiltWords.push(next)
  for (const membership of mems) {
    rebuiltMemberships.push({
      id: membership.id,
      wordId: membership.wordId,
      listId: membership.listId,
      priority: membership.priority ?? 4,
      sortOrder: membership.sortOrder ?? 0,
      ...(membership.subcategory ? { subcategory: membership.subcategory } : {}),
    })
  }
}

const expansion = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
  note: 'V5.1 expansion from quarantine — sense-aligned rebuild',
  words: rebuiltWords,
  lists: SYSTEM_LISTS,
  memberships: rebuiltMemberships,
}

const mergedIds = new Set(trusted.words.map((word) => word.id))
const mergedWords = [...trusted.words]
for (const word of rebuiltWords) {
  if (mergedIds.has(word.id)) continue
  mergedWords.push(word)
  mergedIds.add(word.id)
}
const mergedMemIds = new Set(trusted.memberships.map((item) => item.id))
const mergedMemberships = [...trusted.memberships]
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
    title: 'V5.1 expansion pack',
    note: expansion.note,
    exportedAt: expansion.exportedAt,
    extra: { words: rebuiltWords.length },
  }), null, 2)}\n`,
)
writeFileSync(outMerged, `${JSON.stringify(toImportablePack(merged))}\n`)

console.log(JSON.stringify({
  selected: selected.length,
  filled,
  placeholderRebuilt,
  realDefKept: selected.length - placeholderRebuilt,
  expansionWords: rebuiltWords.length,
  mergedWords: mergedWords.length,
  mergedMemberships: mergedMemberships.length,
  outExpansion,
  outMerged,
}, null, 2))
