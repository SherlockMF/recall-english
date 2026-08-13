/**
 * Upgrade production pack quality in place (trusted_v5_2):
 * - Replace wrap/meta English definitions with compositional glosses
 * - Rebuild collocations/examples for non-v1 entries that still use template banks
 * - Keep V1 gold fixes and sense-aligned Chinese answers
 *
 * Run: node scripts/upgradeVocabularyQuality.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = [
  join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json'),
  join(root, 'data/vocabulary-packs/trusted_v5_1_vocabulary_pack.json'),
].find((path) => existsSync(path))
if (!packPath) throw new Error('No trusted pack found')

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

function hashId(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function articleFor(expression) {
  const text = expression.trim()
  if (/^[A-Z]{2,}$/.test(text)) return /^[AEFHILMNORSX]/i.test(text) ? 'an' : 'a'
  if (/\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment|costs|expenses|securities|bonds)\b/i.test(text)) {
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

function isWeakDefinition(def, expression) {
  const d = String(def || '')
  if (!d) return true
  if (/sense of/i.test(d)) return true
  if (/practical .+ line or phrase/i.test(d)) return true
  if (/carry out the action/i.test(d)) return true
  if (/ideas linked to/i.test(d)) return true
  if (/concept expressed by the phrase/i.test(d)) return true
  if (/in a way that matters for .+ communication/i.test(d)) return true
  if (/^a (business|accounting|finance|everyday).*(term|expression)/i.test(d)) return true
  if (d.includes(`“${expression}”`) || d.includes(`"${expression}"`)) {
    if (d.length < 90) return true
  }
  return false
}

function isBankExample(en) {
  return /In the worksheet we applied|Our memo explains why|Before signing, we confirmed|I handled .+ on campus this afternoon|I can explain .+ without reading the notes|Ops will follow up|Could you show me where to find|Once I understood|In the case study we applied|I sorted out the .+ on campus|When I need it, I say|I practised “/i.test(
    String(en || ''),
  )
}

/** Head-noun compositional glosses for multi-word professional terms. */
const HEAD_GLOSS = {
  cost: (mod) => `the amount that must be paid or spent for ${mod}`,
  costs: (mod) => `amounts that must be paid or spent for ${mod}`,
  price: (mod) => `the amount of money charged or quoted for ${mod}`,
  rate: (mod) => `a measured level or proportion relating to ${mod}`,
  ratio: (mod) => `a quantitative relationship used to analyse ${mod}`,
  budget: (mod) => `a planned amount of money set aside for ${mod}`,
  capital: (mod) => `funds or resources available for ${mod}`,
  fund: (mod) => `a pool of money set aside or managed for ${mod}`,
  funds: (mod) => `money available or allocated for ${mod}`,
  credit: (mod) => `an arrangement or amount of credit related to ${mod}`,
  investment: (mod) => `money committed with the expectation of return from ${mod}`,
  contract: (mod) => `a binding agreement concerning ${mod}`,
  account: (mod) => `a record or balance used to track ${mod}`,
  accounting: (mod) => `accounting treatment or practice related to ${mod}`,
  market: (mod) => `the market in which ${mod} is bought, sold, or priced`,
  bank: (mod) => `a banking arrangement or institution role related to ${mod}`,
  company: (mod) => `a business entity associated with ${mod}`,
  bond: (mod) => `a debt security or bond arrangement related to ${mod}`,
  bonds: (mod) => `debt securities related to ${mod}`,
  stock: (mod) => `equity or inventory related to ${mod}`,
  loan: (mod) => `borrowed money arranged for or secured by ${mod}`,
  payment: (mod) => `a transfer of money made for ${mod}`,
  profit: (mod) => `financial gain arising from ${mod}`,
  income: (mod) => `money received from ${mod}`,
  revenue: (mod) => `inflows earned from ${mod}`,
  sales: (mod) => `selling activity or proceeds related to ${mod}`,
  expense: (mod) => `a cost incurred for ${mod}`,
  expenses: (mod) => `costs incurred for ${mod}`,
  commission: (mod) => `a fee paid for ${mod}`,
  commissions: (mod) => `fees paid for ${mod}`,
  payable: (mod) => `an amount owed in respect of ${mod}`,
  receivable: (mod) => `an amount due from others in respect of ${mod}`,
  audit: (mod) => `an examination of records related to ${mod}`,
  control: (mod) => `a process or check used to manage ${mod}`,
  management: (mod) => `the planning and oversight of ${mod}`,
  method: (mod) => `a systematic way of handling ${mod}`,
  system: (mod) => `an organised set of procedures for ${mod}`,
  risk: (mod) => `exposure to loss or uncertainty arising from ${mod}`,
  trade: (mod) => `commercial exchange activity related to ${mod}`,
  production: (mod) => `the process of producing goods related to ${mod}`,
  securities: (mod) => `tradable financial instruments related to ${mod}`,
  sheet: (mod) => `a statement or schedule presenting ${mod}`,
  order: (mod) => `a request to buy or supply goods related to ${mod}`,
  tax: (mod) => `a compulsory levy related to ${mod}`,
  value: (mod) => `the worth assigned to ${mod}`,
  asset: (mod) => `a resource controlled by an entity related to ${mod}`,
  assets: (mod) => `resources controlled by an entity related to ${mod}`,
  liability: (mod) => `an obligation related to ${mod}`,
  liabilities: (mod) => `obligations related to ${mod}`,
  equity: (mod) => `ownership interest related to ${mod}`,
  interest: (mod) => `a charge or stake related to ${mod}`,
  return: (mod) => `gain or yield arising from ${mod}`,
  returns: (mod) => `gains, yields, or goods sent back related to ${mod}`,
  policy: (mod) => `a stated rule or approach for ${mod}`,
  report: (mod) => `a document presenting information about ${mod}`,
  statement: (mod) => `a formal presentation of information about ${mod}`,
  invoice: (mod) => `a bill requesting payment for ${mod}`,
  receipt: (mod) => `written proof of payment related to ${mod}`,
  discount: (mod) => `a reduction from the normal amount for ${mod}`,
  premium: (mod) => `an extra amount paid for ${mod}`,
  margin: (mod) => `the difference used to measure profitability of ${mod}`,
  flow: (mod) => `the movement of money or resources in ${mod}`,
  cycle: (mod) => `a recurring sequence related to ${mod}`,
  period: (mod) => `a span of time used for ${mod}`,
  year: (mod) => `a yearly period used for ${mod}`,
  note: (mod) => `an explanatory disclosure related to ${mod}`,
  notes: (mod) => `explanatory disclosures related to ${mod}`,
  reserve: (mod) => `an amount set aside for ${mod}`,
  provision: (mod) => `a liability recognised for ${mod}`,
  allowance: (mod) => `an amount deducted or set aside for ${mod}`,
  depreciation: (mod) => `allocation of cost over time for ${mod}`,
  amortisation: (mod) => `allocation of cost over time for ${mod}`,
  amortization: (mod) => `allocation of cost over time for ${mod}`,
  impairment: (mod) => `a reduction in recoverable amount related to ${mod}`,
  inventory: (mod) => `goods held for sale or use in ${mod}`,
  goods: (mod) => `products related to ${mod}`,
  service: (mod) => `work performed related to ${mod}`,
  services: (mod) => `work performed related to ${mod}`,
  fee: (mod) => `a charge payable for ${mod}`,
  fees: (mod) => `charges payable for ${mod}`,
  charge: (mod) => `an amount billed for ${mod}`,
  charges: (mod) => `amounts billed for ${mod}`,
  balance: (mod) => `the net amount remaining for ${mod}`,
  card: (mod) => `a card used for ${mod}`,
  list: (mod) => `a listed schedule of ${mod}`,
  plan: (mod) => `a planned approach for ${mod}`,
  agreement: (mod) => `a mutual arrangement concerning ${mod}`,
  terms: (mod) => `conditions that govern ${mod}`,
  clause: (mod) => `a contractual provision about ${mod}`,
  analysis: (mod) => `a detailed examination of ${mod}`,
  forecast: (mod) => `a projection of future ${mod}`,
  estimate: (mod) => `an approximate assessment of ${mod}`,
  valuation: (mod) => `the process of estimating the worth of ${mod}`,
  hedge: (mod) => `a position taken to reduce risk from ${mod}`,
  exposure: (mod) => `the extent of risk arising from ${mod}`,
  portfolio: (mod) => `a collection of holdings related to ${mod}`,
  share: (mod) => `a unit of ownership related to ${mod}`,
  shares: (mod) => `units of ownership related to ${mod}`,
  dividend: (mod) => `a distribution of profits related to ${mod}`,
  dividends: (mod) => `distributions of profits related to ${mod}`,
  option: (mod) => `a right related to ${mod}`,
  options: (mod) => `rights related to ${mod}`,
  swap: (mod) => `an exchange contract related to ${mod}`,
  forward: (mod) => `a forward arrangement related to ${mod}`,
  futures: (mod) => `exchange-traded contracts related to ${mod}`,
  currency: (mod) => `money used for ${mod}`,
  exchange: (mod) => `the conversion or marketplace related to ${mod}`,
  settlement: (mod) => `the completion of payment or delivery for ${mod}`,
  clearance: (mod) => `the process of clearing ${mod}`,
  custody: (mod) => `safekeeping arrangements for ${mod}`,
  collateral: (mod) => `security pledged for ${mod}`,
  guarantee: (mod) => `a promise to cover obligations related to ${mod}`,
  warranty: (mod) => `an assurance given about ${mod}`,
  insurance: (mod) => `protection against loss related to ${mod}`,
  claim: (mod) => `a demand for payment related to ${mod}`,
  claims: (mod) => `demands for payment related to ${mod}`,
  loss: (mod) => `a reduction in value arising from ${mod}`,
  losses: (mod) => `reductions in value arising from ${mod}`,
  gain: (mod) => `an increase in value arising from ${mod}`,
  gains: (mod) => `increases in value arising from ${mod}`,
  variance: (mod) => `the difference between planned and actual ${mod}`,
  overhead: (mod) => `indirect costs related to ${mod}`,
  overheads: (mod) => `indirect costs related to ${mod}`,
  wage: (mod) => `pay for labour related to ${mod}`,
  wages: (mod) => `pay for labour related to ${mod}`,
  salary: (mod) => `regular pay related to ${mod}`,
  payroll: (mod) => `the process of paying staff related to ${mod}`,
  pension: (mod) => `retirement benefit arrangements for ${mod}`,
  benefit: (mod) => `an advantage or payment related to ${mod}`,
  benefits: (mod) => `advantages or payments related to ${mod}`,
  compliance: (mod) => `meeting required rules for ${mod}`,
  regulation: (mod) => `an official rule governing ${mod}`,
  regulations: (mod) => `official rules governing ${mod}`,
  standard: (mod) => `an accepted requirement for ${mod}`,
  standards: (mod) => `accepted requirements for ${mod}`,
  principle: (mod) => `a fundamental rule applied to ${mod}`,
  principles: (mod) => `fundamental rules applied to ${mod}`,
  framework: (mod) => `a structured set of ideas for ${mod}`,
  model: (mod) => `a simplified representation used for ${mod}`,
  formula: (mod) => `a calculation method for ${mod}`,
  basis: (mod) => `the foundation used to measure ${mod}`,
  period: (mod) => `a time span used for ${mod}`,
  date: (mod) => `a calendar point relevant to ${mod}`,
  day: (mod) => `a daily measure related to ${mod}`,
  days: (mod) => `a period measured in days for ${mod}`,
  month: (mod) => `a monthly measure related to ${mod}`,
  months: (mod) => `a period measured in months for ${mod}`,
  costing: (mod) => `a costing approach used for ${mod}`,
  terminology: (mod) => `the specialised vocabulary used in ${mod}`,
  facility: (mod) => `a financing facility arranged for ${mod}`,
  investments: (mod) => `investments held or made in relation to ${mod}`,
  movement: (mod) => `a movement of funds or positions related to ${mod}`,
  movements: (mod) => `movements of funds or positions related to ${mod}`,
  term: (mod) => `an amount or result measured for ${mod}`,
  loans: (mod) => `loans related to ${mod}`,
}

