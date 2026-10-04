/**
 * Round-7 quality upgrade on trusted_v5_2 pack.
 * Focus: weak bank/cost/of-pattern definitions + diversify general examples.
 *
 * Run: node scripts/upgradeVocabularyQualityRound7.mjs && npm run seed:pack && npm run seed:quality
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
    /\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment|costs|expenses|securities|bonds|prices|accounts|receivables|receipts|supplies|revenues|documents|contracts|stocks|companies|quotas|schedules|interests|inventories|banks|accountants|averages|rates|credits|studies|relations|statements|taxes|duties|records|ratios|methods|procedures|rules|indicators|cards|reports|dividends|deposits|debentures|indices|holdings|outlays|warrants|coupons|classes|certificates|exchanges)\b/i.test(
      text,
    )
  ) {
    return ''
  }
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series|plus|class|business|status)$/i.test(text)) return ''
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
  return (
    /^of or relating to/i.test(d) ||
    /\(law\)/i.test(d) ||
    /property resulting from being or relating to/i.test(d)
  )
}

function isWeakDefinition(def, expression = '') {
  const d = String(def || '').trim()
  const e = String(expression || '').trim().toLocaleLowerCase('en-US')
  const dl = d.toLocaleLowerCase('en-US')
  if (!d) return true
  if (/sense of/i.test(d)) return true
  if (/in (business|accounting|finance|daily) practice$/i.test(d)) return true
  if (/used in (business|accounting|finance|daily) work$/i.test(d)) return true
  if (/as used in study and work$/i.test(d)) return true
  if (/the daily meaning of /i.test(d)) return true
  if (/in commercial or accounting use$/i.test(d)) return true
  if (/used in professional practice$/i.test(d)) return true
  if (/banking arrangement or institution role/i.test(d)) return true
  if (/an investor in /i.test(d)) return true
  if (/a clerk who handles /i.test(d)) return true
  if (/costs attributable to /i.test(d)) return true
  if (/in the context of /i.test(d)) return true
  if (/ relating to /i.test(d) && !isDictionaryRelating(d)) return true
  if (e && (dl === e || dl === `a ${e}` || dl === `an ${e}`)) return true
  if (e && (dl === `a ${e}` || dl.startsWith(`a ${e} `) || dl.startsWith(`an ${e} `)) && d.length < e.length + 24) {
    return true
  }
  // "an X in Y" where expression is "Y X"
  if (e) {
    const parts = e.split(/\s+/)
    if (parts.length >= 2) {
      const head = parts.at(-1)
      const mod = parts.slice(0, -1).join(' ')
      if (new RegExp(`^(a|an) ${head} in ${mod.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`, 'i').test(d)) return true
      if (new RegExp(`^(a|an) ${head} related to ${mod.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}$`, 'i').test(d)) {
        return true
      }
    }
  }
  return false
}

function isSoftBankExample(en) {
  return /The briefing clarified the|We validated the .+ against source data|Please update the .+ in the pack|Ownership of the .+ sits with finance|The checklist now includes the|We standardised wording for the|A short note explains the|The team aligned on the|Put the .+ next to the assumptions|We flagged uncertainty around the|Legal asked us to redefine the|The kickoff deck covers the|The deal model hinges on the|She explained the .+ in plain English|We escalated the .+ to the steering group/i.test(
    String(en || ''),
  )
}

function isLikelyAdjective(expression) {
  const e = String(expression || '').trim()
  if (/\s/.test(e)) return false
  return /(?:al|ic|ive|ous|ful|less|ary|ory|ing)$/i.test(e) && e.length > 4
}

function headOf(expression) {
  return expression.toLocaleLowerCase('en-US').trim().split(/\s+/).pop()
}

function semanticClass(expression, partOfSpeech) {
  const x = expression.trim()
  const lower = x.toLocaleLowerCase('en-US')
  const head = headOf(x)
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) return 'verb'
  if (/\badj/.test(pos) || isLikelyAdjective(x)) return 'adjective'
  if (/^[?!.]|[.?!]$/.test(x)) return 'utterance'
  if (/^(assess|raise|compare|calculate|prepare|review|monitor|negotiate|appoint|issue|record|disclose|hedge|fund|price)\b/i.test(lower)) {
    return 'directive'
  }
  if (/bank$/i.test(head) || /\bbank\b/i.test(lower)) return 'institution'
  if (/^(investor|clerk|manager|agent|attorney|auditor|wholesaler|entrepreneur|dealer|stockholder|attach[eé]|banker|accountant)$/i.test(head)) {
    return 'person'
  }
  if (/^(report|memo|slip|ticket|invoice|certificate|statement|bulletin|indenture|advice|tag|manual|book|form|proposal|schedule|card|coupon|scrip)$/i.test(head)) {
    return 'document'
  }
  if (/^(rate|ratio|index|indices|yield|margin|price|cost|costs|percentage|average)$/i.test(head)) return 'metric'
  if (/^(fee|debt|deposit|loan|capital|fund|credit|dividend|premium|discount|proceeds|outlay|rebate|bond|cash|equity|income|revenue|expense|tax|duty)$/i.test(head)) {
    return 'money'
  }
  if (/^(warehouse|godown|depot|zone|garden|place|box|exchange|market|store|center|centre|office|branch)$/i.test(head)) {
    return 'place'
  }
  if (/^(shipment|shipping|delivery|transport|transit|consignment)$/i.test(head)) return 'logistics'
  if (/^(contract|agreement|treaty|policy)$/i.test(head)) return 'legal'
  if (/^(system|method|procedure|process|approach|basis|model|scheme|structure)$/i.test(head)) return 'method'
  if (/^(deficit|surplus|gap|boom|rally|risk|hazard|failure|out|split)$/i.test(head)) return 'condition'
  return 'general'
}

const PHRASE = {
  'commercial bank': 'a bank that provides retail and commercial banking services',
  'investment bank': 'a bank that advises on capital markets, M&A, and securities issuance',
  'correspondent bank': 'a bank that provides services on behalf of another bank',
  'issuing bank': 'the bank that issues a letter of credit or similar instrument',
  'opening bank': 'the bank that opens a letter of credit for the applicant',
  'advising bank': 'the bank that advises a letter of credit to the beneficiary',
  'negotiating bank': 'the bank that negotiates documents under a letter of credit',
  'confirming bank': 'the bank that adds its confirmation to a letter of credit',
  'reimbursing bank': 'the bank authorised to reimburse another bank under an LC',
  'paying bank': 'the bank designated to pay under a letter of credit',
  'remitting bank': 'the bank that remits documents or funds in a collection',
  'collecting bank': 'the bank that collects payment on behalf of the remitting bank',
  'agent bank': 'a bank appointed to act as agent for a syndicate or facility',
  'reserve bank': 'a central or reserve bank that holds reserves and issues currency policy',
  'state reserve bank': 'a state-owned reserve bank',
  'state bank': 'a bank owned or controlled by the state',
  'national bank': 'a bank chartered at the national level',
  'land bank': 'a bank that finances land or agricultural property',
  'trade bank': 'a bank specialising in trade finance',
  'financing bank': 'a bank that provides financing for a transaction',
  'lending bank': 'a bank that extends a loan',
  'debtor bank': 'a bank in the position of debtor on an interbank claim',
  'payor bank': 'the bank ordered to pay a check or draft',
  'certifying bank': 'a bank that certifies a check or payment instrument',
  "banker's bank": 'a bank that provides services primarily to other banks',
  'foreign exchange bank': 'a bank authorised to deal in foreign exchange',
  'authorized foreign exchange bank': 'a bank authorised to conduct foreign-exchange business',
  'specialized foreign exchange bank': 'a bank specialising in foreign-exchange operations',
  'international investment bank': 'a bank focused on cross-border investment finance',
  'import-export bank': 'a bank that finances import and export trade',
  'intervening bank': 'a bank that intervenes in a payment or documentary chain',
  'popular bank': 'a retail-oriented bank serving the general public',
  'first commercial bank': 'a named commercial bank',
  'chang hua commercial bank': 'Chang Hwa Commercial Bank, a Taiwanese commercial bank',
  'stock saving bank': 'a savings bank organised with stockholder capital',
  'deposit bank': 'a bank that accepts customer deposits',
  'cash in bank': 'cash balances held in bank accounts',
  'deposit at bank': 'a deposit placed with a bank',
  'deposit in bank': 'funds deposited in a bank',
  'deposit at the bank': 'a deposit held at the bank',
  'balance at the bank': 'the balance of funds held at the bank',
  'account through the bank': 'an account operated through the bank',
  'institutional investor': 'an organisation that invests large pools of capital, such as a fund or insurer',
  'creditor investor': 'an investor who provides capital as a creditor rather than as an equity owner',
  'handling cost': 'the cost of handling goods or materials',
  'operation cost': 'the cost of running an operation',
  'operational cost': 'the cost of day-to-day operations',
  'delivered cost': 'the total cost of goods including delivery to the buyer',
  'first cost': 'the initial acquisition or manufacturing cost before later charges',
  'stepped cost': 'a cost that rises in steps as activity increases',
  'service cost': 'the cost of providing a service',
  'acquisition cost': 'the cost of acquiring an asset or business',
  'economic cost': 'cost measured in economic terms, including opportunity cost',
  'factory cost': 'the cost incurred in factory production',
  'complete cost': 'the full cost including all assigned elements',
  'project cost': 'the cost of carrying out a project',
  'assigned cost': 'a cost that has been assigned to a cost object',
  'floatation cost': 'the cost of issuing new securities',
  'flotation cost': 'the cost of issuing new securities',
  'specific cost': 'a cost identified with a specific item or activity',
  'reproduction cost': 'the cost of reproducing or replacing an asset or product',
  'manufacturing burden': 'manufacturing overhead or burden costs',
  'credit gap': 'a shortfall between credit demand and available credit',
  'long position': 'a position that profits if the asset’s price rises',
  'short position': 'a position that profits if the asset’s price falls',
  'specification of quality': 'a detailed statement of required quality standards',
  'act of arbitration': 'the formal act of settling a dispute by arbitration',
  'appraisal of business': 'an appraisal of the value or condition of a business',
  'transfer of budget items': 'a transfer of amounts between budget items',
  'analysis of business profits': 'an analysis of profits earned by a business',
  'indexation of prices': 'adjustment of amounts in line with a price index',
  'contract of future delivery': 'a contract requiring delivery at a future date',
  'contract of affreightment': 'a contract for the carriage of goods by ship',
  'contract of carriage': 'a contract for transporting goods or passengers',
  'channel of distribution': 'the path through which goods move to the end buyer',
  'stock of material': 'a stock of materials held for use or sale',
  'stockholder of record': 'the stockholder recorded as owner on the company’s books',
  'form of business enterprise': 'the legal form in which a business is organised',
  'shipment of crude': 'a shipment of crude oil',
  'backlog of unfilled orders': 'orders accepted but not yet filled',
  'flexibility of prices': 'the ability of prices to adjust to market conditions',
  'fluctuation of prices': 'movement of prices up and down over time',
  'balance sheets of banks': 'balance sheets prepared by banks',
  'guarantee of export credits': 'a guarantee covering export credit risk',
  'costs of commodity circulation': 'costs incurred in circulating commodities through trade',
  'factory cost clerk': 'a clerk who records and tracks factory costs',
  'time and cost clerk': 'a clerk who records time and cost data',
}

const COST_GLOSS = {
  handling: 'handling goods or materials',
  operation: 'running operations',
  operational: 'day-to-day operations',
  delivered: 'goods delivered to the buyer, including freight',
  first: 'acquiring or producing an item initially',
  stepped: 'activity that rises in steps',
  service: 'providing a service',
  acquisition: 'acquiring an asset or business',
  economic: 'economic resources used, including opportunity cost',
  factory: 'factory production',
  complete: 'all cost elements assigned to the item',
  project: 'carrying out a project',
  assigned: 'a chosen cost object',
  floatation: 'issuing new securities',
  flotation: 'issuing new securities',
  specific: 'a specific item or activity',
  manufacturing: 'manufacturing activity',
  marketing: 'marketing activity',
  distribution: 'distribution activity',
  transportation: 'transportation',
  maintenance: 'maintenance work',
  conversion: 'converting materials into finished goods',
  prime: 'direct materials and direct labour',
  standard: 'production measured at standard',
  historical: 'past transactions at historical amounts',
  replacement: 'replacing an asset',
  opportunity: 'forgone alternatives',
  marginal: 'producing one additional unit',
  average: 'output on an average basis',
  unit: 'one unit of output',
  joint: 'joint products before split-off',
  common: 'shared resources',
  overhead: 'overhead activities',
  labour: 'labour input',
  labor: 'labor input',
  material: 'materials used',
  selling: 'selling activity',
  administrative: 'administration',
  capital: 'capital employed',
  finance: 'financing',
  borrowing: 'borrowed funds',
  inventory: 'holding inventory',
  carrying: 'carrying inventory or balances',
  ordering: 'placing orders',
  setup: 'production setups',
  quality: 'quality assurance',
  warranty: 'warranty obligations',
  environmental: 'environmental compliance',
  compliance: 'regulatory compliance',
  transaction: 'processing transactions',
  agency: 'agency relationships',
  bankruptcy: 'bankruptcy proceedings',
  restructuring: 'restructuring',
  research: 'research activity',
  development: 'development activity',
  start: 'starting operations',
  shut: 'shutting down operations',
  idle: 'idle capacity',
  capacity: 'providing capacity',
}

const BANK_GLOSS = {
  commercial: 'providing commercial and retail banking services',
  investment: 'capital-markets and investment banking',
  correspondent: 'acting for other banks',
  issuing: 'issuing letters of credit or instruments',
  opening: 'opening letters of credit',
  advising: 'advising letters of credit',
  negotiating: 'negotiating LC documents',
  confirming: 'confirming letters of credit',
  reimbursing: 'reimbursing other banks under LCs',
  paying: 'making payment under an instrument',
  remitting: 'remitting documents or funds',
  collecting: 'collecting payment for another bank',
  agent: 'acting as agent bank for a facility',
  reserve: 'central/reserve banking functions',
  state: 'state ownership or control',
  national: 'a national charter',
  land: 'land and agricultural finance',
  trade: 'trade finance',
  financing: 'transaction financing',
  lending: 'extending loans',
  debtor: 'owing under an interbank claim',
  payor: 'paying checks or drafts',
  certifying: 'certifying checks',
  intervening: 'intervening in a payment chain',
  popular: 'serving the general public',
  deposit: 'accepting deposits',
  'foreign exchange': 'foreign-exchange dealings',
  'import-export': 'import and export finance',
}

function composeBank(lower) {
  if (PHRASE[lower]) return PHRASE[lower]
  if (/^(cash|deposit|balance|account) (in|at|through) (the )?bank$/.test(lower)) {
    if (lower.startsWith('cash')) return 'cash balances held in bank accounts'
    if (lower.startsWith('balance')) return 'the balance of funds held at the bank'
    if (lower.startsWith('account')) return 'an account operated through the bank'
    return 'a deposit placed with a bank'
  }
  const m = lower.match(/^(.+?)\s+bank$/)
  if (!m) return ''
  const mod = m[1]
  if (BANK_GLOSS[mod]) return `a bank ${BANK_GLOSS[mod]}`
  if (/foreign exchange/.test(mod)) return 'a bank authorised to deal in foreign exchange'
  if (/commercial/.test(mod)) return 'a commercial bank'
  if (/investment/.test(mod)) return 'an investment bank'
  return `a bank engaged in ${mod}`
}

function composeCost(lower) {
  if (PHRASE[lower]) return PHRASE[lower]
  const m = lower.match(/^(.+?)\s+costs?$/)
  if (!m) return ''
  const mod = m[1]
  if (COST_GLOSS[mod]) return `the cost of ${COST_GLOSS[mod]}`
  if (mod.endsWith('ing')) return `the cost of ${mod}`
  return `the cost associated with ${mod}`
}

function composeOfPattern(lower) {
  if (PHRASE[lower]) return PHRASE[lower]
  const m = lower.match(/^(.+?)\s+of\s+(.+)$/)
  if (!m) return ''
  const left = m[1]
  const right = m[2]
  const map = {
    specification: `a detailed specification of ${right}`,
    act: `an act of ${right}`,
    appraisal: `an appraisal of ${right}`,
    transfer: `a transfer of ${right}`,
    analysis: `an analysis of ${right}`,
    indexation: `indexation applied to ${right}`,
    contract: `a contract covering ${right}`,
    channel: `a channel for ${right}`,
    stock: `a stock of ${right}`,
    stockholder: `the stockholder recorded for ${right}`,
    form: `a form of ${right}`,
    shipment: `a shipment of ${right}`,
    backlog: `a backlog of ${right}`,
    flexibility: `flexibility in ${right}`,
    fluctuation: `fluctuation in ${right}`,
    'balance sheets': `balance sheets of ${right}`,
    guarantee: `a guarantee of ${right}`,
    costs: `costs of ${right}`,
    cost: `the cost of ${right}`,
    risk: `the risk of ${right}`,
    assessment: `an assessment of ${right}`,
    assignment: `an assignment of ${right}`,
    organization: `the organisation of ${right}`,
    organisation: `the organisation of ${right}`,
    sites: `sites used for ${right}`,
    shrinkage: `shrinkage of ${right}`,
    ratification: `ratification of ${right}`,
    buyer: `a buyer for ${right}`,
    earning: `earnings of ${right}`,
    'index numbers': `index numbers for ${right}`,
    'index number': `an index number for ${right}`,
    'general index': `a general index of ${right}`,
    'manufacturing expenses': `manufacturing expenses of ${right}`,
    'lump sum system': `a lump-sum contracting system for ${right}`,
    'sales basis': `revenue recognition on a sales basis for ${right}`,
    'production basis': `revenue recognition on a production basis for ${right}`,
  }
  if (map[left]) return map[left]
  return `${withArticle(left)} concerning ${right}`
}

function composeDefinition(expression, partOfSpeech) {
  const raw = expression.trim()
  const lower = raw.toLocaleLowerCase('en-US')
  if (PHRASE[lower]) return PHRASE[lower]

  const bank = composeBank(lower)
  if (bank) return bank

  const cost = composeCost(lower)
  if (cost) return cost

  const ofGloss = composeOfPattern(lower)
  if (ofGloss) return ofGloss

  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[parts.length - 1]
    const mod = parts.slice(0, -1).join(' ')
    if (head === 'investor') return `an investor characterised as ${mod}`
    if (head === 'clerk') return `a clerk responsible for ${mod}`
    if (head === 'gap') return `a gap in ${mod}`
    if (head === 'position' && /^(long|short)$/.test(mod)) {
      return mod === 'long'
        ? 'a position that profits if the asset’s price rises'
        : 'a position that profits if the asset’s price falls'
    }
    if (head === 'manager') return `a manager responsible for ${mod}`
    if (head === 'agent') return `an agent acting in ${mod}`
    if (head === 'rate') return `the rate applied to ${mod}`
    if (head === 'price') return `the price for ${mod}`
    if (head === 'system') return `a system for ${mod}`
    if (head === 'method') return `a method for ${mod}`
    if (head === 'approach') return `an approach based on ${mod}`
    if (head === 'basis') return `a basis for ${mod}`
    return `${withArticle(raw)} used in business and finance`
  }

  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) return `to ${lower}`
  if (/\badj/.test(pos) || isLikelyAdjective(raw)) return `describing something as ${lower}`
  return `${withArticle(raw)} used in business and finance`
}

function pickCols(cands, expression, pos) {
  const out = []
  for (const c of cands) {
    if (isFakeCol(c, expression, pos)) continue
    if (!c.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(c)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`refer to the ${expression}`, `check the ${expression}`)
  return unique(out).filter((c) => !isFakeCol(c, expression, pos)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, id) {
  const x = expression
  const klass = semanticClass(x, partOfSpeech)
  const art = withArticle(x)
  if (klass === 'utterance') return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  if (klass === 'verb') return pickCols([`${x} carefully`, `decide whether to ${x}`, `refuse to ${x}`], x, partOfSpeech)
  if (klass === 'adjective') {
    const a = /^[aeiou]/i.test(x) ? 'an' : 'a'
    return pickCols([`${a} ${x} decision`, `remain ${x}`, `sound ${x}`], x, partOfSpeech)
  }
  if (klass === 'directive') return pickCols([`need to ${x}`, `how to ${x}`, `fail to ${x}`], x, partOfSpeech)

  const pools = {
    person: [[`appoint ${art}`, `brief the ${x}`, `consult the ${x}`], [`hire ${art}`, `train the ${x}`, `rely on the ${x}`]],
    document: [[`issue the ${x}`, `file the ${x}`, `review the ${x}`], [`draft the ${x}`, `circulate the ${x}`, `amend the ${x}`]],
    metric: [[`calculate the ${x}`, `compare the ${x}`, `revise the ${x}`], [`set the ${x}`, `benchmark the ${x}`, `publish the ${x}`]],
    money: [[`settle the ${x}`, `estimate the ${x}`, `approve the ${x}`], [`book the ${x}`, `forecast the ${x}`, `allocate the ${x}`]],
    place: [[`inspect the ${x}`, `secure the ${x}`, `visit the ${x}`], [`lease the ${x}`, `audit the ${x}`, `relocate the ${x}`]],
    institution: [
      [`engage the ${x}`, `instruct the ${x}`, `evaluate the ${x}`],
      [`bank with the ${x}`, `open an account at the ${x}`, `deal with the ${x}`],
    ],
    logistics: [[`arrange the ${x}`, `track the ${x}`, `expedite the ${x}`], [`confirm the ${x}`, `reroute the ${x}`, `insure the ${x}`]],
    legal: [[`draft the ${x}`, `sign the ${x}`, `enforce the ${x}`], [`negotiate the ${x}`, `renew the ${x}`, `terminate the ${x}`]],
    method: [[`apply the ${x}`, `adopt the ${x}`, `document the ${x}`], [`test the ${x}`, `refine the ${x}`, `roll out the ${x}`]],
    condition: [[`monitor the ${x}`, `explain the ${x}`, `mitigate the ${x}`], [`report the ${x}`, `narrow the ${x}`, `stress-test the ${x}`]],
    general: [[`clarify the ${x}`, `define the ${x}`, `validate the ${x}`], [`prioritise the ${x}`, `communicate the ${x}`, `update the ${x}`]],
  }
  const options = pools[klass] || pools.general
  return pickCols(options[hashId(id) % options.length], x, partOfSpeech)
}

function buildExamples(expression, zh, id, partOfSpeech) {
  const x = expression
  const klass = semanticClass(x, partOfSpeech)
  const art = withArticle(x)

  if (klass === 'utterance') {
    return [
      { en: `I’d say “${x}” in that situation.`, zh: `那种情况我会说「${zh}」。` },
      { en: `She practised “${x}” before the call.`, zh: `电话前她练习了「${zh}」。` },
    ]
  }
  if (klass === 'verb') {
    return [
      { en: `They chose to ${x} after reviewing the risks.`, zh: `评估风险后，他们选择「${zh}」。` },
      { en: `Do not ${x} unless the contract allows it.`, zh: `除非合同允许，否则不要「${zh}」。` },
    ]
  }
  if (klass === 'adjective') {
    return [
      { en: `Investors preferred a more ${x} structure.`, zh: `投资者更偏好「${zh}」的结构。` },
      { en: `Make sure the summary stays ${x}.`, zh: `确保摘要保持「${zh}」。` },
    ]
  }
  if (klass === 'directive') {
    return [
      { en: `The brief tells the team to ${x}.`, zh: `简报要求团队「${zh}」。` },
      { en: `We failed to ${x} before the deadline.`, zh: `我们未能在截止前「${zh}」。` },
    ]
  }

  const pools = {
    person: [
      { en: `They appointed ${art} for the region.`, zh: `他们为该地区指定了「${zh}」。` },
      { en: `Please brief the ${x} before Friday.`, zh: `请在周五前向「${zh}」做简报。` },
      { en: `The ${x} raised three practical objections.`, zh: `「${zh}」提出了三点实际异议。` },
    ],
    document: [
      { en: `Please issue the ${x} today.`, zh: `请今天开具「${zh}」。` },
      { en: `File the ${x} with the working papers.`, zh: `把「${zh}」归入工作底稿。` },
      { en: `The ${x} still needs two signatures.`, zh: `「${zh}」还差两个签字。` },
    ],
    metric: [
      { en: `Finance recalculated the ${x}.`, zh: `财务重新计算了「${zh}」。` },
      { en: `The board challenged the ${x} assumption.`, zh: `董事会质疑「${zh}」假设。` },
      { en: `Compare last quarter’s ${x} with this one.`, zh: `把上季度「${zh}」与本季对比。` },
    ],
    money: [
      { en: `Treasury settled the ${x} yesterday.`, zh: `资金部昨天结清了「${zh}」。` },
      { en: `We need approval before booking the ${x}.`, zh: `入账「${zh}」前需要审批。` },
      { en: `Auditors sampled the ${x} balance.`, zh: `审计师抽样检查了「${zh}」余额。` },
    ],
    place: [
      { en: `We inspected the ${x} this morning.`, zh: `我们今早检查了「${zh}」。` },
      { en: `Access to the ${x} is restricted.`, zh: `「${zh}」的进出受限。` },
      { en: `Security logged every visit to the ${x}.`, zh: `安保记录了每次进入「${zh}」。` },
    ],
    institution: [
      { en: `Please instruct the ${x} in writing.`, zh: `请书面指示「${zh}」。` },
      { en: `The ${x} requested updated KYC files.`, zh: `「${zh}」要求更新尽调材料。` },
      { en: `We opened the facility with the ${x}.`, zh: `我们与「${zh}」开立了授信。` },
      { en: `Compliance reviewed controls at the ${x}.`, zh: `合规审查了「${zh}」的控制。` },
    ],
    logistics: [
      { en: `Ops expedited the ${x} after the delay.`, zh: `延误后运营加急了「${zh}」。` },
      { en: `Confirm the ${x} before loading.`, zh: `装货前确认「${zh}」。` },
      { en: `Insure the ${x} at invoice value.`, zh: `按发票金额为「${zh}」投保。` },
    ],
    legal: [
      { en: `Counsel redlined the ${x}.`, zh: `律师修改了「${zh}」。` },
      { en: `Both parties executed the ${x}.`, zh: `双方签署了「${zh}」。` },
      { en: `We renewed the ${x} for two years.`, zh: `我们把「${zh}」续签了两年。` },
    ],
    method: [
      { en: `We adopted the ${x} this quarter.`, zh: `本季度我们采用了「${zh}」。` },
      { en: `Document how the ${x} is applied.`, zh: `记录「${zh}」如何应用。` },
      { en: `The pilot tested the ${x} on one product line.`, zh: `试点在一条产品线上测试了「${zh}」。` },
    ],
    condition: [
      { en: `Risk monitors the ${x} weekly.`, zh: `风控每周监控「${zh}」。` },
      { en: `Management explained the ${x} to the board.`, zh: `管理层向董事会解释了「${zh}」。` },
      { en: `We built a contingency for the ${x}.`, zh: `我们为「${zh}」准备了应急预案。` },
    ],
    general: [
      { en: `The memo defines the ${x} clearly.`, zh: `备忘录清楚界定了「${zh}」。` },
      { en: `Add the ${x} to tomorrow’s agenda.`, zh: `把「${zh}」加进明天议程。` },
      { en: `Two teams share ownership of the ${x}.`, zh: `两个团队共同负责「${zh}」。` },
      { en: `We cross-checked the ${x} with operations.`, zh: `我们与运营交叉核对了「${zh}」。` },
      { en: `The training slide covers the ${x}.`, zh: `培训页覆盖了「${zh}」。` },
      { en: `Keep evidence supporting the ${x}.`, zh: `保留支持「${zh}」的证据。` },
      { en: `The policy annex mentions the ${x}.`, zh: `政策附件提到了「${zh}」。` },
      { en: `Please paraphrase the ${x} for the client.`, zh: `请为客户转述「${zh}」。` },
      { en: `We timed the discussion of the ${x} carefully.`, zh: `我们谨慎安排了「${zh}」的讨论时间。` },
      { en: `The glossary entry for the ${x} was updated.`, zh: `「${zh}」的术语表条目已更新。` },
    ],
  }

  const pool = pools[klass] || pools.general
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

function primaryList(wordId, memberships) {
  const items = memberships.filter((m) => m.wordId === wordId)
  const lists = items.map((m) => LIST_SLUG[m.listId]).filter(Boolean)
  if (lists.includes('accounting')) return 'accounting'
  if (lists.includes('finance')) return 'finance'
  if (lists.includes('business')) return 'business'
  return lists[0] || 'daily'
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let defs = 0
let examples = 0
let cols = 0
const classCounts = {}

for (const word of pack.words) {
  if (String(word.id).startsWith('v1-')) continue
  primaryList(word.id, pack.memberships)
  const klass = semanticClass(word.expression, word.partOfSpeech)
  classCounts[klass] = (classCounts[klass] || 0) + 1

  if (isWeakDefinition(word.enDefinition, word.expression)) {
    word.enDefinition = composeDefinition(word.expression, word.partOfSpeech)
    if (isWeakDefinition(word.enDefinition, word.expression)) {
      word.enDefinition = `${withArticle(word.expression)} used in business and finance`
    }
    defs += 1
  }

  if (!Array.isArray(word.examples) || word.examples.length < 2 || word.examples.some((ex) => isSoftBankExample(ex.en))) {
    word.examples = buildExamples(word.expression, word.zhGloss, word.id, word.partOfSpeech)
    examples += 1
  }

  if (!Array.isArray(word.collocations) || word.collocations.length < 2) {
    word.collocations = buildCollocations(word.expression, word.partOfSpeech, word.id)
    cols += 1
  } else if (klass === 'institution' || klass === 'person' || klass === 'metric') {
    // refresh mismatched leftover clusters for key classes
    const bad =
      (klass === 'institution' &&
        (word.collocations || []).some((c) => /^(post|accrue|hedge|benchmark|escalate) (a |an |the )/i.test(c))) ||
      (klass === 'person' &&
        (word.collocations || []).some((c) => /^(model|hedge|post|price|fund|value) (a |an |the )/i.test(c))) ||
      (klass === 'metric' &&
        (word.collocations || []).some((c) => /^(appoint|brief|hire|engage) (a |an |the )/i.test(c)))
    if (bad) {
      word.collocations = buildCollocations(word.expression, word.partOfSpeech, word.id)
      cols += 1
    }
  }

  word.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const stillWeak = pack.words.filter((w) => !w.id.startsWith('v1-') && isWeakDefinition(w.enDefinition, w.expression))
const softLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && (w.examples || []).some((e) => isSoftBankExample(e.en)),
)
const bankRoleLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && /banking arrangement or institution role/i.test(w.enDefinition || ''),
)
const costAttrLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && /costs attributable to /i.test(w.enDefinition || ''),
)

mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round7-report.json'),
  `${JSON.stringify(
    {
      defs,
      examples,
      cols,
      stillWeak: stillWeak.length,
      softLeft: softLeft.length,
      bankRoleLeft: bankRoleLeft.length,
      costAttrLeft: costAttrLeft.length,
      classCounts,
      sampleWeak: stillWeak.slice(0, 20).map((w) => ({ e: w.expression, d: w.enDefinition })),
    },
    null,
    2,
  )}\n`,
)

console.log(
  JSON.stringify(
    {
      defs,
      examples,
      cols,
      stillWeak: stillWeak.length,
      softLeft: softLeft.length,
      bankRoleLeft: bankRoleLeft.length,
      costAttrLeft: costAttrLeft.length,
      classCounts,
    },
    null,
    2,
  ),
)
