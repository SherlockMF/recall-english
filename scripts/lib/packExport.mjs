/**
 * Design A: importable vocabulary packs must match vocabularyPack.ts strict schema.
 * Top-level `note` is rejected by the importer — keep human notes in sibling `*.meta.json`.
 */
export function toImportablePack(pack) {
  if (!pack || typeof pack !== 'object') return pack
  const { note: _note, ...rest } = pack
  return rest
}

export function packMetaPayload({ title, note, exportedAt, extra = {} }) {
  return {
    kind: 'vocabulary-pack-meta',
    version: 1,
    title,
    note,
    exportedAt,
    ...extra,
  }
}
