import type { SystemListSlug } from '../domain/types'

/** Lightweight category guess from dictionary text — not LLM. */
export function inferCategoryFromDictionary(
  expression: string,
  definition: string,
  partOfSpeech?: string,
): SystemListSlug | undefined {
  const meaning = definition.toLocaleLowerCase('en-US')
  const ambiguous = /^(interest|stock|equity|capital|bond|credit|share|return|balance|account)$/i.test(expression.trim())
  const text = `${ambiguous && meaning.trim() ? '' : expression} ${meaning} ${partOfSpeech ?? ''}`.toLocaleLowerCase('en-US')

  if (
    /\b(audit|ledger|tax(?:es|ation|able|payer[s]?)?\b|ifrs|depreciat|payable|receivable|amorti[sz]|journal entry|trial balance|accrual|impairment|goodwill|inventory|invoice|reconcil|settlement statement)/.test(text)
    || /会计|审计|账簿|账目|对账|结算单|结算对账单|折旧|应收|应付|税务|发票|核对账户/.test(text)
  ) {
    return 'accounting'
  }
  if (
    /\b(finance|financial|invest(?:s|ed|ing|ments?|ors?)?|stock|bond|equity|leverage|capital|dividend|portfolio|loan|interest rate|credit|debt|cash flow|valuation|market cap)\b/.test(text)
    || /金融|融资|投资|贷款|借款|利息|股票|股权|证券|债券|股息|现金流|回本|回收期/.test(text)
  ) {
    return 'finance'
  }
  if (
    /\b(business|customer|merchant|market|startup|sales|revenue|supplier|contract|negotiat\w*|competitor|brand|marketing|enterprise|commerce|profit margin|site acquisition|rental fee)\b/.test(text)
    || /商务|商业|商户|客户|营销|销售|供应商|采购|合同|谈判|收入分成|点位拓展|租借费用|设备运营/.test(text)
  ) {
    return 'business'
  }
  return undefined
}
