import { describe, expect, it, vi } from 'vitest'
import { parseVocabularyImport, prepareVocabularyImportRow } from './vocabularyImport'

describe('vocabulary paste formats', () => {
  it('rejects an unknown or duplicate header before interpreting any data rows', () => {
    for (const source of ['expression,zhGloss,level\ninterest,兴趣,A2',
      'expression,level\ninterest,A2',
      '英文,等级\ninterest,A2',
      'expression,zhGloss,constructor\ninterest,兴趣,A2',
      '分类,中文,英文,拼错的列\ndaily,兴趣,interest,noun',
      'expression,zhGloss,zhGloss\ninterest,兴趣,利息']) {
      const parsed = parseVocabularyImport(source)
      expect(parsed.rows).toEqual([])
      expect(parsed.errors).toHaveLength(1)
      expect(parsed.errors[0].line).toBe(1)
      expect(parsed.errors[0].message).toMatch(/表头/)
    }
  })

  it('accepts English-only phrases and mixed bilingual delimiters without splitting phrase spaces', () => {
    const parsed = parseVocabularyImport('power bank\ncash flow\t现金流\nmerchant partnership | 商户合作\nrevenue sharing 收入分成\n"rental fee","租借费用",noun,business')
    expect(parsed.errors).toEqual([])
    expect(parsed.rows.map((row) => [row.expression, row.zhGloss])).toEqual([
      ['power bank', ''], ['cash flow', '现金流'], ['merchant partnership', '商户合作'],
      ['revenue sharing', '收入分成'], ['rental fee', '租借费用'],
    ])
    expect(parsed.rows[4]).toMatchObject({ partOfSpeech: 'noun', category: 'business' })
  })

  it('reads reordered bilingual headers, quoted commas, CRLF and BOM', () => {
    const parsed = parseVocabularyImport('\uFEFF分类,中文,英文,词性\r\n金融英语,"收费,按次",rental fee,noun\r\n商务英语,点位拓展,site acquisition,noun')
    expect(parsed.rows[0]).toMatchObject({ expression: 'rental fee', zhGloss: '收费,按次', category: 'finance' })
    expect(parsed.rows[1].category).toBe('business')
  })

  it('does not mistake literal English words for headers or a quoted pipe for a CSV delimiter', () => {
    expect(parseVocabularyImport('word\nexpression').rows.map((row) => row.expression)).toEqual(['word', 'expression'])
    expect(parseVocabularyImport('word | 单词\nexpression,表达').rows.map((row) => row.expression)).toEqual(['word', 'expression'])
    expect(parseVocabularyImport('"cash flow","现金流 | 现金流量"').rows[0].zhGloss).toBe('现金流 | 现金流量')
  })

  it('reports malformed rows and categories rather than silently discarding or misclassifying them', () => {
    const parsed = parseVocabularyImport('bank\t银行\tnoun\tunknown-category\n\t缺英文\n"unclosed,字段\n只写中文\nvalid word')
    expect(parsed.errors.map((error) => error.line)).toEqual([1, 2, 3, 4])
    expect(parsed.rows.map((row) => row.expression)).toEqual(['valid word'])
  })

  it('accepts optional definitions and bilingual examples for a work-specific vocabulary list', () => {
    const parsed = parseVocabularyImport('英文\t中文\t词性\t分类\t英文定义\t英文例句\t例句中文\nrevenue sharing\t收入分成\tnoun\tbusiness\tdividing rental revenue between partners\tWe agreed on revenue sharing.\t我们商定了收入分成。')
    expect(parsed.errors).toEqual([])
    expect(parsed.rows[0]).toMatchObject({ enDefinition: 'dividing rental revenue between partners', exampleEn: 'We agreed on revenue sharing.', exampleZh: '我们商定了收入分成。' })
  })
})