const PHRASE_GLOSS = {
  'credit card': 'a card issued by a bank that lets the holder buy now and pay later',
  'debit card': 'a card that pays for purchases by taking money directly from a bank account',
  'on board': 'in agreement with a plan, or physically on a ship, aircraft, or vehicle',
  'in advance': 'before something happens; ahead of the required time',
  'price war': 'intense competition in which sellers repeatedly cut prices to win customers',
  'cash flow': 'the movement of money into and out of a business over a period',
  'balance sheet': 'a statement showing assets, liabilities, and equity at a point in time',
  'income statement': 'a statement showing income and expenses for a reporting period',
  'working capital': 'current assets minus current liabilities; short-term operating liquidity',
  'fixed assets': 'long-term tangible assets used in operations rather than held for sale',
  'current assets': 'assets expected to be realised or consumed within the operating cycle or one year',
  'accounts payable': 'amounts a business owes suppliers for goods or services bought on credit',
  'accounts receivable': 'amounts customers owe a business for goods or services sold on credit',
  'net present value': 'the discounted value of expected future cash flows minus the initial investment',
  'interest rate': 'the percentage charged or earned on borrowed or invested money',
  'exchange rate': 'the price of one currency expressed in another currency',
  'stock market': 'the public marketplace where shares and related securities are traded',
  'due diligence': 'careful investigation of a business or deal before committing money or signing',
  'joint venture': 'a business arrangement where parties share control, costs, and returns of a project',
  'letter of credit': 'a bank undertaking to pay a seller if agreed shipping documents are presented',
  'bill of lading': 'a transport document acknowledging receipt of goods for shipment',
  'packing list': 'a document listing the contents, weight, and packing details of a shipment',
  'purchase order': 'a buyer’s formal document requesting goods or services from a supplier',
  'sales order': 'a seller’s record confirming a customer’s request to buy goods or services',
  'trade discount': 'a reduction from list price given to trade buyers',
  'cash discount': 'a reduction offered for paying an invoice early',
  'terminal costing': 'a costing method that accumulates costs for a specific contract or job through to completion',
  'profit for the term': 'profit earned during a stated accounting term or period',
  'accounting terminology': 'the specialised words and phrases used in accounting',
  'short-term bank loans': 'bank borrowings that are due for repayment within one year',
  'long-term credit facility': 'a committed credit arrangement available for more than one year',
  'funds and long term investments': 'cash resources together with investments intended to be held long term',
  'short-term investments': 'investments expected to be converted to cash within one year',
  'short-term capital movements': 'cross-border flows of short-term capital and liquid investments',
  'stabilizing short-term capital movement': 'policy or market action aimed at calming short-term capital flows',
}

