/**
 * Bundle the current vocabulary library into a zip the user can keep / re-import.
 * Run: npm run vocabulary:export
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { loadSeedPackFromDisk } from './lib/loadSeedPack.mjs'
import { createArchive } from './lib/archive.mjs'

const root = join(import.meta.dirname, '..')
const { values } = parseArgs({ options: { 'output-dir': { type: 'string' } } })
const { words: seedWords, memberships: seedMemberships, lists: ALL_VOCABULARY_LISTS } = await loadSeedPackFromDisk(root)
const now = new Date()
const exportedAt = now.toISOString().replace(/\.\d{3}Z$/, '.000Z')
const stamp = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kuala_Lumpur',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(now)
const exportRoot = join(root, 'data', 'vocabulary-packs', '_export')
mkdirSync(exportRoot, { recursive: true })
const outDir = mkdtempSync(join(exportRoot, 'vocabulary-stage-'))
const downloads = values['output-dir'] ? resolve(values['output-dir']) : join(process.env.USERPROFILE ?? process.env.HOME ?? root, 'Downloads')
mkdirSync(downloads, { recursive: true })
const zipName = `recall-english-vocabulary-v53-${stamp}.zip`
const zipPath = join(downloads, zipName)
const packPath = join(root, 'data', 'vocabulary-packs', 'trusted_v5_2_vocabulary_pack.json')

const LIST_NAME = Object.fromEntries(ALL_VOCABULARY_LISTS.map((list) => [list.id, list.slug]))

function csvEscape(value) {
  const text = String(value ?? '')
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function writeCsv(path, words, memberships) {
  const listsByWord = new Map()
  for (const item of memberships) {
    const slug = LIST_NAME[item.listId] ?? item.listId
    const current = listsByWord.get(item.wordId) ?? []
    current.push(slug)
    listsByWord.set(item.wordId, current)
  }
  const header = ['id', 'expression', 'lemma', 'partOfSpeech', 'zhGloss', 'enDefinition', 'lists']
  const lines = [header.join(',')]
  for (const word of words) {
    lines.push([
      csvEscape(word.id),
      csvEscape(word.expression),
      csvEscape(word.lemma),
      csvEscape(word.partOfSpeech),
      csvEscape(word.zhGloss),
      csvEscape(word.enDefinition),
      csvEscape((listsByWord.get(word.id) ?? []).join('|')),
    ].join(','))
  }
  writeFileSync(path, `\uFEFF${lines.join('\n')}\n`)
}

mkdirSync(outDir, { recursive: true })

const sourcePack = JSON.parse(readFileSync(packPath, 'utf8'))
const importablePack = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt,
  words: sourcePack.words,
  lists: ALL_VOCABULARY_LISTS.filter((list) => list.isSystem),
  memberships: sourcePack.memberships,
}
const completeSeed = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt,
  words: seedWords,
  lists: ALL_VOCABULARY_LISTS.filter((list) => list.isSystem),
  memberships: seedMemberships,
}

const packJson = join(outDir, 'recall-english_combined_pack.json')
const seedJson = join(outDir, 'recall-english_complete_seed.json')
writeFileSync(packJson, `${JSON.stringify(importablePack)}\n`)
writeFileSync(seedJson, `${JSON.stringify(completeSeed)}\n`)
writeCsv(join(outDir, 'recall-english_complete_seed_index.csv'), seedWords, seedMemberships)

const listCounts = {}
for (const item of seedMemberships) {
  const slug = LIST_NAME[item.listId] ?? item.listId
  listCounts[slug] = (listCounts[slug] ?? 0) + 1
}

const readme = `# Recall English 词库包（V5.3）

导出时间：${exportedAt}

这是当前仓库里、经过四轮事实校对后的完整词库快照。可用应用「设置 → 导入词库包」导入 JSON。

## 文件

| 文件 | 说明 |
| --- | --- |
| \`recall-english_complete_seed.json\` | **推荐**。应用实际内置的完整种子：${seedWords.length} 条 |
| \`recall-english_combined_pack.json\` | 当前 trusted_v5_2 词包源文件：${sourcePack.words.length} 条 |
| \`recall-english_complete_seed_index.csv\` | 完整种子索引，可用 Excel 打开浏览 |

## 规模

- 完整种子词条：${seedWords.length}
- 词包源词条：${sourcePack.words.length}
- 完整种子 memberships：${seedMemberships.length}
- 词包 memberships：${sourcePack.memberships.length}
- 列表计数（memberships，一词可属多表）：${JSON.stringify(listCounts)}

## 导入注意

- 导入的是**词库内容**，不含学习进度（FSRS / 复习记录）。
- 已有本地词条不会被覆盖进度；空字段才可能被补全。
- 不要与旧版 V1/V2/V3 cumulative 重复导入，除非你就是想让合并逻辑去重。
`

writeFileSync(join(outDir, 'README.md'), readme)

const stage = join(outDir, 'zip-stage')
mkdirSync(stage, { recursive: true })
for (const name of [
  'README.md',
  'recall-english_combined_pack.json',
  'recall-english_complete_seed.json',
  'recall-english_complete_seed_index.csv',
]) {
  copyFileSync(join(outDir, name), join(stage, name))
}

createArchive(stage, zipPath)

console.log(JSON.stringify({
  zipPath,
  completeSeedWords: seedWords.length,
  combinedPackWords: sourcePack.words.length,
  listCounts,
}, null, 2))
