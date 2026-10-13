import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'vite'

/** The browser loader uses fetch; exporters read the same public assets from disk. */
export async function loadSeedPackFromDisk(root) {
  const previousNodeEnv = process.env.NODE_ENV
  let server
  try {
    server = await createServer({ root, configFile: false, envFile: false, logLevel: 'error',
      server: { middlewareMode: true, watch: null }, appType: 'custom', optimizeDeps: { noDiscovery: true, include: [] } })
    const seed = await server.ssrLoadModule('/src/data/seedVocabulary.ts')
    const { ALL_VOCABULARY_LISTS } = await server.ssrLoadModule('/src/data/vocabularyLists.ts')
    const { SEED_CONTENT_REVISION } = await server.ssrLoadModule('/src/data/seedContentRevision.ts')
    const read = (name) => JSON.parse(readFileSync(join(root, 'public/data', name), 'utf8'))
    return { words: [...seed.handcraftedSeedWords, ...read('bundledSeedWords.json')],
      memberships: [...seed.handcraftedSeedMemberships, ...read('bundledSeedMemberships.json')],
      lists: ALL_VOCABULARY_LISTS, revision: SEED_CONTENT_REVISION }
  } finally {
    try { await server?.close() }
    finally {
      // Vite's SSR server defaults NODE_ENV to development; do not leak it to the build.
      if (previousNodeEnv === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previousNodeEnv
    }
  }
}
