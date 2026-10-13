import type { DictionaryResult, SystemListSlug } from '../domain/types'
import { expressionKey } from './text'

export type ImportCategory = SystemListSlug | 'auto'
export interface VocabularyImportRow {
  expression: string
  zhGloss: string
  partOfSpeech?: string
  category?: SystemListSlug
  enDefinition?: string
  exampleEn?: string
  exampleZh?: string
  line?: number
  raw?: string
}
export interface VocabularyImportError { line: number; raw: string; message: string }
export interface VocabularyImportSummary {
  added: number
  skipped: number
  sensesAdded: number
  failed: Array<{ row: VocabularyImportRow; message: string }>
  warnings: string[]
}

const categories: Record<string, SystemListSlug> = {
  daily: 'daily', 日常: 'daily', 日常生活: 'daily', business: 'business', 商务: 'business', 商务英语: 'business', 商业英语: 'business',
  finance: 'finance', 金融: 'finance', 金融英语: 'finance', accounting: 'accounting', 会计: 'accounting', 会计英语: 'accounting',
}
const headers: Record<string, keyof VocabularyImportRow> = {
  expression: 'expression', word: 'expression', 英文: 'expression', 英文表达: 'expression',
  zhgloss: 'zhGloss', meaning: 'zhGloss', 中文: 'zhGloss', 中文义项: 'zhGloss',
  partofspeech: 'partOfSpeech', pos: 'partOfSpeech', 词性: 'partOfSpeech', category: 'category', 分类: 'category',
  endefinition: 'enDefinition', definition: 'enDefinition', 英文定义: 'enDefinition',
  exampleen: 'exampleEn', example: 'exampleEn', 英文例句: 'exampleEn', examplezh: 'exampleZh', 例句中文: 'exampleZh',
}

function findSeparator(line: string) {
  let quoted = false
  const separators = new Set<string>()
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] === '"') {
      if (quoted && line[index + 1] === '"') index += 1
      else quoted = !quoted
    } else if (!quoted && ['\t', '|', ','].includes(line[index])) separators.add(line[index])
  }
  if (quoted) throw new Error('双引号未闭合；一个词汇记录请放在同一行。')
  return ['\t', '|', ','].find((separator) => separators.has(separator))
}

function splitFields(line: string, separator: string) {
  const fields: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { field += '"'; index += 1 }
      else if (quoted || !field.trim()) quoted = !quoted
      else field += character
    } else if (character === separator && !quoted) { fields.push(field.trim()); field = '' }
    else field += character
  }
  if (quoted) throw new Error('双引号未闭合；一个词汇记录请放在同一行。')
  fields.push(field.trim())
  return fields
}

export function parseVocabularyImport(value: string) {
  const rows: VocabularyImportRow[] = []
  const errors: VocabularyImportError[] = []
  let columns: Array<keyof VocabularyImportRow | undefined> | undefined
  let headerSeparator: string | undefined
  for (const [index, raw] of value.replace(/^\uFEFF/, '').split(/\r?\n/).entries()) {
    if (!raw.trim()) continue
    try {
      const separator = headerSeparator ?? findSeparator(raw)
      const fields = separator ? splitFields(raw, separator) : (() => {
        const bilingual = raw.trim().match(/^(.+?[A-Za-z][^\p{Script=Han}]*?)\s+([\p{Script=Han}].*)$/u)
        return bilingual ? [bilingual[1].trim(), bilingual[2].trim()] : [raw.trim()]
      })()
      const detected = fields.map((field) => {
        const key = field.toLocaleLowerCase('en-US')
        return Object.hasOwn(headers, key) ? headers[key] : undefined
      })
      const hasHeaderNames = detected.filter(Boolean).length > 1
        || fields.every((field) => /^[A-Za-z_][A-Za-z0-9_-]*$/.test(field))
        || fields.some((field, fieldIndex) => detected[fieldIndex] === 'expression' && /[\p{Script=Han}]/u.test(field))
      if (!rows.length && !columns && fields.length > 1 && detected.includes('expression') && hasHeaderNames) {
        const unknown = fields.filter((_, fieldIndex) => !detected[fieldIndex])
        const message = unknown.length ? `无法识别表头列“${unknown.join('、')}”，请对照添加说明调整或移除。`
          : new Set(detected).size !== detected.length ? '表头列名重复，请对照添加说明。' : undefined
        if (message) return { rows: [], errors: [...errors, { line: index + 1, raw, message }] }
        columns = detected
        headerSeparator = separator
        continue
      }
      if (fields.length > (columns?.length ?? 7)) throw new Error('列数过多；含逗号的 CSV 字段请用双引号包围。')
      const row: VocabularyImportRow = { expression: '', zhGloss: '', line: index + 1, raw }
      const order = columns ?? ['expression', 'zhGloss', 'partOfSpeech', 'category', 'enDefinition', 'exampleEn', 'exampleZh']
      fields.forEach((field, fieldIndex) => {
        const column = order[fieldIndex]
        if (column === 'category') {
          if (field && field !== 'auto' && field !== '自动识别') {
            const key = field.toLocaleLowerCase('en-US')
            const category = Object.hasOwn(categories, key) ? categories[key] : undefined
            if (!category) throw new Error(`无法识别分类“${field}”，请使用日常、商务、金融或会计。`)
            row.category = category
          }
        } else if (column === 'expression' || column === 'zhGloss' || column === 'partOfSpeech'
          || column === 'enDefinition' || column === 'exampleEn' || column === 'exampleZh') row[column] = field
      })
      if (!row.expression || !/[A-Za-z]/.test(row.expression) || /[\p{Script=Han}]/u.test(row.expression)) throw new Error('缺少有效英文表达；中英文请用 Tab、逗号、竖线或空格分隔。')
      rows.push(row)
    } catch (error) {
      errors.push({ line: index + 1, raw, message: error instanceof Error ? error.message : '格式无法识别。' })
    }
  }
  return { rows, errors }
}