const VERB_GLOSS = {
  persist: 'to continue firmly despite difficulty or opposition',
  allot: 'to distribute or assign a share of something',
  encumber: 'to burden an asset with a claim, charge, or restriction',
  amortise: 'to write off a cost gradually over a period',
  amortize: 'to write off a cost gradually over a period',
  hedge: 'to reduce risk by taking an offsetting position',
  invoice: 'to send a bill requesting payment for goods or services',
  audit: 'to examine accounts or records independently',
  budget: 'to plan how money will be spent',
  forecast: 'to estimate a future value or outcome',
  settle: 'to pay or conclude a transaction or dispute',
  refinance: 'to replace existing debt with new borrowing',
  underwrite: 'to accept risk or guarantee the sale of securities',
}

function composeDefinition(expression, partOfSpeech, listSlug) {
  const raw = expression.trim()
  const lower = raw.toLocaleLowerCase('en-US')
  if (PHRASE_GLOSS[lower]) return PHRASE_GLOSS[lower]
  if (VERB_GLOSS[lower]) return VERB_GLOSS[lower]

  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[parts.length - 1]
    const mod = parts.slice(0, -1).join(' ')
    const maker = HEAD_GLOSS[head]
    if (maker) {
      let gloss = maker(mod)
      gloss = gloss.replace(/\bwar war\b/g, 'war')
      if (head === 'war' && parts.length === 2) {
        return `intense competition in which rivals repeatedly cut ${parts[0]}s to win customers`
      }
      return gloss
    }
    return `${withArticle(raw)} in ${listSlug} practice`
  }

  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return `to ${lower}, especially in ${listSlug} situations`
  }
  if (/\badj/.test(pos)) return `describing something as ${lower} in ${listSlug} contexts`
  return `${withArticle(raw)} in ${listSlug} practice`
}

