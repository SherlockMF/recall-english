/**
 * Batch 2 — sanitize acceptedEnVariants across production pack + targeted V1/zh fixes.
 *
 * Rules (conservative):
 * - Keep expression itself
 * - Keep UK/US spelling pairs (-our/-or, -ise/-ize, behaviour/behavior, etc.)
 * - Keep hyphen/space/apostrophe/case/acronym equivalents
 * - Keep singular/plural of the same head when clearly the same term
 * - Drop near-typos, truncated phrases, possessive junk, token reorders, and
 *   variants that omit required content words from the expression
 *
 * Run: node scripts/fixBatch2Variants.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 missing')

const TS = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')

function unique(values) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
}

function compact(value) {
  return normalize(value).replace(/[\s\-_/'.]/g, '')
}

function americanize(value) {
  return normalize(value)
    .replace(/\bbehaviour\b/g, 'behavior')
    .replace(/\bbehaviours\b/g, 'behaviors')
    .replace(/\bcolour\b/g, 'color')
    .replace(/\bcolours\b/g, 'colors')
    .replace(/\bcentre\b/g, 'center')
    .replace(/\bcentres\b/g, 'centers')
    .replace(/\blicence\b/g, 'license')
    .replace(/\bdefence\b/g, 'defense')
    .replace(/\blabour\b/g, 'labor')
    .replace(/\borganisation\b/g, 'organization')
    .replace(/\borganisations\b/g, 'organizations')
    .replace(/\bamortisation\b/g, 'amortization')
    .replace(/\bfloatation\b/g, 'flotation')
    .replace(/isation\b/g, 'ization')
    .replace(/ising\b/g, 'izing')
    .replace(/ised\b/g, 'ized')
    .replace(/ises\b/g, 'izes')
}

function tokens(value) {
  return normalize(value).split(' ').filter(Boolean)
}

function contentTokens(value) {
  const stop = new Set(['a', 'an', 'the', 'of', 'for', 'and', 'or', 'to', 'in', 'on', 'by'])
  return tokens(value).filter((t) => !stop.has(t))
}

function levenshtein(a, b) {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i += 1) {
    const cur = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = cur[j]
  }
  return prev[b.length]
}

/** Explicit known-bad fragments / whole variants from audit + scan. */
const KNOWN_BAD_EXACT = new Set([
  'sale afioat',
  'stock lone',
  'stock ticket',
  'stiffing order',
  "result's management",
  'un-audit balance sheet',
  'generally accounting',
  'securities and exchanges commission',
  'super annuation fund',
  'non-bear bond',
  'estimate revenue',
  'absorbed manufacturing',
  'approximate of the cost',
  'average quality production of',
  'assignment of thru-put contracts',
  'amortization of bond issued expense',
  'national association of accountant',
  'cost accounting standard board',
  'exchanges stabilization fund',
  'stock and bonds',
  'loan capital-debenture',
  'dow jones industrials averages',
  'bank for international settlement',
  'price-earning ratio',
])

function isAcronymVariant(expression, variant) {
  const v = String(variant).trim()
  const e = String(expression).trim()
  // Short acronym for long expression
  if (/^[A-Za-z0-9.&]{2,12}$/.test(v)) {
    const letters = v.replace(/[^A-Za-z]/g, '').toUpperCase()
    if (letters.length >= 2) {
      const initials = contentTokens(expression)
        .map((t) => t[0]?.toUpperCase())
        .join('')
      if (initials.startsWith(letters) || letters.startsWith(initials.slice(0, letters.length))) return true
      if (letters === 'SEC' && /securities and exchange commission/i.test(expression)) return true
      if (letters === 'BIS' && /bank for international settlements/i.test(expression)) return true
      if (letters === 'GATT' && /^gatt$/i.test(expression)) return true
      if (letters === 'DJIA' && /dow jones/i.test(expression)) return true
      if (letters === 'PPF' && /production-?possibility frontier/i.test(expression)) return true
      if (letters === 'CASB' && /cost accounting standards board/i.test(expression)) return true
      if (letters === 'ESF' && /exchange stabilization fund/i.test(expression)) return true
      if (letters === 'OPIC' && /overseas private investment/i.test(expression)) return true
      if (letters === 'FHLBB' && /federal home loan bank board/i.test(expression)) return true
      if (letters === 'SIBOR' && /singapore inter-?bank/i.test(expression)) return true
      if (letters === 'NAA' && /national association of accountants/i.test(expression)) return true
      if (letters === 'IMA' && /national association of accountants/i.test(expression)) return true
    }
  }
  // Long expansion for short acronym expression
  if (/^[A-Za-z0-9.&]{2,12}$/.test(e)) {
    const letters = e.replace(/[^A-Za-z]/g, '').toUpperCase()
    const initials = contentTokens(variant)
      .map((t) => t[0]?.toUpperCase())
      .join('')
    if (letters.length >= 2 && (initials === letters || initials.startsWith(letters))) return true
    if (letters === 'GATT' && /general agreement on tariffs and trade/i.test(variant)) return true
  }
  return false
}

