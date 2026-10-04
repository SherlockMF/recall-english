/**
 * Round-2 vocabulary pack fixes from adversarial review.
 * Run: node scripts/fixVocabularyPackRound2.mjs && npm run seed:pack
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
    // ECDICT POS markers including bare "a." / "aux." / "s." / "r."
    .replace(/(^|[；;\s,，])(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|pl|interj|aux|s|r|a)\.\s*/gi, '$1')
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
      if (/^(vt|vi|n|adj|adv|interj|aux|a|s|r)$/i.test(part)) return false
      if (/^\([^)]*\)$/.test(part)) return false
      if (/^(DOS|WordNet)/i.test(part)) return false
      return true
    })
}

function primaryZhGloss(raw, max = 3) {
  const senses = splitZhSenses(raw)
  if (senses.length === 0) return sanitizeZhFragment(raw) || String(raw ?? '').trim()
  // Dedupe consecutive identical tokens
  const out = []
  for (const s of senses) {
    if (out[out.length - 1] !== s) out.push(s)
  }
  return out.slice(0, max).join('，')
}

function cleanedAnswers(rawGloss, answers) {
  const banned = /性交|强奸|嫖|淫|猥亵|鸡巴|阴茎|阴道|肉欲|杀戳|男风|白痴/
  const fromAnswers = (Array.isArray(answers) ? answers : []).flatMap(splitZhSenses)
  return unique([primaryZhGloss(rawGloss), ...fromAnswers, ...splitZhSenses(rawGloss)])
    .filter((value) => !banned.test(value))
    .filter((value) => !/^(a|n|v|s|r|aux)\./i.test(value))
}

