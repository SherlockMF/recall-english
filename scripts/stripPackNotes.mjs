/**
 * One-shot: strip top-level `note` from existing on-disk importable packs (Design A).
 * Writes sibling `*.meta.json` when a note was present.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packMetaPayload, toImportablePack } from './lib/packExport.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const targets = [
  join(root, 'data/vocabulary-packs/v51_expansion_pack.json'),
  join(root, 'data/vocabulary-packs/v52_expansion_pack.json'),
  join(root, 'data/vocabulary-packs/_quarantine/core_econ_quarantine_pack.json'),
]

const report = []
for (const path of targets) {
  if (!existsSync(path)) {
    report.push({ path, status: 'missing' })
    continue
  }
  const pack = JSON.parse(readFileSync(path, 'utf8'))
  if (!('note' in pack)) {
    report.push({ path, status: 'already-clean' })
    continue
  }
  const note = pack.note
  writeFileSync(path, `${JSON.stringify(toImportablePack(pack))}\n`)
  writeFileSync(
    path.replace(/\.json$/, '.meta.json'),
    `${JSON.stringify(packMetaPayload({
      title: path.split(/[/\\]/).pop(),
      note,
      exportedAt: pack.exportedAt,
      extra: { words: pack.words?.length ?? 0 },
    }), null, 2)}\n`,
  )
  report.push({ path, status: 'stripped', note })
}
console.log(JSON.stringify(report, null, 2))
