import type { BundledDictionarySenses } from '../lib/wordSenses'
import { DICTIONARY_CONTENT_REVISION } from './dictionaryContentRevision'

export async function loadBundledDictionarySenses(): Promise<BundledDictionarySenses> {
  const response = await fetch(`/data/bundledDictionarySenses.json?v=${DICTIONARY_CONTENT_REVISION}`)
  if (!response.ok) throw new Error(`加载多义词库失败（${response.status}）。`)
  const pack = await response.json() as BundledDictionarySenses
  if (pack.revision !== DICTIONARY_CONTENT_REVISION || !Array.isArray(pack.results)) {
    throw new Error('多义词库版本不匹配，请刷新页面重试。')
  }
  return pack
}
