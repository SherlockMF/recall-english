/**
 * Round-5 quality upgrade on trusted_v5_2 pack.
 * Focus: replace "in commercial or accounting use" floors + diversify escalate templates.
 *
 * Run: node scripts/upgradeVocabularyQualityRound5.mjs && npm run seed:pack && npm run seed:quality
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
  if (/in commercial or accounting use$/i.test(d)) return true
  if (/ connected with /i.test(d)) return true
  if (/the activity of .+ in the context of/i.test(d)) return true
  if (/a measured level or proportion relating to/i.test(d)) return true
  if (/practice relating to /i.test(d)) return true
  if (/ relating to /i.test(d) && !isDictionaryRelating(d)) return true
  if (/relating to its listed sense/i.test(d)) return true
  return false
}

function isSoftBankExample(en) {
  return /Before we sign, let’s confirm the|Ops put the .+ on this week|We closed the week by settling the|The client asked for clarity on the|Ops follows up on the|We put “.+” on Thursday’s agenda|We escalated the .+ to the steering group|Ops flagged a delay around the|Sales needs a decision on the .+ by Friday|The proposal restates our position on the/i.test(
    String(en || ''),
  )
}

function isLikelyAdjective(expression) {
  const e = String(expression || '').trim()
  if (/\s/.test(e)) return false
  return /(?:al|ic|ive|ous|ful|less|ary|ory|ing)$/i.test(e) && e.length > 4
}

function isGenericColSet(cols, expression, partOfSpeech) {
  const list = Array.isArray(cols) ? cols : []
  if (list.length < 2) return true
  if (list.some((col) => /^a [aeiou]/i.test(col))) return true
  if (/\badjective\b/i.test(partOfSpeech || '') || isLikelyAdjective(expression)) {
    const ok = list.some((col) =>
      new RegExp(`^(an?|more|remain|sound|clearly) .*${expression.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i').test(col),
    )
    return !ok
  }
  return false
}

/** Hand glosses for the commercial-use residual queue + common patterns. */
const PHRASE = {
  'commercial attache': 'a commercial attaché at an embassy or consulate',
  'commercial guild': 'a guild or association of commercial traders',
  'commercial efficiency': 'efficiency in commercial operations',
  'mill supply wholesalers': 'wholesalers that supply mills with materials and equipment',
  'net indebtedness': 'total debt less offsets, showing net amounts owed',
  'cost additions': 'amounts added to cost in a cost build-up',
  'cost approach': 'a valuation approach based on cost to reproduce or replace',
  'cost budget in diagrams': 'a cost budget presented in diagram form',
  'least cost point': 'the output or activity level at which total cost is minimised',
  'manufacturing burden': 'manufacturing overhead or burden costs',
  'manufacturing costs classified': 'manufacturing costs grouped by class or category',
  'margin and guaranty': 'margin money and related guarantees',
  'management engineering firms': 'firms that provide management engineering services',
  'management autonomy': 'freedom of managers to make operating decisions',
  'commercially saleable': 'able to be sold in ordinary commercial markets',
  'marketing price policies': 'policies governing prices used in marketing',
  'market garden': 'a garden grown to supply produce to market',
  'market place': 'a place or arena where goods are bought and sold',
  'market mechanisms': 'mechanisms by which markets allocate resources and set prices',
  'customs attorney': 'an attorney who handles customs matters',
  'production factors': 'inputs used in production, such as labour and capital',
  'producing cost centers': 'cost centres that produce goods or services',
  'price sovereignty': 'control or dominance over pricing in a market',
  'price tendered': 'the price offered in a tender',
  'budget item': 'a line item in a budget',
  'budget layout': 'the layout or arrangement of a budget',
  'profit target': 'a targeted level of profit',
  'business failure': 'the failure or collapse of a business',
  'price loco': 'the price at the place of purchase',
  'price leadership': 'a situation where one firm sets prices others follow',
  'price rigidity': 'resistance of prices to change',
  'price moderate': 'a moderate or restrained price level',
  'price not competitive': 'a price that is not competitive in the market',
  'price delivered along vessel': 'the price for goods delivered alongside the vessel',
  'business reply cards': 'reply cards prepaid for business responses',
  'business indicators': 'indicators that track business conditions',
  'budget proposal': 'a proposed budget submitted for approval',
  'raise the market upon': 'to force or push the market price up',
  'quality control and reliability': 'quality control together with product reliability',
  'cost-benefit philosophy': 'an approach that weighs costs against benefits',
  'open market rentals': 'rental rates determined in the open market',
  'credit standing and respectability': 'a firm’s credit standing and commercial reputation',
  'case commercial': 'a commercial case or commercial matter under review',
  'payment in installments': 'payment made in successive installments',
  'road transport': 'transport of goods by road',
  'free overside': 'delivery terms under which goods are free when discharged overside',
  'sale afloat': 'a sale of goods while they are still afloat in transit',
  'administration authority': 'authority to administer or manage an activity',
  'invisible supply': 'supply that is not immediately visible in reported stocks',
  'gross proceeds': 'total proceeds before deductions',
  'quantity rebate': 'a rebate granted for purchasing a larger quantity',
  'bilateral trade and payments agreements': 'agreements covering bilateral trade and payments',
  'reporting stockholders equity by sources': 'presenting stockholders’ equity broken down by source',
  'marketing cost control by territory': 'control of marketing costs broken down by territory',
  'public opinion': 'the views held by the public on an issue',
  'leading article': 'the main editorial article in a newspaper',
  'shipment request': 'a request to arrange a shipment',
  'shipment by sailing boat': 'shipment made by sailing vessel',
  'shipment by instalments': 'shipment delivered in instalments',
  'shipment by first opportunity': 'shipment made at the earliest available opportunity',
  'shipment advice': 'advice notifying that a shipment has been made',
  'shipment by cheapest route': 'shipment routed by the cheapest available path',
  'shipping and traffic': 'shipping operations and related traffic management',
  'average sales expectancy': 'the average expected level of sales',
  'shipping from the mill': 'dispatch of goods from the mill',
  'shipping entrepreneur': 'an entrepreneur engaged in shipping',
  'shipping mark': 'marks on packages identifying a shipment',
  'foreign market survey': 'a survey of conditions in a foreign market',
  'back order memo': 'a memo recording a back order',
  'foreign trade zone': 'a zone where goods may be imported with special customs treatment',
  'standard costing reports': 'reports produced under a standard costing system',
  'deposit at the treasury': 'a deposit lodged with the treasury',
  'stock in storage': 'stock held in storage',
  'assess market opportunities': 'to evaluate opportunities in a market',
  'stock out': 'a situation where stock is unavailable',
  "stockholder's right": 'a right belonging to a stockholder',
  'deposit received for guarantees': 'a deposit received as security for guarantees',
  'social marketing concept': 'a marketing concept focused on social objectives',
  'fixed production coefficient': 'a fixed ratio of inputs to output in production',
  'fixed budgets': 'budgets that do not vary with activity level',
  'fixed loans unsecured': 'fixed-term loans that are unsecured',
  'payroll records': 'records of payroll amounts and deductions',
  'stock scrip': 'scrip representing a right to stock',
  'bond discount unamortized': 'unamortized discount on bonds payable',
  'sales slip': 'a slip documenting a sale',
  'accounting concept': 'a foundational concept used in accounting',
  'accounting manual': 'a manual describing accounting policies and procedures',
  'expense invoices': 'invoices supporting expense claims',
  'inter-company dividends unpaid': 'dividends declared between companies but not yet paid',
  'cost manual': 'a manual of cost accounting methods and rates',
  'inventory accounting methods': 'methods used to account for inventory',
  'marketing audits': 'audits of marketing activities and effectiveness',
  'organization costs written off': 'organisation costs that have been written off',
  'balance sheet ratios': 'ratios derived from balance sheet amounts',
  'special customs invoices': 'customs invoices required for special clearance',
  'auditing generality': 'a general principle applied in auditing',
  'audit objective': 'the objective an audit is designed to achieve',
  'retaliatory tariffs': 'tariffs imposed in retaliation for another country’s measures',
  'reserved stock tag': 'a tag marking stock that has been reserved',
  "bank's account title": 'the title of a bank account',
  'banking machine': 'a machine used for banking transactions',
  'funded property': 'property financed or held as funded assets',
  'sales ticket': 'a ticket or slip recording a sale',
  'accounting books': 'the books of account',
  'accounting data': 'data used in accounting records and reports',
  'accounting entity': 'the entity for which accounts are kept',
  'accounting for foreign subsidiaries': 'accounting treatment of foreign subsidiaries',
  'accountant general': 'a senior public accountant responsible for government accounts',
  'accounting trends and techniques': 'published surveys of accounting trends and techniques',
  'accounting identity': 'an identity that always holds in accounting equations',
  'tax treaties': 'treaties allocating taxing rights between countries',
  'taxation neutrality': 'a tax design that does not distort economic choices',
  'tax differential': 'a difference in tax rates or tax treatment',
  'tariff for revenue only': 'a tariff imposed mainly to raise revenue',
  'independent auditors': 'auditors independent of the entity being audited',
  'notes receivable from stockholders': 'notes receivable due from stockholders',
  'cost accounting procedures': 'procedures used in cost accounting',
  'cost accounting by elements': 'cost accounting analysed by cost element',
  'cost accounting by departments': 'cost accounting analysed by department',
  'liability for payroll taxes': 'the liability to pay payroll taxes',
  'management accounting problems': 'problems arising in management accounting',
  'invoice book inward': 'a book recording inward invoices',
  'invoice book outward': 'a book recording outward invoices',
  'investment tax credit rules': 'rules governing investment tax credits',
  'prohibitive import duties': 'import duties set high enough to discourage imports',
  'customs free depot': 'a depot where goods are held free of customs duty',
  'business accountancy': 'accountancy applied to business enterprises',
  'income after taxes': 'income remaining after tax',
  'import duty memo': 'a memo recording import duty',
  'payroll scale': 'a scale of pay rates used for payroll',
  'due from correspondent': 'amounts due from a correspondent bank or firm',
  'customary dues': 'dues charged according to custom or usage',
  'imputed rent': 'rent attributed to owner-occupied property',
  'pay check': 'a check issued for wages or salary',
  'fully depreciated assets in active use': 'assets still used after being fully depreciated',
  'statement from creditors': 'a statement received from creditors',
  'staff accounting bulletin': 'a staff accounting bulletin issued by a regulator',
  'stock in hand': 'stock currently held on hand',
  'stock on hand': 'stock currently on hand',
  'assistant auditor-general': 'a deputy to the auditor-general',
  'investment in default': 'an investment on which payment is in default',
  'capital productivity': 'output produced per unit of capital',
  'bank debits': 'debits charged to bank accounts',
  'bank deposits': 'funds deposited with banks',
  'bank insolvency': 'the insolvency of a bank',
  'exempted dealers': 'dealers exempted from a regulatory requirement',
  'trade hazard': 'a hazard or risk arising in trade',
  'bond subscriptions': 'subscriptions to purchase newly issued bonds',
  'cost recovery': 'recovery of costs through charges or proceeds',
  'guaranteed debentures': 'debentures backed by a guarantee',
  'financial times stock indices': 'stock indices published by the Financial Times',
  'special safe-deposit': 'a special safe-deposit facility',
  'reverse stock split': 'a consolidation of shares that reduces the number outstanding',
  'bond indentures': 'legal contracts governing bond issues',
  'bank draft': 'a draft drawn by or on a bank',
  'fund for government investors': 'a fund set up for government investors',
  'safe deposit box': 'a locked box rented in a bank vault for valuables',
  'dividend declared': 'a dividend that has been declared but may not yet be paid',
  'discount on bonds purchased': 'discount arising when bonds are purchased below par',
  'inter-company bond holdings': 'bond holdings between related companies',
  'negative debt': 'an unusual presentation where debt is shown as a negative amount',
  'net bonded debt': 'bonded debt after deducting related offsets',
  'loan on bills': 'a loan secured by bills of exchange',
  'investment in subsidiary-company': 'an investment in a subsidiary company',
  'investment company institute': 'an institute representing investment companies',
  'investment boom': 'a period of rapidly rising investment activity',
  'highly capitalised': 'having a high level of capital relative to activity',
  'portfolio effect': 'the risk-reducing effect of combining assets in a portfolio',
  'bonds authorized': 'bonds that have been authorised for issue',
  'bond coupons': 'coupons attached to bonds for interest collection',
  'over capitalised': 'having more capital than the business can use productively',
  'income on investments abroad': 'income earned from investments held abroad',
  'capital outlays': 'expenditures on capital assets',
  'credit risk relief': 'relief or mitigation of credit risk',
  'capital for trading purpose': 'capital provided for trading activities',
  'capital paid-in': 'capital that shareholders have paid in',
  'capital in general': 'capital considered in a general sense',
  'capital intensity': 'the amount of capital used relative to labour or output',
  'capital intensive': 'requiring a large amount of capital relative to labour',
  'capital debentures': 'debentures treated as capital instruments',
  'capital employed': 'capital used in the business to generate returns',
  'credit for productive purpose': 'credit extended for productive use',
  'minor rally': 'a short or modest recovery in prices',
  'cats and dogs': 'speculative or low-quality securities',
  'income to net worth': 'the ratio of income to net worth',
  'cash on back': 'cash noted on the reverse of a document',
  'premium on treasury stock sold': 'premium arising when treasury stock is sold above cost',
  'bonds with stock purchase warrants': 'bonds issued with warrants to buy stock',
  'bond valuation between interest dates': 'valuation of a bond between interest payment dates',
  'foreign bank bills': 'bills drawn on or by foreign banks',
  'sinking fund cash': 'cash set aside in a sinking fund',
  'sinking fund requirements': 'amounts required to be paid into a sinking fund',
  'stock classes': 'classes of stock with different rights',
  'stock certificates': 'certificates evidencing ownership of stock',
  'stock arbitrage': 'arbitrage trading in stocks across markets',
  'stock issued for property': 'stock issued in exchange for property',
  'stock exchanges': 'organised markets for trading stocks',
  'stock exchange indices': 'indices tracking stock exchange prices',
  'stock owned': 'stock owned by an investor or entity',
  'deposit correction slip': 'a slip used to correct a deposit entry',
}

