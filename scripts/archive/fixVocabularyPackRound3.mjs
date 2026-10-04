/**
 * Round-3 vocabulary pack fixes from adversarial r3 review.
 * Run: node scripts/fixVocabularyPackRound3.mjs && npm run seed:pack
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
    .replace(/(^|[；;\s,，])(?:n|v|vt|vi|adj|adv|prep|conj|pron|art|num|int|pl|interj|aux|s|r|a)\.\s*/gi, '$1')
    .replace(/[；;]+\s*/g, '；')
    .replace(/[,，]\s*[,，]+/g, '，')
    .replace(/\.{2,}/g, '')
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
      if (/^(DOS|WordNet)$/i.test(part)) return false
      if (/白痴|男风/.test(part)) return false
      return true
    })
}

function primaryZhGloss(raw, max = 3) {
  const senses = splitZhSenses(raw)
  if (senses.length === 0) return sanitizeZhFragment(raw) || String(raw ?? '').trim()
  const out = []
  for (const s of senses) {
    if (out[out.length - 1] !== s) out.push(s)
  }
  return out.slice(0, max).join('，')
}

function cleanedAnswers(rawGloss, answers) {
  const banned = /性交|强奸|嫖|淫|猥亵|鸡巴|阴茎|阴道|肉欲|杀戳|男风|白痴|耶稣受难|脱离肉体/
  const fromAnswers = (Array.isArray(answers) ? answers : []).flatMap(splitZhSenses)
  return unique([primaryZhGloss(rawGloss), ...fromAnswers, ...splitZhSenses(rawGloss)])
    .filter((value) => !banned.test(value))
    .filter((value) => !/^(a|n|v|s|r|aux)\./i.test(value))
}

