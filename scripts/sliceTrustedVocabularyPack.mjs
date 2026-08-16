/**
 * Slice combined pack into trusted V1 production pack + core/econ quarantine.
 *
 * Out:
 *   data/vocabulary-packs/trusted_v1_vocabulary_pack.json
 *   data/vocabulary-packs/_quarantine/core_econ_quarantine_pack.json
 *
 * Run: node scripts/sliceTrustedVocabularyPack.mjs
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { toImportablePack, packMetaPayload } from './lib/packExport.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sourcePath = join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')
const trustedPath = join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json')
const quarantineDir = join(root, 'data/vocabulary-packs/_quarantine')
const quarantinePath = join(quarantineDir, 'core_econ_quarantine_pack.json')

const SYSTEM_LISTS = [
  {
    id: 'list-daily',
    name: 'Daily Life',
    slug: 'daily',
    description: '马来西亚日常生活与校园英语',
    category: 'daily',
    isSystem: true,
    createdAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'list-business',
    name: 'Business',
    slug: 'business',
    description: '商业沟通、采购销售与合作',
    category: 'business',
    isSystem: true,
    createdAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'list-finance',
    name: 'Finance',
    slug: 'finance',
    description: '金融、投资与公司财务',
    category: 'finance',
    isSystem: true,
    createdAt: '2026-08-10T00:00:00.000Z',
  },
  {
    id: 'list-accounting',
    name: 'Accounting',
    slug: 'accounting',
    description: '会计、审计、税务与报表',
    category: 'accounting',
    isSystem: true,
    createdAt: '2026-08-10T00:00:00.000Z',
  },
]

const pack = JSON.parse(readFileSync(sourcePath, 'utf8'))
const exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')

const v1Words = pack.words.filter((word) => String(word.id).startsWith('v1-'))
const quarantineWords = pack.words.filter((word) => {
  const id = String(word.id)
  return id.startsWith('core-') || id.startsWith('econ-')
})

const v1Ids = new Set(v1Words.map((word) => word.id))
const quarantineIds = new Set(quarantineWords.map((word) => word.id))

const trusted = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt,
  words: v1Words,
  lists: SYSTEM_LISTS,
  memberships: pack.memberships.filter((item) => v1Ids.has(item.wordId)),
}

const quarantine = {
  version: 1,
  kind: 'vocabulary-pack',
  exportedAt,
  note: 'Quarantined core/econ senses — not for production study until sense-aligned rebuild (V5.1+).',
  words: quarantineWords,
  lists: SYSTEM_LISTS,
  memberships: pack.memberships.filter((item) => quarantineIds.has(item.wordId)),
}

mkdirSync(quarantineDir, { recursive: true })
writeFileSync(trustedPath, `${JSON.stringify(toImportablePack(trusted))}\n`)
writeFileSync(quarantinePath, `${JSON.stringify(toImportablePack(quarantine))}\n`)
writeFileSync(
  quarantinePath.replace(/\.json$/, '.meta.json'),
  `${JSON.stringify(packMetaPayload({
    title: 'Quarantine core/econ pack',
    note: quarantine.note,
    exportedAt,
    extra: { words: quarantineWords.length },
  }), null, 2)}\n`,
)
writeFileSync(
  join(quarantineDir, 'README.md'),
  `# Quarantine — core / econ

These ${quarantineWords.length} senses were removed from the production learning library in Vocabulary V5.0.

Reason: senseKey ↔ definition ↔ zhGloss ↔ acceptedZhAnswers alignment is not trustworthy at scale.

Rebuild plan: V5.1 (~3000 by need) → V5.2 (5000–8000 after pipeline proves stable).

Do **not** import this pack into the default study library.
`,
)

console.log(JSON.stringify({
  sourceWords: pack.words.length,
  trustedV1Words: trusted.words.length,
  trustedMemberships: trusted.memberships.length,
  quarantineWords: quarantine.words.length,
  quarantineMemberships: quarantine.memberships.length,
  trustedPath,
  quarantinePath,
}, null, 2))