export async function prepareVocabularyImportRow(
  row: VocabularyImportRow,
  lookup: (expression: string) => Promise<DictionaryResult>,
  category: ImportCategory = 'auto',
) {
  let result: DictionaryResult
  let warning: string | undefined
  try {
    result = await lookup(row.expression)
    if (!result.word.trim() || !result.meanings.some((meaning) => meaning.zhGloss?.trim() || meaning.definition.trim())) throw new Error('词典未返回可保存的词义。')
  } catch (error) {
    if (!row.zhGloss) throw error
    warning = `${row.expression}：${error instanceof Error ? error.message : '补全失败'}；已保留提供的中文义项。`
    result = { query: row.expression, word: row.expression, fetchedAt: new Date().toISOString(), meanings: [] }
  }
  const partKey = (value: string) => {
    const key = expressionKey(value).replace(/\.$/, '')
    return ({ n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition' } as Record<string, string>)[key] ?? key
  }
  let selected = result.meanings.findIndex((meaning) => Boolean(meaning.zhGloss?.trim())
    && (!row.zhGloss || expressionKey(meaning.zhGloss ?? '') === expressionKey(row.zhGloss))
    && (!row.partOfSpeech || partKey(meaning.partOfSpeech) === partKey(row.partOfSpeech))
    && (!row.enDefinition || expressionKey(meaning.definition) === expressionKey(row.enDefinition)))
  if (row.zhGloss && selected < 0) {
    result = { ...result, meanings: [...result.meanings, { partOfSpeech: row.partOfSpeech || 'expression',
      definition: row.enDefinition ?? '', zhGloss: row.zhGloss, synonyms: [] }] }
    selected = result.meanings.length - 1
  }
  if (selected >= 0) result = { ...result, meanings: result.meanings.map((meaning, index) => index !== selected ? meaning : {
    ...meaning, definition: row.enDefinition || meaning.definition, example: row.exampleEn || meaning.example, exampleZh: row.exampleZh || meaning.exampleZh,
  }) }
  if (selected < 0 && !warning) warning = `${row.expression}：未找到${row.partOfSpeech ? ` ${row.partOfSpeech} 的` : ''}双语义项，已保存为暂停；补充中文或选择其他义项后可训练。`
  return { result, selectedIndices: selected < 0 ? [] : [selected], category: row.category ?? category, warning }
}

export const VOCABULARY_ADD_GUIDE = `词库添加说明
每行一个词或短语；保留英文短语内部的空格。

1. 纯英文（自动补全多个义项）
power bank
merchant partnership

2. 英文 + 中文（Tab、逗号或竖线分隔，也可用空格接中文）
cash flow\t现金流
site acquisition | 点位拓展
revenue sharing 收入分成
"rental fee","租借费用"

3. 可选列顺序：英文、中文、词性、分类、英文定义、英文例句、例句中文
revenue sharing,收入分成,noun,business
settlement statement,结算对账单,noun,accounting
表头可写 expression,zhGloss,partOfSpeech,category,enDefinition,exampleEn,exampleZh，也可写 英文,中文,词性,分类,英文定义,英文例句,例句中文；有表头时可调整列顺序，后面的可选列可省略。
分类支持 daily/日常生活、business/商务英语、finance/金融英语、accounting/会计英语；省略分类则逐义项自动识别，导入后可编辑修正。
CSV 字段含逗号时用双引号包围，字段内的双引号写成两个双引号；每条记录不要跨行。

自动保存词典返回的全部义项。纯英文默认训练首个有中文的义项；提供中文时训练对应义项，其余新增义项暂停，可在词库详情开启。来源不保证穷尽全部用法。
重复添加保留已有分类、训练状态、已会和进度；不会把已有暂停义项自动恢复。
补全仅在点击添加时查询现有词典，优先使用本地缓存。纯英文补全失败会保留待重试内容；已有中文可直接保存并提示补全失败。
这里是粘贴文本格式；完整词库 JSON 文件请到设置中的词库导入入口。`
