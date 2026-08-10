import type { ListSlug, SystemListSlug } from '../domain/types'

/** Expressions that belong primarily to Accounting (from former finance seed). */
const ACCOUNTING_ONLY = new Set([
  'asset',
  'liability',
  'revenue',
  'expense',
  'profit',
  'loss',
  'accounts receivable',
  'accounts payable',
  'inventory',
  'depreciation',
  'amortisation',
  'accrual',
  'prepayment',
  'provision',
  'impairment',
  'carrying amount',
  'fair value',
  'historical cost',
  'materiality',
  'going concern',
  'double-entry bookkeeping',
  'debit',
  'credit',
  'journal entry',
  'general ledger',
  'trial balance',
  'financial statements',
  'statement of financial position',
  'income statement',
  'statement of cash flows',
  'retained earnings',
  'share capital',
  'cost of sales',
  'gross profit',
  'operating profit',
  'net profit',
  'current ratio',
  'interest expense',
  'budget',
  'forecast',
  'variance',
  'break-even point',
  'fixed cost',
  'variable cost',
  'contribution margin',
  'overhead',
  'audit',
  'auditor',
  'audit evidence',
  'internal control',
  'reconciliation',
  'tax liability',
  'deferred tax',
  'IFRS',
  'recognition',
  'measurement',
  'disclosure',
])

/** Shared between Finance and Accounting. */
const FINANCE_AND_ACCOUNTING = new Set([
  'equity',
  'cash flow',
  'dividend',
  'working capital',
  'liquidity',
  'solvency',
  'leverage',
])

/** Remaining former-finance expressions → Finance only. */
export function listSlugsForFormerFinance(expression: string): SystemListSlug[] {
  const key = expression.trim().toLocaleLowerCase('en-US')
  if (FINANCE_AND_ACCOUNTING.has(key)) return ['finance', 'accounting']
  if (ACCOUNTING_ONLY.has(key)) return ['accounting']
  return ['finance']
}

export function listSlugsForSeedCategory(
  category: 'daily' | 'finance' | 'business',
  expression: string,
): ListSlug[] {
  if (category === 'daily') return ['daily']
  if (category === 'business') return ['business']
  return listSlugsForFormerFinance(expression)
}
