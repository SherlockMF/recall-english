/**
 * Build bundled seed JSON from the trusted V1 vocabulary pack (Vocabulary V5.0).
 *
 * Source: data/vocabulary-packs/trusted_v1_vocabulary_pack.json
 * Output: public/data/bundledSeedWords.json + bundledSeedMemberships.json
 *
 * Skips pack entries whose expression already exists in the handcrafted seed
 * (seedVocabulary.ts), so the curated 240 stay authoritative.
 *
 * Hard-fails on placeholder definitions, template examples, or fake collocations.
 *
 * Run: node scripts/buildBundledSeedPack.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_TIMESTAMP = '2026-08-14T00:00:00.000Z'

function normalizeExpression(value) {
  return value
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

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function sanitizeZhFragment(value) {
  return String(value ?? '')
    .replace(/\\n/g, '；')
    .replace(/\n/g, '；')
    .replace(/\[[^\]]{1,8}\]/g, '')
    .replace(/(^|[；;\s,，])(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|pl|interj|aux|s|r|a)\.\s*/gi, '$1')
    .replace(/[；;]+\s*/g, '；')
    .replace(/[,，]\s*[,，]+/g, '，')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[；;,\s，]+|[；;,\s，]+$/g, '')
    .trim()
}

function isSentenceLikeGloss(raw, word) {
  const text = String(raw ?? '').trim()
  const expression = String(word?.expression ?? '')
  const pos = String(word?.partOfSpeech ?? '').toLocaleLowerCase('en-US')
  if (/\bsentence\b/.test(pos)) return true
  if (/[?？！!]$/.test(expression) || /[?？！!]$/.test(text)) return true
  if (/^(can|could|would|will|do|did|is|are|may|sorry|please|how|what|why|when)\b/i.test(expression)) {
    return true
  }
  // Full Chinese sentence with comma clause — keep intact.
  if (/[，,].+[吗麼么呢吧？?]$/.test(text)) return true
  return false
}

function splitZhSenses(value, word) {
  const cleaned = sanitizeZhFragment(value)
  if (isSentenceLikeGloss(cleaned, word)) {
    return cleaned ? [cleaned] : []
  }
  // Do not split on commas/semicolons that sit inside brackets or quotes.
  const parts = []
  let buf = ''
  let depth = 0
  let quote = null
  for (const ch of cleaned) {
    if (quote) {
      buf += ch
      if (ch === quote || (quote === '“' && ch === '”') || (quote === '「' && ch === '」')) quote = null
      continue
    }
    if (ch === '"' || ch === '“' || ch === '「' || ch === "'") {
      quote = ch === '“' ? '“' : ch === '「' ? '「' : ch
      buf += ch
      continue
    }
    if (ch === '(' || ch === '（' || ch === '[') {
      depth += 1
      buf += ch
      continue
    }
    if (ch === ')' || ch === '）' || ch === ']') {
      depth = Math.max(0, depth - 1)
      buf += ch
      continue
    }
    if (depth === 0 && /[；;,，]/.test(ch)) {
      const part = buf.trim()
      if (part && !/^(vt|vi|n|adj|adv)$/i.test(part)) parts.push(part)
      buf = ''
      continue
    }
    buf += ch
  }
  const tail = buf.trim()
  if (tail && !/^(vt|vi|n|adj|adv)$/i.test(tail)) parts.push(tail)
  return parts
}

/** Sense-aligned answers only: primary gloss sense + near-synonym answers, not a full dictionary dump. */
function senseAlignedZhAnswers(rawGloss, answers, word) {
  const senses = splitZhSenses(rawGloss, word)
  const primary = senses[0] || sanitizeZhFragment(rawGloss) || String(rawGloss ?? '').trim()
  const fromAnswers = (Array.isArray(answers) ? answers : [])
    .flatMap((answer) => splitZhSenses(answer, word))
    .filter((value) => value === primary || value.includes(primary) || primary.includes(value))
  const banned = /性交|强奸|嫖|淫|猥亵|肉欲|男风|白痴|耶稣受难|脱离肉体|精液|迷幻药|花柳病/
  return unique([primary, ...fromAnswers])
    .filter((value) => !banned.test(value))
    .filter((value) => !/^(a|n|v|s|r|aux)\./i.test(value))
    .slice(0, 4)
}

