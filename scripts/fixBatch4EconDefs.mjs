/**
 * Batch 4 — rebuild templated Econ (and residual) professional definitions.
 *
 * Run: node scripts/fixBatch4EconDefs.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeProfessionalDefinition,
  isTemplateDefinition,
  PHRASE_GLOSS,
  normalizeExpr,
} from './lib/professionalGloss.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 missing')

const TS = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
const LIST_SLUG = {
  'list-daily': 'daily',
  'list-business': 'business',
  'list-finance': 'finance',
  'list-accounting': 'accounting',
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const membershipByWord = new Map()
for (const item of pack.memberships || []) {
  if (!membershipByWord.has(item.wordId)) membershipByWord.set(item.wordId, item.listId)
}

let updated = 0
let phraseHits = 0
let templateHits = 0
const updatedIds = []
const stillWeak = []

for (const word of pack.words) {
  const def = String(word.enDefinition || '')
  const lower = normalizeExpr(word.expression)
  const mustFix = Boolean(PHRASE_GLOSS[lower]) || isTemplateDefinition(def)
  if (!mustFix) continue

  const listId = membershipByWord.get(word.id)
  const listSlug = LIST_SLUG[listId] || 'professional'
  const next = composeProfessionalDefinition({
    expression: word.expression,
    partOfSpeech: word.partOfSpeech,
    zhGloss: word.zhGloss,
    listSlug,
  })

  if (!next || next === def) {
    if (isTemplateDefinition(def)) {
      stillWeak.push({ id: word.id, expression: word.expression, def: def.slice(0, 100) })
    }
    continue
  }

  if (PHRASE_GLOSS[lower]) phraseHits += 1
  if (isTemplateDefinition(def)) templateHits += 1

  word.enDefinition = next
  word.updatedAt = TS
  updated += 1
  updatedIds.push(word.id)

  // If new def still matches a banned template, record it.
  if (isTemplateDefinition(next)) {
    stillWeak.push({ id: word.id, expression: word.expression, def: next.slice(0, 100) })
  }
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const report = {
  updated,
  phraseHits,
  templateHits,
  stillWeakCount: stillWeak.length,
  stillWeak: stillWeak.slice(0, 30),
  sampleIds: updatedIds.slice(0, 30),
}
writeFileSync(join(root, 'scripts/_b4_report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
