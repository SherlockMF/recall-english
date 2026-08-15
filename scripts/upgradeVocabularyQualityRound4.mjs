/**
 * Round-4 quality upgrade on trusted_v5_2 pack.
 * Focus: kill tautological "… relating to …" compositions, fix awkward adj/abstract cols.
 *
 * Run: node scripts/upgradeVocabularyQualityRound4.mjs && npm run seed:pack && npm run seed:quality
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
    /\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment|costs|expenses|securities|bonds|prices|accounts|receivables|receipts|supplies|revenues|documents|contracts|stocks|companies|quotas|schedules|interests|inventories|banks|accountants|averages|rates|credits|studies|relations|statements)\b/i.test(
      text,
    )
  ) {
    return ''
  }
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series|plus|class|business)$/i.test(text)) return ''
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

function isDictionaryRelating(def) {
  const d = String(def || '')
  if (/^of or relating to/i.test(d)) return true
  if (/\(law\)/i.test(d)) return true
  if (/property resulting from being or relating to/i.test(d)) return true
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
  if (/a measured level or proportion relating to/i.test(d)) return true
  if (/practice relating to /i.test(d)) return true
  if (/ relating to /i.test(d) && !isDictionaryRelating(d)) return true
  if (/relating to its listed sense/i.test(d)) return true
  return false
}

function isSoftBankExample(en) {
  return /Before we sign, let’s confirm the|Ops put the .+ on this week|We closed the week by settling the|The client asked for clarity on the|Ops follows up on the|We put “.+” on Thursday’s agenda|on Thursday’s agenda/i.test(
    String(en || ''),
  )
}

function isGenericColSet(cols, expression, partOfSpeech) {
  const list = Array.isArray(cols) ? cols : []
  if (list.length < 2) return true
  if (list.some((col) => /^a [aeiou]/i.test(col))) return true
  if (/\badjective\b/i.test(partOfSpeech || '') || isLikelyAdjective(expression)) {
    const ok = list.some((col) =>
      new RegExp(`^(an?|more|remain|sound|clearly) .*${expression.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i').test(col),
    )
    return !ok || list.some((col) => /^(pilot|scale|retire|prepare|bring|file|scope|own) (a |an |the )/i.test(col))
  }
  return (
    list.filter((col) =>
      /^(confirm|negotiate|follow up on|review|record|explain|analyse|monitor|report|check|ask about|use|discuss|finalise|track|update|request|classify|measure|study|apply|pilot|scale|retire|look up|note|prepare|bring|file) (a |an |the )/i.test(
        col,
      ),
    ).length >= 2
  )
}

function isLikelyAdjective(expression) {
  const e = String(expression || '').trim()
  if (/\s/.test(e)) return false
  return /(?:al|ic|ive|ous|ful|less|ary|ory|ing)$/i.test(e) && e.length > 4
}

const PHRASE = {
  'delivery ex-warehouse': 'delivery of goods from the seller’s warehouse',
  'standard cost clearing': 'clearing or settlement of variances against standard cost',
  'departmental manufacturing overhead rate': 'the overhead absorption rate for a manufacturing department',
  'revenue and expense summary': 'a summary account of revenues and expenses',
  'revenue sharing': 'an arrangement to share revenue among parties',
  'general management development': 'training and development for general managers',
  'restructuring contract area interests': 'reorganisation of interests in a contract area',
  'bidding group': 'a group formed to submit a joint bid',
  'bidding advertisement': 'an advertisement inviting bids',
  'bid invitation': 'an invitation to submit a bid',
  'reserve for sales discounts': 'a reserve set aside for expected sales discounts',
  'global import quotas': 'import quotas applied on a worldwide basis',
  'reproduction cost new': 'the cost of reproducing an asset as if new',
  'selected bidding': 'bidding limited to invited or selected bidders',
  'sales on monthly installment': 'sales paid for in monthly installments',
  'sales talk': 'persuasive talk used to promote a sale',
  'benefit-to-cost relationship': 'the relationship between benefits and costs',
  'equity joint-venture': 'a joint venture in which partners contribute equity capital',
  'equity participation': 'ownership participation through an equity stake',
  'equity annuity': 'an annuity linked to equity assets or returns',
  'access to markets': 'the ability to enter or sell into markets',
  'absolute order to pay': 'an unconditional order requiring payment',
  'warehouse man': 'a person who manages or works in a warehouse',
  'warehouse keeper': 'a person responsible for keeping a warehouse',
  'factory cost responsibility summary': 'a summary of factory costs by responsibility centre',
  'strong stockholder': 'a stockholder with a large or controlling holding',
  'supply price schedules': 'schedules listing supply prices',
  'trade restriction': 'a restriction on trade flows or commercial activity',
  'trade reference': 'a reference about a firm’s trade creditworthiness',
  'trade practice': 'an established commercial practice',
  'trade by commodities': 'trade classified or conducted by commodity',
  'trade fair': 'an exhibition where firms display and promote goods',
  'trade deficit': 'an excess of imports over exports',
  'allocable profit oil': 'profit oil that can be allocated among parties',
  'export prepayment': 'payment received in advance for export goods',
  'export-oriented industry': 'an industry organised mainly for export markets',
  'tendering ring': 'a group that colludes on tenders',
  'tender invitation': 'an invitation to tender',
  'export bounty': 'a subsidy or bounty paid on exports',
  'inter-transfer of budget items': 'transfer of amounts between budget items',
}

const HEAD = {
  rate: (m) => `the rate applied to ${m}`,
  rates: (m) => `rates applied to ${m}`,
  prices: (m) => `prices charged for ${m}`,
  price: (m) => `the price charged for ${m}`,
  accountants: (m) => `accountants specialising in ${m}`,
  accountant: (m) => `an accountant specialising in ${m}`,
  delivery: (m) => `delivery under ${m} terms`,
  surplus: (m) => `a surplus of ${m}`,
  banks: (m) => `banks engaged in ${m}`,
  bank: (m) => `a bank engaged in ${m}`,
  receivables: (m) => `receivables arising from ${m}`,
  inventories: (m) => `inventories of ${m}`,
  interests: (m) => `interests in ${m}`,
  items: (m) => `items of ${m}`,
  budgeting: (m) => `budgeting for ${m}`,
  earned: (m) => `${m} that has been earned`,
  wholesaler: (m) => `a wholesaler of ${m}`,
  transactions: (m) => `transactions involving ${m}`,
  retirement: (m) => `retirement of ${m}`,
  godown: (m) => `a godown for ${m}`,
  form: (m) => `a form used for ${m}`,
  averages: (m) => `averages of ${m}`,
  issued: (m) => `${m} that has been issued`,
  power: (m) => `power over ${m}`,
  investor: (m) => `an investor in ${m}`,
  clearing: (m) => `clearing of ${m}`,
  summary: (m) => `a summary of ${m}`,
  sharing: (m) => `sharing of ${m}`,
  group: (m) => `a group formed for ${m}`,
  invitation: (m) => `an invitation to ${m}`,
  advertisement: (m) => `an advertisement for ${m}`,
  bidding: (m) => `bidding conducted as ${m}`,
  relationship: (m) => `the relationship between parties regarding ${m}`,
  annuity: (m) => `an annuity linked to ${m}`,
  keeper: (m) => `a keeper of ${m}`,
  man: (m) => `a person who works with ${m}`,
  reference: (m) => `a reference concerning ${m}`,
  practice: (m) => `an established practice in ${m}`,
  industry: (m) => `an industry focused on ${m}`,
  concern: (m) => `a business concern in ${m}`,
  sector: (m) => `the sector of ${m}`,
  collection: (m) => `collection of ${m}`,
  consignment: (m) => `a consignment of ${m}`,
  statements: (m) => `statements of ${m}`,
  consolidation: (m) => `consolidation of ${m}`,
  taking: (m) => `taking of ${m}`,
  law: (m) => `law governing ${m}`,
  contracts: (m) => `contracts for ${m}`,
  enterprises: (m) => `enterprises engaged in ${m}`,
  credits: (m) => `credits related to ${m}`,
  studies: (m) => `studies of ${m}`,
  factor: (m) => `a factor affecting ${m}`,
  gap: (m) => `a gap in ${m}`,
  subsidiary: (m) => `a subsidiary for ${m}`,
  store: (m) => `a store of ${m}`,
  transit: (m) => `transit of ${m}`,
  position: (m) => `a position in ${m}`,
  recognition: (m) => `recognition of ${m}`,
  range: (m) => `a range of ${m}`,
  sample: (m) => `a sample of ${m}`,
  relations: (m) => `relations concerning ${m}`,
  review: (m) => `a review of ${m}`,
  final: (m) => `the final stage of ${m}`,
  unit: (m) => `a unit of ${m}`,
  notice: (m) => `a notice concerning ${m}`,
  talk: (m) => `talk used for ${m}`,
  fair: (m) => `a fair featuring ${m}`,
  deficit: (m) => `a deficit in ${m}`,
  oil: (m) => `oil allocated as ${m}`,
  prepayment: (m) => `prepayment for ${m}`,
  ring: (m) => `a ring formed for ${m}`,
  bounty: (m) => `a bounty paid for ${m}`,
  quotas: (m) => `quotas on ${m}`,
  quota: (m) => `a quota on ${m}`,
  schedules: (m) => `schedules of ${m}`,
  schedule: (m) => `a schedule of ${m}`,
  restriction: (m) => `a restriction on ${m}`,
  participation: (m) => `participation in ${m}`,
  development: (m) => `development of ${m}`,
  overhead: (m) => `overhead for ${m}`,
  installment: (m) => `an installment plan for ${m}`,
  discounts: (m) => `discounts on ${m}`,
  discount: (m) => `a discount on ${m}`,
  new: (m) => `${m} measured on a new-asset basis`,
  stockholder: (m) => `a stockholder with ${m} influence`,
  venture: (m) => `a venture structured as ${m}`,
  markets: (m) => `markets for ${m}`,
  pay: (m) => `an obligation to pay under ${m}`,
  cost: (m) => `costs attributable to ${m}`,
  costs: (m) => `costs attributable to ${m}`,
  revenue: (m) => `revenue from ${m}`,
  expense: (m) => `expense related to ${m}`,
  equity: (m) => `equity related to ${m}`,
  trade: (m) => `trade in ${m}`,
  export: (m) => `export activity for ${m}`,
  import: (m) => `import activity for ${m}`,
  warehouse: (m) => `a warehouse for ${m}`,
  management: (m) => `management of ${m}`,
  contract: (m) => `a contract for ${m}`,
  area: (m) => `an area for ${m}`,
  account: (m) => `an account for ${m}`,
  accounts: (m) => `accounts for ${m}`,
  capital: (m) => `capital related to ${m}`,
  fund: (m) => `a fund for ${m}`,
  funds: (m) => `funds for ${m}`,
  loan: (m) => `a loan for ${m}`,
  credit: (m) => `credit related to ${m}`,
  deposit: (m) => `a deposit for ${m}`,
  payment: (m) => `payment for ${m}`,
  market: (m) => `a market for ${m}`,
  order: (m) => `an order for ${m}`,
  bill: (m) => `a bill for ${m}`,
  tax: (m) => `tax on ${m}`,
  value: (m) => `the value of ${m}`,
  analysis: (m) => `an analysis of ${m}`,
  report: (m) => `a report on ${m}`,
  statement: (m) => `a statement of ${m}`,
  invoice: (m) => `an invoice for ${m}`,
  margin: (m) => `the margin on ${m}`,
  reserve: (m) => `a reserve for ${m}`,
  provision: (m) => `a provision for ${m}`,
  inventory: (m) => `inventory of ${m}`,
  asset: (m) => `an asset used for ${m}`,
  assets: (m) => `assets used for ${m}`,
  liability: (m) => `a liability from ${m}`,
  liabilities: (m) => `liabilities from ${m}`,
  interest: (m) => `interest on ${m}`,
  return: (m) => `return on ${m}`,
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
  budget: (m) => `a budget for ${m}`,
  system: (m) => `a system for ${m}`,
  method: (m) => `a method for ${m}`,
  process: (m) => `a process for ${m}`,
  product: (m) => `a product of ${m}`,
  goods: (m) => `goods related to ${m}`,
  service: (m) => `a service for ${m}`,
  services: (m) => `services for ${m}`,
  production: (m) => `production of ${m}`,
  manufacturing: (m) => `manufacturing of ${m}`,
  risk: (m) => `risk related to ${m}`,
  audit: (m) => `an audit of ${m}`,
  control: (m) => `control over ${m}`,
  disclosure: (m) => `disclosure of ${m}`,
  measurement: (m) => `measurement of ${m}`,
  impairment: (m) => `impairment of ${m}`,
  depreciation: (m) => `depreciation of ${m}`,
  receivable: (m) => `a receivable from ${m}`,
  payable: (m) => `a payable for ${m}`,
  ledger: (m) => `a ledger for ${m}`,
  entry: (m) => `an entry for ${m}`,
  amount: (m) => `an amount of ${m}`,
  total: (m) => `the total of ${m}`,
  average: (m) => `the average of ${m}`,
  percentage: (m) => `the percentage of ${m}`,
  agent: (m) => `an agent who deals with ${m}`,
  agency: (m) => `an agency that handles ${m}`,
  channel: (m) => `a channel for ${m}`,
  scheme: (m) => `a scheme for ${m}`,
  graph: (m) => `a graph showing ${m}`,
  card: (m) => `a card used for ${m}`,
}

function composeStructural(lower) {
  if (PHRASE[lower]) return PHRASE[lower]

  let m = lower.match(/^reserve for (.+)$/)
  if (m) return `a reserve set aside for ${m[1]}`

  m = lower.match(/^access to (.+)$/)
  if (m) return `the ability to enter or use ${m[1]}`

  m = lower.match(/^(.+) on (.+)$/)
  if (m && /^(sales|purchase|payment|return)$/.test(m[1])) {
    return `${m[1]} arranged on ${m[2]} terms`
  }

  m = lower.match(/^delivery ex-(.+)$/)
  if (m) return `delivery of goods from the ${m[1]}`

  m = lower.match(/^order to (.+)$/)
  if (m) return `an order requiring someone to ${m[1]}`

  m = lower.match(/^(.+) order to (.+)$/)
  if (m) return `an ${m[1]} order requiring someone to ${m[2]}`

  m = lower.match(/^(.+) of (.+)$/)
  if (m) {
    const left = m[1]
    const right = m[2]
    if (left === 'cost' || left.endsWith(' cost')) return `the cost associated with ${right}`
    if (left === 'value') return `the value attributed to ${right}`
    if (left === 'control') return `control over ${right}`
    if (left === 'summary') return `a summary of ${right}`
    if (left === 'sharing') return `sharing of ${right}`
    if (left === 'transfer' || left.endsWith(' transfer') || left.includes('transfer')) {
      return `a transfer of ${right}`
    }
    if (left === 'collection') return `collection of ${right}`
    if (left === 'analysis') return `an analysis of ${right}`
    return `${left} of ${right}`
  }

  return ''
}

function composeDefinition(expression, partOfSpeech) {
  const raw = expression.trim()
  const lower = raw.toLocaleLowerCase('en-US')
  if (PHRASE[lower]) return PHRASE[lower]

  const structural = composeStructural(lower)
  if (structural) return structural

  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[parts.length - 1]
    const mod = parts.slice(0, -1).join(' ')
    if (HEAD[head]) return HEAD[head](mod)
    // Prefer meaningful paraphrase over tautology
    if (/er$|or$|ee$|ant$|ist$/.test(head)) return `a person or party involved in ${mod}`
    if (/ing$/.test(head)) return `the activity of ${head} in the context of ${mod}`
    if (/tion$|sion$|ment$|ance$|ence$/.test(head)) return `${withArticle(head)} connected with ${mod}`
    return `${withArticle(raw)} in commercial or accounting use`
  }

  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) return `to ${lower}`
  if (/\badj/.test(pos) || isLikelyAdjective(raw)) return `describing something as ${lower}`
  if (/\bpronoun\b/.test(pos)) return `a pronoun meaning ${lower}`
  return `${withArticle(raw)} in commercial or accounting use`
}

function pickCols(cands, expression, pos) {
  const out = []
  for (const c of cands) {
    if (isFakeCol(c, expression, pos)) continue
    if (!c.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(c)
    if (out.length >= 3) break
  }
  while (out.length < 2) {
    out.push(`clarify “${expression}”`, `use “${expression}” precisely`)
  }
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
  if (/\badj/.test(pos) || isLikelyAdjective(x)) {
    const art = /^[aeiou]/i.test(x) ? 'an' : 'a'
    return pickCols(
      [`${art} ${x} decision`, `remain ${x}`, `sound ${x}`, `clearly ${x}`, `more ${x} than expected`],
      x,
      partOfSpeech,
    )
  }
  const head = lower.split(/\s+/).pop()
  const pools = {
    rate: [`set the ${x}`, `apply the ${x}`, `revise the ${x}`],
    rates: [`compare the ${x}`, `publish the ${x}`, `adjust the ${x}`],
    prices: [`quote the ${x}`, `benchmark the ${x}`, `cut the ${x}`],
    cost: [`estimate the ${x}`, `allocate the ${x}`, `cut the ${x}`],
    summary: [`prepare the ${x}`, `review the ${x}`, `circulate the ${x}`],
    invitation: [`issue the ${x}`, `respond to the ${x}`, `withdraw the ${x}`],
    deficit: [`narrow the ${x}`, `finance the ${x}`, `report the ${x}`],
    warehouse: [`inspect the ${x}`, `stock the ${x}`, `clear goods through the ${x}`],
    contract: [`draft the ${x}`, `sign the ${x}`, `enforce the ${x}`],
    investor: [`attract ${withArticle(x)}`, `brief the ${x}`, `report to the ${x}`],
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
        [`benchmark the ${x}`, `escalate the ${x}`, `close out the ${x}`],
        [`brief the team on the ${x}`, `agree the ${x}`, `document the ${x}`],
      ],
      daily: [
        [`look up “${x}”`, `note “${x}”`, `double-check “${x}”`],
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
  if (/\badj/.test(pos) || isLikelyAdjective(x)) {
    return [
      { en: `The board wanted a more ${x} approach.`, zh: `董事会希望采取更「${zh}」的做法。` },
      { en: `Keep the wording clearly ${x}.`, zh: `措辞要明确体现「${zh}」。` },
    ]
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
  const pool = pools[listSlug] || pools.daily
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
    word.enDefinition = composeDefinition(word.expression, word.partOfSpeech)
    if (isWeakDefinition(word.enDefinition)) {
      word.enDefinition = `${withArticle(word.expression)} in commercial or accounting use`
    }
    defs += 1
  }

  const adjLike = /\badj/.test(String(word.partOfSpeech || '')) || isLikelyAdjective(word.expression)
  const adjExampleBroken =
    adjLike &&
    (word.examples || []).some((ex) =>
      new RegExp(`\\bthe ${word.expression.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i').test(ex.en || ''),
    )

  if (
    !Array.isArray(word.examples) ||
    word.examples.length < 2 ||
    word.examples.some((ex) => isSoftBankExample(ex.en)) ||
    adjExampleBroken
  ) {
    word.examples = buildExamples(word.expression, word.zhGloss, list, word.id, word.partOfSpeech)
    examples += 1
  }

  if (isGenericColSet(word.collocations, word.expression, word.partOfSpeech) || (word.collocations || []).length < 2) {
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
const relatingLeft = pack.words.filter(
  (w) =>
    !w.id.startsWith('v1-') &&
    / relating to /i.test(w.enDefinition || '') &&
    !isDictionaryRelating(w.enDefinition),
)
mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round4-report.json'),
  `${JSON.stringify(
    {
      defs,
      examples,
      cols,
      stillWeak: stillWeak.length,
      softLeft: softLeft.length,
      relatingLeft: relatingLeft.length,
      sampleWeak: stillWeak.slice(0, 20).map((w) => ({ e: w.expression, d: w.enDefinition })),
      sampleRelating: relatingLeft.slice(0, 15).map((w) => ({ e: w.expression, d: w.enDefinition })),
    },
    null,
    2,
  )}\n`,
)

console.log(
  JSON.stringify(
    { defs, examples, cols, stillWeak: stillWeak.length, softLeft: softLeft.length, relatingLeft: relatingLeft.length },
    null,
    2,
  ),
)