function primaryZhGloss(raw, word) {
  const senses = splitZhSenses(raw, word)
  if (senses.length === 0) return sanitizeZhFragment(raw) || String(raw ?? '').trim()
  return senses[0]
}

function stripEnPosPrefix(text) {
  let next = String(text ?? '').trim()
  if (/^see\s+/i.test(next) || /see aught/i.test(next)) return ''
  next = next.replace(/^&\s*/g, '')
  for (let i = 0; i < 4; i += 1) {
    // Only strip explicit POS markers with a dot (n. / v. / a. …), never bare English articles.
    const stripped = next.replace(/^[navsr]\.\s+/i, '')
    if (stripped === next) break
    next = stripped.trim()
  }
  return next
}

function cleanEnDefinition(value) {
  let text = String(value ?? '').trim()
  if (/^(Business|Accounting|Finance|Daily)\s+sense\s+of\b/i.test(text)) {
    throw new Error(`Placeholder definition not allowed: ${text.slice(0, 80)}`)
  }
  const parts = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((part) => stripEnPosPrefix(part))
    .filter(Boolean)
  const first = parts.find(Boolean) || stripEnPosPrefix(text)
  if (!first) throw new Error('Empty English definition after cleanup')
  return first.length > 400 ? `${first.slice(0, 397)}...` : first
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function loadHandcraftedExpressions() {
  const source = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')
  const expressions = new Set()
  for (const match of source.matchAll(/expression:\s*'((?:\\'|[^'])*)'/g)) {
    expressions.add(normalizeExpression(match[1].replace(/\\'/g, "'")))
  }
  for (const match of source.matchAll(/expression:\s*"((?:\\"|[^"])*)"/g)) {
    expressions.add(normalizeExpression(match[1].replace(/\\"/g, '"')))
  }
  return expressions
}

function buildUsagePrompts(wordId, expression, exampleEn) {
  const sample = exampleEn || `I used ${expression} in a real situation.`
  return [
    {
      id: `${wordId}-cloze`,
      type: 'cloze',
      prompt: `Complete: ${sample.replace(new RegExp(escapeRegExp(expression), 'i'), '_____')}`,
      answer: expression,
      modelAnswer: sample,
      checkpoints: [expression],
    },
    {
      id: `${wordId}-sentence`,
      type: 'sentence',
      prompt: `用 “${expression}” 写一句你真实会说的话。`,
      modelAnswer: sample,
      checkpoints: [expression],
    },
  ]
}

function isFakeCollocation(col, expression, partOfSpeech) {
  const nc = normalizeLoose(col)
  const ne = normalizeLoose(expression)
  if (!nc || !ne) return true
  if (nc === ne) return true
  if (partOfSpeech && nc === normalizeLoose(`${expression} ${partOfSpeech}`)) return true
  if (nc === normalizeLoose(`use ${expression}`)) return true
  if (nc === normalizeLoose(`${expression} (${partOfSpeech})`)) return true
  return false
}

function requireExamples(word) {
  const examples = Array.isArray(word.examples)
    ? word.examples
        .map((item) => ({
          en: String(item.en ?? '').trim(),
          zh: String(item.zh ?? '').trim(),
        }))
        .filter((item) => item.en && item.zh)
    : []
  if (examples.length < 2) {
    throw new Error(`${word.id}: need ≥2 real examples (got ${examples.length})`)
  }
  for (const example of examples) {
    if (/Please notice .+ in context/i.test(example.en)) {
      throw new Error(`${word.id}: banned template example`)
    }
    if (/matters in real study and work contexts/i.test(example.en)) {
      throw new Error(`${word.id}: banned filler example`)
    }
  }
  return examples.slice(0, 2)
}

function requireCollocations(word) {
  const fromPack = Array.isArray(word.collocations) ? word.collocations : []
  const valid = unique(fromPack).filter(
    (value) => !isFakeCollocation(value, word.expression, word.partOfSpeech),
  )
  if (valid.length < 2) {
    throw new Error(
      `${word.id} (${word.expression}): need ≥2 real collocations (got ${valid.length})`,
    )
  }
  return valid.slice(0, 3)
}

const packPathCandidates = [
  join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json'),
  join(root, 'data/vocabulary-packs/trusted_v5_1_vocabulary_pack.json'),
  join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json'),
]
const packPath = packPathCandidates.find((path) => existsSync(path))
if (!packPath) throw new Error('No trusted vocabulary pack found')
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const existing = loadHandcraftedExpressions()

if (pack.kind !== 'vocabulary-pack') {
  throw new Error('trusted pack kind must be vocabulary-pack')
}

const words = []
const skipped = []
const errors = []

for (const word of pack.words) {
  const id = String(word.id)
  if (!/^(v1|core|econ)-/.test(id)) {
    errors.push(`${word.id}: production pack must use v1-*/core-*/econ-* ids`)
    continue
  }
  const key = normalizeExpression(word.expression)
  if (existing.has(key)) {
    skipped.push(word.expression)
    continue
  }

  try {
    const examples = requireExamples(word)
    const zhGloss = primaryZhGloss(word.zhGloss, word)
    const next = {
      id: word.id,
      expression: word.expression,
      lemma: word.lemma || word.expression.toLocaleLowerCase('en-US'),
      senseKey: word.senseKey,
      zhGloss,
      enDefinition: cleanEnDefinition(word.enDefinition),
      partOfSpeech: word.partOfSpeech,
      acceptedZhAnswers: senseAlignedZhAnswers(word.zhGloss, word.acceptedZhAnswers, word),
      acceptedEnVariants: unique([word.expression, ...(word.acceptedEnVariants ?? [])]),
      examples,
      collocations: requireCollocations(word),
      source: 'seed',
      priority: Number.isFinite(word.priority) ? word.priority : 1,
      status: 'active',
      usagePrompts: buildUsagePrompts(word.id, word.expression, examples[0]?.en),
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    }
    if (word.ipaUk) next.ipaUk = word.ipaUk
    if (word.ipaUs) next.ipaUs = word.ipaUs
    if (word.audioUk) next.audioUk = word.audioUk
    if (word.audioUs) next.audioUs = word.audioUs
    if (Array.isArray(word.synonyms) && word.synonyms.length) next.synonyms = word.synonyms
    if (Array.isArray(word.antonyms) && word.antonyms.length) next.antonyms = word.antonyms
    words.push(next)
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error))
  }
}

if (errors.length) {
  console.error(JSON.stringify({ failed: errors.length, sample: errors.slice(0, 20) }, null, 2))
  process.exit(1)
}

const keptIds = new Set(words.map((word) => word.id))
const memberships = pack.memberships
  .filter((item) => keptIds.has(item.wordId))
  .map((item) => {
    const membership = {
      id: item.id,
      wordId: item.wordId,
      listId: item.listId,
      priority: Number.isFinite(item.priority) ? item.priority : 1,
      sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : 0,
    }
    if (typeof item.subcategory === 'string' && item.subcategory.trim()) {
      membership.subcategory = item.subcategory.trim()
    }
    return membership
  })

const wordsOut = join(root, 'public/data/bundledSeedWords.json')
const membershipsOut = join(root, 'public/data/bundledSeedMemberships.json')
writeFileSync(wordsOut, `${JSON.stringify(words, null, 2)}\n`)
writeFileSync(membershipsOut, `${JSON.stringify(memberships, null, 2)}\n`)

console.log(JSON.stringify({
  packPath,
  packWords: pack.words.length,
  added: words.length,
  skippedHandcraftedOverlap: skipped.length,
  memberships: memberships.length,
  wordsOut,
  membershipsOut,
}, null, 2))
