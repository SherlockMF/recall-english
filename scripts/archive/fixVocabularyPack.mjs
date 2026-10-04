/**
 * Apply confirmed factual fixes to the combined vocabulary pack.
 *
 * - Expression typos / truncations
 * - Wrong ZH glosses / contaminated answers
 * - Remove unsuitable entries
 * - Sanitize ECDICT debris in zhGloss / acceptedZhAnswers for all remaining words
 * - Clean primary EN definitions (strip WordNet multi-sense dumps when possible)
 *
 * Run: node scripts/fixVocabularyPack.mjs
 * Then: npm run seed:pack
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')

function unique(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))]
}

function sanitizeZhFragment(value) {
  return String(value ?? '')
    .replace(/\\n/g, '；')
    .replace(/\n/g, '；')
    .replace(/\[[^\]]{1,12}\]/g, '')
    .replace(/\b(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|pl|interj)\.\s*/gi, '')
    .replace(/[；;]+\s*/g, '；')
    .replace(/[,，]\s*[,，]+/g, '，')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[；;,\s，]+|[；;,\s，]+$/g, '')
    .trim()
}

function splitZhSenses(value) {
  return sanitizeZhFragment(value)
    .split(/[；;,，]/)
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false
      if (/^(vt|vi|n|adj|adv|interj)$/i.test(part)) return false
      if (/^\([^)]*\)$/.test(part)) return false // e.g. (度量衡)
      if (part.length === 1 && !/[\u3400-\u9fff]/.test(part)) return false
      return true
    })
}

function primaryZhGloss(raw, max = 3) {
  const senses = splitZhSenses(raw)
  if (senses.length === 0) return sanitizeZhFragment(raw) || String(raw ?? '').trim()
  return senses.slice(0, max).join('，')
}

function cleanedAnswers(rawGloss, answers) {
  const fromAnswers = (Array.isArray(answers) ? answers : []).flatMap(splitZhSenses)
  return unique([primaryZhGloss(rawGloss), ...fromAnswers, ...splitZhSenses(rawGloss)])
}

/** Prefer first usable English sense; drop WordNet POS dumps when multiple. */
function cleanEnDefinition(value) {
  let text = String(value ?? '').trim()
  if (!text) return text
  // Split ECDICT / WordNet multi-line dumps
  const parts = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((p) => p.replace(/^\s*[nav]\.\s*/i, '').trim())
    .filter(Boolean)
  // Drop biographical / pointer junk as primary if later sense looks better — keep first non-empty
  const first = parts[0] || text
  // Truncation repair markers
  if (/an identif$/i.test(first)) return first.replace(/an identif$/i, 'an identifying mark or label')
  return first.length > 400 ? `${first.slice(0, 397)}...` : first
}

/** Delete these word ids entirely (unsuitable or irreparably wrong). */
const DELETE_IDS = new Set([
  'core-1f956b5138bfda', // rape
  'core-39c2a0993ad1b3', // proposition (sexual solicitation)
  'econ-da2b128800d4e1', // us = 美国 (pronoun headword)
  'econ-d2d359e4ae582a', // GM: ZH=通用汽车 EN=gram
  'econ-95633a5a6d22bd', // involvement = 财政困难
  'econ-086a42a4aeca63', // depreciation cause (headword nonsense)
])