function isLegitimateVariant(expression, variant) {
  const ne = normalize(expression)
  const nv = normalize(variant)
  if (!nv) return false
  if (nv === ne) return true
  if (KNOWN_BAD_EXACT.has(nv)) return false
  if (isAcronymVariant(expression, variant)) return true

  // Case / punctuation / hyphen / apostrophe only
  if (compact(ne) === compact(nv)) return true
  if (americanize(ne) === americanize(nv)) return true

  // Singular/plural of same multiword term (last token only)
  const te = tokens(ne)
  const tv = tokens(nv)
  if (te.length === tv.length && te.length > 0) {
    const headSame = te.slice(0, -1).join(' ') === tv.slice(0, -1).join(' ')
    const a = te[te.length - 1]
    const b = tv[tv.length - 1]
    if (headSame && (a + 's' === b || b + 's' === a || a.replace(/ies$/, 'y') === b || b.replace(/ies$/, 'y') === a)) {
      return true
    }
  }

  // vs / versus / v.
  if (/^(vs|versus|v\.)$/i.test(ne) && /^(vs|versus|v\.)$/i.test(nv)) return true

  // Explicit curated equivalents (not loose synonyms)
  const allow = [
    [/^banker's order$/i, /^(bankers order|standing order)$/i],
    [/^non-bearer bond$/i, /^registered bond$/i],
    [/^price-earnings ratio$/i, /^(price\/earnings ratio|p\/e ratio|pe ratio)$/i],
    [/^dow jones industrial average$/i, /^(the dow|djia)$/i],
    [/^original margin$/i, /^initial margin$/i],
    [/^initial margin$/i, /^original margin$/i],
    [/^superannuation fund$/i, /^super fund$/i],
    [/^singapore inter-bank offering rate$/i, /^(singapore interbank offered rate|sibor)$/i],
    [/^us securities and exchange commission$/i, /^(u\.s\. securities and exchange commission|sec)$/i],
    [/^securities and exchange commission$/i, /^sec$/i],
  ]
  for (const [exprRe, varRe] of allow) {
    if (exprRe.test(ne) && varRe.test(nv)) return true
  }

  return false
}

function reasonReject(expression, variant) {
  const ne = normalize(expression)
  const nv = normalize(variant)
  if (KNOWN_BAD_EXACT.has(nv)) return 'known-bad'
  if (!nv) return 'empty'
  if (nv === ne) return null

  // Truncated: variant is a strict prefix missing trailing content words
  const ce = contentTokens(ne)
  const cv = contentTokens(nv)
  if (ce.length >= 2 && cv.length < ce.length) {
    const missing = ce.filter((t) => !cv.includes(t) && !cv.includes(t.replace(/s$/, '')))
    if (missing.length >= 1 && nv.length + 3 < ne.length) return 'truncated-missing-words'
  }

  // Token reorder of same bag
  if (
    ce.length === cv.length &&
    ce.length > 1 &&
    [...ce].sort().join(' ') === [...cv].sort().join(' ') &&
    ce.join(' ') !== cv.join(' ')
  ) {
    return 'token-reorder'
  }

  // Possessive junk inserted
  if (/'s\b/.test(nv) && !/'s\b/.test(ne) && americanize(nv.replace(/'s\b/g, 's')) !== americanize(ne)) {
    return 'possessive-junk'
  }

  // Hyphenated junk like loan capital-debenture
  if (nv.includes('-') && !ne.includes('-') && !compact(ne).includes(compact(nv).replace(/-/g, ''))) {
    if (nv.includes(ne) && nv.length > ne.length + 2) return 'appended-junk'
  }

  // Near typo relative to expression (but not UK/US)
  if (americanize(ne) !== americanize(nv) && compact(ne) !== compact(nv)) {
    const dist = levenshtein(compact(ne), compact(nv))
    const len = Math.max(compact(ne).length, compact(nv).length)
    if (dist >= 1 && dist <= 2 && dist / len <= 0.2 && !isAcronymVariant(expression, variant)) {
      // allow singular/plural already handled
      return 'near-typo'
    }
  }

  // Extra spaces creating non-words: "super annuation"
  if (nv.replace(/\s+/g, '') === ne.replace(/[\s-]+/g, '') && nv.includes(' ') && !ne.includes(' ')) {
    // splitting a compound oddly
    if (!ne.includes(' ')) return 'odd-split'
  }

  return 'not-equivalent'
}

function sanitizeVariants(expression, variants) {
  const kept = []
  const removed = []
  for (const variant of unique([expression, ...(variants || [])])) {
    if (isLegitimateVariant(expression, variant)) {
      kept.push(variant)
      continue
    }
    const why = reasonReject(expression, variant) || 'not-equivalent'
    // If reject reason is soft and variant equals acronym etc — already handled
    removed.push({ variant, why })
  }
  // Always keep expression first
  const final = unique([expression, ...kept.filter((v) => normalize(v) !== normalize(expression))])
  return { final, removed }
}

/** Targeted content fixes beyond variants. */
const CONTENT_FIXES = {
  'econ-858f28bf2a85eb': {
    zhGloss: '“自愿”出口配额制',
    acceptedZhAnswers: ['“自愿”出口配额制', '自愿出口配额'],
  },
  // Restore curated equivalents stripped by the first sanitizer pass.
  'econ-769116ef204ccf': {
    acceptedEnVariants: ['GATT', 'General Agreement on Tariffs and Trade'],
  },
  'econ-337d77016a9dd8': {
    acceptedEnVariants: ['original margin', 'initial margin'],
  },
  'econ-826c4bb7dd8c8c': {
    acceptedEnVariants: ['initial margin', 'original margin'],
  },
  'econ-52e9371f00cdce': {
    acceptedEnVariants: ['superannuation fund', 'super fund'],
  },
  'econ-20ec77253a5975': {
    acceptedEnVariants: [
      'singapore inter-bank offering rate',
      'Singapore Interbank Offered Rate',
      'SIBOR',
    ],
  },
  'econ-7ca71019f55a3a': {
    zhGloss: '万亿（短尺度：10¹²）',
    acceptedZhAnswers: ['万亿', '兆（短尺度）', '一万亿'],
  },
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let wordsTouched = 0
let variantsRemoved = 0
const removedSamples = []
const updatedIds = []
const fieldCounts = {
  acceptedEnVariants: 0,
  zhGloss: 0,
  acceptedZhAnswers: 0,
  enDefinition: 0,
}

for (const word of pack.words) {
  let changed = false
  const before = JSON.stringify(word.acceptedEnVariants || [])
  const { final, removed } = sanitizeVariants(word.expression, word.acceptedEnVariants)
  if (JSON.stringify(final) !== before) {
    word.acceptedEnVariants = final
    changed = true
    fieldCounts.acceptedEnVariants += 1
    variantsRemoved += removed.length
    if (removed.length && removedSamples.length < 40) {
      removedSamples.push({ id: word.id, expression: word.expression, removed })
    }
  }

  const patch = CONTENT_FIXES[word.id]
  if (patch) {
    for (const [k, v] of Object.entries(patch)) {
      if (JSON.stringify(word[k]) !== JSON.stringify(v)) {
        word[k] = v
        changed = true
        if (k in fieldCounts) fieldCounts[k] += 1
      }
    }
  }

  if (changed) {
    word.updatedAt = TS
    wordsTouched += 1
    updatedIds.push(word.id)
  }
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const report = {
  wordsTouched,
  variantsRemoved,
  fieldCounts,
  updatedIds,
  removedSamples,
}
writeFileSync(join(root, 'scripts/_b2_report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  wordsTouched,
  variantsRemoved,
  fieldCounts,
  removedSampleCount: removedSamples.length,
  removedSamples: removedSamples.slice(0, 25),
}, null, 2))
