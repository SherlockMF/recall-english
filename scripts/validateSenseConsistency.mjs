/**
 * Sense consistency validator for production vocabulary.
 * Emits a report; exits 1 only when --strict and hard findings exist.
 *
 * Run: node scripts/validateSenseConsistency.mjs
 *      node scripts/validateSenseConsistency.mjs --strict
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundled = JSON.parse(readFileSync(join(root, 'public/data/bundledSeedWords.json'), 'utf8'))
const pack = JSON.parse(readFileSync(join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json'), 'utf8'))
const strict = process.argv.includes('--strict')

function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}
function posClass(pos) {
  const p = String(pos || '').toLocaleLowerCase('en-US')
  if (/\badverb\b|\badv\b/.test(p)) return 'adverb'
  if (/\badjective\b|\badj\b/.test(p)) return 'adjective'
  if (/\bpronoun\b/.test(p)) return 'pronoun'
  if (/\bpreposition\b|\bprep\b/.test(p)) return 'preposition'
  if (/\bconjunction\b|\bconj\b/.test(p)) return 'conjunction'
  if (/\bnumeral\b|\bnumber\b/.test(p)) return 'numeral'
  if (/\bverb\b/.test(p) && !/noun/.test(p)) return 'verb'
  if (/\bnoun\b/.test(p)) return 'noun'
  if (/\bsentence\b|\bphrase\b/.test(p)) return 'phrase'
  return 'other'
}

function defLooksVerbal(def) {
  return /^(to |the act of |the process of )/i.test(String(def || '').trim())
}
function zhLooksAdjective(zh) {
  return /的$/.test(String(zh || '').trim())
}
const hard = []
const soft = []

function fail(item, rule, detail) {
  hard.push({ id: item.id, expression: item.expression, layer: String(item.id).split('-')[0], rule, detail })
}

function warn(item, rule, detail) {
  soft.push({ id: item.id, expression: item.expression, layer: String(item.id).split('-')[0], rule, detail })
}

// 1) Per-word checks
for (const item of bundled) {
  const pos = posClass(item.partOfSpeech)
  const def = String(item.enDefinition || '')
  const zh = String(item.zhGloss || '')
  const answers = item.acceptedZhAnswers || []
  const examples = item.examples || []
  const cols = item.collocations || []

  if (!def.trim()) fail(item, 'empty_definition', '')
  if (!zh.trim()) fail(item, 'empty_zhGloss', '')
  if (/[（(][^）)]*$/.test(zh)) fail(item, 'zh_unclosed_paren', zh)
  // Dictionary-style endings ("grant credentials to") are common; keep as soft signal only.
  if (/\b(and|or|the|a|an|with|by|to|of|for)$/i.test(def.trim()) && def.trim().length < 36) {
    warn(item, 'def_short_trailing_function_word', def)
  }
  if (/\([^)]*$/.test(def)) fail(item, 'def_unclosed_paren', def)
  if (/^credit related to /i.test(def) || /^a market associated with /i.test(def)) {
    fail(item, 'weak_composed_professional_def', def)
  }
  if (/Finance sense of|Accounting sense of|Business sense of|Daily sense of/i.test(def)) {
    fail(item, 'placeholder_definition', def)
  }

  // acceptedZhAnswers volume alarm (soft): too many often means multi-sense leakage
  if (answers.length >= 8) {
    warn(item, 'accepted_zh_answers_unusually_many', String(answers.length))
  }
  if (pos === 'adjective' && answers.some((a) => /地$/.test(String(a))) && !answers.some((a) => /的$/.test(String(a)))) {
    warn(item, 'adj_answers_look_adverbial', answers.join(' / '))
  }
  // POS vs definition rough clash
  if (pos === 'verb' && !defLooksVerbal(def) && /^(a |an |the )/i.test(def) && !/phrasal/.test(String(item.partOfSpeech))) {
    warn(item, 'verb_def_looks_nominal', def.slice(0, 120))
  }
  if (pos === 'noun' && defLooksVerbal(def) && !/gerund|ing\b/i.test(item.expression)) {
    warn(item, 'noun_def_looks_verbal', def.slice(0, 120))
  }
  if (pos === 'adjective' && defLooksVerbal(def)) {
    warn(item, 'adj_def_looks_verbal', def.slice(0, 120))
  }
  if (pos === 'adjective' && zh && !zhLooksAdjective(zh) && answers.every((a) => !zhLooksAdjective(a))) {
    warn(item, 'adj_zh_not_adjectival', zh)
  }

  // acceptedZhAnswers should stay near current sense (hard if wildly many unrelated)
  if (answers.length >= 6) warn(item, 'many_zh_answers', answers.join(' | '))
  if (answers.some((a) => /[（(][^）)]*$/.test(String(a)))) fail(item, 'answer_unclosed_paren', answers.join(' | '))

  // Cross-POS zh answers: adjective sense with adverb-only answers etc.
  if (pos === 'adjective' && answers.some((a) => /地$/.test(String(a).trim())) && answers.every((a) => /地$/.test(String(a).trim()))) {
    fail(item, 'adj_answers_all_adverbial', answers.join(' | '))
  }

  // Example must contain expression (soft for pronouns already fixed)
  for (const ex of examples) {
    if (!new RegExp(item.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(ex.en || '')) {
      warn(item, 'example_missing_expression', ex.en)
    }
  }

  // Collocation POS hostility leftover
  if ((pos === 'adverb' || pos === 'preposition' || pos === 'pronoun') && cols.some((c) => new RegExp(`^\\w+ the ${item.expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i').test(c))) {
    fail(item, 'col_article_hostile', cols.join(' | '))
  }
}

// 2) Duplicate expression with near-identical definitions (sense collision)
const byExpr = new Map()
for (const item of pack.words) {
  const key = normalize(item.expression)
  if (!byExpr.has(key)) byExpr.set(key, [])
  byExpr.get(key).push(item)
}

const collisions = []
for (const [expression, items] of byExpr) {
  if (items.length < 2) continue
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i]
      const b = items[j]
      const da = normalize(a.enDefinition)
      const db = normalize(b.enDefinition)
      const za = normalize(a.zhGloss)
      const zb = normalize(b.zhGloss)
      const sameDef = da === db || (da && db && (da.includes(db) || db.includes(da)) && Math.abs(da.length - db.length) < 24)
      const sameZh = za === zb
      if (sameDef || (sameZh && sameDef !== false && da.slice(0, 40) === db.slice(0, 40))) {
        collisions.push({
          expression,
          left: { id: a.id, senseKey: a.senseKey, zh: a.zhGloss, def: String(a.enDefinition || '').slice(0, 100) },
          right: { id: b.id, senseKey: b.senseKey, zh: b.zhGloss, def: String(b.enDefinition || '').slice(0, 100) },
          sameDef,
          sameZh,
        })
      }
    }
  }
}

for (const hit of collisions) {
  soft.push({
    id: hit.left.id,
    expression: hit.expression,
    layer: 'dup',
    rule: 'near_duplicate_sense',
    detail: `${hit.left.id} vs ${hit.right.id}`,
  })
}

const report = {
  bundledWords: bundled.length,
  hard: hard.length,
  soft: soft.length,
  hardByRule: Object.entries(hard.reduce((acc, row) => {
    acc[row.rule] = (acc[row.rule] || 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1]),
  softByRule: Object.entries(soft.reduce((acc, row) => {
    acc[row.rule] = (acc[row.rule] || 0) + 1
    return acc
  }, {})).sort((a, b) => b[1] - a[1]),
  hardSample: hard.slice(0, 40),
  collisionSample: collisions.slice(0, 20),
  collisions: collisions.length,
  collisionList: collisions,
  hardFindings: hard,
  softFindings: soft.slice(0, 200),
}

const outDir = join(root, 'data/vocabulary-packs/_export')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'sense-consistency-report.json'), `${JSON.stringify(report, null, 2)}\n`)

console.log(JSON.stringify({
  hard: report.hard,
  soft: report.soft,
  collisions: report.collisions,
  hardByRule: report.hardByRule,
  softByRule: report.softByRule.slice(0, 12),
  hardSample: report.hardSample.slice(0, 15),
  collisionSample: report.collisionSample,
}, null, 2))

if (strict && (hard.length || collisions.length)) process.exit(1)
