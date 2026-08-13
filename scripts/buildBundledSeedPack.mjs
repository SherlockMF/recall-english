/**
 * Build bundled seed JSON from the vocabulary pack.
 *
 * Source: data/vocabulary-packs/all_batches_combined_vocabulary_pack.json
 * Output: src/data/bundledSeedWords.json + bundledSeedMemberships.json
 *
 * Skips pack entries whose expression already exists in the handcrafted seed
 * (seedVocabulary.ts), so the curated 240 stay authoritative.
 *
 * Also normalizes ECDICT-style Chinese gloss noise (literal `\n`, `[经]` tags,
 * embedded POS markers) so study answers stay usable.
 *
 * Run: node scripts/buildBundledSeedPack.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SEED_TIMESTAMP = '2026-08-13T00:00:00.000Z'

function normalizeExpression(value) {
  return value
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

/** Clean ECDICT debris: literal `\n`, bracket tags, POS prefixes. */
function sanitizeZhFragment(value) {
  return String(value ?? '')
    .replace(/偶而/g, '偶尔')
    .replace(/迫随者/g, '追随者')
    .replace(/不辛/g, '不幸')
    .replace(/论误/g, '讹误')
    .replace(/给于/g, '给予')
    .replace(/挑畔/g, '挑衅')
    .replace(/鞭苔/g, '鞭笞')
    .replace(/机僚/g, '官僚')
    .replace(/计可证/g, '许可证')
    .replace(/宜传/g, '宣传')
    .replace(/船双/g, '船只')
    .replace(/常期信用/g, '长期信用')
    .replace(/欧州/g, '欧洲')
    .replace(/守侯/g, '守候')
    .replace(/合部所有/g, '全部所有')
    .replace(/权品/g, '样品')
    .replace(/记时/g, '计时')
    .replace(/续学生签证/g, '续签学生签证')
    .replace(/大部份/g, '大部分')
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

function splitZhSenses(value) {
  return sanitizeZhFragment(value)
    .split(/[；;,，]/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^(vt|vi|n|adj|adv)$/i.test(part))
}

function primaryZhGloss(raw) {
  const senses = splitZhSenses(raw)
  if (senses.length === 0) return sanitizeZhFragment(raw) || String(raw ?? '').trim()
  return senses.slice(0, 3).join('，')
}

function cleanedAcceptedZhAnswers(rawGloss, answers) {
  const fromAnswers = (Array.isArray(answers) ? answers : []).flatMap(splitZhSenses)
  const banned = /性交|强奸|嫖|淫|猥亵|肉欲|男风|白痴|耶稣受难|脱离肉体|精液|迷幻药|花柳病/
  return unique([primaryZhGloss(rawGloss), ...fromAnswers, ...splitZhSenses(rawGloss)])
    .filter((value) => !banned.test(value))
    .filter((value) => !/^(a|n|v|s|r|aux)\./i.test(value))
}

function stripEnPosPrefix(text) {
  let next = String(text ?? '').trim()
  if (/^see\s+/i.test(next) || /see aught/i.test(next)) return ''
  next = next.replace(/^&\s*/g, '')
  for (let i = 0; i < 4; i += 1) {
    const stripped = next
      .replace(/^[navsr]\.\s+/i, '')
      .replace(/^[navsr]\s+(?=[A-Za-z("'])/i, '')
    if (stripped === next) break
    next = stripped.trim()
  }
  return next
}

function cleanEnDefinition(value, expression) {
  let text = String(value ?? '').trim()
  const placeholder = text.match(/^(Business|Accounting|Finance|Daily) sense of [“"'](.+?)[”"']\.?$/i)
  if (placeholder && expression) {
    return `${placeholder[1]} sense of “${expression}”.`
  }
  const parts = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((part) => stripEnPosPrefix(part))
    .filter(Boolean)
  let first = parts[0] || stripEnPosPrefix(text)
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
  return expressions
}

function buildUsagePrompts(wordId, expression, exampleEn) {
  const sample = exampleEn?.trim() || `I need to use “${expression}” in a real sentence.`
  const cloze = sample.replace(new RegExp(escapeRegExp(expression), 'i'), '_____')
  return [
    {
      id: `${wordId}-cloze`,
      type: 'cloze',
      prompt: `Complete the sentence: ${cloze}`,
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

function ensureExamples(word) {
  const zhGloss = primaryZhGloss(word.zhGloss)
  const examples = Array.isArray(word.examples) ? word.examples.map((item) => ({
    en: String(item.en ?? ''),
    zh: String(item.zh ?? ''),
  })).filter((item) => item.en.trim() && item.zh.trim()) : []

  if (examples.length === 0) {
    examples.push({
      en: `Please notice ${word.expression} in context.`,
      zh: `请在语境中注意「${zhGloss}」。`,
    })
  }
  if (examples.length === 1) {
    examples.push({
      en: `${word.expression} matters in real study and work contexts.`,
      zh: `在真实学习与工作场景中要注意「${zhGloss}」。`,
    })
  }
  return examples.slice(0, 2)
}

function ensureCollocations(word) {
  const fromPack = Array.isArray(word.collocations) ? word.collocations : []
  const filled = unique([
    ...fromPack,
    word.expression,
    word.lemma && word.lemma !== word.expression ? word.lemma : '',
    word.partOfSpeech ? `${word.expression} (${word.partOfSpeech})` : '',
  ])
  if (filled.length >= 2) return filled.slice(0, 3)
  return unique([word.expression, `use ${word.expression}`]).slice(0, 2)
}

const packPath = join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')
const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const existing = loadHandcraftedExpressions()

const words = []
const skipped = []

for (const word of pack.words) {
  const key = normalizeExpression(word.expression)
  if (existing.has(key)) {
    skipped.push(word.expression)
    continue
  }

  const examples = ensureExamples(word)
  const zhGloss = primaryZhGloss(word.zhGloss)
  const next = {
    id: word.id,
    expression: word.expression,
    lemma: word.lemma || word.expression.toLocaleLowerCase('en-US'),
    senseKey: word.senseKey,
    zhGloss,
    enDefinition: cleanEnDefinition(word.enDefinition, word.expression),
    partOfSpeech: word.partOfSpeech,
    acceptedZhAnswers: cleanedAcceptedZhAnswers(word.zhGloss, word.acceptedZhAnswers),
    acceptedEnVariants: unique([word.expression, ...(word.acceptedEnVariants ?? [])]).filter((value) => {
      if (value === word.expression) return true
      return !/sales sales|improvementbudget|profit rata|financial time stock|return of (investment|equity)|irresistible|payable agent|cash and delivery|imports'|application-for |fully depreciated assets in active$|reserve for purchase of treasury$|cumulative capital stock/i.test(value)
    }),
    examples,
    collocations: ensureCollocations(word),
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

const wordsOut = join(root, 'src/data/bundledSeedWords.json')
const membershipsOut = join(root, 'src/data/bundledSeedMemberships.json')
writeFileSync(wordsOut, `${JSON.stringify(words, null, 2)}\n`)
writeFileSync(membershipsOut, `${JSON.stringify(memberships, null, 2)}\n`)

console.log(JSON.stringify({
  packWords: pack.words.length,
  added: words.length,
  skippedHandcraftedOverlap: skipped.length,
  memberships: memberships.length,
  wordsOut,
  membershipsOut,
}, null, 2))
