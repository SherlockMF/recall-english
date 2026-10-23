import { validateLearningTrack, validateReviewAttempt, validateSettings, validateStudyTimeEntry, validateVocabularyList, validateWord, validateWordListItem } from '../backup'
import { COLLECTION_STORES, type CloudChange, type CloudCollection } from './types'

const validators = { words: validateWord, lists: validateVocabularyList, memberships: validateWordListItem, tracks: validateLearningTrack, attempts: validateReviewAttempt, timeEntries: validateStudyTimeEntry, settings: validateSettings }
export function validateCloudChanges(value: unknown): CloudChange[] {
  if (!Array.isArray(value)) throw new Error('云端同步数据格式无效。')
  return value.map((entry: CloudChange) => {
    if (!entry || !(entry.collection in COLLECTION_STORES) || typeof entry.id !== 'string' || !Number.isSafeInteger(entry.revision) || entry.revision < 0) throw new Error('云端同步记录无效。')
    if (entry.data !== null) {
      const record = validators[entry.collection as CloudCollection](entry.data, `cloud.${entry.collection}.${entry.id}`)
      if (record.id !== entry.id) throw new Error('云端记录标识不一致。')
    }
    return entry
  })
}
