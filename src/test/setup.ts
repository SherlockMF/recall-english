import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

window.scrollTo = () => undefined

// The bundled seed pack ships as a public asset (fetched at runtime, not part
// of the JS bundle); serve it from disk when tests exercise the seed loader.
const seedFiles: Record<string, string> = {
  '/data/bundledSeedWords.json': '../../public/data/bundledSeedWords.json',
  '/data/bundledSeedMemberships.json': '../../public/data/bundledSeedMemberships.json',
  '/data/bundledDictionarySenses.json': '../../public/data/bundledDictionarySenses.json',
}

const originalFetch = globalThis.fetch.bind(globalThis)
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const relative = seedFiles[new URL(url, 'http://localhost/').pathname]
  if (relative) {
    const body = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')
    return new Response(body, { headers: { 'content-type': 'application/json' } })
  }
  return originalFetch(input, init)
}) as typeof fetch