function cleanEnDefinition(value, expression) {
  let text = String(value ?? '').trim()
  if (!text) return text

  // Sync placeholder defs that still quote old typos
  const placeholder = text.match(/^(Business|Accounting|Finance|Daily) sense of [“"'](.+?)[”"']\.?$/i)
  if (placeholder && expression) {
    return `${placeholder[1]} sense of “${expression}”.`
  }

  const parts = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((part) => part.replace(/^\s*[navsr]\.\s*/i, '').trim())
    .filter(Boolean)
    .filter((part) => !/^(psychiatry|High\.?)$/i.test(part))

  let first = parts[0] || text.replace(/^\s*[navsr]\.\s*/i, '').trim()
  // Drop leading orphan POS crumbs like "s. new" / "a involving"
  first = first.replace(/^[asvr]\.\s*/i, '').replace(/^[asvr]\s+(?=[a-z])/i, '')
  if (first.length > 400) first = `${first.slice(0, 397)}...`
  return first
}

function cleanEnVariants(variants, expression) {
  const bad = /customary's|devidend|receivalbe|receopt|foreing|persion|absorpation|commerical|agents's|manaual|ratte|liqudating|shheet|benifit|enterprice|qutota|ballon|footege|transfre|commision|reveivable|invoicf|aisurance|correspondance|manufacuure|customsers|securties|sovereinty|vost |scheduls|arbitation|coverrnent|certitied|austalian|outstandarding|loansand|pro-fitin|shheet/i
  const next = unique([expression, ...(variants || [])]).filter((v) => !bad.test(v) || v === expression)
  return next.length ? next : [expression]
}

const DELETE_IDS = new Set([
  'econ-86e0cfad49b04b', // windfall → 意外损失 irreparable wrong
  'core-dfb04e6fdc8e28', // murder - content
  'econ-51594c99e331e2', // cash on delivery sales sales - duplicate garbage (re-add clean below via rename instead?)
])

// Keep COD sales but rename — don't delete; remove from DELETE
DELETE_IDS.delete('econ-51594c99e331e2')

const RENAME_BY_ID = {
  'econ-369a45f65c5351': 'bank rate',
  'econ-832f2b2b91cfb2': 'accounting manual',
  'econ-b179f297ebaf43': 'inventory liquidating',
  'econ-e4f5b1e5b0321e': 'capital improvement budget',
  'econ-51594c99e331e2': 'cash on delivery sales',
  'econ-a21f594c57bc6d': 'stock warrants outstanding',
  'econ-4372e71ca3665a': 'profit rate of net worth',
  'econ-ba1c1b7113b51b': 'financial times stock indices',
  'econ-3d1bd2a93c7713': 'general accounting',
  'econ-173a6d0fa6452e': 'approximation of the cost',
  'econ-7e65d74fd51d93': 'absorbed manufacturing overhead',
  'econ-57afa66daf6df8': 'cost price',
  'econ-495421c0113fea': 'national association of accountants',
  'econ-c238e2ed64dbd8': 'cost accounting standards board',
  'econ-9586daf9b5bd1d': 'balance sheet classification and valuation',
  'econ-5d406dac43b8ea': 'australian institute of cost accountants',
  'econ-34232e29358140': 'cost-and-benefit-sharing',
  'econ-aeae02af0e4962': 'maturity distribution of loans and securities',
  'econ-39004dbdc004a8': 'reserve for intra-company profit in inventories',
  'econ-0984a5f61891b9': 'balloon payment',
  'econ-1d85065066aa1d': 'footage rate payment',
  'econ-2a0dff52e7e055': 'stock loan',
  'econ-2b1c96b1fa4f6b': 'stock transfer',
  'econ-9c6b594fe79fe9': 'associated enterprise',
  'econ-9ae3569bd481fc': 'autonomous export quota',
  'econ-c6a0eeefd3fec1': 'stuffing order',
  'econ-ab738d8b61b238': 'reserve for purchase of treasury stock',
  'econ-9094a4e09cd5fe': 'australian society of accountants',
  'econ-b4189992b4933e': 'application for loan form',
}

const PATCH_BY_ID = {
  'econ-f866b7d52a108c': {
    enDefinition: 'Business sense of “customer\'s deposit”.',
    zhGloss: '客户存款，客户定金，存入保证金',
    acceptedZhAnswers: ['客户存款', '客户定金', '存入保证金'],
  },
  'econ-59617fb15a8104': {
    enDefinition: 'Accounting sense of “customer\'s ledger”.',
    zhGloss: '应收帐款分户帐，销售客户分户帐',
    acceptedZhAnswers: ['应收账款分户账', '销售客户分户账', '客户分户账'],
  },
  'econ-9ab1b53c0dc45a': {
    enDefinition: 'Business sense of “customer\'s container deposit”.',
  },
  'econ-f8eaf8ac8cfb39': {
    enDefinition: 'Business sense of “customer\'s credit rating”.',
  },
  'econ-12931b50b2ad0c': {
    enDefinition: 'Accounting sense of “bond interest receivable”.',
  },
  'econ-db2c032fc99ea5': {
    enDefinition: 'Accounting sense of “ratification of agents\' contracts”.',
  },
  'econ-617857e3fd4a43': {
    enDefinition: 'Finance sense of “capital dividend”.',
  },
  'econ-c4f8e2f4a7930d': {
    enDefinition: 'Finance sense of “specialized foreign exchange bank”.',
  },
  'econ-0da19cb367526f': {
    enDefinition: 'Accounting sense of “general average deposit receipt”.',
  },
  'econ-a34fe22dc5a5e4': {
    enDefinition: 'Finance sense of “reserve for pension fund”.',
  },
  'econ-0b51ac34b1a545': {
    enDefinition: 'Finance sense of “securities and exchange commission”.',
  },
  'econ-c3bf2ad1961f87': {
    enDefinition: 'Business sense of “full absorption costing”.',
  },
  'econ-1c569ffb6c0f24': {
    enDefinition: 'Business sense of “results management”.',
  },
  'econ-170373adb0cb73': {
    zhGloss: '部，政府部门',
    enDefinition: 'a government department headed by a minister',
    acceptedZhAnswers: ['部', '政府部门', '部委'],
  },
  'econ-2156e40a12d6bd': {
    zhGloss: '贫穷的，差的，劣质的',
    enDefinition: 'having little money or means; of low quality',
    acceptedZhAnswers: ['贫穷的', '差的', '劣质的'],
  },
  'econ-2baf9529782a90': {
    zhGloss: '辩护，防御',
    enDefinition: 'the case presented by the accused in court; protection against attack',
    acceptedZhAnswers: ['辩护', '防御', '防卫'],
  },
  'econ-c3a71b15188728': {
    zhGloss: '交付，递送，交运',
    enDefinition: 'to take goods, letters, etc. to the person or place they have been sent to',
    acceptedZhAnswers: ['交付', '递送', '交运'],
  },
  'econ-9248e701086509': {
    zhGloss: '秘书，书记，大臣',
    enDefinition: 'a person who handles correspondence and administrative work; a senior official',
    acceptedZhAnswers: ['秘书', '书记', '大臣'],
  },
  'econ-7933e585a909e0': {
    zhGloss: '到达，抵达',
    enDefinition: 'the act of arriving; someone or something that has arrived',
    acceptedZhAnswers: ['到达', '抵达', '到达物'],
  },
  'econ-1ded3053d03630': {
    zhGloss: '疲软的，虚弱的，疲弱的',
    enDefinition: 'lacking strength; (of a market) soft or declining',
    acceptedZhAnswers: ['疲软的', '虚弱的', '疲弱的'],
  },
  'econ-ba1d4317935dff': {
    zhGloss: '全国的，国家的，国民的',
    enDefinition: 'relating to a nation as a whole',
    partOfSpeech: 'adjective',
    acceptedZhAnswers: ['全国的', '国家的', '国民的'],
  },
  'econ-f8c70173850f09': {
    // irresistible was glossed as 不可抗力
    expression: 'force majeure',
    lemma: 'force majeure',
    zhGloss: '不可抗力',
    enDefinition: 'unforeseeable circumstances that prevent fulfilment of a contract',
    partOfSpeech: 'noun',
    acceptedZhAnswers: ['不可抗力'],
  },
  'econ-86e0cfad49b04b': {
    zhGloss: '意外收获，横财',
    enDefinition: 'a piece of unexpected good fortune, especially a sudden financial gain',
    acceptedZhAnswers: ['意外收获', '横财'],
  },
  'econ-b4189992b4933e': {
    zhGloss: '贷款申请表',
    enDefinition: 'a form used to apply for a loan',
    acceptedZhAnswers: ['贷款申请表', '借款申请书'],
  },
  'econ-deebbdbf2fe85a': {
    zhGloss: '股份合并，股本合并',
    enDefinition: 'the consolidation of stock or share capital',
    acceptedZhAnswers: ['股份合并', '股本合并'],
  },
  'econ-ba7c00609a936f': {
    zhGloss: '可控成本',
    enDefinition: 'a cost that a manager can influence or control',
    acceptedZhAnswers: ['可控成本', '可控制成本'],
  },
  'econ-0f2a6b9025a563': {
    zhGloss: '换产成本，切换成本',
    enDefinition: 'the cost of changing from one product or process setup to another',
    acceptedZhAnswers: ['换产成本', '切换成本'],
  },
  'econ-9aa77a5c68d4c6': {
    zhGloss: '人力资产会计',
    enDefinition: 'accounting for the value of human resources as assets',
    acceptedZhAnswers: ['人力资产会计'],
  },
  'econ-d8279dab636091': {
    zhGloss: '期货市场',
    enDefinition: 'a market in which futures contracts are traded',
    acceptedZhAnswers: ['期货市场'],
  },
  'econ-32d7c55cbdec19': {
    zhGloss: '短期收入损失',
    enDefinition: 'a loss of revenue over a short period',
    acceptedZhAnswers: ['短期收入损失'],
  },
  'econ-c68b0a6b691407': {
    zhGloss: '软贷款，低息贷款',
    enDefinition: 'a loan on concessional or below-market terms',
    acceptedZhAnswers: ['软贷款', '低息贷款'],
  },
  'econ-7eeb6c707be90a': {
    zhGloss: '价格突然飞涨',
    enDefinition: 'a sudden sharp rise in prices',
    acceptedZhAnswers: ['价格突然飞涨', '价格急涨'],
  },
  'econ-b498a3256b3ebf': {
    zhGloss: '简单再生产',
    enDefinition: 'reproduction that replaces capital without expansion',
    acceptedZhAnswers: ['简单再生产'],
  },
  'econ-002603bcdb8371': {
    zhGloss: '萧条市场，病态市场',
    enDefinition: 'a weak or depressed market',
    acceptedZhAnswers: ['萧条市场', '病态市场', '市面凋滞'],
  },
  'econ-2006397adf49f3': {
    zhGloss: '资本需求量，资本需求',
    enDefinition: 'the quantity of capital demanded',
    acceptedZhAnswers: ['资本需求量', '资本需求'],
  },
  'econ-87baa046759495': {
    zhGloss: '存货留置权，存货扣押权',
    enDefinition: 'a lien on inventory as security for a debt',
    acceptedZhAnswers: ['存货留置权', '存货扣押权'],
  },
  'econ-ebdbf64d502dc4': {
    zhGloss: '认股价格，认购价格',
    enDefinition: 'the price at which shares may be subscribed',
    acceptedZhAnswers: ['认股价格', '认购价格', '预约价格'],
  },
  'core-6266c5dbe4b431': {
    zhGloss: '过度，剩余，超过',
    enDefinition: 'an amount that is more than necessary or allowed',
    acceptedZhAnswers: ['过度', '剩余', '超过', '超额'],
  },
  'core-1f863fb64a444d': {
    zhGloss: '丝，绸，绸缎',
    enDefinition: 'a fine soft fibre produced by silkworms; cloth made from it',
    acceptedZhAnswers: ['丝', '绸', '绸缎'],
  },
  'core-3496ae539fd99f': {
    zhGloss: '肉，肉体',
    enDefinition: 'the soft substance of an animal or human body',
    acceptedZhAnswers: ['肉', '肉体'],
  },
  'econ-445f231180450a': {
    zhGloss: '代理佣金，行纪佣金',
    enDefinition: 'commission paid to a factor or agent for services',
    acceptedZhAnswers: ['代理佣金', '行纪佣金'],
  },
  'econ-a21f594c57bc6d': {
    zhGloss: '流通在外认股权证',
    enDefinition: 'stock warrants that remain outstanding',
    acceptedZhAnswers: ['流通在外认股权证', '未行使认股权证'],
  },
  'core-0737c22d3bfae8': {
    enDefinition: 'to come or bring to a finish or an end; having all necessary parts',
    zhGloss: '完成的，完整的',
    acceptedZhAnswers: ['完成的', '完整的', '完成'],
  },
  'econ-97e90a14afbd16': {
    zhGloss: '企业偿付能力',
    enDefinition: 'the ability of a business to meet its long-term obligations',
    acceptedZhAnswers: ['企业偿付能力', '偿债能力'],
  },
  'core-b389d89ce85203': {
    zhGloss: '专业知识，专长',
    enDefinition: 'expert skill or knowledge in a particular field',
    acceptedZhAnswers: ['专业知识', '专长', '专门技术'],
  },
  'econ-f2dac981437cec': {
    zhGloss: '直接成本法，直接成本计算',
    acceptedZhAnswers: ['直接成本法', '直接成本计算'],
  },
}

// Remove windfall from DELETE since we patch it; keep murder deleted
DELETE_IDS.delete('econ-86e0cfad49b04b')
DELETE_IDS.add('core-dfb04e6fdc8e28')

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const stats = {
  deleted: 0,
  renamed: 0,
  patched: 0,
  sanitized: 0,
  defsSynced: 0,
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
    stats.renamed += 1
  }

  const patch = PATCH_BY_ID[word.id]
  if (patch) {
    next = { ...next, ...patch }
    if (patch.expression && !patch.lemma) {
      next.lemma = patch.expression.toLocaleLowerCase('en-US')
    }
    stats.patched += 1
  }

  const beforeZh = next.zhGloss
  const beforeAns = JSON.stringify(next.acceptedZhAnswers)
  const beforeEn = next.enDefinition
  const beforeVar = JSON.stringify(next.acceptedEnVariants)

  next.zhGloss = primaryZhGloss(next.zhGloss)
  // Apply common OCR/typo replacements in zh
  next.zhGloss = next.zhGloss
    .replace(/剩于/g, '剩余')
    .replace(/绸锻/g, '绸缎')
    .replace(/软货款/g, '软贷款')
    .replace(/非涨/g, '飞涨')
    .replace(/单还再生产/g, '简单再生产')
    .replace(/资本而求量/g, '资本需求量')
    .replace(/扣押押权/g, '扣押权')
    .replace(/认购价限/g, '认购价格')
    .replace(/办公室管管理/g, '办公室管理')
    .replace(/宜接成本法/g, '直接成本法')
    .replace(/应伐款/g, '应付款')

  next.acceptedZhAnswers = cleanedAnswers(beforeZh, next.acceptedZhAnswers)
    .map((a) => a
      .replace(/剩于/g, '剩余')
      .replace(/绸锻/g, '绸缎')
      .replace(/软货款/g, '软贷款')
      .replace(/非涨/g, '飞涨')
      .replace(/单还再生产/g, '简单再生产')
      .replace(/资本而求量/g, '资本需求量')
      .replace(/扣押押权/g, '扣押权')
      .replace(/认购价限/g, '认购价格')
      .replace(/办公室管管理/g, '办公室管理')
      .replace(/宜接成本法/g, '直接成本法')
      .replace(/应伐款/g, '应付款'))
  next.acceptedZhAnswers = unique(next.acceptedZhAnswers)

  next.enDefinition = cleanEnDefinition(next.enDefinition, next.expression)
  next.acceptedEnVariants = cleanEnVariants(next.acceptedEnVariants, next.expression)

  if (beforeEn !== next.enDefinition) stats.defsSynced += 1
  if (
    beforeZh !== next.zhGloss
    || beforeAns !== JSON.stringify(next.acceptedZhAnswers)
    || beforeVar !== JSON.stringify(next.acceptedEnVariants)
  ) {
    stats.sanitized += 1
  }

  if (!next.zhGloss.trim()) {
    next.zhGloss = next.acceptedZhAnswers[0] || next.expression
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
}, null, 2))
