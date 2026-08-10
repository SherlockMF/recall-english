import type { SystemListSlug } from '../domain/types'

/** Lightweight category guess from dictionary text — not LLM. */
export function inferCategoryFromDictionary(
  expression: string,
  definition: string,
  partOfSpeech?: string,
): SystemListSlug | undefined {
  const text = `${expression} ${definition} ${partOfSpeech ?? ''}`.toLocaleLowerCase('en-US')

  if (
    /\b(account|audit|ledger|tax|ifrs|depreciat|payable|receivable|amorti[sz]|journal entry|trial balance|accrual|impairment|goodwill|inventory|invoice|reconcil)/.test(text)
  ) {
    return 'accounting'
  }
  if (
    /\b(finance|financial|invest|stock|bond|equity|leverage|capital|dividend|portfolio|loan|interest|credit|debt|cash flow|runway|valuation|market cap)\b/.test(text)
  ) {
    return 'finance'
  }
  if (
    /\b(business|customer|market|startup|sales|revenue|supplier|contract|negotiat|competitor|brand|marketing|enterprise|commerce|profit margin)\b/.test(text)
  ) {
    return 'business'
  }
  return undefined
}