const HEAD = {
  memo: (m) => `a memo concerning ${m}`,
  slip: (m) => `a slip used for ${m}`,
  manual: (m) => `a manual of ${m}`,
  concept: (m) => `a concept used in ${m}`,
  invoices: (m) => `invoices for ${m}`,
  invoice: (m) => `an invoice for ${m}`,
  property: (m) => `property related to ${m}`,
  taxes: (m) => `taxes on ${m}`,
  tax: (m) => `tax on ${m}`,
  debt: (m) => `debt arising from ${m}`,
  bills: (m) => `bills related to ${m}`,
  purpose: (m) => `a purpose related to ${m}`,
  target: (m) => `a target for ${m}`,
  item: (m) => `an item of ${m}`,
  layout: (m) => `the layout of ${m}`,
  failure: (m) => `failure of ${m}`,
  policies: (m) => `policies on ${m}`,
  policy: (m) => `policy on ${m}`,
  mechanisms: (m) => `mechanisms of ${m}`,
  factors: (m) => `factors of ${m}`,
  centers: (m) => `centres for ${m}`,
  centres: (m) => `centres for ${m}`,
  attorney: (m) => `an attorney for ${m}`,
  efficiency: (m) => `efficiency in ${m}`,
  autonomy: (m) => `autonomy in ${m}`,
  firms: (m) => `firms providing ${m}`,
  wholesalers: (m) => `wholesalers of ${m}`,
  indebtedness: (m) => `indebtedness after ${m}`,
  additions: (m) => `additions to ${m}`,
  approach: (m) => `an approach based on ${m}`,
  point: (m) => `a point of ${m}`,
  burden: (m) => `burden costs of ${m}`,
  guaranty: (m) => `a guaranty for ${m}`,
  garden: (m) => `a garden for ${m}`,
  place: (m) => `a place for ${m}`,
  leadership: (m) => `leadership in ${m}`,
  rigidity: (m) => `rigidity of ${m}`,
  indicators: (m) => `indicators of ${m}`,
  cards: (m) => `cards used for ${m}`,
  proposal: (m) => `a proposal for ${m}`,
  philosophy: (m) => `a philosophy of ${m}`,
  rentals: (m) => `rentals in ${m}`,
  respectability: (m) => `respectability of ${m}`,
  installments: (m) => `installments for ${m}`,
  transport: (m) => `transport by ${m}`,
  authority: (m) => `authority over ${m}`,
  supply: (m) => `supply of ${m}`,
  proceeds: (m) => `proceeds from ${m}`,
  rebate: (m) => `a rebate for ${m}`,
  agreements: (m) => `agreements on ${m}`,
  sources: (m) => `sources of ${m}`,
  territory: (m) => `territory for ${m}`,
  opinion: (m) => `opinion on ${m}`,
  article: (m) => `an article on ${m}`,
  request: (m) => `a request for ${m}`,
  advice: (m) => `advice of ${m}`,
  traffic: (m) => `traffic related to ${m}`,
  expectancy: (m) => `expectancy of ${m}`,
  entrepreneur: (m) => `an entrepreneur in ${m}`,
  mark: (m) => `a mark for ${m}`,
  survey: (m) => `a survey of ${m}`,
  zone: (m) => `a zone for ${m}`,
  reports: (m) => `reports on ${m}`,
  treasury: (m) => `the treasury for ${m}`,
  storage: (m) => `storage of ${m}`,
  opportunities: (m) => `opportunities in ${m}`,
  right: (m) => `a right of ${m}`,
  guarantees: (m) => `guarantees for ${m}`,
  coefficient: (m) => `a coefficient of ${m}`,
  budgets: (m) => `budgets for ${m}`,
  unsecured: (m) => `${m} that is unsecured`,
  records: (m) => `records of ${m}`,
  scrip: (m) => `scrip for ${m}`,
  unamortized: (m) => `${m} that is unamortized`,
  unpaid: (m) => `${m} that is unpaid`,
  methods: (m) => `methods of ${m}`,
  audits: (m) => `audits of ${m}`,
  ratios: (m) => `ratios of ${m}`,
  generality: (m) => `generality in ${m}`,
  objective: (m) => `an objective of ${m}`,
  tariffs: (m) => `tariffs on ${m}`,
  tag: (m) => `a tag for ${m}`,
  title: (m) => `the title of ${m}`,
  machine: (m) => `a machine for ${m}`,
  ticket: (m) => `a ticket for ${m}`,
  books: (m) => `books of ${m}`,
  data: (m) => `data for ${m}`,
  entity: (m) => `an entity for ${m}`,
  subsidiaries: (m) => `subsidiaries in ${m}`,
  techniques: (m) => `techniques of ${m}`,
  identity: (m) => `an identity in ${m}`,
  treaties: (m) => `treaties on ${m}`,
  neutrality: (m) => `neutrality of ${m}`,
  differential: (m) => `a differential in ${m}`,
  auditors: (m) => `auditors of ${m}`,
  stockholders: (m) => `stockholders of ${m}`,
  procedures: (m) => `procedures for ${m}`,
  elements: (m) => `elements of ${m}`,
  departments: (m) => `departments for ${m}`,
  problems: (m) => `problems in ${m}`,
  inward: (m) => `${m} recorded inward`,
  outward: (m) => `${m} recorded outward`,
  rules: (m) => `rules for ${m}`,
  duties: (m) => `duties on ${m}`,
  depot: (m) => `a depot for ${m}`,
  accountancy: (m) => `accountancy for ${m}`,
  scale: (m) => `a scale of ${m}`,
  correspondent: (m) => `a correspondent for ${m}`,
  dues: (m) => `dues for ${m}`,
  rent: (m) => `rent for ${m}`,
  check: (m) => `a check for ${m}`,
  bulletin: (m) => `a bulletin on ${m}`,
  productivity: (m) => `productivity of ${m}`,
  debits: (m) => `debits for ${m}`,
  deposits: (m) => `deposits at ${m}`,
  insolvency: (m) => `insolvency of ${m}`,
  dealers: (m) => `dealers in ${m}`,
  hazard: (m) => `a hazard in ${m}`,
  subscriptions: (m) => `subscriptions to ${m}`,
  recovery: (m) => `recovery of ${m}`,
  debentures: (m) => `debentures for ${m}`,
  indices: (m) => `indices of ${m}`,
  split: (m) => `a split of ${m}`,
  indentures: (m) => `indentures for ${m}`,
  draft: (m) => `a draft for ${m}`,
  investors: (m) => `investors in ${m}`,
  box: (m) => `a box for ${m}`,
  declared: (m) => `${m} that has been declared`,
  purchased: (m) => `${m} that has been purchased`,
  holdings: (m) => `holdings of ${m}`,
  boom: (m) => `a boom in ${m}`,
  capitalised: (m) => `${m} that is capitalised`,
  effect: (m) => `the effect of ${m}`,
  authorized: (m) => `${m} that has been authorized`,
  coupons: (m) => `coupons on ${m}`,
  abroad: (m) => `${m} earned abroad`,
  outlays: (m) => `outlays of ${m}`,
  relief: (m) => `relief from ${m}`,
  intensity: (m) => `intensity of ${m}`,
  intensive: (m) => `intensive in ${m}`,
  employed: (m) => `${m} employed in the business`,
  rally: (m) => `a rally in ${m}`,
  worth: (m) => `worth of ${m}`,
  warrants: (m) => `warrants for ${m}`,
  dates: (m) => `dates for ${m}`,
  cash: (m) => `cash for ${m}`,
  requirements: (m) => `requirements for ${m}`,
  classes: (m) => `classes of ${m}`,
  certificates: (m) => `certificates of ${m}`,
  arbitrage: (m) => `arbitrage in ${m}`,
  exchanges: (m) => `exchanges for ${m}`,
  owned: (m) => `${m} that is owned`,
  cost: (m) => `costs attributable to ${m}`,
  price: (m) => `the price for ${m}`,
  market: (m) => `a market for ${m}`,
  capital: (m) => `capital for ${m}`,
  stock: (m) => `stock of ${m}`,
  bond: (m) => `a bond for ${m}`,
  bonds: (m) => `bonds for ${m}`,
  bank: (m) => `a bank for ${m}`,
  credit: (m) => `credit for ${m}`,
  deposit: (m) => `a deposit for ${m}`,
  shipment: (m) => `a shipment by ${m}`,
  shipping: (m) => `shipping of ${m}`,
  accounting: (m) => `accounting for ${m}`,
  audit: (m) => `an audit of ${m}`,
  investment: (m) => `an investment in ${m}`,
  income: (m) => `income from ${m}`,
  payroll: (m) => `payroll for ${m}`,
  budget: (m) => `a budget for ${m}`,
  management: (m) => `management of ${m}`,
  marketing: (m) => `marketing of ${m}`,
  production: (m) => `production of ${m}`,
  business: (m) => `business related to ${m}`,
  trade: (m) => `trade in ${m}`,
  customs: (m) => `customs treatment of ${m}`,
  rate: (m) => `the rate applied to ${m}`,
  value: (m) => `the value of ${m}`,
  fund: (m) => `a fund for ${m}`,
  loan: (m) => `a loan for ${m}`,
  equity: (m) => `equity related to ${m}`,
  dividend: (m) => `a dividend from ${m}`,
  discount: (m) => `a discount on ${m}`,
  premium: (m) => `a premium on ${m}`,
  portfolio: (m) => `a portfolio of ${m}`,
  sinking: (m) => `sinking-fund amounts for ${m}`,
}