/** Strip WordNet/ECDICT POS crumbs: "n the officer", "n a formal", "n. foo", "v make". */
function stripEnPosPrefix(text) {
  let next = String(text ?? '').trim()
  if (/^see\s+/i.test(next) || /see aught/i.test(next)) return ''
  next = next.replace(/^&\s*/g, '')
  for (let i = 0; i < 4; i += 1) {
    const stripped = next
      .replace(/^[navsr]\.\s+/i, '')
      .replace(/^[navsr]\s+(?=[A-Za-z("'])/i, '')
    if (stripped === next) break
    next = stripped.trim()
  }
  return next
}

function cleanEnDefinition(value, expression) {
  let text = String(value ?? '').trim()
  if (!text) return text
  const placeholder = text.match(/^(Business|Accounting|Finance|Daily) sense of [“"'](.+?)[”"']\.?$/i)
  if (placeholder && expression) {
    return `${placeholder[1]} sense of “${expression}”.`
  }
  const parts = text
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((part) => stripEnPosPrefix(part))
    .filter(Boolean)
    .filter((part) => !/^(psychiatry|High\.?)$/i.test(part))
  let first = parts[0] || stripEnPosPrefix(text)
  if (first.length > 400) first = `${first.slice(0, 397)}...`
  return first
}

const DELETE_IDS = new Set([
  'econ-1ea30ede9b506c', // bank american — mangled lemma
  'econ-50d4c2b49b56a6', // specific bank proper noun as vocab
])

const RENAME_BY_ID = {
  'econ-3fa03c21af7f14': 'bond flotation market',
  'econ-cbbe093eed7d28': 'shareholder',
  'econ-7fb7d669b94fdd': 'unaudited balance sheet',
  'econ-91b1a5a034fc08': 'import agent',
  'econ-616c03306f03a1': 'paying agent',
  'econ-6fe5d3a03faf46': 'cash on delivery',
  'econ-b49b2554546533': 'stock ticker',
  'econ-e963d8d26a0c5b': 'assignment of throughput contracts',
  'econ-873ab6e6d64366': 'loan capital',
}

const PATCH_BY_ID = {
  'econ-e058f812ae6ba9': {
    acceptedEnVariants: ['surety'],
    zhGloss: '保证人，保证金，担保',
    enDefinition: 'a person who takes responsibility for another\'s performance of an undertaking; something given as security',
  },
  'econ-fda522f14ea4d5': {
    zhGloss: '大部分，多半',
    acceptedZhAnswers: ['大部分', '多半', '主要地'],
  },
  'v1-terminal-value-ceb5d620': {
    zhGloss: '终期价值，期末价值',
    enDefinition: 'in DCF, the value of a business at the end of the explicit forecast period',
    acceptedZhAnswers: ['终期价值', '期末价值', '永续价值'],
  },
  'v1-future-value-6d7e1928': {
    zhGloss: '终值，将来值',
    acceptedZhAnswers: ['终值', '将来值', '未来值'],
  },
  'v1-does-my-insurance-cover-this-35455e97': {
    zhGloss: '我的保险保这个吗？',
    acceptedZhAnswers: ['我的保险保这个吗？', '这个在保险范围内吗？'],
  },
  'v1-medical-certificate-cbc9fb3c': {
    zhGloss: '医疗证明，诊断证明',
    acceptedZhAnswers: ['医疗证明', '诊断证明', '医生证明'],
  },
  'v1-could-i-get-a-medical-certificate-14240fe7': {
    zhGloss: '我可以开一张医疗证明吗？',
    acceptedZhAnswers: ['我可以开一张医疗证明吗？', '能给我开医疗证明吗？'],
  },
  'v1-still-water-f3171a05': {
    zhGloss: '无气泡水，无汽水',
    acceptedZhAnswers: ['无气泡水', '无汽水', '静水'],
  },
  'v1-shipping-address-dcff6870': {
    zhGloss: '收货地址，送达地址',
    acceptedZhAnswers: ['收货地址', '送达地址'],
  },
  'v1-ambient-temperature-2c932213': {
    zhGloss: '环境温度，周围温度',
    acceptedZhAnswers: ['环境温度', '周围温度'],
  },
  'econ-7a7d1b8a93da53': {
    zhGloss: '最近的，新近的',
    enDefinition: 'having happened or begun only a short time ago',
    acceptedZhAnswers: ['最近的', '新近的'],
  },
  'econ-418b03c91215cc': {
    zhGloss: '社区，群体，共同体',
    acceptedZhAnswers: ['社区', '群体', '共同体'],
  },
  'econ-b150a1aa0a630d': {
    zhGloss: '法律的，合法的',
    acceptedZhAnswers: ['法律的', '合法的', '法定的'],
  },
  'econ-2ff2febef2da41': {
    zhGloss: '出版物，刊物',
    enDefinition: 'a printed work offered for distribution; the act of publishing',
    acceptedZhAnswers: ['出版物', '刊物', '发表'],
  },
  'econ-fc3fb5a92ee6c2': {
    enDefinition: 'worth a great deal of money or highly useful',
    zhGloss: '有价值的，贵重的',
    acceptedZhAnswers: ['有价值的', '贵重的'],
  },
  'econ-cb329146a0dd0d': {
    zhGloss: '描述，说明，说明书',
    acceptedZhAnswers: ['描述', '说明', '说明书'],
  },
  'econ-7b202d57f214af': {
    zhGloss: '工厂，制造厂',
    acceptedZhAnswers: ['工厂', '制造厂'],
  },
  'econ-9e32d15b246e50': {
    zhGloss: '空头，空头头寸',
    enDefinition: 'a short position in a security, or short-term bonds in some market jargon',
    acceptedZhAnswers: ['空头', '空头头寸', '短期债券'],
  },
  'econ-ab34e22e386377': {
    zhGloss: '暂记，暂记账户',
    enDefinition: 'an accounting account used to hold items pending classification',
    acceptedZhAnswers: ['暂记', '暂记账户', '未定账'],
  },
  'econ-37877ea87f50bc': {
    zhGloss: '少报，少计',
    enDefinition: 'stating an amount as less than it actually is, especially in accounts or tax',
    acceptedZhAnswers: ['少报', '少计'],
  },
  'econ-915a1e1e547deb': {
    zhGloss: '盈利，收益',
    enDefinition: 'profit remaining after expenses; a company\'s earnings',
    acceptedZhAnswers: ['盈利', '收益', '利润'],
  },
  'econ-69233843b037a1': {
    zhGloss: '国际清算银行',
    enDefinition: 'the Bank for International Settlements, an institution for central banks',
    acceptedZhAnswers: ['国际清算银行'],
  },
  'econ-be91887b1ddb96': {
    zhGloss: '银行托管，银行保管',
    acceptedZhAnswers: ['银行托管', '银行保管'],
  },
  'econ-1e428a84efb150': {
    zhGloss: '推销话术，销售说辞',
    acceptedZhAnswers: ['推销话术', '销售说辞'],
  },
  'econ-fa16fb9121ad60': {
    zhGloss: '二级市场价格',
    acceptedZhAnswers: ['二级市场价格'],
  },
  'econ-72a1b283a40149': {
    zhGloss: '融资借款，筹措资金贷款',
    acceptedZhAnswers: ['融资借款', '筹措资金贷款'],
  },
  'econ-c867aa55a272cc': {
    zhGloss: '零售分销',
    acceptedZhAnswers: ['零售分销', '零售配销'],
  },
  'econ-d2bffc7cbf6741': {
    zhGloss: '总经销商，总批发商',
    acceptedZhAnswers: ['总经销商', '总批发商'],
  },
  'econ-8f7fdc85e30e27': {
    zhGloss: '银行资信证明',
    acceptedZhAnswers: ['银行资信证明', '银行征信'],
  },
  'econ-4eec27346d74fa': {
    zhGloss: '银行综合保单',
    acceptedZhAnswers: ['银行综合保单', '银行一揽子保单'],
  },
  'econ-21ec0becc38139': {
    zhGloss: '银行利息',
    acceptedZhAnswers: ['银行利息'],
  },
  'econ-25b16da04d270d': {
    zhGloss: '非上市股票，未上市股票',
    acceptedZhAnswers: ['非上市股票', '未上市股票', '未挂牌股票'],
  },
  'econ-abaa1018815cb9': {
    zhGloss: '未摊销债券折价',
    acceptedZhAnswers: ['未摊销债券折价', '未摊还公司债券折价'],
  },
  'econ-169885a9b367d0': {
    zhGloss: '托管债券，第三者代管债券',
    acceptedZhAnswers: ['托管债券', '第三者代管债券'],
  },
  'econ-c493e786666f26': {
    zhGloss: '未实现利润，递延收益',
    acceptedZhAnswers: ['未实现利润', '递延收益'],
  },
  'econ-6fc867871848c3': {
    zhGloss: '分红保险单',
    acceptedZhAnswers: ['分红保险单', '分红保单'],
  },
  'econ-9ab49de448e7b2': {
    zhGloss: '赊销账户',
    acceptedZhAnswers: ['赊销账户', '应收赊销账款'],
  },
  'econ-06ca81b4ea548d': {
    zhGloss: '分销成本，推销成本',
    acceptedZhAnswers: ['分销成本', '推销成本'],
  },
  'econ-cb13b94caeb20b': {
    zhGloss: '全球营销',
    acceptedZhAnswers: ['全球营销', '全球销售'],
  },
  'econ-b613f8cbf8902c': {
    zhGloss: '全新重置成本',
    acceptedZhAnswers: ['全新重置成本', '按新重置成本'],
  },
  'core-11e60b0eaadeba': {
    zhGloss: '自然的，天然的',
    acceptedZhAnswers: ['自然的', '天然的'],
  },
  'core-5fd2a36e8130e4': {
    zhGloss: '南方的，南部的',
    acceptedZhAnswers: ['南方的', '南部的'],
  },
  'econ-3a363746b80be7': {
    zhGloss: '内部劳动力市场',
    acceptedZhAnswers: ['内部劳动力市场', '企业内部劳动力市场'],
  },
  'econ-3c7558b37052d7': {
    zhGloss: '盈利价格比，收益价格比',
    acceptedZhAnswers: ['盈利价格比', '收益价格比', '盈利收益率'],
  },
  'econ-f21c13b7ceac9d': {
    zhGloss: '作业成本，活动成本',
    acceptedZhAnswers: ['作业成本', '活动成本'],
  },
  'econ-2f9e4b9c0f1830': {
    zhGloss: '投资活动',
    acceptedZhAnswers: ['投资活动'],
  },
  'econ-3cf164e8c529bc': {
    zhGloss: '不计提折旧的资产',
    acceptedZhAnswers: ['不计提折旧的资产', '非折旧资产'],
  },
  'econ-720c84d6e42853': {
    zhGloss: '到岸成本，落地成本',
    acceptedZhAnswers: ['到岸成本', '落地成本'],
  },
  'econ-33eb60bfeb4319': {
    zhGloss: '资本保全，资本维持',
    acceptedZhAnswers: ['资本保全', '资本维持'],
  },
  'econ-11f80b42b4b4d0': {
    zhGloss: '过高价格，天价',
    acceptedZhAnswers: ['过高价格', '天价'],
  },
  'econ-8b48a43db925da': {
    zhGloss: '税收协定，税务条约',
    acceptedZhAnswers: ['税收协定', '税务条约'],
  },
  'econ-8a0aed151a088e': {
    zhGloss: '仓库管理员',
    acceptedZhAnswers: ['仓库管理员', '仓储员'],
  },
  'econ-3230867e925ea7': {
    zhGloss: '保兑手续费',
    acceptedZhAnswers: ['保兑手续费'],
  },
  'econ-122d379cd98564': {
    zhGloss: '授权代理人，认可代理人',
    acceptedZhAnswers: ['授权代理人', '认可代理人'],
  },
  'econ-30625ccd00c0d3': {
    zhGloss: '生产要素',
    acceptedZhAnswers: ['生产要素'],
  },
  'econ-b9e4a7a6100570': {
    zhGloss: '定价过高而失去市场',
    acceptedZhAnswers: ['定价过高而失去市场'],
  },
  'econ-4aa5e76bcec69b': {
    zhGloss: '做市，提供买卖报价',
    acceptedZhAnswers: ['做市', '提供买卖报价'],
  },
  'econ-5a7f25f8e8a090': {
    zhGloss: '溢价摊销',
    acceptedZhAnswers: ['溢价摊销', '债券溢价摊销'],
  },
  'econ-00289931ddffef': {
    zhGloss: '超额利润抵免',
    acceptedZhAnswers: ['超额利润抵免'],
  },
  'econ-fa0dcbd02bbb74': {
    zhGloss: '费用自动转账指令',
    acceptedZhAnswers: ['费用自动转账指令', '费用定期付款指令'],
  },
  'econ-708f205e54dba3': {
    zhGloss: '中间银行，介入行',
    acceptedZhAnswers: ['中间银行', '介入行'],
  },
  'econ-3df9939c246ffa': {
    zhGloss: '无条件支付命令',
    acceptedZhAnswers: ['无条件支付命令', '无条件支付委托'],
  },
  'econ-817fba153f7299': {
    zhGloss: '应计应收款',
    acceptedZhAnswers: ['应计应收款'],
  },
  'econ-07edb91bf4b366': {
    zhGloss: '负债务',
    acceptedZhAnswers: ['负债务'],
  },
  'econ-ee4c3a37c5d1c5': {
    acceptedEnVariants: ['explicit costs'],
  },
  'econ-931d37ac1efdbe': {
    zhGloss: '销售毛利，销售利润率',
    acceptedZhAnswers: ['销售毛利', '销售利润率'],
  },
  'econ-a6610b7c577fa4': {
    zhGloss: '利润率，利润幅度',
    acceptedZhAnswers: ['利润率', '利润幅度'],
  },
  'econ-cc8bb4fc064a42': {
    zhGloss: '实际现金成本',
    acceptedZhAnswers: ['实际现金成本'],
  },
  'econ-763d4a1559cd79': {
    zhGloss: '无汇票出口',
    acceptedZhAnswers: ['无汇票出口'],
  },
  'econ-9eb967fd69c243': {
    zhGloss: '无汇票进口',
    acceptedZhAnswers: ['无汇票进口'],
  },
  'econ-c75c59a1a6d515': {
    zhGloss: '双重外汇市场',
    acceptedZhAnswers: ['双重外汇市场', '双重汇率市场'],
  },
  'econ-63051dbbd414f0': {
    zhGloss: '制造商产量浮动保单',
    acceptedZhAnswers: ['制造商产量浮动保单'],
  },
  'econ-57378b78b960ce': {
    zhGloss: '酌量性成本，可管理成本',
    acceptedZhAnswers: ['酌量性成本', '可管理成本'],
  },
  'econ-5653909885c72a': {
    zhGloss: '酌量性固定成本',
    acceptedZhAnswers: ['酌量性固定成本'],
  },
  'econ-51df7a352637a6': {
    zhGloss: '投资组合管理服务',
    acceptedZhAnswers: ['投资组合管理服务', '证券组合管理服务'],
  },
  'econ-3df096be3286eb': {
    zhGloss: '高价股',
    acceptedZhAnswers: ['高价股'],
  },
  'econ-a3170215da041d': {
    zhGloss: '获利了结，获利回吐',
    acceptedZhAnswers: ['获利了结', '获利回吐'],
  },
  'core-c3bec6bcbc9b9f': {
    zhGloss: '例子，情况，实例',
    enDefinition: 'an example or occurrence of something',
    acceptedZhAnswers: ['例子', '情况', '实例'],
  },
  'econ-e8a342419b66b2': {
    zhGloss: '平行市场',
    acceptedZhAnswers: ['平行市场'],
  },
  'econ-35481f59a73b64': {
    zhGloss: '正式发票',
    acceptedZhAnswers: ['正式发票'],
  },
  'econ-df4da45ecf22b2': {
    zhGloss: '财政税收政策',
    acceptedZhAnswers: ['财政税收政策', '财税政策'],
  },
  'econ-6b6b1506ada467': {
    zhGloss: '股票套利',
    acceptedZhAnswers: ['股票套利'],
  },
  'econ-4ccc619620a91b': {
    zhGloss: '所有者权益变动表',
    acceptedZhAnswers: ['所有者权益变动表', '业主权益表'],
  },
  'econ-f7ce922f150e4c': {
    zhGloss: '流动资本',
    acceptedZhAnswers: ['流动资本'],
  },
  'econ-9094a4e09cd5fe': {
    zhGloss: '澳大利亚会计师协会',
    acceptedZhAnswers: ['澳大利亚会计师协会'],
  },
  'econ-5fed1e2600893b': {
    zhGloss: '固定债务',
    acceptedZhAnswers: ['固定债务'],
  },
  'core-83d6311e87d477': {
    zhGloss: '移动的，可移动的',
    enDefinition: 'able to move or be moved freely',
    acceptedZhAnswers: ['移动的', '可移动的'],
  },
  'core-626a8be2a3454b': {
    zhGloss: '公司，法人',
    acceptedZhAnswers: ['公司', '法人', '股份公司'],
  },
  'core-9f7a912e58cbc0': {
    zhGloss: '应该，应当',
    enDefinition: 'used to express duty, obligation, or what is advisable',
    partOfSpeech: 'modal',
    acceptedZhAnswers: ['应该', '应当'],
  },
  'core-eabc12ab2e0eb3': {
    zhGloss: '激情，热爱',
    acceptedZhAnswers: ['激情', '热爱', '酷爱'],
  },
  'core-dc8803926c6489': {
    zhGloss: '分别地，单独地',
    acceptedZhAnswers: ['分别地', '单独地'],
  },
  'core-8029e7aeed18f8': {
    zhGloss: '接收器，收款人，破产管理人',
    enDefinition: 'a person or device that receives something; in insolvency, an official who takes control of assets',
    acceptedZhAnswers: ['接收器', '收款人', '破产管理人'],
  },
  'econ-5ad3e3e96255f0': {
    zhGloss: '计划预算，项目预算',
    acceptedZhAnswers: ['计划预算', '项目预算'],
  },
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const stats = {
  deleted: 0,
  renamed: 0,
  patched: 0,
  sanitized: 0,
  enPosStripped: 0,
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

  next.zhGloss = primaryZhGloss(next.zhGloss)
    .replace(/大部份/g, '大部分')
    .replace(/白痴/g, '')
    .replace(/男风/g, '')
    .replace(/[，,]{2,}/g, '，')
    .replace(/^[，,]+|[，,]+$/g, '')
  next.acceptedZhAnswers = cleanedAnswers(beforeZh, next.acceptedZhAnswers)
    .map((a) => a.replace(/大部份/g, '大部分'))
  next.acceptedZhAnswers = unique(next.acceptedZhAnswers)

  next.enDefinition = cleanEnDefinition(next.enDefinition, next.expression)
  if (beforeEn !== next.enDefinition && /^\s*[navsr][\s.]/i.test(beforeEn || '')) {
    stats.enPosStripped += 1
  }

  if (Array.isArray(next.acceptedEnVariants)) {
    next.acceptedEnVariants = unique([
      next.expression,
      ...next.acceptedEnVariants.filter((v) => {
        if (!v) return false
        if (v === next.expression) return true
        if (/surely/i.test(v) && /surety/i.test(next.expression)) return false
        if (/explicitly costs/i.test(v)) return false
        return true
      }),
    ])
  }

  if (
    beforeZh !== next.zhGloss
    || beforeAns !== JSON.stringify(next.acceptedZhAnswers)
    || beforeEn !== next.enDefinition
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
writeFileSync(packPath, `${JSON.stringify({
  ...pack,
  words: kept,
  memberships,
  exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
})}\n`)

console.log(JSON.stringify({
  ...stats,
  afterWords: kept.length,
  afterMemberships: memberships.length,
}, null, 2))