function pickCols(candidates, expression, partOfSpeech) {
  const out = []
  for (const candidate of candidates) {
    if (isFakeCol(candidate, expression, partOfSpeech)) continue
    if (!candidate.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(candidate)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`learn ${expression}`, `use ${expression} correctly`)
  return unique(out).filter((c) => !isFakeCol(c, expression, partOfSpeech)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, listSlug, subcategory) {
  const x = expression
  const ax = withArticle(expression)
  const lower = x.toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x) || /^(can|could|how|what|i |we )\b/i.test(x)) {
    return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  }
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return pickCols([`${x} carefully`, `decide whether to ${x}`, `need to ${x}`], x, partOfSpeech)
  }
  const head = lower.split(/\s+/).pop()
  let pool = []
  if (HEAD_GLOSS[head] || /cost|price|rate|ratio|budget|capital|fund/.test(head)) {
    pool = [`calculate the ${x}`, `review the ${x}`, `compare the ${x}`]
  } else if (/policy|statement|report|invoice|contract|order|list/.test(head)) {
    pool = [`prepare the ${x}`, `issue the ${x}`, `check the ${x}`]
  } else if (listSlug === 'accounting') pool = [`record the ${x}`, `disclose the ${x}`, `review the ${x}`]
  else if (listSlug === 'finance') pool = [`analyse the ${x}`, `monitor the ${x}`, `hedge the ${x}`]
  else if (listSlug === 'business') pool = [`confirm the ${x}`, `negotiate the ${x}`, `follow up on the ${x}`]
  else pool = [`check the ${x}`, `ask about the ${x}`, `use the ${x}`]
  if (subcategory === 'audit') pool = [`test the ${x}`, `document the ${x}`, ...pool]
  if (subcategory === 'payment') pool = [`process the ${x}`, `schedule the ${x}`, ...pool]
  return pickCols([...pool, `discuss ${ax}`], x, partOfSpeech)
}

