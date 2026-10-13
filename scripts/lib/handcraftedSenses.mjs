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

export function overlapsHandcraftedSense(word, handcrafted) {
  return handcrafted.some((sense) => {
    if (normalize(sense.expression) !== normalize(word.expression)
      || normalize(sense.partOfSpeech) !== normalize(word.partOfSpeech)) return false
    const definition = normalize(word.enDefinition)
    const existingDefinition = normalize(sense.enDefinition)
    if (definition && existingDefinition) return definition === existingDefinition
    return Boolean(normalize(word.zhGloss)) && normalize(sense.zhGloss) === normalize(word.zhGloss)
  })
}
