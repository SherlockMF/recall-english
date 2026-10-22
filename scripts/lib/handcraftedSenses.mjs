function normalize(value) {
  return String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ')
}

/** Read literal SeedRow fields without evaluating the TypeScript source. */
function field(row, name) {
  const match = row.match(new RegExp(`\\b${name}:\\s*(?:'((?:\\\\.|[^'\\\\])*)'|"((?:\\\\.|[^"\\\\])*)")`))
  if (!match) throw new Error(`Cannot read handcrafted sense field: ${name}`)
  return (match[1] ?? match[2]).replace(/\\(['"\\])/g, '$1')
}

export function loadHandcraftedSenses(source) {
  const rows = source.match(/\{\s*expression:\s*(['"])[\s\S]*?\}/g) ?? []
  return rows.map((row) => ({ expression: field(row, 'expression'), zhGloss: field(row, 'zh'),
    enDefinition: field(row, 'definition'), partOfSpeech: field(row, 'partOfSpeech') }))
}

function sameSnapshot(left, right) {
  return ['expression', 'partOfSpeech', 'zhGloss', 'enDefinition']
    .every((key) => normalize(left[key]) === normalize(right?.[key]))
}

export function overlapsHandcraftedSense(word, handcrafted, reviews = []) {
  const review = reviews.find((entry) => entry.wordId === word.id)
  if (review) {
    if (!['duplicate', 'retain'].includes(review.decision)
      || !sameSnapshot(word, review.source)
      || handcrafted.filter((sense) => sameSnapshot(sense, review.canonical)).length !== 1) {
      throw new Error(`Sense overlap review is stale or invalid: ${word.id}; review both senses before rebuilding`)
    }
    return review.decision === 'duplicate'
  }
  return handcrafted.some((sense) => {
    if (normalize(sense.expression) !== normalize(word.expression)
      || normalize(sense.partOfSpeech) !== normalize(word.partOfSpeech)) return false
    const definition = normalize(word.enDefinition)
    const existingDefinition = normalize(sense.enDefinition)
    if (definition && existingDefinition) return definition === existingDefinition
    return Boolean(normalize(word.zhGloss)) && normalize(sense.zhGloss) === normalize(word.zhGloss)
  })
}
