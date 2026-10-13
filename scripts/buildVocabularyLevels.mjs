import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const revision = 'd4e45b75b38f27b30dfc5c44d8c571aec7e7092f'
const files = ['cefrj-vocabulary-profile-1.5.csv', 'octanove-vocabulary-profile-c1c2-1.0.csv']
const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
function csv(text) {
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { field += '"'; i++ }
      else quoted = !quoted
    } else if (!quoted && (c === ',' || c === '\n')) {
      row.push(field.replace(/\r$/, '')); field = ''
      if (c === '\n') { rows.push(row); row = [] }
    } else field += c
  }
  if (field || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row) }
  return rows
}
const entries = Object.create(null)
const hashes = {}
await mkdir('data/word-levels', { recursive: true })
for (const file of files) {
  const response = await fetch(`https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/${revision}/${file}`)
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`)
  const body = await response.text()
  hashes[file] = createHash('sha256').update(body).digest('hex')
  await writeFile(`data/word-levels/${file}`, body)
  for (const [headword, pos, level] of csv(body).slice(1)) {
    if (!levels.includes(level)) continue
    for (const spelling of headword.split('/')) {
      const key = spelling.trim().toLowerCase().replace(/\s+/g, ' ')
      const previous = entries[key]?.[pos]
      if (!previous || levels.indexOf(level) < levels.indexOf(previous)) {
        entries[key] ??= Object.create(null)
        entries[key][pos] = level
      }
    }
  }
}
await writeFile('src/data/vocabularyLevels.json', `${JSON.stringify(Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))))}\n`)
await writeFile('data/word-levels/provenance.json', `${JSON.stringify({ revision, hashes }, null, 2)}\n`)
console.log(`Generated ${Object.keys(entries).length} offline headwords.`)