const dictionaryResult = {
  query: 'interest', word: 'interest', fetchedAt: '2026-10-11T00:00:00Z', meanings: [
    { partOfSpeech: 'noun', zhGloss: '兴趣', definition: 'a desire to learn about something', synonyms: [] },
    { partOfSpeech: 'noun', zhGloss: '利息', definition: 'money paid for a loan', synonyms: [] },
    { partOfSpeech: 'verb', definition: 'to attract attention', synonyms: [] },
  ],
}

describe('dictionary completion during import', () => {
  it('archives every returned sense and trains the first bilingual sense for English-only rows', async () => {
    const lookup = vi.fn().mockResolvedValue(dictionaryResult)
    const prepared = await prepareVocabularyImportRow({ expression: 'interest', zhGloss: '' }, lookup)
    expect(lookup).toHaveBeenCalledWith('interest')
    expect(prepared.result.meanings).toHaveLength(3)
    expect(prepared.selectedIndices).toEqual([0])
    expect(prepared.category).toBe('auto')
  })

  it('preserves a supplied sense and category while archiving other dictionary senses', async () => {
    const prepared = await prepareVocabularyImportRow({ expression: 'interest', zhGloss: '利息', category: 'finance' }, async () => dictionaryResult)
    expect(prepared.selectedIndices).toEqual([1])
    expect(prepared.category).toBe('finance')
    const custom = await prepareVocabularyImportRow({ expression: 'interest', zhGloss: '商业权益', partOfSpeech: 'noun' }, async () => dictionaryResult)
    expect(custom.result.meanings.at(-1)?.zhGloss).toBe('商业权益')
    expect(custom.selectedIndices).toEqual([3])
  })

  it('keeps bilingual input on lookup failure but does not invent translations for English-only failures', async () => {
    const lookup = vi.fn().mockRejectedValue(new Error('词典暂时离线'))
    const prepared = await prepareVocabularyImportRow({ expression: 'site acquisition', zhGloss: '点位拓展' }, lookup)
    expect(prepared.result.meanings[0].zhGloss).toBe('点位拓展')
    expect(prepared.warning).toContain('词典暂时离线')
    await expect(prepareVocabularyImportRow({ expression: 'site acquisition', zhGloss: '' }, lookup)).rejects.toThrow('词典暂时离线')
  })

  it('keeps the supplied definition and examples even when dictionary completion is unavailable', async () => {
    const prepared = await prepareVocabularyImportRow({ expression: 'revenue sharing', zhGloss: '收入分成',
      enDefinition: 'dividing rental revenue between partners', exampleEn: 'We agreed on revenue sharing.', exampleZh: '我们商定了收入分成。' },
      async () => { throw new Error('离线') })
    expect(prepared.result.meanings[0]).toMatchObject({ definition: 'dividing rental revenue between partners', example: 'We agreed on revenue sharing.', exampleZh: '我们商定了收入分成。' })
  })

  it('uses the requested POS for English-only input and preserves definitions distinguishing the same gloss', async () => {
    const source = { ...dictionaryResult, meanings: [...dictionaryResult.meanings,
      { partOfSpeech: 'verb', zhGloss: '引起兴趣', definition: 'to make someone interested', synonyms: [] }] }
    expect((await prepareVocabularyImportRow({ expression: 'interest', zhGloss: '', partOfSpeech: 'v.' }, async () => source)).selectedIndices).toEqual([3])
    const bank = { query: 'bank', word: 'bank', fetchedAt: source.fetchedAt, meanings: [
      { partOfSpeech: 'noun', zhGloss: '银行', definition: 'a financial institution', senseKey: 'bank-institution', synonyms: [] },
    ] }
    const prepared = await prepareVocabularyImportRow({ expression: 'bank', zhGloss: '银行', partOfSpeech: 'noun', enDefinition: 'a building housing a financial institution' }, async () => bank)
    expect(prepared.selectedIndices).toEqual([1])
    expect(prepared.result.meanings[0].definition).toBe('a financial institution')
    expect(prepared.result.meanings[1]).toMatchObject({ definition: 'a building housing a financial institution' })
    expect(prepared.result.meanings[1].senseKey).not.toBe('bank-institution')
  })
})