function composeStructural(lower) {
  if (PHRASE[lower]) return PHRASE[lower]

  let m = lower.match(/^(.+) by (.+)$/)
  if (m) return `${m[1]} arranged or analysed by ${m[2]}`

  m = lower.match(/^(.+) from (.+)$/)
  if (m) return `${m[1]} obtained from ${m[2]}`

  m = lower.match(/^(.+) for (.+)$/)
  if (m) return `${m[1]} intended for ${m[2]}`

  m = lower.match(/^(.+) on (.+)$/)
  if (m) return `${m[1]} applied on ${m[2]}`

  m = lower.match(/^(.+) with (.+)$/)
  if (m) return `${m[1]} together with ${m[2]}`

  m = lower.match(/^(.+) in (.+)$/)
  if (m) return `${m[1]} in the context of ${m[2]}`

  m = lower.match(/^(.+) of (.+)$/)
  if (m) return `${m[1]} of ${m[2]}`

  return ''
}

function composeDefinition(expression, partOfSpeech) {
  const raw = expression.trim()
  const lower = raw.toLocaleLowerCase('en-US')
  if (PHRASE[lower]) return PHRASE[lower]

  const structural = composeStructural(lower)
  if (structural && !/in commercial or accounting use/i.test(structural)) return structural

  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    const head = parts[parts.length - 1]
    const mod = parts.slice(0, -1).join(' ')
    if (HEAD[head]) return HEAD[head](mod)
    if (/er$|or$|ee$|ant$|ist$/.test(head)) return `a person or firm involved in ${mod}`
    if (/ing$/.test(head)) return `${head} for ${mod}`
    if (/tion$|sion$|ment$|ance$|ence$/.test(head)) return `${withArticle(head)} for ${mod}`
    return `${withArticle(raw)} used in professional practice`
  }

  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) return `to ${lower}`
  if (/\badj/.test(pos) || isLikelyAdjective(raw)) return `describing something as ${lower}`
  return `${withArticle(raw)} used in professional practice`
}

