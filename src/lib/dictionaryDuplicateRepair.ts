import type { Word, WordListItem } from '../domain/types'

interface RepairSnapshot {
  words: Word[]
  tracks: { id: string; itemId: string; reps: number; lapses: number }[]
  memberships: WordListItem[]
  attempts: { itemId: string }[]
}

/** Narrow repair for duplicates produced by the initial cross-tab bundle import. */
export function planDictionaryDuplicateRepair(snapshot: RepairSnapshot, sourceIdentities: Set<string>, createdAfter: string,
  aliases?: ReadonlyMap<string, string>) {
  const histories = new Set(snapshot.attempts.map((attempt) => attempt.itemId))
  for (const track of snapshot.tracks) if (track.reps || track.lapses) histories.add(track.itemId)
  const memberships = new Map<string, WordListItem[]>()
  for (const membership of snapshot.memberships) {
    const bucket = memberships.get(membership.wordId) ?? []
    bucket.push(membership)
    memberships.set(membership.wordId, bucket)
  }
  function removable(word: Word) {
    return word.source === 'dictionary' && word.status === 'paused' && !word.knownAt && word.priority === 0
      && Date.parse(word.createdAt) >= Date.parse(createdAfter) && word.updatedAt === word.createdAt
      && !histories.has(word.id)
      && !(memberships.get(word.id) ?? []).some((membership) => membership.priority !== 0 || membership.listId === 'list-my-vocabulary')
  }
  const groups = new Map<string, Word[]>()
  for (const word of snapshot.words) {
    const originalIdentity = `${word.lemma}\u0000${word.senseKey}`
    const identity = aliases?.get(originalIdentity) ?? originalIdentity
    if (word.source !== 'dictionary' || !sourceIdentities.has(identity)) continue
    const bucket = groups.get(identity) ?? []
    bucket.push(word)
    groups.set(identity, bucket)
  }
  const removed = new Set<string>()
  for (const group of groups.values()) {
    if (group.length < 2) continue
    group.sort((left, right) => Number(removable(left)) - Number(removable(right))
      || left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id))
    const retained = new Set<string>()
    for (const word of group) {
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, status: _status, knownAt: _knownAt, ...content } = word
      const fingerprint = JSON.stringify({ ...content, senseKey: aliases?.get(`${word.lemma}\u0000${word.senseKey}`) ?? word.senseKey,
        ...(aliases ? {
          audioUk: word.audioUk === `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.expression)}&type=1` ? undefined : word.audioUk,
          audioUs: word.audioUs === `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.expression)}&type=2` ? undefined : word.audioUs,
        } : {}),
        usagePrompts: word.usagePrompts.map(({ id: _promptId, ...prompt }) => prompt),
        memberships: (memberships.get(word.id) ?? []).map(({ id: _membershipId, wordId: _wordId, ...membership }) => aliases
          ? { listId: membership.listId, priority: membership.priority, subcategory: membership.subcategory } : membership)
          .sort((left, right) => left.listId.localeCompare(right.listId)),
      })
      if (retained.has(fingerprint) && removable(word)) removed.add(word.id)
      else retained.add(fingerprint)
    }
  }
  return { wordIds: [...removed],
    trackIds: snapshot.tracks.filter((track) => removed.has(track.itemId)).map((track) => track.id),
    membershipIds: snapshot.memberships.filter((membership) => removed.has(membership.wordId)).map((membership) => membership.id) }
}
