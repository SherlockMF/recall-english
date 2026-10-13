import { afterEach, expect, it } from 'vitest'
import pack from '../../data/shared-power-bank/shared-power-bank.vocabulary.json'
import pasteText from '../../data/shared-power-bank/vocabulary.tsv?raw'
import { clearDatabase, closeDatabase, getUserDataSnapshot, putWord } from './db'
import { importVocabularyPack, parseVocabularyPack } from './vocabularyPack'
import { parseVocabularyImport } from './vocabularyImport'

afterEach(closeDatabase)

it('provides a valid work-specific pack with matching paste content and preserves progress on repeat imports', async () => {
  const validated = parseVocabularyPack(pack)
  const paste = parseVocabularyImport(pasteText)
  expect(paste.errors).toEqual([])
  expect(validated.words).toHaveLength(42)
  expect(paste.rows.map((row) => row.expression).sort()).toEqual(validated.words.map((word) => word.expression).sort())
  expect(validated.words.every((word) => word.enDefinition && word.examples[0]?.en && word.examples[0]?.zh)).toBe(true)
  expect(new Set(paste.rows.map((row) => row.category))).toEqual(new Set(['business', 'daily', 'finance', 'accounting']))
  await clearDatabase()
  expect((await importVocabularyPack(pack)).added).toBe(42)
  const before = await getUserDataSnapshot()
  const word = before.words[0]
  await putWord({ ...word, knownAt: '2026-10-11T01:00:00Z', vocabularyLevel: 'C1' })
  expect((await importVocabularyPack(pack)).added).toBe(0)
  const after = await getUserDataSnapshot()
  expect(after.words.find((item) => item.id === word.id)).toMatchObject({ knownAt: '2026-10-11T01:00:00Z', vocabularyLevel: 'C1' })
  expect(after.tracks).toEqual(before.tracks)
})