function pickCols(cands, expression, pos) {
  const out = []
  for (const c of cands) {
    if (isFakeCol(c, expression, pos)) continue
    if (!c.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(c)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`clarify “${expression}”`, `use “${expression}” precisely`)
  return unique(out).filter((c) => !isFakeCol(c, expression, pos)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, listSlug, id) {
  const x = expression
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  if (/[?!.]$/.test(x)) return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
    return pickCols([`${x} carefully`, `decide whether to ${x}`, `refuse to ${x}`], x, partOfSpeech)
  }
  if (/\badj/.test(pos) || isLikelyAdjective(x)) {
    const art = /^[aeiou]/i.test(x) ? 'an' : 'a'
    return pickCols([`${art} ${x} decision`, `remain ${x}`, `sound ${x}`], x, partOfSpeech)
  }
  const byList = {
    accounting: [
      [`post the ${x}`, `reconcile the ${x}`, `disclose the ${x}`],
      [`accrue the ${x}`, `restate the ${x}`, `roll forward the ${x}`],
    ],
    finance: [
      [`model the ${x}`, `stress-test the ${x}`, `hedge the ${x}`],
      [`price the ${x}`, `fund the ${x}`, `refinance the ${x}`],
    ],
    business: [
      [`brief the team on the ${x}`, `agree the ${x}`, `document the ${x}`],
      [`scope the ${x}`, `own the ${x}`, `close out the ${x}`],
    ],
    daily: [
      [`look up “${x}”`, `note “${x}”`, `double-check “${x}”`],
      [`ask about the ${x}`, `keep the ${x}`, `file the ${x}`],
    ],
  }
  const options = byList[listSlug] || byList.daily
  return pickCols(options[hashId(id) % options.length], x, partOfSpeech)
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
      { en: `The lead schedule supports the ${x}.`, zh: `主导明细表支持「${zh}」。` },
    ],
    finance: [
      { en: `The deal model hinges on the ${x}.`, zh: `交易模型取决于「${zh}」。` },
      { en: `Risk reported a spike in the ${x}.`, zh: `风控报告「${zh}」出现飙升。` },
      { en: `We stress-tested assumptions about the ${x}.`, zh: `我们对「${zh}」相关假设做了压力测试。` },
      { en: `Treasury flagged the ${x} in the morning pack.`, zh: `资金部在晨报中标出了「${zh}」。` },
      { en: `The credit memo references the ${x}.`, zh: `贷记通知单引用了「${zh}」。` },
    ],
    business: [
      { en: `Legal asked us to redefine the ${x}.`, zh: `法务要求我们重新界定「${zh}」。` },
      { en: `The kickoff deck covers the ${x}.`, zh: `启动材料覆盖了「${zh}」。` },
      { en: `Ops tracked the ${x} against the SLA.`, zh: `运营按服务级别协议跟踪「${zh}」。` },
      { en: `We renegotiated terms around the ${x}.`, zh: `我们就「${zh}」重新谈了条款。` },
      { en: `The customer FAQ explains the ${x}.`, zh: `客户常见问题说明了「${zh}」。` },
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
  return { list }
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let defs = 0
let examples = 0
let cols = 0

for (const word of pack.words) {
  if (String(word.id).startsWith('v1-')) continue
  const { list } = primaryMeta(word.id, pack.memberships)

  if (isWeakDefinition(word.enDefinition)) {
    word.enDefinition = composeDefinition(word.expression, word.partOfSpeech)
    if (isWeakDefinition(word.enDefinition)) {
      word.enDefinition = `${withArticle(word.expression)} used in professional practice`
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

  if (isGenericColSet(word.collocations, word.expression, word.partOfSpeech) || (word.collocations || []).length < 2) {
    word.collocations = buildCollocations(word.expression, word.partOfSpeech, list, word.id)
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
const commercialLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && /in commercial or accounting use$/i.test(w.enDefinition || ''),
)
mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round5-report.json'),
  `${JSON.stringify(
    {
      defs,
      examples,
      cols,
      stillWeak: stillWeak.length,
      softLeft: softLeft.length,
      commercialLeft: commercialLeft.length,
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
      commercialLeft: commercialLeft.length,
    },
    null,
    2,
  ),
)