function buildExamples(expression, zhGloss, listSlug, subcategory, id, partOfSpeech) {
  const x = expression
  const zh = zhGloss
  const ax = withArticle(expression)
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x)) {
    return [
      { en: `In that situation I’d say, “${x}”.`, zh: `那种情况下我会说：「${zh}」。` },
      { en: `I rehearsed “${x}” before the meeting.`, zh: `开会前我练习了「${zh}」。` },
    ]
  }
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return [
      { en: `We decided to ${x} despite the delay.`, zh: `尽管有延误，我们仍决定「${zh}」。` },
      { en: `Managers asked the team not to ${x} without approval.`, zh: `经理要求团队未经批准不要「${zh}」。` },
    ]
  }
  if (/war$/i.test(x)) {
    return [
      { en: `Retailers entered a ${x} before the holiday season.`, zh: `假日季前零售商陷入了「${zh}」。` },
      { en: `A prolonged ${x} can destroy industry margins.`, zh: `长期「${zh}」会毁掉行业利润率。` },
    ]
  }
  const head = x.toLocaleLowerCase('en-US').split(/\s+/).pop()
  const byHead = {
    cost: [
      { en: `We underestimated the ${x} in the project budget.`, zh: `我们在项目预算里低估了「${zh}」。` },
      { en: `Please send a breakdown of the ${x}.`, zh: `请把「${zh}」的明细发来。` },
    ],
    price: [
      { en: `The supplier revised the ${x} after the cost increase.`, zh: `成本上升后，供应商调整了「${zh}」。` },
      { en: `Can you lock the ${x} for thirty days?`, zh: `「${zh}」可以锁定三十天吗？` },
    ],
    rate: [
      { en: `A small change in the ${x} affects the whole model.`, zh: `「${zh}」的小幅变动会影响整个模型。` },
      { en: `We compared last year’s ${x} with this quarter.`, zh: `我们把去年的「${zh}」与本季度做了对比。` },
    ],
    budget: [
      { en: `The team must stay within the ${x}.`, zh: `团队必须控制在「${zh}」以内。` },
      { en: `Finance approved an increase to the ${x}.`, zh: `财务批准上调「${zh}」。` },
    ],
    account: [
      { en: `Please reconcile the ${x} before month end.`, zh: `请在月末前核对「${zh}」。` },
      { en: `The ${x} still shows an unexplained difference.`, zh: `「${zh}」仍有无法解释的差额。` },
    ],
    payment: [
      { en: `We scheduled the ${x} for Friday.`, zh: `我们把「${zh}」安排在周五。` },
      { en: `The supplier chased the overdue ${x}.`, zh: `供应商催收逾期的「${zh}」。` },
    ],
    contract: [
      { en: `Legal reviewed the ${x} before signature.`, zh: `法务在签署前审阅了「${zh}」。` },
      { en: `The ${x} expires at the end of the year.`, zh: `「${zh}」将于年底到期。` },
    ],
    card: [
      { en: `I paid with my ${x} at the counter.`, zh: `我在柜台用「${zh}」付款。` },
      { en: `Keep the ${x} details private.`, zh: `请妥善保管「${zh}」信息。` },
    ],
  }

  const domainPools = {
    accounting: [
      { en: `The ledger entry captures the ${x} for this period.`, zh: `分类账分录记录了本期的「${zh}」。` },
      { en: `Students practised calculating ${ax} in the tutorial.`, zh: `辅导课上学生们练习计算「${zh}」。` },
      { en: `Notes explain how the entity presents the ${x}.`, zh: `附注说明实体如何列报「${zh}」。` },
    ],
    finance: [
      { en: `The investment committee asked about the ${x}.`, zh: `投资委员会询问了「${zh}」。` },
      { en: `Our valuation is sensitive to the ${x}.`, zh: `我们的估值对「${zh}」很敏感。` },
      { en: `Treasury monitors the ${x} every morning.`, zh: `资金部每天早上监控「${zh}」。` },
    ],
    business: [
      { en: `Before we sign, let’s confirm the ${x} in writing.`, zh: `签字前，我们书面确认「${zh}」。` },
      { en: `The buyer negotiated a better ${x}.`, zh: `买方谈成了更好的「${zh}」。` },
      { en: `Ops put the ${x} on this week’s checklist.`, zh: `运营把「${zh}」放进本周清单。` },
    ],
    daily: [
      { en: `I sorted out the ${x} at the campus counter.`, zh: `我在校园柜台办好了「${zh}」。` },
      { en: `Could you help me with the ${x}?`, zh: `你能帮我处理一下「${zh}」吗？` },
      { en: `The portal shows the latest ${x}.`, zh: `门户上显示了最新的「${zh}」。` },
    ],
  }

  const specific = byHead[head]
  const general = domainPools[listSlug] || domainPools.daily
  const pool = specific ? [...specific, ...general] : general
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