/** expression renames by id */
const RENAME_BY_ID = {
  'econ-f866b7d52a108c': "customer's deposit",
  'econ-59617fb15a8104': "customer's ledger",
  'econ-9ab1b53c0dc45a': "customer's container deposit",
  'econ-f8eaf8ac8cfb39': "customer's credit rating",
  'econ-617857e3fd4a43': 'capital dividend',
  'econ-03f8cfac29c222': "banker's commercial credit",
  'econ-35c56ca8dcf1a1': 'return on equity',
  'econ-19475b84dae29d': 'return on investment',
  'econ-c4f8e2f4a7930d': 'specialized foreign exchange bank',
  'econ-0da19cb367526f': 'general average deposit receipt',
  'econ-a34fe22dc5a5e4': 'reserve for pension fund',
  'econ-c3bf2ad1961f87': 'full absorption costing',
  'econ-0b51ac34b1a545': 'securities and exchange commission',
  'econ-69233843b037a1': 'bank for international settlements',
  'econ-2e1b415945a3d5': 'accrued commission receivable',
  'econ-62973f3c66611d': 'straight cost plus contract',
  'econ-b881f1189138ca': 'supply price schedules',
  'econ-ee4c3a37c5d1c5': 'explicit costs',
  'econ-005bd7b495b889': 'commercial invoice',
  'econ-03e9a655a6b1ac': 'commercial credit insurance',
  'econ-2a23c8d96c8a98': 'commercial correspondence',
  'econ-f261136d92e45b': 'non-bearer bond',
  'econ-68d5e03fd1581a': 'cost of manufacture',
  'econ-0bdcdbe91e9682': 'notes receivable from customers',
  'econ-d280642693138e': "commission on auditor's responsibilities",
  'econ-473125b5905c2f': 'investment securities',
  'econ-f689704c815b3c': 'price-earnings ratio',
  'econ-b0cd8f4665a17b': 'price sovereignty',
  'econ-52e9371f00cdce': 'superannuation fund',
  'econ-12931b50b2ad0c': 'bond interest receivable',
  'econ-db2c032fc99ea5': "ratification of agents' contracts",
  'econ-bff528f3395e97': 'import commission house',
  'econ-b2111a0c5e2c52': 'fully depreciated assets in active use',
  'econ-7a29529fad923a': 'association of government accountants',
  'econ-ef66a319661929': 'association of certified accountants',
  'econ-9094a4e09cd5fe': 'australian society of accountants',
  'econ-a9748f716bcdfb': 'inter-american commercial arbitration commission',
  'econ-1c569ffb6c0f24': 'results management',
  'econ-48cd25026192af': 'average quality of production',
  'econ-b4189992b4933e': 'application for loan form',
}

