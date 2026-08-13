/**
 * Score quarantine candidates for Vocabulary V5.1 selection preview.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const q = JSON.parse(readFileSync(join(root, 'data/vocabulary-packs/_quarantine/core_econ_quarantine_pack.json'), 'utf8'))
const trusted = JSON.parse(readFileSync(join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json'), 'utf8'))
const seedSrc = readFileSync(join(root, 'src/data/seedVocabulary.ts'), 'utf8')

const existing = new Set()
for (const match of seedSrc.matchAll(/expression:\s*'((?:\\'|[^'])*)'/g)) {
  existing.add(match[1].replace(/\\'/g, "'").toLocaleLowerCase('en-US'))
}
for (const word of trusted.words) existing.add(word.expression.toLocaleLowerCase('en-US'))

const memByWord = new Map()
for (const item of q.memberships) {
  const list = memByWord.get(item.wordId) || []
  list.push(item)
  memByWord.set(item.wordId, list)
}

function primaryList(id) {
  const mem = memByWord.get(id) || []
  const order = ['list-business', 'list-daily', 'list-accounting', 'list-finance']
  for (const listId of order) {
    if (mem.some((item) => item.listId === listId)) return listId
  }
  return mem[0]?.listId || 'none'
}

function isPlaceholder(word) {
  return /^(Business|Accounting|Finance|Daily)\s+sense\s+of\b/i.test(word.enDefinition || '')
}

function isBadZh(word) {
  return /性交|强奸|嫖|淫|白痴|男风|精液|迷幻药|花柳病/.test(word.zhGloss || '')
}

function score(word) {
  let value = 0
  const list = primaryList(word.id)
  if (list === 'list-business') value += 400
  else if (list === 'list-daily') value += 300
  else if (list === 'list-accounting') value += 200
  else if (list === 'list-finance') value += 100
  if (!isPlaceholder(word)) value += 500
  if ((word.enDefinition || '').length >= 50) value += 50
  if ((word.zhGloss || '').length >= 2) value += 20
  if (word.id.startsWith('econ-')) value += 10
  return value
}

const candidates = q.words
  .filter((word) => {
    if (existing.has(word.expression.toLocaleLowerCase('en-US'))) return false
    if (isBadZh(word)) return false
    if (/^[navsr]\.\s/i.test(word.zhGloss || '')) return false
    return true
  })
  .map((word) => ({
    word,
    score: score(word),
    list: primaryList(word.id),
    placeholder: isPlaceholder(word),
  }))
  .sort((left, right) => right.score - left.score)

const top = candidates.slice(0, 2100)
const byList = {}
let placeholder = 0
for (const item of top) {
  byList[item.list] = (byList[item.list] || 0) + 1
  if (item.placeholder) placeholder += 1
}

console.log(JSON.stringify({
  candidates: candidates.length,
  selected: top.length,
  byList,
  stillPlaceholderInTop: placeholder,
  minScore: top.at(-1)?.score,
  maxScore: top[0]?.score,
  top10: top.slice(0, 10).map((item) => ({
    score: item.score,
    list: item.list,
    placeholder: item.placeholder,
    expression: item.word.expression,
    def: String(item.word.enDefinition || '').slice(0, 70),
  })),
}, null, 2))
