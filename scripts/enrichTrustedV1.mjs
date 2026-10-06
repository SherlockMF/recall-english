/**
 * Apply V5.0 definition fixes + rebuild collocations/examples for trusted V1 pack.
 *
 * In/out: data/vocabulary-packs/trusted_v1_vocabulary_pack.json
 * Run: node scripts/enrichTrustedV1.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v1_vocabulary_pack.json')

const DEFINITION_FIXES = {
  'v1-bad-debt-e13f829d': {
    enDefinition:
      'a receivable that has been judged irrecoverable and is written off (distinct from a doubtful debt that is still possibly collectible)',
    acceptedZhAnswers: ['坏账', '呆账核销', '不可收回账款'],
    collocations: ['write off a bad debt', 'bad debt expense', 'recover a bad debt'],
    examples: [
      {
        en: 'The company wrote off the bad debt after all collection attempts failed.',
        zh: '在所有催收尝试失败后，公司核销了这笔坏账。',
      },
      {
        en: 'Bad debt expense rose when several long-overdue receivables were written off.',
        zh: '若干长期逾期应收款被核销后，坏账费用上升。',
      },
    ],
  },
  'v1-effective-interest-rate-43237205': {
    enDefinition:
      'the rate that exactly discounts estimated future cash payments or receipts through the expected life of a financial instrument to its amortised cost (IFRS 9 effective interest method)',
    acceptedZhAnswers: ['实际利率', '实际利率法下的利率'],
    collocations: ['calculate the effective interest rate', 'effective interest method', 'apply the effective interest rate'],
    examples: [
      {
        en: 'Under IFRS 9, interest is recognised using the effective interest rate on the amortised cost.',
        zh: '按 IFRS 9，利息按摊余成本上的实际利率确认。',
      },
      {
        en: 'The effective interest rate differs from the contractual coupon when the instrument is issued at a discount.',
        zh: '工具折价发行时，实际利率会不同于合同票面利率。',
      },
    ],
  },
  'v1-inventory-write-down-14e39798': {
    enDefinition:
      'a reduction of inventory carrying amount to net realisable value when NRV is below cost (IAS 2)',
    acceptedZhAnswers: ['存货跌价', '存货跌价至可变现净值'],
    collocations: ['inventory write-down to NRV', 'recognise an inventory write-down', 'reverse an inventory write-down'],
    examples: [
      {
        en: 'IAS 2 requires an inventory write-down when net realisable value falls below cost.',
        zh: '当可变现净值低于成本时，IAS 2 要求计提存货跌价。',
      },
      {
        en: 'The inventory write-down reduced both carrying amount and profit for the period.',
        zh: '存货跌价同时降低了账面金额与本期利润。',
      },
    ],
  },
  'v1-recoverable-amount-b8505a6c': {
    enDefinition:
      'the higher of an asset’s fair value less costs of disposal and its value in use',
    acceptedZhAnswers: ['可收回金额'],
    collocations: ['compare carrying amount with recoverable amount', 'estimate recoverable amount', 'recoverable amount of a CGU'],
    examples: [
      {
        en: 'An impairment loss is recognised when carrying amount exceeds recoverable amount.',
        zh: '当账面金额超过可收回金额时确认减值损失。',
      },
      {
        en: 'Recoverable amount is the higher of fair value less costs of disposal and value in use.',
        zh: '可收回金额是公允价值减处置费用与使用价值二者较高者。',
      },
    ],
  },
  'v1-account-balance-eb80d7a1': {
    enDefinition:
      'the net amount remaining in an account after debits and credits — for example a ledger account or a bank account',
    acceptedZhAnswers: ['账户余额', '账上余额'],
    collocations: ['check the account balance', 'ledger account balance', 'bank account balance'],
    examples: [
      {
        en: 'The ledger account balance must agree with the trial balance total for that account.',
        zh: '该分类账账户余额必须与试算平衡表中该账户合计一致。',
      },
      {
        en: 'I checked my bank account balance before transferring the semester fees.',
        zh: '转学期学费前，我核对了银行账户余额。',
      },
    ],
  },
  'v1-current-asset-d1dabbde': {
    enDefinition:
      'an asset that is cash or a cash equivalent, held for trading, expected to be realised within twelve months after the reporting period, or expected to be realised, sold, or consumed in the normal operating cycle',
    acceptedZhAnswers: ['流动资产'],
    collocations: ['classify as a current asset', 'current asset ratio', 'current assets on the statement of financial position'],
    examples: [
      {
        en: 'Inventory is usually presented as a current asset because it is consumed in the operating cycle.',
        zh: '存货通常列报为流动资产，因为其在经营周期内被耗用。',
      },
      {
        en: 'Cash and trade receivables are typical current assets.',
        zh: '现金与应收账款是典型的流动资产。',
      },
    ],
  },
  'v1-current-liability-bc9a1e11': {
    enDefinition:
      'a liability that is expected to be settled in the normal operating cycle, held primarily for trading, due within twelve months after the reporting period, or for which the entity does not have the right at the reporting date to defer settlement for at least twelve months',
    acceptedZhAnswers: ['流动负债'],
    collocations: ['classify as a current liability', 'current liabilities total', 'settle a current liability'],
    examples: [
      {
        en: 'Trade payables are normally classified as a current liability.',
        zh: '应付账款通常归类为流动负债。',
      },
      {
        en: 'A bank loan due within twelve months is presented as a current liability.',
        zh: '十二个月内到期的银行借款列报为流动负债。',
      },
    ],
  },
  'v1-inventory-provision-4a6e69f8': {
    enDefinition:
      'a practical or legacy label for an allowance linked to writing inventory down toward net realisable value; prefer the IAS 2 term inventory write-down in formal study',
    zhGloss: '存货跌价准备（实务用语）',
    acceptedZhAnswers: ['存货跌价准备', '存货准备（实务用语）'],
    collocations: ['inventory provision (legacy term)', 'prefer inventory write-down', 'release an inventory provision'],
    examples: [
      {
        en: 'In formal IFRS study, prefer “inventory write-down” over the legacy phrase inventory provision.',
        zh: '正式 IFRS 学习中，优先使用 inventory write-down，而不是旧称 inventory provision。',
      },
      {
        en: 'Some ledgers still show an inventory provision that represents write-downs to NRV.',
        zh: '有些账簿仍显示存货跌价准备，实质对应跌价至可变现净值。',
      },
    ],
  },
  'v1-non-current-asset-8ada4b0e': {
    enDefinition:
      'an asset that does not meet the criteria for classification as a current asset (for example property, plant and equipment held for long-term use)',
    acceptedZhAnswers: ['非流动资产', '长期资产'],
    collocations: ['non-current asset register', 'classify as a non-current asset', 'depreciate a non-current asset'],
    examples: [
      {
        en: 'Property, plant and equipment is typically a non-current asset.',
        zh: '不动产、厂场和设备通常是非流动资产。',
      },
      {
        en: 'An asset is non-current when it fails the current-asset classification tests.',
        zh: '不满足流动资产分类条件的资产即为非流动资产。',
      },
    ],
  },
  'v1-non-current-liability-bacb84ca': {
    enDefinition:
      'a liability that does not meet the criteria for classification as a current liability',
    acceptedZhAnswers: ['非流动负债', '长期负债'],
    collocations: ['non-current liability note', 'reclassify a non-current liability', 'long-term non-current liability'],
    examples: [
      {
        en: 'A loan payable after more than twelve months is usually a non-current liability.',
        zh: '超过十二个月后应付的借款通常是非流动负债。',
      },
      {
        en: 'The entity reclassified the portion due within a year out of non-current liabilities.',
        zh: '实体把一年内到期部分从非流动负债中重分类出去。',
      },
    ],
  },
  'v1-useful-life-d4a3e24e': {
    enDefinition:
      'the period over which an asset is expected to be available for use by an entity, or the number of production or similar units expected to be obtained from the asset',
    acceptedZhAnswers: ['使用寿命', '预计使用年限'],
    collocations: ['estimate useful life', 'revise useful life', 'useful life in units of production'],
    examples: [
      {
        en: 'Management revised the useful life of the machine after a technical review.',
        zh: '技术复核后，管理层修订了该机器的使用寿命。',
      },
      {
        en: 'Useful life may be expressed in years or in units of production.',
        zh: '使用寿命可以用年数或生产单位数表示。',
      },
    ],
  },
  'v1-weighted-average-cost-e6cd436b': {
    enDefinition:
      'an inventory cost formula that averages the cost of similar items on hand at the beginning of the period and those purchased or produced during the period, weighted by quantity (IAS 2)',
    acceptedZhAnswers: ['加权平均成本', '加权平均成本法'],
    collocations: ['weighted average cost formula', 'apply weighted average cost', 'periodic weighted average cost'],
    examples: [
      {
        en: 'Under the weighted average cost formula, opening inventory and purchases are averaged by quantity.',
        zh: '在加权平均成本法下，期初存货与购入按数量加权平均。',
      },
      {
        en: 'The store uses weighted average cost rather than FIFO for identical spare parts.',
        zh: '该门店对相同备件采用加权平均成本而非先进先出。',
      },
    ],
  },
  'v1-financial-year-0e3a4471': {
    enDefinition:
      'an entity’s accounting and reporting period, normally about twelve months, used to prepare financial statements',
    acceptedZhAnswers: ['财务年度', '会计年度'],
    collocations: ['end of the financial year', 'financial year end', 'shortened financial year'],
    examples: [
      {
        en: 'The company’s financial year ends on 31 December.',
        zh: '该公司财务年度于 12 月 31 日结束。',
      },
      {
        en: 'A newly incorporated entity may report a first financial year that is shorter than twelve months.',
        zh: '新成立实体的首个财务年度可能短于十二个月。',
      },
    ],
  },
}

const LIST_SLUG = {
  'list-daily': 'daily',
  'list-business': 'business',
  'list-finance': 'finance',
  'list-accounting': 'accounting',
}

function unique(values) {
  return [...new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean))]
}

function normalizeLoose(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

function isFakeCollocation(col, expression, partOfSpeech) {
  const nc = normalizeLoose(col)
  const ne = normalizeLoose(expression)
  if (!nc || !ne) return true
  if (nc === ne) return true
  if (partOfSpeech && nc === normalizeLoose(`${expression} ${partOfSpeech}`)) return true
  if (nc === normalizeLoose(`use ${expression}`)) return true
  if (nc === normalizeLoose(`${expression} (${partOfSpeech})`)) return true
  return false
}

function hashId(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function articleFor(expression) {
  const text = expression.trim()
  if (/^[A-Z]{2,}$/.test(text)) {
    return /^[AEFHILMNORSX]/i.test(text) ? 'an' : 'a'
  }
  if (/\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment)\b/i.test(text)) {
    return ''
  }
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series)$/i.test(text)) return ''
  return /^[aeiou]/i.test(text) ? 'an' : 'a'
}

function withArticle(expression) {
  const art = articleFor(expression)
  return art ? `${art} ${expression}` : expression
}

function primaryMeta(wordId, memberships) {
  const items = memberships.filter((item) => item.wordId === wordId)
  const lists = items.map((item) => LIST_SLUG[item.listId]).filter(Boolean)
  let list = 'daily'
  if (lists.includes('accounting')) list = 'accounting'
  else if (lists.includes('finance')) list = 'finance'
  else if (lists.includes('business')) list = 'business'
  else if (lists[0]) list = lists[0]
  const subcategory = items.find((item) => LIST_SLUG[item.listId] === list)?.subcategory
    || items[0]?.subcategory
    || ''
  return { list, subcategory }
}

function isSentenceExpression(expression) {
  const text = String(expression || '').trim()
  return /[?!.]$/.test(text) || /^(can|could|would|will|how|what|where|when|why|is|are|do|does|did|i |we |please )\b/i.test(text)
}

function pickValid(candidates, expression, partOfSpeech, count = 3) {
  const picked = []
  for (const candidate of candidates) {
    if (!candidate) continue
    if (isFakeCollocation(candidate, expression, partOfSpeech)) continue
    if (!candidate.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    if (picked.includes(candidate)) continue
    picked.push(candidate)
    if (picked.length >= count) break
  }
  if (picked.length < 2) {
    picked.push(`talk about ${expression}`, `learn ${expression}`)
  }
  return unique(picked).slice(0, count)
}

function lexicalCollocations(expression, partOfSpeech) {
  const x = expression
  const ax = withArticle(expression)
  const lower = x.toLocaleLowerCase('en-US')
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  const isVerb = /\bverb\b/.test(pos) && !/phrase/.test(pos)

  if (isSentenceExpression(x)) {
    return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  }
  if (isVerb) {
    return [`${x} carefully`, `need to ${x}`, `decide when to ${x}`]
  }

  if (lower.endsWith('equation')) return [`apply the ${x}`, `balance the ${x}`, `state the ${x}`]
  if (lower.endsWith('policy')) return [`adopt ${ax}`, `change the ${x}`, `disclose the ${x}`]
  if (lower.endsWith('estimate')) return [`make ${ax}`, `revise ${ax}`, `accounting ${x}`]
  if (lower.startsWith('accrued ')) return [`recognise ${ax}`, `reverse ${ax}`, `period-end ${x}`]
  if (lower.startsWith('prepaid ')) return [`recognise ${ax}`, `amortise ${ax}`, `release ${ax}`]
  if (/moq|minimum order/.test(lower)) return [`meet the ${x}`, `negotiate the ${x}`, `below the ${x}`]
  if (/provision|allowance|write-?down|impairment/.test(lower)) {
    return [`recognise ${ax}`, `reverse ${ax}`, `measure ${ax}`]
  }
  if (/ratio|rate$|yield|return/.test(lower)) return [`calculate the ${x}`, `interpret the ${x}`, `compare the ${x}`]
  if (/statement|report|note|transcript/.test(lower)) return [`prepare the ${x}`, `review the ${x}`, `issue the ${x}`]
  if (/invoice|receipt|quotation|quote|order|moq|packing list/.test(lower)) {
    return [`issue ${ax}`, `check the ${x}`, `send the ${x}`]
  }
  if (/card|password|portal|wifi|wi-fi/.test(lower)) return [`use the ${x}`, `request ${ax}`, `activate the ${x}`]
  if (/meeting|agenda|minutes|deadline|appointment/.test(lower)) {
    return [`set the ${x}`, `confirm the ${x}`, `move the ${x}`]
  }
  if (/payment|deposit|refund|fare|fee/.test(lower)) return [`make ${ax}`, `request ${ax}`, `confirm the ${x}`]
  if (/asset|liability|equity|inventory|receivable|payable/.test(lower)) {
    return [`classify ${ax}`, `measure ${ax}`, `disclose ${ax}`]
  }
  if (/budget|forecast|valuation|cash flow/.test(lower)) return [`prepare ${ax}`, `update the ${x}`, `review the ${x}`]
  if (/risk|hedge|exposure|fx /.test(lower)) return [`manage ${ax}`, `hedge ${ax}`, `monitor the ${x}`]
  if (/bond|share|equity|dividend|coupon/.test(lower)) return [`issue ${ax}`, `price the ${x}`, `trade the ${x}`]
  return null
}

function subcategoryCollocations(expression, subcategory, list) {
  const x = expression
  const ax = withArticle(expression)
  const map = {
    audit: [`audit the ${x}`, `test the ${x}`, `document the ${x}`],
    'bookkeeping-ledger': [`post the ${x}`, `reconcile the ${x}`, `record the ${x}`],
    'financial-statements': [`present the ${x}`, `disclose the ${x}`, `read the ${x}`],
    inventory: [`count the ${x}`, `value the ${x}`, `move the ${x}`],
    'management-costing': [`allocate the ${x}`, `analyse the ${x}`, `control the ${x}`],
    'non-current-assets': [`capitalise the ${x}`, `depreciate the ${x}`, `impair the ${x}`],
    'revenue-expense-accrual': [`accrue the ${x}`, `recognise ${ax}`, `defer the ${x}`],
    'tax-reporting': [`compute the ${x}`, `file the ${x}`, `estimate the ${x}`],
    'logistics-inventory': [`ship against the ${x}`, `update the ${x}`, `check the ${x}`],
    payment: [`process the ${x}`, `confirm the ${x}`, `schedule the ${x}`],
    'pricing-quotation': [`send the ${x}`, `revise the ${x}`, `compare the ${x}`],
    'ordering-moq': [`meet the ${x}`, `negotiate the ${x}`, `confirm the ${x}`],
    negotiation: [`discuss the ${x}`, `agree the ${x}`, `reopen the ${x}`],
    'meeting-communication': [`circulate the ${x}`, `confirm the ${x}`, `follow the ${x}`],
    school: [`submit the ${x}`, `check the ${x}`, `download the ${x}`],
    'banking-payments': [`transfer against the ${x}`, `verify the ${x}`, `update the ${x}`],
    'banking-interest': [`earn the ${x}`, `charge the ${x}`, `compare the ${x}`],
    'fixed-income': [`price the ${x}`, `hold the ${x}`, `trade the ${x}`],
    'equity-investment': [`invest via the ${x}`, `value the ${x}`, `rebalance the ${x}`],
    'fx-risk': [`hedge the ${x}`, `measure the ${x}`, `report the ${x}`],
    'corporate-finance': [`plan the ${x}`, `approve the ${x}`, `fund via the ${x}`],
    restaurant: [`order the ${x}`, `ask for the ${x}`, `pay for the ${x}`],
    'restaurant-cafe': [`order the ${x}`, `ask for the ${x}`, `pay for the ${x}`],
    shopping: [`compare the ${x}`, `ask about the ${x}`, `return using the ${x}`],
    transport: [`check the ${x}`, `book the ${x}`, `pay the ${x}`],
    healthcare: [`ask about the ${x}`, `explain the ${x}`, `follow the ${x}`],
    'household-weather': [`prepare for the ${x}`, `check the ${x}`, `talk about the ${x}`],
  }
  if (map[subcategory]) return map[subcategory]

  if (list === 'accounting') return [`review the ${x}`, `explain the ${x}`, `apply the ${x}`]
  if (list === 'finance') return [`analyse the ${x}`, `monitor the ${x}`, `report the ${x}`]
  if (list === 'business') return [`confirm the ${x}`, `prepare the ${x}`, `follow up on the ${x}`]
  return [`use the ${x}`, `ask about the ${x}`, `remember the ${x}`]
}

function buildCollocations(expression, partOfSpeech, list, subcategory) {
  const lexical = lexicalCollocations(expression, partOfSpeech) || []
  const bySub = subcategoryCollocations(expression, subcategory, list)
  return pickValid([...lexical, ...bySub], expression, partOfSpeech, 3)
}

function buildExamples(expression, zhGloss, list, subcategory, id) {
  const x = expression
  const ax = withArticle(expression)
  const zh = zhGloss || expression

  if (isSentenceExpression(x)) {
    return [
      {
        en: `When I need it, I say “${x}” naturally.`,
        zh: `需要时，我会自然地说：「${zh}」。`,
      },
      {
        en: `I practised “${x}” before the real conversation.`,
        zh: `正式对话前，我练习了「${zh}」。`,
      },
    ]
  }

  const pools = {
    audit: [
      { en: `The audit team sampled transactions related to the ${x}.`, zh: `审计团队抽样检查了与「${zh}」相关的交易。` },
      { en: `Working papers explain how we tested the ${x}.`, zh: `工作底稿说明我们如何测试「${zh}」。` },
    ],
    'bookkeeping-ledger': [
      { en: `Please post the ${x} before preparing the trial balance.`, zh: `编制试算平衡表前，请先过账「${zh}」。` },
      { en: `We reconciled the ${x} to the supporting schedule.`, zh: `我们把「${zh}」与支持性明细进行了核对。` },
    ],
    'financial-statements': [
      { en: `Users look at the ${x} when reading the annual report.`, zh: `阅读年报时，使用者会关注「${zh}」。` },
      { en: `The notes clarify presentation of the ${x}.`, zh: `附注澄清了「${zh}」的列报方式。` },
    ],
    inventory: [
      { en: `Warehouse staff counted items linked to the ${x}.`, zh: `仓管清点了与「${zh}」相关的存货。` },
      { en: `Costing changed after we updated the ${x}.`, zh: `更新「${zh}」后，成本计算发生变化。` },
    ],
    'non-current-assets': [
      { en: `Capex approval depends on how we treat the ${x}.`, zh: `资本开支审批取决于我们如何处理「${zh}」。` },
      { en: `Depreciation policy interacts with the ${x}.`, zh: `折旧政策与「${zh}」相互影响。` },
    ],
    'tax-reporting': [
      { en: `The tax team estimated the ${x} for the return.`, zh: `税务团队为报税估算了「${zh}」。` },
      { en: `Supporting workings for the ${x} were filed with the pack.`, zh: `「${zh}」的支持性计算已归入资料包。` },
    ],
    payment: [
      { en: `Accounts payable released the ${x} after three-way match.`, zh: `三单匹配通过后，应付账款放出了「${zh}」。` },
      { en: `The supplier chased us about the ${x}.`, zh: `供应商催问我们「${zh}」的进展。` },
    ],
    'pricing-quotation': [
      { en: `Sales refreshed the ${x} after the cost change.`, zh: `成本变动后，销售更新了「${zh}」。` },
      { en: `The buyer compared our ${x} with two rivals.`, zh: `买方把我们的「${zh}」与两家对手做了比较。` },
    ],
    'ordering-moq': [
      { en: `We could not place a smaller lot because of the ${x}.`, zh: `因为「${zh}」，我们无法下更小批量。` },
      { en: `Procurement negotiated the ${x} for the pilot run.`, zh: `采购为试产协商了「${zh}」。` },
    ],
    school: [
      { en: `I downloaded the ${x} from the student portal.`, zh: `我从学生门户下载了「${zh}」。` },
      { en: `The lecturer asked us to bring the ${x} to class.`, zh: `讲师要求我们把「${zh}」带到课堂上。` },
    ],
    'banking-payments': [
      { en: `I verified the ${x} before confirming the transfer.`, zh: `确认转账前，我核对了「${zh}」。` },
      { en: `The teller helped me update the ${x}.`, zh: `柜员帮我更新了「${zh}」。` },
    ],
    'fixed-income': [
      { en: `The desk marked the ${x} to market at close.`, zh: `交易台在收盘时把「${zh}」按市价估值。` },
      { en: `Investors asked how sensitive the ${x} is to yields.`, zh: `投资者询问「${zh}」对收益率有多敏感。` },
    ],
    'fx-risk': [
      { en: `Treasury hedged the ${x} ahead of the receivable date.`, zh: `资金部在应收款到期前对冲了「${zh}」。` },
      { en: `The board pack summarised exposure from the ${x}.`, zh: `董事会材料汇总了来自「${zh}」的风险敞口。` },
    ],
    'restaurant-cafe': [
      { en: `I asked the waiter about the ${x}.`, zh: `我向服务员询问了「${zh}」。` },
      { en: `We paid for the ${x} before leaving the café.`, zh: `离开咖啡馆前，我们付清了「${zh}」。` },
    ],
    shopping: [
      { en: `The cashier explained the ${x} at checkout.`, zh: `收银员在结账时说明了「${zh}」。` },
      { en: `I kept the ${x} in case I need a return.`, zh: `我留着「${zh}」，以备退货。` },
    ],
    transport: [
      { en: `Please check the ${x} before we board.`, zh: `上车前请核对「${zh}」。` },
      { en: `The app shows the ${x} for this route.`, zh: `应用显示了这条线路的「${zh}」。` },
    ],
    healthcare: [
      { en: `The pharmacist explained the ${x} clearly.`, zh: `药剂师清楚地解释了「${zh}」。` },
      { en: `I asked the clinic about the ${x} before agreeing.`, zh: `同意前，我向诊所询问了「${zh}」。` },
    ],
  }

  const fallback = {
    accounting: [
      { en: `In class we applied ${ax} to a short case study.`, zh: `课上我们把「${zh}」用到一个短案例中。` },
      { en: `The worksheet shows how the ${x} affects the accounts.`, zh: `工作底稿显示「${zh}」如何影响账目。` },
      { en: `I can now explain the ${x} without reading the notes.`, zh: `我现在可以不看笔记解释「${zh}」。` },
    ],
    finance: [
      { en: `Our model is sensitive to assumptions about the ${x}.`, zh: `我们的模型对「${zh}」相关假设很敏感。` },
      { en: `The memo highlights why the ${x} matters for this deal.`, zh: `备忘录强调了「${zh}」对本交易的重要性。` },
      { en: `I compared last year’s ${x} with the current forecast.`, zh: `我把去年的「${zh}」与当前预测做了对比。` },
    ],
    business: [
      { en: `Before we sign, let’s confirm the ${x} in writing.`, zh: `签字前，我们书面确认一下「${zh}」。` },
      { en: `The ops lead owns follow-up on the ${x}.`, zh: `运营负责人跟进「${zh}」。` },
      { en: `We put the ${x} on the agenda for Thursday.`, zh: `我们把「${zh}」放进周四议程。` },
    ],
    daily: [
      { en: `I sorted out the ${x} on campus this afternoon.`, zh: `今天下午我在校园把「${zh}」办妥了。` },
      { en: `Could you show me where to find the ${x}?`, zh: `你能告诉我在哪里找「${zh}」吗？` },
      { en: `Once I understood the ${x}, the process felt easier.`, zh: `弄懂「${zh}」后，流程就顺多了。` },
    ],
  }

  const specific = pools[subcategory]
  const general = fallback[list] || fallback.daily
  const pool = specific && specific.length >= 2 ? [...specific, ...general] : general
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

function senseOnlyAnswers(zhGloss, accepted) {
  const primary = String(zhGloss ?? '')
    .split(/[；;]/)[0]
    .split(/[，,]/)[0]
    .trim()
  const extras = (Array.isArray(accepted) ? accepted : [])
    .map((value) => String(value).trim())
    .filter(Boolean)
    .filter((value) => value === primary || value.includes(primary) || primary.includes(value))
  return unique([primary, ...extras]).slice(0, 4)
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const memberships = pack.memberships

let definitionPatched = 0
let enriched = 0

for (const word of pack.words) {
  const fix = DEFINITION_FIXES[word.id]
  if (fix) {
    // Apply scalar fields first; colloc/examples handled below so overrides win.
    const { collocations, examples, ...scalars } = fix
    Object.assign(word, scalars)
    definitionPatched += 1
    if (collocations) word._fixCollocations = collocations
    if (examples) word._fixExamples = examples
  }

  const { list, subcategory } = primaryMeta(word.id, memberships)
  word.collocations = Array.isArray(word._fixCollocations) && word._fixCollocations.length >= 2
    ? word._fixCollocations
    : buildCollocations(word.expression, word.partOfSpeech, list, subcategory)
  word.examples = Array.isArray(word._fixExamples) && word._fixExamples.length >= 2
    ? word._fixExamples
    : buildExamples(word.expression, word.zhGloss, list, subcategory, word.id)
  delete word._fixCollocations
  delete word._fixExamples

  word.acceptedZhAnswers = senseOnlyAnswers(word.zhGloss || fix?.zhGloss, word.acceptedZhAnswers)
  if (fix?.zhGloss) word.zhGloss = fix.zhGloss
  enriched += 1
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

console.log(JSON.stringify({
  words: pack.words.length,
  definitionPatched,
  enriched,
  packPath,
}, null, 2))
