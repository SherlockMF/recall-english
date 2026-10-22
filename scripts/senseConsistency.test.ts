import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { expect, it } from 'vitest'

it('accepts noun act/process definitions while still flagging actual POS mismatches', () => {
  const directory = mkdtempSync(join(tmpdir(), 'engstudy-sense-validator-'))
  const target = resolve(directory)
  if (dirname(target) !== resolve(tmpdir()) || !target.startsWith(`${resolve(tmpdir())}${sep}engstudy-sense-validator-`)) {
    throw new Error('Refusing to use unexpected test directory')
  }
  try {
    mkdirSync(join(directory, 'scripts'))
    mkdirSync(join(directory, 'public/data'), { recursive: true })
    mkdirSync(join(directory, 'data/vocabulary-packs'), { recursive: true })
    cpSync(resolve('scripts/validateSenseConsistency.mjs'), join(directory, 'scripts/validateSenseConsistency.mjs'))
    const words = [
      { id: 'noun-act', expression: 'delivery', partOfSpeech: 'noun', enDefinition: 'the act of taking goods to a buyer' },
      { id: 'noun-process', expression: 'valuation', partOfSpeech: 'noun', enDefinition: 'the process of estimating value' },
      { id: 'wrong-noun', expression: 'clap', partOfSpeech: 'noun', enDefinition: 'to strike the hands together' },
      { id: 'wrong-verb', expression: 'deliver', partOfSpeech: 'verb', enDefinition: 'the act of taking goods to a buyer' },
      { id: 'wrong-adjective', expression: 'busy', partOfSpeech: 'adjective', enDefinition: 'the process of working' },
    ].map(word => ({ ...word, zhGloss: word.partOfSpeech === 'adjective' ? '测试的' : '测试', examples: [], collocations: [] }))
    writeFileSync(join(directory, 'public/data/bundledSeedWords.json'), JSON.stringify(words))
    writeFileSync(join(directory, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json'), JSON.stringify({ words }))
    execFileSync(process.execPath, [join(directory, 'scripts/validateSenseConsistency.mjs'), '--strict'])
    const report = JSON.parse(readFileSync(join(directory, 'data/vocabulary-packs/_export/sense-consistency-report.json'), 'utf8'))
    expect(report.softFindings.map((row: { id: string; rule: string }) => [row.id, row.rule])).toEqual([
      ['wrong-noun', 'noun_def_looks_verbal'], ['wrong-verb', 'verb_def_looks_nominal'],
      ['wrong-adjective', 'adj_def_looks_verbal'],
    ])
  } finally {
    rmSync(target, { recursive: true, force: true })
  }
})