/** Full field overrides by id */
const PATCH_BY_ID = {
  'econ-e058f812ae6ba9': {
    // surely was glossed as surety
    expression: 'surety',
    lemma: 'surety',
    zhGloss: '保证人，保证金，担保',
    enDefinition: 'a person who takes responsibility for another\'s performance of an undertaking; something given as security',
    partOfSpeech: 'noun',
    acceptedZhAnswers: ['保证人', '保证金', '担保', '保证'],
  },
  'econ-3f76207183ce12': {
    zhGloss: '货物，商品，动产',
    enDefinition: 'merchandise or possessions; articles of trade',
    acceptedZhAnswers: ['货物', '商品', '动产'],
  },
  'econ-efa0c129598db9': {
    zhGloss: '宣传材料，商品说明书',
    enDefinition: 'printed material used to advertise or describe products or services',
    acceptedZhAnswers: ['宣传材料', '商品说明书', '广告文案'],
  },
  'v1-debt-to-equity-ratio-0d98da3b': {
    zhGloss: '债务权益比，产权比率',
    enDefinition: 'a leverage ratio comparing total debt with shareholders\' equity',
    acceptedZhAnswers: ['债务权益比', '产权比率', '负债权益比'],
  },
  'econ-43d4991437f61d': {
    enDefinition: 'relating to money, finance, or the management of funds',
  },
  'v1-depreciation-af9a0fb7': {
    zhGloss: '折旧',
    enDefinition: 'the systematic allocation of a tangible asset\'s depreciable amount over its useful life',
    acceptedZhAnswers: ['折旧'],
  },
  'v1-discount-rate-654e3f44': {
    zhGloss: '折现率，贴现率',
    enDefinition: 'the interest rate used to discount future cash flows to present value; also a central-bank lending rate',
    acceptedZhAnswers: ['折现率', '贴现率'],
  },
  'econ-1a95769f3608d9': {
    zhGloss: '代理佣金，代销佣金',
    enDefinition: 'a sales commission paid to an agent or salesperson, often as an override on others\' sales',
    acceptedZhAnswers: ['代理佣金', '代销佣金', '销售提成'],
  },
  'econ-97e463e8ad517d': {
    zhGloss: '代理银行，往来行',
    enDefinition: 'a bank that provides services in a locality on behalf of another bank',
    acceptedZhAnswers: ['代理银行', '往来行', '代理商行'],
  },
  'econ-415213a8bb2f9a': {
    zhGloss: '使用权，享用',
    enDefinition: 'the right to use and enjoy property; pleasure derived from use',
    acceptedZhAnswers: ['使用权', '享用'],
  },
  'econ-13506c7614a07d': {
    zhGloss: '律师，募捐者',
    enDefinition: 'a legal practitioner who advises clients and prepares cases; also a person who solicits contributions',
    acceptedZhAnswers: ['律师', '募捐者'],
  },
  'econ-64eb0f145ba09e': {
    zhGloss: '厂家检验证明书',
    enDefinition: 'a certificate issued by a manufacturer confirming inspection of goods',
    acceptedZhAnswers: ['厂家检验证明书', '制造商检验证书'],
  },
  'econ-cf11c02e2f6b31': {
    zhGloss: '股东分户账',
    enDefinition: 'a ledger recording each stockholder\'s shareholdings',
    acceptedZhAnswers: ['股东分户账', '股东总账'],
  },
  'econ-bf1aa02489fe8c': {
    zhGloss: '设定资本，法定股本',
    enDefinition: 'the amount of capital that a corporation is authorized or stated to have',
    acceptedZhAnswers: ['设定资本', '法定股本', '设定股本'],
  },
  'econ-04bddc34df9f8d': {
    zhGloss: '主要成本，直接成本',
    enDefinition: 'direct materials plus direct labour costs of production',
    acceptedZhAnswers: ['主要成本', '直接成本'],
  },
  'econ-cbe46631e294c8': {
    zhGloss: '债券基金',
    enDefinition: 'an investment fund that primarily holds bonds',
    acceptedZhAnswers: ['债券基金', '公司债基金'],
  },
  'econ-8024ecc2651265': {
    zhGloss: '奖学金，研究员基金',
    enDefinition: 'money granted for advanced study or research',
    acceptedZhAnswers: ['奖学金', '研究员基金', '研究员薪金'],
  },
  'econ-b8f37eb534d4e5': {
    zhGloss: '履行，完成',
    enDefinition: 'to carry out or complete an obligation or contract',
    acceptedZhAnswers: ['履行', '完成', '履行契约'],
  },
  'econ-6077a4b4c2f88d': {
    zhGloss: '面额，票面金额',
    enDefinition: 'the face value of a currency note, coin, or security',
    acceptedZhAnswers: ['面额', '票面金额', '名称'],
  },
  'econ-50b9fdec03a236': {
    zhGloss: '应付账款',
    enDefinition: 'amounts a business owes to suppliers for goods or services received',
    acceptedZhAnswers: ['应付账款', '应付帐款'],
  },
  'econ-b553a837f47bd1': {
    zhGloss: '创业管理，合资企业管理',
    enDefinition: 'the management of a new business venture or joint enterprise',
    acceptedZhAnswers: ['创业管理', '合资企业管理'],
  },
  'econ-d50b9ed8397964': {
    zhGloss: '金融公司，财务公司',
    enDefinition: 'a company that provides loans and other financing services',
    acceptedZhAnswers: ['金融公司', '财务公司'],
  },
  'econ-67a9a11e2ab700': {
    zhGloss: '库存物资基金，存货资金',
    enDefinition: 'funds tied up in inventory or stores',
    acceptedZhAnswers: ['库存物资基金', '存货资金'],
  },
  'econ-9ddf38a8e9702d': {
    zhGloss: '补充信用证',
    enDefinition: 'an additional letter of credit that supplements an existing facility',
    acceptedZhAnswers: ['补充信用证', '补充信用状'],
  },
  'econ-f2dac981437cec': {
    zhGloss: '直接成本法，直接成本计算',
    enDefinition: 'a costing method that treats only variable manufacturing costs as product costs',
    acceptedZhAnswers: ['直接成本法', '直接成本计算'],
  },
  'econ-81d462ea2ce119': {
    zhGloss: '出口风险担保',
    enDefinition: 'a guarantee or insurance scheme covering exporters against certain commercial or political risks',
    acceptedZhAnswers: ['出口风险担保', '出口信用担保'],
  },
  'econ-58209b0d2ad878': {
    zhGloss: '保险业务组合',
    enDefinition: 'the set of insurance policies or risks held by an insurer',
    acceptedZhAnswers: ['保险业务组合', '保险业务量'],
  },
  'econ-a9748f716bcdfb': {
    expression: 'inter-american commercial arbitration commission',
    lemma: 'inter-american commercial arbitration commission',
    zhGloss: '美洲国家商务仲裁委员会',
    enDefinition: 'an inter-American body for commercial arbitration',
    acceptedZhAnswers: ['美洲国家商务仲裁委员会'],
  },
  'econ-89ef6ce16b5c4e': {
    zhGloss: '清仓甩卖，大贱卖',
    enDefinition: 'a sale intended to clear remaining stock at reduced prices',
    acceptedZhAnswers: ['清仓甩卖', '大贱卖', '出清存货'],
  },
  'econ-b277ac1143a0c4': {
    zhGloss: '中间价，中间市场价格',
    enDefinition: 'a price midway between bid and offer, or a mid-market quotation',
    acceptedZhAnswers: ['中间价', '中间市场价格'],
  },
  'econ-be8682cde20cea': {
    zhGloss: '利息收入',
    enDefinition: 'cash or amounts received as interest',
    acceptedZhAnswers: ['利息收入', '利息收款'],
  },
  'econ-41fec4c2eeaf18': {
    zhGloss: '国内税务局，国内收入署',
    enDefinition: 'the United States federal tax authority (IRS)',
    acceptedZhAnswers: ['国内税务局', '国内收入署'],
  },
  'econ-8819f8381309fb': {
    zhGloss: '营业外利息，非经营利息',
    enDefinition: 'interest income or expense not arising from core operating activities',
    acceptedZhAnswers: ['营业外利息', '非经营利息'],
  },
  'econ-6000e207a18e8f': {
    zhGloss: '账户分类，会计科目分类',
    enDefinition: 'the grouping of accounts into classes in a chart of accounts',
    acceptedZhAnswers: ['账户分类', '会计科目分类', '会计科目表'],
  },
  'econ-626b5972f511f0': {
    zhGloss: '流通信用证，巡回信用证',
    enDefinition: 'a letter of credit that can be presented at multiple banks in different places',
    acceptedZhAnswers: ['流通信用证', '巡回信用证'],
  },
  'econ-b387f1d7412530': {
    zhGloss: '营销风险，销售风险',
    enDefinition: 'risks arising from marketing or selling activities',
    acceptedZhAnswers: ['营销风险', '销售风险'],
  },
  'econ-f044ba0daed0ec': {
    zhGloss: '可控预算，可控制造费用预算',
    enDefinition: 'a budget limited to costs that a manager can control',
    acceptedZhAnswers: ['可控预算', '可控制造费用预算'],
  },
  'econ-63b44dd7a7ca0f': {
    zhGloss: '生产者资本',
    enDefinition: 'capital used by producers in production',
    acceptedZhAnswers: ['生产者资本'],
  },
  'econ-c0597e0da7be00': {
    zhGloss: '总价，一次总付价格',
    enDefinition: 'a single overall price for a package of goods or services',
    acceptedZhAnswers: ['总价', '一次总付价格', '包干价格'],
  },
  'econ-d6fc789410e1ce': {
    zhGloss: '财政关税，收入性关税',
    enDefinition: 'a customs duty imposed mainly to raise government revenue',
    acceptedZhAnswers: ['财政关税', '收入性关税'],
  },
  'econ-ceb23868946645': {
    zhGloss: '有担保债务，担保借款',
    enDefinition: 'debt backed by collateral or other security',
    acceptedZhAnswers: ['有担保债务', '担保借款'],
  },
  'econ-0fc4bf240c4ece': {
    zhGloss: '无违约风险利率',
    enDefinition: 'an interest rate that assumes no risk of default by the borrower',
    acceptedZhAnswers: ['无违约风险利率', '无风险利率'],
  },
  'econ-fe63c27b19cd58': {
    zhGloss: '公用事业股票',
    enDefinition: 'shares of companies that provide public utilities such as electricity or water',
    acceptedZhAnswers: ['公用事业股票', '公用事业股'],
  },
  'econ-10d1876d1d6d18': {
    zhGloss: '未领股利，应付未领股利',
    enDefinition: 'dividends declared payable that have not yet been claimed by shareholders',
    acceptedZhAnswers: ['未领股利', '应付未领股利'],
  },
  'econ-58e588deeb196d': {
    zhGloss: '间断市场，非连续市场',
    enDefinition: 'a market in which trading does not occur continuously',
    acceptedZhAnswers: ['间断市场', '非连续市场'],
  },
  'econ-1317a283f997cc': {
    zhGloss: '股票交易，股权交易',
    enDefinition: 'the buying and selling of equities',
    acceptedZhAnswers: ['股票交易', '股权交易'],
  },
  'econ-67e553746d92da': {
    zhGloss: '社会成本效益',
    enDefinition: 'analysis comparing social costs and social benefits of a project or policy',
    acceptedZhAnswers: ['社会成本效益', '社会成本-效益'],
  },
  'econ-1bdfc18e175d0a': {
    zhGloss: '物价与收入政策',
    enDefinition: 'government policy aimed at controlling prices and incomes',
    acceptedZhAnswers: ['物价与收入政策', '价格与所得政策'],
  },
  'econ-832916956466c2': {
    zhGloss: '应收不动产抵押贷款',
    enDefinition: 'mortgage loans on real estate that are receivable by the lender',
    acceptedZhAnswers: ['应收不动产抵押贷款', '应收房地产贷款'],
  },
  'econ-55e20939c5227d': {
    zhGloss: '高净值市场',
    enDefinition: 'the market segment of high-net-worth individuals or clients',
    acceptedZhAnswers: ['高净值市场', '高净值客户市场'],
  },
  'econ-25181d9a12ebad': {
    zhGloss: '价格伸缩性，价格灵活性',
    enDefinition: 'the ability of prices to adjust upward or downward',
    acceptedZhAnswers: ['价格伸缩性', '价格灵活性'],
  },
  'econ-a0732fb0258130': {
    zhGloss: '组合投资，证券组合投资',
    enDefinition: 'investment in a portfolio of securities rather than a controlling stake',
    acceptedZhAnswers: ['组合投资', '证券组合投资', '间接投资'],
  },
  'econ-a2d987356787f5': {
    expression: 'cumulative preferred stock',
    lemma: 'cumulative preferred stock',
    zhGloss: '累积优先股',
    enDefinition: 'preferred stock on which unpaid dividends accumulate until paid',
    acceptedZhAnswers: ['累积优先股', '累积股利优先股'],
  },
  'econ-09c30269aa3f32': {
    zhGloss: '冲减资本，资本冲销',
    enDefinition: 'a charge made against capital rather than against income',
    acceptedZhAnswers: ['冲减资本', '资本冲销'],
  },
  'econ-2bf03540632743': {
    zhGloss: '赊销与收款费用',
    enDefinition: 'expenses of granting credit and collecting receivables',
    acceptedZhAnswers: ['赊销与收款费用', '信用与收款费用'],
  },
  'econ-ed7c51ca23146e': {
    zhGloss: '信用档案，资信档案',
    enDefinition: 'a file of information used to assess a customer\'s creditworthiness',
    acceptedZhAnswers: ['信用档案', '资信档案'],
  },
  'econ-570835fa4e9870': {
    zhGloss: '信贷利率，信用利率',
    enDefinition: 'the interest rate charged on credit or a loan facility',
    acceptedZhAnswers: ['信贷利率', '信用利率'],
  },
  'core-9080a51cd6de0d': {
    zhGloss: '挖，掘，探究',
    enDefinition: 'to break up and move earth; to search or investigate',
    acceptedZhAnswers: ['挖', '掘', '探究'],
  },
  'core-702b78f40c5a2c': {
    zhGloss: '追逐，追求',
    enDefinition: 'to pursue in order to catch or attain',
    partOfSpeech: 'verb',
    acceptedZhAnswers: ['追逐', '追求'],
  },
  'core-8c72b58e547c0f': {
    zhGloss: '狩猎，搜寻',
    enDefinition: 'to pursue and kill or catch wild animals; to search for something',
    partOfSpeech: 'verb',
    acceptedZhAnswers: ['狩猎', '搜寻'],
  },
  'econ-e91f5f7daad357': {
    zhGloss: '办公室管理',
    enDefinition: 'the organization and administration of office work and staff',
    acceptedZhAnswers: ['办公室管理', '办公管理'],
  },
  'econ-a1cd2e25187921': {
    zhGloss: '随意审计，任意审计',
    enDefinition: 'an audit that is optional rather than legally required',
    acceptedZhAnswers: ['随意审计', '任意审计'],
  },
  'econ-463062dc5a6f90': {
    zhGloss: '特许会计师准会员',
    enDefinition: 'an associate-grade membership of a chartered accountancy body',
    acceptedZhAnswers: ['特许会计师准会员', '特许会计师协会准会员'],
  },
  'econ-32d7c55cbdec19': {
    zhGloss: '短期收入损失',
    enDefinition: 'a loss of revenue over a short period',
    acceptedZhAnswers: ['短期收入损失', '短期营收损失'],
  },
  'econ-edec4b1b4ce403': {
    zhGloss: '递延收益贷项',
    enDefinition: 'income credits that are recognized later than the related cash or billing',
    acceptedZhAnswers: ['递延收益贷项', '延期收益贷项'],
  },
  'econ-e066133fdba5e5': {
    zhGloss: '前，不含，已除权',
    enDefinition: 'a finance prefix meaning without the right to a dividend or other benefit (e.g. ex dividend)',
    partOfSpeech: 'adverb',
    acceptedZhAnswers: ['前', '不含', '已除权'],
  },
  'core-78c9a53e2f28b5': {
    zhGloss: '再见',
    enDefinition: 'a casual expression used when leaving; goodbye',
    partOfSpeech: 'interjection',
    acceptedZhAnswers: ['再见'],
  },
  'core-9c20b9ba55a293': {
    zhGloss: '适合，合身，健康的',
    enDefinition: 'to be the right size or shape; physically healthy; suitable',
    acceptedZhAnswers: ['适合', '合身', '健康的'],
  },
  'core-b0fa3893769995': {
    zhGloss: '解释，口译，诠释',
    enDefinition: 'an explanation of meaning; oral translation',
    acceptedZhAnswers: ['解释', '口译', '诠释'],
  },
  'core-208d788ad4ab65': {
    zhGloss: '别墅',
    enDefinition: 'a large and comfortable country house',
    acceptedZhAnswers: ['别墅'],
  },
  'core-2f7106a0cdfaa6': {
    zhGloss: '向前，向外',
    enDefinition: 'forward in time, place, or order',
    partOfSpeech: 'adverb',
    acceptedZhAnswers: ['向前', '向外', '以后'],
  },
  'core-9726f4049391ae': {
    zhGloss: '航空公司，航线',
    enDefinition: 'a company that provides regular public air transport',
    acceptedZhAnswers: ['航空公司', '航线'],
  },
  'core-83e4fbbbb4a2ec': {
    zhGloss: '营业额，周转率',
    enDefinition: 'the amount of business done; the rate at which stock or staff is replaced',
    acceptedZhAnswers: ['营业额', '周转率', '人员流动'],
  },
  'core-828845d3914ec6': {
    zhGloss: '消除，排除，剔除',
    enDefinition: 'to remove or get rid of something',
    acceptedZhAnswers: ['消除', '排除', '剔除', '除去'],
  },
  'core-39ae89e0a13594': {
    zhGloss: '执行，实行，完成',
    enDefinition: 'to carry out a plan, order, or piece of work',
    acceptedZhAnswers: ['执行', '实行', '完成'],
  },
  'core-44d5369032336a': {
    zhGloss: '自行车，脚踏车',
    enDefinition: 'a bicycle',
    acceptedZhAnswers: ['自行车', '脚踏车'],
  },
  'core-5ad43148c90a8f': {
    zhGloss: '第五，五分之一',
    enDefinition: 'constituting number five in a sequence; one of five equal parts',
    acceptedZhAnswers: ['第五', '五分之一'],
  },
  'core-34305c61a64c3c': {
    zhGloss: '害怕的，惊慌的',
    enDefinition: 'frightened or worried',
    partOfSpeech: 'adjective',
    acceptedZhAnswers: ['害怕的', '惊慌的', '担惊受怕的'],
  },
  'core-7f550a9f4c4417': {
    zhGloss: '嗨',
    enDefinition: 'an informal greeting or interjection to get attention',
    partOfSpeech: 'interjection',
    acceptedZhAnswers: ['嗨'],
  },
  'core-b02b5038c33595': {
    zhGloss: '性别',
    enDefinition: 'the state of being male or female; a grammatical category',
    acceptedZhAnswers: ['性别', '语法性别'],
  },
  'core-b389d89ce85203': {
    zhGloss: '专业知识，专长',
    enDefinition: 'expert skill or knowledge in a particular field',
    acceptedZhAnswers: ['专业知识', '专长', '专门技术'],
  },
  'core-8486abc504c32d': {
    zhGloss: '便士',
    enDefinition: 'plural of penny (British currency unit)',
    acceptedZhAnswers: ['便士'],
  },
  'core-bb2e84b075ab69': {
    zhGloss: '奖学金，学问',
    enDefinition: 'financial aid awarded to a student on academic merit; also scholarly learning',
    acceptedZhAnswers: ['奖学金', '学问', '学术成就'],
  },
  'core-dfcb43ff4ef663': {
    zhGloss: '结果，结局',
    enDefinition: 'something that follows as a result or consequence',
    acceptedZhAnswers: ['结果', '结局'],
  },
  'core-32185118d94a18': {
    zhGloss: '场地，举办地',
    enDefinition: 'the place where an event or meeting is held',
    acceptedZhAnswers: ['场地', '举办地', '会场'],
  },
  'core-4b0444069dc13f': {
    zhGloss: '购物中心，商场',
    enDefinition: 'a large enclosed shopping complex',
    acceptedZhAnswers: ['购物中心', '商场'],
  },
  'core-2523b26dbae277': {
    zhGloss: '妈妈',
    enDefinition: 'informal word for mother',
    acceptedZhAnswers: ['妈妈', '母亲'],
  },
  'core-78b6f944434eac': {
    zhGloss: '会话，交谈',
    enDefinition: 'an informal talk between two or more people',
    acceptedZhAnswers: ['会话', '交谈', '说话'],
  },
  'core-d83fc386ba33f5': {
    zhGloss: '暖和的，温暖的，热情的',
    enDefinition: 'having or giving out heat to a moderate degree; friendly',
    acceptedZhAnswers: ['暖和的', '温暖的', '热情的'],
  },
  'econ-889c6853a117ac': {
    zhGloss: '参与者，交易者',
    enDefinition: 'a person or company that takes part in a market or activity',
    acceptedZhAnswers: ['参与者', '交易者', '玩家'],
  },
  'econ-6c36ab332e72c3': {
    zhGloss: '美元，元',
    enDefinition: 'the basic monetary unit of the United States and some other countries',
    acceptedZhAnswers: ['美元', '元'],
  },
  'core-9796809f7dae48': {
    zhGloss: '监视器，监督，班长',
    enDefinition: 'a screen for display; a person who watches or checks something',
    acceptedZhAnswers: ['监视器', '监督', '班长'],
  },
  'core-13a2828b3adecc': {
    zhGloss: '登记，注册',
    enDefinition: 'an official list; to record in an official list',
    acceptedZhAnswers: ['登记', '注册'],
  },
  'core-e65aace9237833': {
    zhGloss: '裤子',
    enDefinition: 'a piece of clothing covering the body from the waist to the ankles, with a separate part for each leg',
    acceptedZhAnswers: ['裤子'],
  },
  'core-07596f183f5e91': {
    zhGloss: '残疾的，有障碍的',
    enDefinition: 'having a physical or mental condition that limits movements, senses, or activities',
    acceptedZhAnswers: ['残疾的', '有障碍的'],
  },
  'v1-tax-allowance-77ff920b': {
    zhGloss: '免税额，税收扣除额',
    enDefinition: 'an amount that can be deducted or is exempt when calculating taxable income',
    acceptedZhAnswers: ['免税额', '税收扣除额', '扣除额'],
  },
  'v1-weighted-average-cost-e6cd436b': {
    zhGloss: '加权平均成本',
    enDefinition: 'an average cost of inventory weighted by quantities purchased',
    acceptedZhAnswers: ['加权平均成本'],
  },
  'econ-b5efd4907162b8': {
    zhGloss: '未偿付的，未解决的',
    enDefinition: 'not yet paid, resolved, or settled',
    acceptedZhAnswers: ['未偿付的', '未解决的', '未清的'],
  },
  'econ-acb2b66690089d': {
    zhGloss: '清偿，偿还',
    enDefinition: 'the payment of a debt or fulfilment of an obligation',
    acceptedZhAnswers: ['清偿', '偿还', '赎回'],
  },
  'econ-baacee0a140dad': {
    zhGloss: '上限，最高限度',
    enDefinition: 'an upper limit on prices, wages, or other quantities',
    acceptedZhAnswers: ['上限', '最高限度', '顶点'],
  },
  'econ-0bd7211aee528a': {
    zhGloss: '以旧换新折价物',
    enDefinition: 'an item given in part payment toward a new purchase',
    acceptedZhAnswers: ['以旧换新折价物', '折价物'],
  },
  'econ-3f3f462976ce93': {
    zhGloss: '人质',
    enDefinition: 'a person held as security for the fulfilment of a condition',
    acceptedZhAnswers: ['人质'],
  },
  'econ-feb522900cd260': {
    zhGloss: '行李',
    enDefinition: 'personal belongings packed for travel; luggage',
    acceptedZhAnswers: ['行李'],
  },
  'econ-f290fd9a145f9e': {
    zhGloss: '适当的，合适的',
    enDefinition: 'suitable or proper in the circumstances',
    partOfSpeech: 'adjective',
    acceptedZhAnswers: ['适当的', '合适的'],
  },
  'econ-31e10e63573191': {
    zhGloss: '战略，策略',
    enDefinition: 'a plan of action designed to achieve a long-term aim',
    acceptedZhAnswers: ['战略', '策略'],
  },
  'econ-70cafc7ba74a3f': {
    zhGloss: '雇主',
    enDefinition: 'a person or organization that hires people to work for wages',
    acceptedZhAnswers: ['雇主'],
  },
  'econ-e0d587ce038c01': {
    zhGloss: '昂贵的',
    enDefinition: 'costing a lot of money',
    acceptedZhAnswers: ['昂贵的', '花钱多的'],
  },
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const stats = {
  deleted: 0,
  renamed: 0,
  patched: 0,
  sanitized: 0,
  before: pack.words.length,
}

const kept = []
for (const word of pack.words) {
  if (DELETE_IDS.has(word.id)) {
    stats.deleted += 1
    continue
  }

  let next = { ...word }

  if (RENAME_BY_ID[word.id]) {
    next.expression = RENAME_BY_ID[word.id]
    next.lemma = next.expression.toLocaleLowerCase('en-US')
    next.acceptedEnVariants = unique([next.expression, ...(word.acceptedEnVariants || [])])
    stats.renamed += 1
  }

  const patch = PATCH_BY_ID[word.id]
  if (patch) {
    next = { ...next, ...patch }
    if (patch.expression && !patch.lemma) {
      next.lemma = patch.expression.toLocaleLowerCase('en-US')
    }
    if (patch.expression) {
      next.acceptedEnVariants = unique([patch.expression, ...(next.acceptedEnVariants || [])])
    }
    if (patch.zhGloss && !patch.acceptedZhAnswers) {
      next.acceptedZhAnswers = cleanedAnswers(patch.zhGloss, word.acceptedZhAnswers)
    }
    stats.patched += 1
  }

  // Always sanitize ZH / answers / EN for residual ECDICT noise
  const beforeZh = next.zhGloss
  const beforeAns = JSON.stringify(next.acceptedZhAnswers)
  const beforeEn = next.enDefinition
  next.zhGloss = primaryZhGloss(next.zhGloss)
  next.acceptedZhAnswers = cleanedAnswers(beforeZh, next.acceptedZhAnswers)
  next.enDefinition = cleanEnDefinition(next.enDefinition)
  if (
    beforeZh !== next.zhGloss
    || beforeAns !== JSON.stringify(next.acceptedZhAnswers)
    || beforeEn !== next.enDefinition
  ) {
    stats.sanitized += 1
  }

  // Drop NSFW fragments that may remain in answers
  const banned = /性交|强奸|嫖|淫|猥亵|鸡巴|阴茎|阴道/
  next.acceptedZhAnswers = next.acceptedZhAnswers.filter((a) => !banned.test(a))
  if (banned.test(next.zhGloss)) {
    next.zhGloss = next.acceptedZhAnswers[0] || sanitizeZhFragment(next.zhGloss).split(/[；，]/)[0]
  }

  kept.push(next)
}

const keptIds = new Set(kept.map((w) => w.id))
const memberships = pack.memberships.filter((m) => keptIds.has(m.wordId))

const out = {
  ...pack,
  words: kept,
  memberships,
  exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
}

writeFileSync(packPath, `${JSON.stringify(out)}\n`)
console.log(JSON.stringify({
  ...stats,
  afterWords: kept.length,
  afterMemberships: memberships.length,
  packPath,
}, null, 2))
