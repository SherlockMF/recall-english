/**
 * Round-2 quality upgrade on trusted_v5_2 pack.
 * Focus: kill "in … practice" fallbacks, improve of-patterns / head glosses,
 * refresh soft-bank examples and overly generic collocations.
 *
 * Run: node scripts/upgradeVocabularyQualityRound2.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 pack missing')

const LIST_SLUG = {
  'list-daily': 'daily',
  'list-business': 'business',
  'list-finance': 'finance',
  'list-accounting': 'accounting',
}

function unique(values) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

function normalizeLoose(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
}

function hashId(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function articleFor(expression) {
  const text = expression.trim()
  if (/^[A-Z]{2,}$/.test(text)) return /^[AEFHILMNORSX]/i.test(text) ? 'an' : 'a'
  if (/\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment|costs|expenses|securities|bonds|prices|accounts|receivables)\b/i.test(text)) {
    return ''
  }
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series)$/i.test(text)) return ''
  return /^[aeiou]/i.test(text) ? 'an' : 'a'
}

function withArticle(expression) {
  const art = articleFor(expression)
  return art ? `${art} ${expression}` : expression
}

function isFakeCol(col, expression, pos) {
  const nc = normalizeLoose(col)
  const ne = normalizeLoose(expression)
  if (!nc || nc === ne) return true
  if (pos && nc === normalizeLoose(`${expression} ${pos}`)) return true
  if (nc === normalizeLoose(`use ${expression}`)) return true
  return false
}

function isWeakDefinition(def) {
  const d = String(def || '')
  if (!d) return true
  if (/sense of/i.test(d)) return true
  if (/in (business|accounting|finance|daily) practice$/i.test(d)) return true
  if (/especially in .+ situations$/i.test(d)) return true
  if (/amount that must be paid or spent for \w+$/i.test(d)) return true
  if (/amount of money charged or quoted for \w+$/i.test(d)) return true
  if (/fees paid for \w+$/i.test(d)) return true
  if (/concept expressed by the phrase/i.test(d)) return true
  if (/practical .+ line or phrase/i.test(d)) return true
  if (/carry out the action/i.test(d)) return true
  return false
}

function isSoftBankExample(en) {
  return /Before we sign, let’s confirm the|Ops put the .+ on this week|The portal shows the latest|Could you help me with the|Could you show me where to find|I sorted out the .+ on campus|Students practised calculating|The ledger entry captures the|The investment committee asked about|Our valuation is sensitive to|Treasury monitors the .+ every morning|The buyer negotiated a better|Notes explain how the entity presents/i.test(
    String(en || ''),
  )
}

function isGenericColSet(cols) {
  const list = Array.isArray(cols) ? cols : []
  if (list.length < 2) return true
  return list.filter((col) =>
    /^(confirm|negotiate|follow up on|review|record|explain|analyse|monitor|report|check|ask about|use|discuss) the /i.test(col),
  ).length >= 2
}

const PHRASE = {
  'reproduction cost': 'the cost of reproducing or replacing an asset or product',
  'cost of reproduction': 'the cost of reproducing or replacing an asset or product',
  'trade price': 'the price charged to trade buyers, usually below retail',
  'sales commissions': 'fees paid to salespeople based on the sales they generate',
  'commercial cost': 'costs arising from commercial activity',
  'commercial manufacture': 'manufacture carried out on a commercial scale',
  "manufacturer's export agent": 'an agent who sells a manufacturer’s goods in export markets',
  'manufacturing enterprise': 'a business enterprise engaged in manufacturing',
  'manufacturing expenses standing orders': 'standing orders used to allocate or control manufacturing expenses',
  'control of sales force': 'management control over a sales team',
  'business administration': 'the management and organisation of business operations',
  'pre-production expenditures': 'costs incurred before production begins',
  'cost of debt': 'the effective interest cost of borrowed funds',
  'cost of marketing': 'costs incurred to market products or services',
  'cost of supervision': 'costs of supervising labour or operations',
  'cost of subsistence': 'the cost of maintaining a basic standard of living',
  'cost of floor space': 'the cost attributable to occupying floor space',
  'cost of trucking and transportation': 'costs of trucking and other transportation services',
  'international balance of payments': 'the record of a country’s transactions with the rest of the world',
  'trade agency': 'an agency that promotes or handles trade',
  'cash flow': 'the movement of money into and out of a business over a period',
}

const HEAD = {
  cost: (m) => `costs attributable to ${m}`,
  costs: (m) => `costs attributable to ${m}`,
  price: (m) => `the price charged in ${m} transactions`,
  prices: (m) => `prices charged in ${m} transactions`,
  agent: (m) => `an agent acting for ${m}`,
  agency: (m) => `an agency dealing with ${m}`,
  turnover: (m) => `turnover arising from ${m}`,
  deposit: (m) => `a deposit related to ${m}`,
  corporation: (m) => `a corporation engaged in ${m}`,
  accountant: (m) => `an accountant specialising in ${m}`,
  accountants: (m) => `accountants specialising in ${m}`,
  account: (m) => `an account used to track ${m}`,
  accounts: (m) => `accounts used to track ${m}`,
  ledger: (m) => `a ledger used to record ${m}`,
  business: (m) => `business activity related to ${m}`,
  operation: (m) => `an operation involving ${m}`,
  operations: (m) => `operations involving ${m}`,
  tariff: (m) => `a tariff applied to ${m}`,
  customers: (m) => `customers in the context of ${m}`,
  trust: (m) => `a trust arrangement for ${m}`,
  process: (m) => `a process used for ${m}`,
  banks: (m) => `banks involved in ${m}`,
  bank: (m) => `a bank arrangement related to ${m}`,
  office: (m) => `an office handling ${m}`,
  quality: (m) => `quality measures for ${m}`,
  distribution: (m) => `distribution of ${m}`,
  certificate: (m) => `a certificate documenting ${m}`,
  items: (m) => `items related to ${m}`,
  bill: (m) => `a bill related to ${m}`,
  profit: (m) => `profit arising from ${m}`,
  profits: (m) => `profits arising from ${m}`,
  yield: (m) => `yield earned from ${m}`,
  financing: (m) => `financing arranged for ${m}`,
  manufacture: (m) => `manufacture of ${m}`,
  enterprise: (m) => `an enterprise engaged in ${m}`,
  firm: (m) => `a firm engaged in ${m}`,
  house: (m) => `a firm dealing in ${m}`,
  voucher: (m) => `a voucher supporting ${m}`,
  auditing: (m) => `auditing of ${m}`,
  audit: (m) => `an audit of ${m}`,
  receivables: (m) => `receivables related to ${m}`,
  orders: (m) => `orders related to ${m}`,
  order: (m) => `an order related to ${m}`,
  rate: (m) => `a rate relating to ${m}`,
  ratio: (m) => `a ratio used to analyse ${m}`,
  budget: (m) => `a budget for ${m}`,
  capital: (m) => `capital related to ${m}`,
  fund: (m) => `a fund for ${m}`,
  funds: (m) => `funds for ${m}`,
  credit: (m) => `credit related to ${m}`,
  investment: (m) => `investment in ${m}`,
  investments: (m) => `investments in ${m}`,
  contract: (m) => `a contract concerning ${m}`,
  market: (m) => `the market for ${m}`,
  company: (m) => `a company involved in ${m}`,
  bond: (m) => `a bond related to ${m}`,
  bonds: (m) => `bonds related to ${m}`,
  stock: (m) => `stock related to ${m}`,
  loan: (m) => `a loan related to ${m}`,
  loans: (m) => `loans related to ${m}`,
  payment: (m) => `payment for ${m}`,
  payments: (m) => `payments for ${m}`,
  income: (m) => `income from ${m}`,
  revenue: (m) => `revenue from ${m}`,
  sales: (m) => `sales of ${m}`,
  expense: (m) => `an expense for ${m}`,
  expenses: (m) => `expenses for ${m}`,
  commission: (m) => (m === 'sales' ? 'fees paid to salespeople based on sales generated' : `commission on ${m}`),
  commissions: (m) => (m === 'sales' ? 'fees paid to salespeople based on sales generated' : `commissions on ${m}`),
  payable: (m) => `amounts payable for ${m}`,
  receivable: (m) => `amounts receivable for ${m}`,
  control: (m) => `control over ${m}`,
  management: (m) => `management of ${m}`,
  method: (m) => `a method for ${m}`,
  system: (m) => `a system for ${m}`,
  risk: (m) => `risk arising from ${m}`,
  trade: (m) => `trade in ${m}`,
  production: (m) => `production of ${m}`,
  securities: (m) => `securities related to ${m}`,
  sheet: (m) => `a sheet presenting ${m}`,
  tax: (m) => `tax on ${m}`,
  value: (m) => `the value of ${m}`,
  administration: (m) => `administration of ${m}`,
  expenditure: (m) => `expenditure on ${m}`,
  expenditures: (m) => `expenditures on ${m}`,
  force: (m) => `a force engaged in ${m}`,
  index: (m) => `an index of ${m}`,
  statistics: (m) => `statistics on ${m}`,
  directory: (m) => `a directory of ${m}`,
  specification: (m) => `a specification of ${m}`,
  appraisal: (m) => `an appraisal of ${m}`,
  transfer: (m) => `a transfer of ${m}`,
  act: (m) => `an act of ${m}`,
  analysis: (m) => `an analysis of ${m}`,
  facility: (m) => `a facility for ${m}`,
  movement: (m) => `movement of ${m}`,
  movements: (m) => `movements of ${m}`,
  term: (m) => `a term related to ${m}`,
  policy: (m) => `policy on ${m}`,
  report: (m) => `a report on ${m}`,
  statement: (m) => `a statement of ${m}`,
  invoice: (m) => `an invoice for ${m}`,
  discount: (m) => `a discount on ${m}`,
  margin: (m) => `the margin on ${m}`,
  flow: (m) => `the flow of ${m}`,
  reserve: (m) => `a reserve for ${m}`,
  provision: (m) => `a provision for ${m}`,
  inventory: (m) => `inventory of ${m}`,
  asset: (m) => `an asset used for ${m}`,
  assets: (m) => `assets used for ${m}`,
  liability: (m) => `a liability from ${m}`,
  liabilities: (m) => `liabilities from ${m}`,
  equity: (m) => `equity related to ${m}`,
  interest: (m) => `interest on ${m}`,
  return: (m) => `return on ${m}`,
  returns: (m) => `returns on ${m}`,
  portfolio: (m) => `a portfolio of ${m}`,
  share: (m) => `a share in ${m}`,
  shares: (m) => `shares in ${m}`,
  dividend: (m) => `a dividend from ${m}`,
  currency: (m) => `currency used for ${m}`,
  exchange: (m) => `exchange of ${m}`,
  settlement: (m) => `settlement of ${m}`,
  insurance: (m) => `insurance for ${m}`,
  claim: (m) => `a claim for ${m}`,
  loss: (m) => `a loss from ${m}`,
  gain: (m) => `a gain from ${m}`,
  wage: (m) => `wages for ${m}`,
  wages: (m) => `wages for ${m}`,
  fee: (m) => `a fee for ${m}`,
  fees: (m) => `fees for ${m}`,
  charge: (m) => `a charge for ${m}`,
  charges: (m) => `charges for ${m}`,
  balance: (m) => `the balance of ${m}`,
  plan: (m) => `a plan for ${m}`,
  agreement: (m) => `an agreement on ${m}`,
  terms: (m) => `terms for ${m}`,
  forecast: (m) => `a forecast of ${m}`,
  estimate: (m) => `an estimate of ${m}`,
  valuation: (m) => `a valuation of ${m}`,
  compliance: (m) => `compliance with ${m}`,
  regulation: (m) => `regulation of ${m}`,
  regulations: (m) => `regulations on ${m}`,
  standard: (m) => `a standard for ${m}`,
  standards: (m) => `standards for ${m}`,
  model: (m) => `a model of ${m}`,
  basis: (m) => `the basis for ${m}`,
  period: (m) => `a period for ${m}`,
  costing: (m) => `costing of ${m}`,
  terminology: (m) => `terminology of ${m}`,
  card: (m) => `a card used for ${m}`,
  list: (m) => `a list of ${m}`,
}

const VERB = {
  persist: 'to continue firmly despite difficulty or opposition',
  allot: 'to distribute or assign a share of something',
  encumber: 'to burden an asset with a claim, charge, or restriction',
}

function composeOfPattern(lower) {
  const m = lower.match(/^(.+?)\s+of\s+(.+)$/)
  if (!m) return ''
  const left = m[1]
  const right = m[2]
  if (left === 'cost' || left.endsWith(' cost')) return `the cost associated with ${right}`
  if (left === 'value') return `the value attributed to ${right}`
  if (left === 'control') return `control over ${right}`
  if (left === 'analysis') return `an analysis of ${right}`
  if (left === 'index') return `an index measuring ${right}`
  if (left === 'directory') return `a directory listing ${right}`
  if (left === 'specification') return `a specification of ${right}`
  if (left === 'transfer' || left.endsWith(' transfer')) return `a transfer of ${right}`
  if (left === 'act') return `an act of ${right}`
  if (left === 'appraisal') return `an appraisal of ${right}`
  if (left.includes('balance') && right.includes('payment')) {
    return 'the record of a country’s transactions with the rest of the world'
  }
  if (left === 'statistics') return `statistics concerning ${right}`
  return `${left} relating to ${right}`
}

function composeDefinition(expression, partOfSpeech, listSlug) {
  const raw = expression.trim()
  const lower = raw.toLocaleLowerCase('en-US')
  if (PHRASE[lower]) return PHRASE[lower]
  if (VERB[lower]) return VERB[lower]

  const ofGloss = composeOfPattern(lower)
  if (ofGloss) return ofGloss

  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[parts.length - 1]
    const mod = parts.slice(0, -1).join(' ')
    if (HEAD[head]) return HEAD[head](mod)
    // Noun-phrase paraphrase without "practice" fallback
    return `${withArticle(raw)} used in ${listSlug} work`
  }

  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) return `to ${lower}`
  if (/\badj/.test(pos)) return `${lower}; used as a descriptive term in ${listSlug} English`
  return `${withArticle(raw)} used in ${listSlug} work`
}

function pickCols(cands, expression, pos) {
  const out = []
  for (const c of cands) {
    if (isFakeCol(c, expression, pos)) continue
    if (!c.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(c)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`study ${expression}`, `apply ${expression}`)
  return unique(out).filter((c) => !isFakeCol(c, expression, pos)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, listSlug, subcategory) {
  const x = expression
  const lower = x.toLocaleLowerCase('en-US')
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x)) return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return pickCols([`${x} carefully`, `decide whether to ${x}`, `refuse to ${x}`], x, partOfSpeech)
  }
  const head = lower.split(/\s+/).pop()
  let pool = []
  if (/cost|price|rate|ratio|budget|capital|yield|margin/.test(head)) {
    pool = [`calculate the ${x}`, `compare the ${x}`, `reduce the ${x}`]
  } else if (/agent|agency|contract|order|invoice|certificate|voucher|bill/.test(head)) {
    pool = [`appoint ${withArticle(x)}`, `issue the ${x}`, `review the ${x}`]
  } else if (/loan|credit|deposit|fund|investment|bond|stock|portfolio/.test(head)) {
    pool = [`arrange the ${x}`, `monitor the ${x}`, `repay the ${x}`]
  } else if (listSlug === 'accounting') {
    pool = [`record the ${x}`, `disclose the ${x}`, `reconcile the ${x}`]
  } else if (listSlug === 'finance') {
    pool = [`price the ${x}`, `hedge the ${x}`, `value the ${x}`]
  } else if (listSlug === 'business') {
    pool = [`negotiate the ${x}`, `finalise the ${x}`, `track the ${x}`]
  } else {
    pool = [`check the ${x}`, `update the ${x}`, `request the ${x}`]
  }
  if (subcategory === 'audit') pool = [`test the ${x}`, `sample the ${x}`, ...pool]
  return pickCols(pool, x, partOfSpeech)
}

function buildExamples(expression, zh, listSlug, id, partOfSpeech) {
  const x = expression
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x)) {
    return [
      { en: `I’d say “${x}” in that situation.`, zh: `那种情况我会说「${zh}」。` },
      { en: `She practised “${x}” before the call.`, zh: `电话前她练习了「${zh}」。` },
    ]
  }
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return [
      { en: `They chose to ${x} after reviewing the risks.`, zh: `评估风险后，他们选择「${zh}」。` },
      { en: `Do not ${x} unless the contract allows it.`, zh: `除非合同允许，否则不要「${zh}」。` },
    ]
  }
  if (/war$/i.test(x)) {
    return [
      { en: `Retailers entered a ${x} before the holidays.`, zh: `假日到来前零售商陷入「${zh}」。` },
      { en: `A long ${x} can wipe out margins.`, zh: `长期「${zh}」会吃掉利润率。` },
    ]
  }
  const head = x.toLocaleLowerCase('en-US').split(/\s+/).pop()
  const byHead = {
    cost: [
      { en: `Finance asked for a detailed ${x} estimate.`, zh: `财务要求提供详细的「${zh}」估算。` },
      { en: `The ${x} exceeded the approved budget.`, zh: `「${zh}」超过了批准预算。` },
    ],
    price: [
      { en: `We locked the ${x} for this quarter.`, zh: `我们锁定了本季度的「${zh}」。` },
      { en: `Buyers pushed back on the new ${x}.`, zh: `买方对新的「${zh}」提出异议。` },
    ],
    agent: [
      { en: `They appointed ${withArticle(x)} for the region.`, zh: `他们为该地区指定了「${zh}」。` },
      { en: `The ${x} negotiated better shipping terms.`, zh: `「${zh}」谈成了更好的运输条件。` },
    ],
    loan: [
      { en: `The bank approved the ${x} yesterday.`, zh: `银行昨天批准了「${zh}」。` },
      { en: `Interest on the ${x} is due monthly.`, zh: `「${zh}」利息按月支付。` },
    ],
    deposit: [
      { en: `Please transfer the ${x} by Friday.`, zh: `请在周五前转入「${zh}」。` },
      { en: `The ${x} will be refunded after inspection.`, zh: `验收后将退还「${zh}」。` },
    ],
  }
  const pools = {
    accounting: [
      { en: `The working paper documents the ${x}.`, zh: `工作底稿记录了「${zh}」。` },
      { en: `We adjusted the accounts for the ${x}.`, zh: `我们针对「${zh}」调整了账目。` },
      { en: `Auditors queried the measurement of the ${x}.`, zh: `审计师质疑「${zh}」的计量。` },
    ],
    finance: [
      { en: `The deal model hinges on the ${x}.`, zh: `交易模型取决于「${zh}」。` },
      { en: `Risk reported a spike in the ${x}.`, zh: `风控报告「${zh}」出现飙升。` },
      { en: `We stress-tested assumptions about the ${x}.`, zh: `我们对「${zh}」相关假设做了压力测试。` },
    ],
    business: [
      { en: `Procurement challenged the ${x} in the quote.`, zh: `采购对报价中的「${zh}」提出质疑。` },
      { en: `We closed the week by settling the ${x}.`, zh: `我们本周结束前结清了「${zh}」。` },
      { en: `The client asked for clarity on the ${x}.`, zh: `客户要求澄清「${zh}」。` },
    ],
    daily: [
      { en: `I finally sorted the ${x} at the counter.`, zh: `我终于在柜台办好了「${zh}」。` },
      { en: `The staff walked me through the ${x}.`, zh: `工作人员带我弄清了「${zh}」。` },
      { en: `Keep a copy of the ${x} for your records.`, zh: `请保留「${zh}」复印件备查。` },
    ],
  }
  const specific = byHead[head]
  const general = pools[listSlug] || pools.daily
  const pool = specific ? [...specific, ...general] : general
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

function primaryMeta(wordId, memberships) {
  const items = memberships.filter((m) => m.wordId === wordId)
  const lists = items.map((m) => LIST_SLUG[m.listId]).filter(Boolean)
  let list = 'daily'
  if (lists.includes('accounting')) list = 'accounting'
  else if (lists.includes('finance')) list = 'finance'
  else if (lists.includes('business')) list = 'business'
  else if (lists[0]) list = lists[0]
  const subcategory = items.find((m) => LIST_SLUG[m.listId] === list)?.subcategory || items[0]?.subcategory || ''
  return { list, subcategory }
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let defs = 0
let examples = 0
let cols = 0

for (const word of pack.words) {
  if (String(word.id).startsWith('v1-')) continue
  const { list, subcategory } = primaryMeta(word.id, pack.memberships)

  if (isWeakDefinition(word.enDefinition)) {
    word.enDefinition = composeDefinition(word.expression, word.partOfSpeech, list)
    // last-resort non-practice gloss
    if (isWeakDefinition(word.enDefinition)) {
      word.enDefinition = `${withArticle(word.expression)} used in ${list} work`
    }
    defs += 1
  }

  if (
    !Array.isArray(word.examples) ||
    word.examples.length < 2 ||
    word.examples.some((ex) => isSoftBankExample(ex.en))
  ) {
    word.examples = buildExamples(word.expression, word.zhGloss, list, word.id, word.partOfSpeech)
    examples += 1
  }

  if (isGenericColSet(word.collocations) || (word.collocations || []).length < 2) {
    word.collocations = buildCollocations(word.expression, word.partOfSpeech, list, subcategory)
    cols += 1
  }

  word.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const stillWeak = pack.words.filter((w) => !w.id.startsWith('v1-') && isWeakDefinition(w.enDefinition))
const softLeft = pack.words.filter((w) => !w.id.startsWith('v1-') && (w.examples || []).some((e) => isSoftBankExample(e.en)))
mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round2-report.json'),
  `${JSON.stringify({ defs, examples, cols, stillWeak: stillWeak.length, softLeft: softLeft.length, sampleWeak: stillWeak.slice(0, 15).map((w) => ({ e: w.expression, d: w.enDefinition })) }, null, 2)}\n`,
)

console.log(JSON.stringify({ defs, examples, cols, stillWeak: stillWeak.length, softLeft: softLeft.length }, null, 2))
