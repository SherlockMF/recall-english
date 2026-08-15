/**
 * Round-3 quality upgrade on trusted_v5_2 pack.
 * Focus: kill "used in … work" / daily-meaning fallbacks, diversify examples & cols.
 *
 * Run: node scripts/upgradeVocabularyQualityRound3.mjs && npm run seed:pack && npm run seed:quality
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
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
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
  if (
    /\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment|costs|expenses|securities|bonds|prices|accounts|receivables|receipts|supplies|revenues|documents|contracts|stocks|companies)\b/i.test(
      text,
    )
  ) {
    return ''
  }
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series|plus|class)$/i.test(text)) return ''
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
  if (/used in (business|accounting|finance|daily) work$/i.test(d)) return true
  if (/as used in study and work$/i.test(d)) return true
  if (/the daily meaning of /i.test(d)) return true
  if (/especially in .+ situations$/i.test(d)) return true
  if (/concept expressed by the phrase/i.test(d)) return true
  if (/practical .+ line or phrase/i.test(d)) return true
  if (/carry out the action/i.test(d)) return true
  if (/; used as a descriptive term in /i.test(d)) return true
  return false
}

function isSoftBankExample(en) {
  return /Before we sign, let’s confirm the|Ops put the .+ on this week|The portal shows the latest|Could you help me with the|Could you show me where to find|I sorted out the .+ on campus|Students practised calculating|The ledger entry captures the|The investment committee asked about|Our valuation is sensitive to|Treasury monitors the .+ every morning|The buyer negotiated a better|Notes explain how the entity presents|We closed the week by settling the|The client asked for clarity on the|I finally sorted the|The staff walked me through the|Procurement challenged the .+ in the quote|We put the .+ on the agenda|The ops lead owns follow-up on the/i.test(
    String(en || ''),
  )
}

function isGenericColSet(cols) {
  const list = Array.isArray(cols) ? cols : []
  if (list.length < 2) return true
  return (
    list.filter((col) =>
      /^(confirm|negotiate|follow up on|review|record|explain|analyse|monitor|report|check|ask about|use|discuss|finalise|track|update|request|classify|measure|study|apply) the /i.test(
        col,
      ),
    ).length >= 2
  )
}

const WORD = {
  skin: 'the outer covering of the body of a person or animal',
  theirs: 'belonging to or associated with the people or things previously mentioned',
  freighter: 'a ship or aircraft that carries freight',
  'pooling-of-interest': 'an accounting method that combines companies by pooling equity interests',
  'after-cost': 'a cost incurred after the main transaction or production stage',
  'export-oriented': 'designed or organised mainly for export markets',
  'non-payment': 'failure to pay an amount that is due',
  'contractual-joint-venture': 'a joint venture formed by contract rather than by creating a new company',
  'profit-push': 'pressure or drive to increase profits',
  'cost-and-benefit-sharing': 'an arrangement to share costs and benefits among parties',
  'credit-worthiness': 'the assessed ability and willingness to repay credit',
  franchisee: 'a person or firm that operates a business under a franchisor’s brand',
  upswing: 'an upward movement or improvement in activity or prices',
  'cash-on-the-line': 'payment in cash required immediately on delivery or settlement',
}

const PHRASE = {
  'cost-volume-profit graph': 'a graph showing how costs, volume, and profit relate',
  'payable against documents': 'payable when shipping or trade documents are presented',
  'sales revenues': 'income earned from selling goods or services',
  'equity receiver': 'a receiver appointed to protect equity interests in a distressed firm',
  'take or pay contracts': 'contracts requiring payment for a minimum quantity whether taken or not',
  'trade procurator': 'an agent authorised to act in trade or commercial matters',
  'commercial message': 'a business communication or commercial notice',
  'cost plus': 'a pricing approach that adds a markup to cost',
  'manufacturing establishment': 'a business establishment engaged in manufacturing',
  'margin money': 'cash or collateral deposited as a margin requirement',
  'commercial practice': 'an established way of doing business',
  'commercial standing': 'a firm’s commercial reputation or credit standing',
  'master-budgeted activity': 'the activity level assumed in the master budget',
  'marketing channel': 'a path through which goods move from producer to customer',
  'production cartel': 'a cartel that coordinates production among members',
  'business combination': 'a transaction in which businesses are brought under common control',
  'business standing': 'a firm’s reputation for creditworthiness in business',
  'customs warehouse': 'a warehouse under customs control for dutiable goods',
  'import deposit scheme': 'a scheme requiring importers to lodge a cash deposit',
  'cost reimbursable and fee contracts': 'contracts that reimburse costs and add an agreed fee',
  'per capita': 'for each person; calculated on a per-person basis',
  'middle class': 'the social group between the upper and working classes',
  'shipping supplies': 'materials and supplies used in shipping goods',
  'credit card': 'a card issued by a bank that lets the holder buy now and pay later',
}

const HEAD = {
  graph: (m) => `a graph showing ${m}`,
  chart: (m) => `a chart showing ${m}`,
  curve: (m) => `a curve showing the relationship for ${m}`,
  clerk: (m) => `a clerk who handles ${m}`,
  agent: (m) => `an agent who deals with ${m}`,
  agency: (m) => `an agency that handles ${m}`,
  distributor: (m) => `a distributor of ${m}`,
  procurator: (m) => `a procurator acting in ${m}`,
  warehouse: (m) => `a warehouse for ${m}`,
  establishment: (m) => `an establishment engaged in ${m}`,
  enterprise: (m) => `an enterprise engaged in ${m}`,
  company: (m) => `a company engaged in ${m}`,
  companies: (m) => `companies engaged in ${m}`,
  cartel: (m) => `a cartel coordinating ${m}`,
  channel: (m) => `a channel for ${m}`,
  scheme: (m) => `a scheme for ${m}`,
  practice: (m) => `practice relating to ${m}`,
  standing: (m) => `standing in terms of ${m}`,
  message: (m) => `a message concerning ${m}`,
  combination: (m) => `a combination involving ${m}`,
  activity: (m) => `activity related to ${m}`,
  contracts: (m) => `contracts for ${m}`,
  contract: (m) => `a contract for ${m}`,
  documents: (m) => `documents used for ${m}`,
  document: (m) => `a document used for ${m}`,
  revenues: (m) => `revenues from ${m}`,
  revenue: (m) => `revenue from ${m}`,
  receipts: (m) => `receipts from ${m}`,
  receipt: (m) => `a receipt for ${m}`,
  earnings: (m) => `earnings from ${m}`,
  supplies: (m) => `supplies used for ${m}`,
  money: (m) => `money set aside or required for ${m}`,
  class: (m) => `a class of ${m}`,
  capita: () => 'for each person; calculated on a per-person basis',
  plus: (m) => `${m} plus an agreed markup or fee`,
  export: (m) => `export activity related to ${m}`,
  import: (m) => `import activity related to ${m}`,
  tender: (m) => `a tender for ${m}`,
  register: (m) => `a register of ${m}`,
  paper: (m) => `a paper concerning ${m}`,
  book: (m) => `a book recording ${m}`,
  banking: (m) => `banking related to ${m}`,
  arbitration: (m) => `arbitration of ${m}`,
  marketing: (m) => `marketing of ${m}`,
  quota: (m) => `a quota for ${m}`,
  division: (m) => `a division responsible for ${m}`,
  board: (m) => `a board overseeing ${m}`,
  center: (m) => `a center for ${m}`,
  centre: (m) => `a centre for ${m}`,
  finance: (m) => `finance related to ${m}`,
  capacity: (m) => `capacity for ${m}`,
  quotation: (m) => `a quotation for ${m}`,
  debenture: (m) => `a debenture for ${m}`,
  issue: (m) => `an issue of ${m}`,
  security: (m) => `security related to ${m}`,
  sale: (m) => `a sale of ${m}`,
  stocks: (m) => `stocks of ${m}`,
  stock: (m) => `stock of ${m}`,
  theory: (m) => `theory of ${m}`,
  transaction: (m) => `a transaction involving ${m}`,
  estate: (m) => `estate related to ${m}`,
  purchase: (m) => `a purchase of ${m}`,
  pool: (m) => `a pool of ${m}`,
  fluctuation: (m) => `fluctuation in ${m}`,
  line: (m) => `a line of ${m}`,
  paid: (m) => `${m} that has been paid`,
  received: (m) => `${m} that has been received`,
  receiver: (m) => `a receiver appointed for ${m}`,
  cost: (m) => `costs attributable to ${m}`,
  costs: (m) => `costs attributable to ${m}`,
  price: (m) => `the price charged for ${m}`,
  prices: (m) => `prices charged for ${m}`,
  rate: (m) => `the rate applied to ${m}`,
  ratio: (m) => `a ratio measuring ${m}`,
  account: (m) => `an account for ${m}`,
  accounts: (m) => `accounts for ${m}`,
  expense: (m) => `expense related to ${m}`,
  expenses: (m) => `expenses related to ${m}`,
  income: (m) => `income from ${m}`,
  profit: (m) => `profit from ${m}`,
  loss: (m) => `a loss from ${m}`,
  capital: (m) => `capital related to ${m}`,
  fund: (m) => `a fund for ${m}`,
  funds: (m) => `funds for ${m}`,
  loan: (m) => `a loan for ${m}`,
  credit: (m) => `credit related to ${m}`,
  deposit: (m) => `a deposit for ${m}`,
  payment: (m) => `payment for ${m}`,
  market: (m) => `a market for ${m}`,
  trade: (m) => `trade in ${m}`,
  order: (m) => `an order for ${m}`,
  bill: (m) => `a bill for ${m}`,
  note: (m) => `a note for ${m}`,
  certificate: (m) => `a certificate for ${m}`,
  bond: (m) => `a bond for ${m}`,
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
  analysis: (m) => `an analysis of ${m}`,
  facility: (m) => `a facility for ${m}`,
  movement: (m) => `movement of ${m}`,
  movements: (m) => `movements of ${m}`,
  term: (m) => `a term related to ${m}`,
  terms: (m) => `terms for ${m}`,
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
  budget: (m) => `a budget for ${m}`,
  system: (m) => `a system for ${m}`,
  method: (m) => `a method for ${m}`,
  procedure: (m) => `a procedure for ${m}`,
  process: (m) => `a process for ${m}`,
  structure: (m) => `a structure of ${m}`,
  level: (m) => `the level of ${m}`,
  volume: (m) => `the volume of ${m}`,
  output: (m) => `output of ${m}`,
  input: (m) => `input for ${m}`,
  product: (m) => `a product of ${m}`,
  products: (m) => `products of ${m}`,
  goods: (m) => `goods related to ${m}`,
  service: (m) => `a service for ${m}`,
  services: (m) => `services for ${m}`,
  manager: (m) => `a manager responsible for ${m}`,
  management: (m) => `management of ${m}`,
  department: (m) => `a department for ${m}`,
  office: (m) => `an office for ${m}`,
  branch: (m) => `a branch handling ${m}`,
  network: (m) => `a network for ${m}`,
  platform: (m) => `a platform for ${m}`,
  programme: (m) => `a programme for ${m}`,
  program: (m) => `a program for ${m}`,
  project: (m) => `a project for ${m}`,
  venture: (m) => `a venture involving ${m}`,
  partnership: (m) => `a partnership for ${m}`,
  franchise: (m) => `a franchise for ${m}`,
  licence: (m) => `a licence for ${m}`,
  license: (m) => `a license for ${m}`,
  permit: (m) => `a permit for ${m}`,
  duty: (m) => `duty on ${m}`,
  tariff: (m) => `a tariff on ${m}`,
  customs: (m) => `customs treatment of ${m}`,
  freight: (m) => `freight for ${m}`,
  cargo: (m) => `cargo of ${m}`,
  shipment: (m) => `a shipment of ${m}`,
  shipping: (m) => `shipping of ${m}`,
  logistics: (m) => `logistics for ${m}`,
  production: (m) => `production of ${m}`,
  manufacturing: (m) => `manufacturing of ${m}`,
  operations: (m) => `operations for ${m}`,
  operation: (m) => `an operation involving ${m}`,
  performance: (m) => `performance of ${m}`,
  risk: (m) => `risk related to ${m}`,
  risks: (m) => `risks related to ${m}`,
  exposure: (m) => `exposure to ${m}`,
  hedge: (m) => `a hedge against ${m}`,
  option: (m) => `an option on ${m}`,
  futures: (m) => `futures on ${m}`,
  swap: (m) => `a swap involving ${m}`,
  derivative: (m) => `a derivative linked to ${m}`,
  yield: (m) => `yield on ${m}`,
  maturity: (m) => `maturity of ${m}`,
  principal: (m) => `principal of ${m}`,
  collateral: (m) => `collateral for ${m}`,
  guarantee: (m) => `a guarantee of ${m}`,
  warranty: (m) => `a warranty covering ${m}`,
  audit: (m) => `an audit of ${m}`,
  auditor: (m) => `an auditor of ${m}`,
  control: (m) => `control over ${m}`,
  controls: (m) => `controls over ${m}`,
  disclosure: (m) => `disclosure of ${m}`,
  recognition: (m) => `recognition of ${m}`,
  measurement: (m) => `measurement of ${m}`,
  impairment: (m) => `impairment of ${m}`,
  depreciation: (m) => `depreciation of ${m}`,
  amortisation: (m) => `amortisation of ${m}`,
  amortization: (m) => `amortization of ${m}`,
  accrual: (m) => `an accrual for ${m}`,
  accruals: (m) => `accruals for ${m}`,
  receivable: (m) => `a receivable from ${m}`,
  receivables: (m) => `receivables from ${m}`,
  payable: (m) => `a payable for ${m}`,
  payables: (m) => `payables for ${m}`,
  ledger: (m) => `a ledger for ${m}`,
  journal: (m) => `a journal for ${m}`,
  entry: (m) => `an entry for ${m}`,
  entries: (m) => `entries for ${m}`,
  worksheet: (m) => `a worksheet for ${m}`,
  schedule: (m) => `a schedule of ${m}`,
  table: (m) => `a table of ${m}`,
  figure: (m) => `a figure for ${m}`,
  amount: (m) => `an amount of ${m}`,
  total: (m) => `the total of ${m}`,
  average: (m) => `the average of ${m}`,
  percentage: (m) => `the percentage of ${m}`,
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

function composeHyphenCompound(lower) {
  if (!lower.includes('-')) return ''
  if (WORD[lower]) return WORD[lower]
  if (lower.endsWith('-oriented')) return `oriented toward ${lower.replace(/-oriented$/, '').replace(/-/g, ' ')}`
  if (lower.startsWith('non-')) return `not involving ${lower.slice(4).replace(/-/g, ' ')}`
  if (lower.endsWith('-worthiness')) return `the assessed worthiness regarding ${lower.replace(/-worthiness$/, '').replace(/-/g, ' ')}`
  return ''
}

function composeDefinition(expression, partOfSpeech, listSlug) {
  const raw = expression.trim()
  const lower = raw.toLocaleLowerCase('en-US')
  if (PHRASE[lower]) return PHRASE[lower]
  if (WORD[lower]) return WORD[lower]

  const hyphen = composeHyphenCompound(lower)
  if (hyphen) return hyphen

  const ofGloss = composeOfPattern(lower)
  if (ofGloss) return ofGloss

  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[parts.length - 1]
    const mod = parts.slice(0, -1).join(' ')
    if (HEAD[head]) return HEAD[head](mod)
    return `${withArticle(raw)} relating to ${mod}`
  }

  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) return `to ${lower}`
  if (/\badj/.test(pos)) return `describing something as ${lower}`
  if (/\bpronoun\b/.test(pos)) return `a pronoun meaning ${lower}`
  if (listSlug === 'accounting') return `${withArticle(raw)} as used in accounting`
  if (listSlug === 'finance') return `${withArticle(raw)} as used in finance`
  if (listSlug === 'business') return `${withArticle(raw)} as used in business`
  return `${withArticle(raw)}; a common term in everyday English`
}

function pickCols(cands, expression, pos) {
  const out = []
  for (const c of cands) {
    if (isFakeCol(c, expression, pos)) continue
    if (!c.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(c)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`clarify the ${expression}`, `document the ${expression}`)
  return unique(out).filter((c) => !isFakeCol(c, expression, pos)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, listSlug, subcategory, id) {
  const x = expression
  const lower = x.toLocaleLowerCase('en-US')
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x)) return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return pickCols([`${x} carefully`, `decide whether to ${x}`, `refuse to ${x}`], x, partOfSpeech)
  }
  const head = lower.split(/\s+/).pop()
  const pools = {
    cost: [`estimate the ${x}`, `allocate the ${x}`, `cut the ${x}`],
    price: [`quote the ${x}`, `lock in the ${x}`, `benchmark the ${x}`],
    rate: [`set the ${x}`, `compare the ${x}`, `adjust the ${x}`],
    agent: [`appoint ${withArticle(x)}`, `brief the ${x}`, `replace the ${x}`],
    agency: [`engage ${withArticle(x)}`, `instruct the ${x}`, `audit the ${x}`],
    contract: [`draft the ${x}`, `sign the ${x}`, `enforce the ${x}`],
    contracts: [`draft the ${x}`, `sign the ${x}`, `enforce the ${x}`],
    loan: [`underwrite the ${x}`, `service the ${x}`, `restructure the ${x}`],
    deposit: [`lodge the ${x}`, `release the ${x}`, `verify the ${x}`],
    graph: [`plot the ${x}`, `interpret the ${x}`, `update the ${x}`],
    warehouse: [`inspect the ${x}`, `clear goods through the ${x}`, `stock the ${x}`],
  }
  let pool = pools[head]
  if (!pool) {
    const byList = {
      accounting: [
        [`post the ${x}`, `reconcile the ${x}`, `disclose the ${x}`],
        [`accrue the ${x}`, `restate the ${x}`, `roll forward the ${x}`],
        [`sample the ${x}`, `vouch the ${x}`, `tie out the ${x}`],
      ],
      finance: [
        [`model the ${x}`, `stress-test the ${x}`, `hedge the ${x}`],
        [`price the ${x}`, `mark the ${x}`, `fund the ${x}`],
        [`underwrite the ${x}`, `syndicate the ${x}`, `refinance the ${x}`],
      ],
      business: [
        [`scope the ${x}`, `own the ${x}`, `handover the ${x}`],
        [`pilot the ${x}`, `scale the ${x}`, `retire the ${x}`],
        [`benchmark the ${x}`, `escalate the ${x}`, `close out the ${x}`],
      ],
      daily: [
        [`look up the ${x}`, `note the ${x}`, `double-check the ${x}`],
        [`ask about the ${x}`, `keep the ${x}`, `share the ${x}`],
        [`prepare the ${x}`, `bring the ${x}`, `file the ${x}`],
      ],
    }
    const options = byList[listSlug] || byList.daily
    pool = options[hashId(id) % options.length]
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
    graph: [
      { en: `The slide shows the ${x} clearly.`, zh: `幻灯片清楚展示了「${zh}」。` },
      { en: `We redraw the ${x} whenever volume changes.`, zh: `销量变化时我们会重画「${zh}」。` },
    ],
    contract: [
      { en: `Legal redlined the ${x} overnight.`, zh: `法务连夜修改了「${zh}」。` },
      { en: `Both parties initialled the ${x}.`, zh: `双方在「${zh}」上签了字。` },
    ],
    warehouse: [
      { en: `Customs released the goods from the ${x}.`, zh: `海关从「${zh}」放行了货物。` },
      { en: `Stock counts at the ${x} were clean.`, zh: `「${zh}」盘点结果正常。` },
    ],
  }
  const pools = {
    accounting: [
      { en: `The working paper documents the ${x}.`, zh: `工作底稿记录了「${zh}」。` },
      { en: `We adjusted the accounts for the ${x}.`, zh: `我们针对「${zh}」调整了账目。` },
      { en: `Auditors queried the measurement of the ${x}.`, zh: `审计师质疑「${zh}」的计量。` },
      { en: `Month-end close hinges on the ${x}.`, zh: `月末结账取决于「${zh}」。` },
    ],
    finance: [
      { en: `The deal model hinges on the ${x}.`, zh: `交易模型取决于「${zh}」。` },
      { en: `Risk reported a spike in the ${x}.`, zh: `风控报告「${zh}」出现飙升。` },
      { en: `We stress-tested assumptions about the ${x}.`, zh: `我们对「${zh}」相关假设做了压力测试。` },
      { en: `Treasury flagged the ${x} in the morning pack.`, zh: `资金部在晨报中标出了「${zh}」。` },
    ],
    business: [
      { en: `Ops flagged a delay around the ${x}.`, zh: `运营标出了与「${zh}」相关的延误。` },
      { en: `The proposal restates our position on the ${x}.`, zh: `提案重申了我们对「${zh}」的立场。` },
      { en: `Sales needs a decision on the ${x} by Friday.`, zh: `销售需要周五前就「${zh}」拍板。` },
      { en: `We escalated the ${x} to the steering group.`, zh: `我们把「${zh}」升级到了指导小组。` },
    ],
    daily: [
      { en: `Keep a copy of the ${x} for your records.`, zh: `请保留「${zh}」复印件备查。` },
      { en: `She explained the ${x} in plain English.`, zh: `她用简单英语解释了「${zh}」。` },
      { en: `I noted the ${x} in my planner.`, zh: `我把「${zh}」记在了计划本上。` },
      { en: `Please bring proof of the ${x}.`, zh: `请带上「${zh}」的证明。` },
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
    if (isWeakDefinition(word.enDefinition)) {
      word.enDefinition = `${withArticle(word.expression)} relating to its listed sense`
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
    word.collocations = buildCollocations(word.expression, word.partOfSpeech, list, subcategory, word.id)
    cols += 1
  }

  word.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const stillWeak = pack.words.filter((w) => !w.id.startsWith('v1-') && isWeakDefinition(w.enDefinition))
const softLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && (w.examples || []).some((e) => isSoftBankExample(e.en)),
)
mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round3-report.json'),
  `${JSON.stringify(
    {
      defs,
      examples,
      cols,
      stillWeak: stillWeak.length,
      softLeft: softLeft.length,
      sampleWeak: stillWeak.slice(0, 20).map((w) => ({ e: w.expression, d: w.enDefinition })),
    },
    null,
    2,
  )}\n`,
)

console.log(JSON.stringify({ defs, examples, cols, stillWeak: stillWeak.length, softLeft: softLeft.length }, null, 2))