function primaryMeta(wordId, memberships) {
  const items = memberships.filter((item) => item.wordId === wordId)
  const lists = items.map((item) => LIST_SLUG[item.listId]).filter(Boolean)
  let list = 'daily'
  if (lists.includes('accounting')) list = 'accounting'
  else if (lists.includes('finance')) list = 'finance'
  else if (lists.includes('business')) list = 'business'
  else if (lists[0]) list = lists[0]
  const subcategory = items.find((item) => LIST_SLUG[item.listId] === list)?.subcategory || items[0]?.subcategory || ''
  return { list, subcategory }
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let defsUpgraded = 0
let examplesUpgraded = 0
let colsUpgraded = 0

for (const word of pack.words) {
  const { list, subcategory } = primaryMeta(word.id, pack.memberships)
  const isV1 = String(word.id).startsWith('v1-')

  if (!isV1 && isWeakDefinition(word.enDefinition, word.expression)) {
    word.enDefinition = composeDefinition(word.expression, word.partOfSpeech, list)
    if (isWeakDefinition(word.enDefinition, word.expression)) {
      word.enDefinition = `${withArticle(word.expression)} in ${list} practice`
    }
    defsUpgraded += 1
  }

  const needsExamples =
    !isV1 &&
    (!Array.isArray(word.examples) ||
      word.examples.length < 2 ||
      word.examples.some(
        (item) =>
          isBankExample(item.en) ||
          /confirm the persist|confirm the price war|let’s confirm the persist/i.test(item.en),
      ))
  if (needsExamples) {
    word.examples = buildExamples(word.expression, word.zhGloss, list, subcategory, word.id, word.partOfSpeech)
    examplesUpgraded += 1
  }

  const needsCols =
    !isV1 &&
    (!Array.isArray(word.collocations) ||
      word.collocations.length < 2 ||
      word.collocations.filter((col) => !isFakeCol(col, word.expression, word.partOfSpeech)).length < 2)
  if (needsCols) {
    word.collocations = buildCollocations(word.expression, word.partOfSpeech, list, subcategory)
    colsUpgraded += 1
  }

  word.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const reportDir = join(root, 'data/vocabulary-packs/_export')
mkdirSync(reportDir, { recursive: true })
const stillWeak = pack.words.filter((w) => !String(w.id).startsWith('v1-') && isWeakDefinition(w.enDefinition, w.expression))
writeFileSync(
  join(reportDir, 'v52-quality-upgrade-report.json'),
  `${JSON.stringify({
    packPath,
    defsUpgraded,
    examplesUpgraded,
    colsUpgraded,
    stillWeak: stillWeak.length,
    stillWeakSample: stillWeak.slice(0, 20).map((w) => ({ id: w.id, e: w.expression, d: w.enDefinition })),
  }, null, 2)}\n`,
)

console.log(JSON.stringify({
  packPath,
  words: pack.words.length,
  defsUpgraded,
  examplesUpgraded,
  colsUpgraded,
  stillWeak: stillWeak.length,
}, null, 2))
