/**
 * Round-4 vocabulary pack fixes from adversarial r4 review.
 * Run: node scripts/fixVocabularyPackRound4.mjs && npm run seed:pack
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/all_batches_combined_vocabulary_pack.json')

function unique(values) {
  return [...new Set(values.map((v) => String(v).trim()).filter(Boolean))]
}

const ZH_TYPOS = [
  [/偶而/g, '偶尔'],
  [/迫随者/g, '追随者'],
  [/不辛/g, '不幸'],
  [/论误/g, '讹误'],
  [/给于/g, '给予'],
  [/挑畔/g, '挑衅'],
  [/鞭苔/g, '鞭笞'],
  [/机僚/g, '官僚'],
  [/计可证/g, '许可证'],
  [/宜传/g, '宣传'],
  [/船双/g, '船只'],
  [/常期信用/g, '长期信用'],
  [/欧州/g, '欧洲'],
  [/守侯/g, '守候'],
  [/合部所有/g, '全部所有'],
  [/权品/g, '样品'],
  [/记时/g, '计时'],
  [/续学生签证/g, '续签学生签证'],
  [/大部份/g, '大部分'],
]

function applyZhTypos(value) {
  let next = String(value ?? '')
  for (const [re, to] of ZH_TYPOS) next = next.replace(re, to)
  return next
}

const BANNED_ZH = /性交|强奸|嫖|淫|猥亵|鸡巴|阴茎|阴道|肉欲|杀戳|男风|白痴|耶稣受难|脱离肉体|精液|迷幻药|花柳病/

const ACRONYM_DUMP = /文摘索引|存取隔离|高级信息|先进接口|科学研究网|数据数字转换|互连网信息包|制造自动化协议|自动文档|系统实用程序|计算机辅助(教育|测试|翻译|排版|教学|排字)|终端接口处理器|通用汇编程序|图形应用程序|中央处理机速度|通用任务程序|路径检索程序|串行线接口协议|调用程序分析|代码分析程序|计算机辅助生产|计算机辅助印刷|教育信息系统|邮局协议|增值网|邮件程序|Internet网|转移向量/

function sanitizeZhFragment(value) {
  return applyZhTypos(String(value ?? ''))
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
      if (BANNED_ZH.test(part) || ACRONYM_DUMP.test(part)) return false
      if (/高潮/.test(part)) return false
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
  const fromAnswers = (Array.isArray(answers) ? answers : []).flatMap(splitZhSenses)
  return unique([primaryZhGloss(rawGloss), ...fromAnswers, ...splitZhSenses(rawGloss)])
    .filter((value) => !BANNED_ZH.test(value) && !ACRONYM_DUMP.test(value) && !/^高潮$/.test(value))
}

const BAD_VARIANT = /sales sales|improvementbudget|profit rata|financial time stock|return of (investment|equity)|irresistible|payable agent|cash and delivery|imports'|application-for |fully depreciated assets in active$|reserve for purchase of treasury$|cumulative capital stock|explicitly costs|customary's|devidend|receivalbe/i

function cleanEnVariants(variants, expression) {
  return unique([expression, ...(variants || [])]).filter((v) => {
    if (!v || v === expression) return v === expression || Boolean(v)
    if (BAD_VARIANT.test(v)) return false
    return true
  })
}

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
  const parts = text.replace(/\\n/g, '\n').split(/\n+/).map((p) => stripEnPosPrefix(p)).filter(Boolean)
  let first = parts[0] || stripEnPosPrefix(text)
  if (first.length > 400) first = `${first.slice(0, 397)}...`
  return first
}

const DELETE_IDS = new Set([
  'econ-22f7971dfb7488', // journal title
  'econ-d280642693138e', // Cohen Commission
  'econ-6dbacfb41a784c', // org proper noun
  'econ-cbbc8d77f962f6', // statute title
  'econ-c1bdd0c1f313d2', // correspondents bank duplicate
  'econ-91b1a5a034fc08', // duplicate import agent leftover
])

const RENAME_BY_ID = {
  'econ-f5d36fb664f080': 'sale afloat',
  'econ-d30164890935a5': 'dow jones industrial average',
  'econ-2bf4b75105f03b': 'exchange stabilization fund',
  'econ-8eaeb9b8a8b103': 'estimated revenue',
  'econ-3b4236692b6bf0': 'stocks and bonds',
  'econ-3e038c066c8c7d': 'amortization of bond issue expense',
}

const PATCH_BY_ID = {
  'v1-annual-percentage-rate-07528b5e': {
    zhGloss: '年百分率，APR',
    acceptedZhAnswers: ['年百分率', 'APR', '年化百分率'],
  },
  'v1-i-need-to-renew-my-student-visa-2b09aff6': {
    zhGloss: '我需要续签学生签证。',
    acceptedZhAnswers: ['我需要续签学生签证。', '我要续签学生签证'],
  },
  'econ-ca7db6d03ec492': {
    zhGloss: '在…之中，在当中',
    enDefinition: 'in the middle of; surrounded by',
    acceptedZhAnswers: ['在…之中', '在当中'],
  },
  'econ-b7655061e02455': {
    zhGloss: '残骸，船只失事残骸',
    acceptedZhAnswers: ['残骸', '船只失事残骸'],
  },
  'econ-9842c989188084': {
    zhGloss: '长期信用证',
    acceptedZhAnswers: ['长期信用证', '长期信用状'],
  },
  'econ-13ea700adcbe37': {
    zhGloss: '会计手册，会计制度汇编',
    acceptedZhAnswers: ['会计手册', '会计制度汇编'],
  },
  'econ-72000006b6d45c': {
    zhGloss: '外贸融资，国际贸易融资',
    acceptedZhAnswers: ['外贸融资', '国际贸易融资'],
  },
  'econ-9b5e46fdf42f84': {
    zhGloss: '抵押证券资本',
    acceptedZhAnswers: ['抵押证券资本'],
  },
  'econ-7ea0b3c9a42a50': {
    zhGloss: '股利均衡基金',
    acceptedZhAnswers: ['股利均衡基金'],
  },
  'econ-e0d6ae5cf2a2d0': {
    zhGloss: '货物，船货',
    acceptedZhAnswers: ['货物', '船货', '货运'],
  },
  'econ-7027e333a83c54': {
    zhGloss: '中产阶级',
    acceptedZhAnswers: ['中产阶级'],
  },
  'econ-05fa394843a4d7': {
    zhGloss: '民主党人，民主主义者',
    acceptedZhAnswers: ['民主党人', '民主主义者'],
  },
  'econ-c2d0f75d679b71': {
    zhGloss: '授权，认可',
    acceptedZhAnswers: ['授权', '认可', '委任'],
  },
  'econ-90e7552bb9a261': {
    zhGloss: '标的，基础的，潜在的',
    acceptedZhAnswers: ['标的', '基础的', '潜在的'],
  },
  'econ-df636f85ef183f': {
    zhGloss: '警告，注意事项',
    acceptedZhAnswers: ['警告', '注意事项', '停止支付通知'],
  },
  'econ-306631de5c0aff': {
    zhGloss: '企业家',
    acceptedZhAnswers: ['企业家'],
  },
  'econ-a20e7481161cc2': {
    zhGloss: '批准，追认',
    acceptedZhAnswers: ['批准', '追认'],
  },
  'econ-6a411c76198079': {
    zhGloss: '贡献，出资',
    acceptedZhAnswers: ['贡献', '出资', '捐款'],
  },
  'econ-24aaa8e99ecd37': {
    zhGloss: '升级，逐步扩大',
    acceptedZhAnswers: ['升级', '逐步扩大'],
  },
  'econ-a38f067f6f0b91': {
    zhGloss: '声望，威望',
    acceptedZhAnswers: ['声望', '威望'],
  },
  'econ-f80dc9cd368828': {
    zhGloss: '蓝天市场，未注册证券市场',
    acceptedZhAnswers: ['蓝天市场', '未注册证券市场'],
  },
  'econ-53608a0b3f35a7': {
    zhGloss: '搬运成本，装卸成本',
    acceptedZhAnswers: ['搬运成本', '装卸成本', '经手成本'],
  },
  'econ-b69f28d794d98c': {
    zhGloss: '应计成本，机会成本',
    acceptedZhAnswers: ['应计成本', '机会成本', '估算成本'],
  },
  'econ-6d046914c54b9b': {
    zhGloss: '预收收入，递延收入',
    acceptedZhAnswers: ['预收收入', '递延收入', '未实现收入'],
  },
  'econ-9b5aee6e8cfc26': {
    zhGloss: '银行存款',
    acceptedZhAnswers: ['银行存款'],
  },
  'econ-ba92d08442a386': {
    zhGloss: '银行股票',
    acceptedZhAnswers: ['银行股票', '银行股本'],
  },
  'econ-cb5e9e8a6ab39c': {
    zhGloss: '经济成本',
    acceptedZhAnswers: ['经济成本'],
  },
  'econ-8b0f0a935385d9': {
    zhGloss: '资本利息',
    acceptedZhAnswers: ['资本利息'],
  },
  'econ-23dc0897b84b04': {
    zhGloss: '货币市场',
    acceptedZhAnswers: ['货币市场'],
  },
  'econ-05913363fddd0c': {
    zhGloss: '净值对负债比率',
    acceptedZhAnswers: ['净值对负债比率', '净资产负债比'],
  },
  'econ-c86a2ab1b075c4': {
    zhGloss: '背对背信用证',
    acceptedZhAnswers: ['背对背信用证'],
  },
  'econ-b6474f09a127df': {
    zhGloss: '背对背信用证',
    acceptedZhAnswers: ['背对背信用证'],
  },
  'econ-ee697511ba2b71': {
    zhGloss: '生产卡特尔',
    acceptedZhAnswers: ['生产卡特尔'],
  },
  'econ-eb0b3766f47211': {
    zhGloss: '牛市，多头市场',
    acceptedZhAnswers: ['牛市', '多头市场'],
  },
  'econ-753ed61fe7ef4e': {
    zhGloss: '或有信用风险',
    acceptedZhAnswers: ['或有信用风险'],
  },
  'econ-1ecf34bbc3056b': {
    zhGloss: '连同汇兑费用一并支付',
    acceptedZhAnswers: ['连同汇兑费用一并支付'],
  },
  'econ-2860ac46a84c8c': {
    zhGloss: '零数定价',
    acceptedZhAnswers: ['零数定价', '奇数定价'],
  },
  'econ-bb6def7721602c': {
    zhGloss: '资本主义生产',
    acceptedZhAnswers: ['资本主义生产'],
  },
  'econ-927d75bbc33ad2': {
    zhGloss: '受监管投资公司',
    acceptedZhAnswers: ['受监管投资公司'],
  },
  'econ-6ecf03061a98f3': {
    zhGloss: '会计部门',
    acceptedZhAnswers: ['会计部门', '会计处'],
  },
  'econ-b9b25af7d2ceb1': {
    zhGloss: '认缴资本',
    acceptedZhAnswers: ['认缴资本', '已认购资本'],
  },
  'econ-f9496e03dc5d0c': {
    zhGloss: '提存准备，资金化准备',
    acceptedZhAnswers: ['提存准备', '资金化准备'],
  },
  'econ-54a1acb7011a34': {
    zhGloss: '权益资本，股本',
    acceptedZhAnswers: ['权益资本', '股本'],
  },
  'econ-dfc48123f93279': {
    zhGloss: '赎回价格',
    acceptedZhAnswers: ['赎回价格', '赎回价'],
  },
  'econ-0ffe8f038288c9': {
    zhGloss: '商业政策，贸易政策',
    acceptedZhAnswers: ['商业政策', '贸易政策'],
  },
  'econ-849bfc76a1a0bb': {
    zhGloss: '保险箱保管',
    acceptedZhAnswers: ['保险箱保管', '保管箱'],
  },
  'econ-a2a7912cb0ef46': {
    zhGloss: '出口信贷',
    acceptedZhAnswers: ['出口信贷'],
  },
  'econ-3c155b38e9e61b': {
    zhGloss: '原始成本，最初成本',
    acceptedZhAnswers: ['原始成本', '最初成本'],
  },
  'econ-e36550d41ccd3e': {
    zhGloss: '分配成本，分摊成本',
    acceptedZhAnswers: ['分配成本', '分摊成本'],
  },
  'econ-cc4bce6e500bbf': {
    zhGloss: '证券批发商，做市批发商',
    acceptedZhAnswers: ['证券批发商', '做市批发商'],
  },
  'econ-c9571407232056': {
    zhGloss: '权益结合法',
    acceptedZhAnswers: ['权益结合法'],
  },
  'econ-c20c2a17d4b53d': {
    zhGloss: '即期信用证',
    acceptedZhAnswers: ['即期信用证'],
  },
  'econ-29f3ae24ed27db': {
    zhGloss: '做市商',
    acceptedZhAnswers: ['做市商'],
  },
  'econ-dbc3ec275da0d9': {
    zhGloss: '活跃市场',
    acceptedZhAnswers: ['活跃市场'],
  },
  'econ-4932365fd11d92': {
    zhGloss: '取得成本，购置成本',
    acceptedZhAnswers: ['取得成本', '购置成本'],
  },
  'econ-d51a0edf24429c': {
    zhGloss: '贸易壁垒',
    acceptedZhAnswers: ['贸易壁垒'],
  },
  'econ-542bb15e45a8dc': {
    zhGloss: '退货，贸易统计回报',
    acceptedZhAnswers: ['退货', '贸易统计回报'],
  },
  'econ-b3001f92a5e561': {
    zhGloss: '股票基金',
    acceptedZhAnswers: ['股票基金'],
  },
  'econ-57555c08cedd84': {
    zhGloss: '银行融资',
    acceptedZhAnswers: ['银行融资'],
  },
  'econ-906c7e0a2be82d': {
    zhGloss: '银行无力偿债',
    acceptedZhAnswers: ['银行无力偿债', '银行破产'],
  },
  'econ-90a2819666baa9': {
    zhGloss: '管理费',
    acceptedZhAnswers: ['管理费'],
  },
  'econ-44d184697526d8': {
    zhGloss: '资本成本',
    acceptedZhAnswers: ['资本成本'],
  },
  'econ-f07fac5206b39e': {
    zhGloss: '仓库交货',
    acceptedZhAnswers: ['仓库交货'],
  },
  'econ-95e8b4abf9f115': {
    zhGloss: '退休基金',
    acceptedZhAnswers: ['退休基金', '养老基金'],
  },
  'core-bbe5bb364fb35f': {
    zhGloss: '教，讲授，教导',
    enDefinition: 'to give instruction or help someone learn',
    partOfSpeech: 'verb',
    acceptedZhAnswers: ['教', '讲授', '教导'],
  },
  'core-5929e58a5aa1fd': {
    zhGloss: '美好的，和蔼的',
    enDefinition: 'pleasant, kind, or attractive',
    partOfSpeech: 'adjective',
    acceptedZhAnswers: ['美好的', '和蔼的', '正派的'],
  },
  'core-7d1f8f911da92c': {
    zhGloss: '灰色，灰色的',
    enDefinition: 'of the colour between black and white',
    acceptedZhAnswers: ['灰色', '灰色的'],
  },
  'core-ff0dc9ba250002': {
    zhGloss: '电视',
    acceptedZhAnswers: ['电视'],
  },
  'core-61a7508ed1b04e': {
    zhGloss: '基本的，基础的',
    enDefinition: 'forming an essential foundation; fundamental',
    acceptedZhAnswers: ['基本的', '基础的'],
  },
  'econ-de0bf163228dcf': {
    zhGloss: '员工流动成本',
    acceptedZhAnswers: ['员工流动成本', '人事流动成本'],
  },
  'econ-07e310ea14759e': {
    zhGloss: '分期付款销售合同',
    acceptedZhAnswers: ['分期付款销售合同'],
  },
  'econ-a196012ac26a11': {
    zhGloss: '计时和成本会计员',
    acceptedZhAnswers: ['计时和成本会计员'],
  },
  'econ-dc5680a292e351': {
    zhGloss: '船边交货价格',
    acceptedZhAnswers: ['船边交货价格', 'FAS价格'],
  },
  'econ-addaf93a1a0375': {
    zhGloss: '质量控制圈活动，品管圈活动',
    acceptedZhAnswers: ['质量控制圈活动', '品管圈活动'],
  },
  'econ-9b5f98ffc5eda4': {
    zhGloss: '对全资子公司的投资',
    acceptedZhAnswers: ['对全资子公司的投资'],
  },
  'econ-3060b7b7985059': {
    zhGloss: '凭卖方样品质量交货',
    acceptedZhAnswers: ['凭卖方样品质量交货'],
  },
  'econ-58dc5fdf37c7b0': {
    zhGloss: '以领得进口许可证为准的报价',
    acceptedZhAnswers: ['以领得进口许可证为准的报价'],
  },
  'econ-81b3888148cb1c': {
    zhGloss: '官僚化的',
    acceptedZhAnswers: ['官僚化的'],
  },
  'econ-0714e345b9be53': {
    zhGloss: '开发，剥削',
    acceptedZhAnswers: ['开发', '剥削'],
  },
  'econ-a1a2798d4bd63d': {
    zhGloss: '船货，船只运载量',
    acceptedZhAnswers: ['船货', '船只运载量', '大量'],
  },
  'econ-d52bdb43c89789': {
    zhGloss: '倒填日期，填早日期',
    acceptedZhAnswers: ['倒填日期', '填早日期'],
  },
  'core-64c90140381c75': {
    zhGloss: '侵略的，挑衅的，进取的',
    enDefinition: 'ready to attack or confront; energetic and determined',
    acceptedZhAnswers: ['侵略的', '挑衅的', '进取的'],
  },
  'econ-881f067e3e5a8f': {
    zhGloss: '破产财产管理人',
    acceptedZhAnswers: ['破产财产管理人', '破产管理人'],
  },
  'econ-e30e3ea09219ac': {
    zhGloss: '应有成本审查',
    acceptedZhAnswers: ['应有成本审查', '应有成本分析'],
  },
  'econ-0382b97422be97': {
    zhGloss: '止损单',
    acceptedZhAnswers: ['止损单'],
  },
  'econ-08c0f0fac72b0f': {
    zhGloss: '从量税',
    acceptedZhAnswers: ['从量税'],
  },
  'core-00c7103750bf7b': {
    zhGloss: '油炸，鱼苗',
    enDefinition: 'to cook in hot fat or oil; young fish',
    acceptedZhAnswers: ['油炸', '鱼苗', '油炸食物'],
  },
  'core-26b99989814c00': {
    zhGloss: '她的',
    enDefinition: 'belonging to or associated with a female person or animal previously mentioned',
    acceptedZhAnswers: ['她的'],
  },
  'core-922cce49ed1675': {
    zhGloss: '你的，你们的',
    enDefinition: 'belonging to or associated with the person or people being addressed',
    acceptedZhAnswers: ['你的', '你们的'],
  },
  'core-aa39520e70f976': {
    enDefinition: 'any person who; the person that',
  },
  'core-c19ab8d3c2c942': {
    zhGloss: '拍手，鼓掌',
    enDefinition: 'to strike the palms of the hands together, especially to show approval',
    acceptedZhAnswers: ['拍手', '鼓掌'],
  },
  'core-2580d49ff40608': {
    zhGloss: '禁止，禁令',
    enDefinition: 'to officially or legally prohibit',
    acceptedZhAnswers: ['禁止', '禁令', '取缔'],
  },
  'core-cf0f3f416e6fa2': {
    zhGloss: '许可证，许可',
    enDefinition: 'an official document giving permission to do something',
    acceptedZhAnswers: ['许可证', '许可', '执照'],
  },
  'core-92713d47093771': {
    zhGloss: '种子',
    acceptedZhAnswers: ['种子'],
  },
  'core-434b0a6daa5306': {
    zhGloss: '酸',
    acceptedZhAnswers: ['酸'],
  },
  'core-7e06da1fac8825': {
    zhGloss: '宽广的，辽阔的',
    enDefinition: 'having a large distance from side to side; wide',
    acceptedZhAnswers: ['宽广的', '辽阔的', '广大的'],
  },
  'core-d7ce74466d5413': {
    zhGloss: '波浪，挥手',
    acceptedZhAnswers: ['波浪', '挥手', '波'],
  },
  'core-11b0b7df4e2c7b': {
    zhGloss: '偶尔，有时',
    acceptedZhAnswers: ['偶尔', '有时'],
  },
  'core-7ca68bd65a8993': {
    zhGloss: '支持者，追随者',
    acceptedZhAnswers: ['支持者', '追随者'],
  },
  'core-712bb05acc526e': {
    zhGloss: '悲剧，不幸',
    acceptedZhAnswers: ['悲剧', '不幸'],
  },
  'core-c4587d77b4b3e7': {
    zhGloss: '腐败，贪污',
    acceptedZhAnswers: ['腐败', '贪污'],
  },
  'core-1303263e41b9b0': {
    zhGloss: '专员，地方长官',
    acceptedZhAnswers: ['专员', '地方长官'],
  },
  'core-37eca5751d1f6d': {
    zhGloss: '给予，使得，提出',
    enDefinition: 'to cause to become; to give or provide',
    acceptedZhAnswers: ['给予', '使得', '提出'],
  },
  'core-0f51a8c574c157': {
    zhGloss: '反复地，再三地',
    enDefinition: 'many times; over and over',
    acceptedZhAnswers: ['反复地', '再三地'],
  },
  'core-2d02a8f51cd383': {
    zhGloss: '松树，松木',
    acceptedZhAnswers: ['松树', '松木'],
  },
  'core-b6d4f63bc72c15': {
    zhGloss: '海报，招贴',
    acceptedZhAnswers: ['海报', '招贴'],
  },
  'core-4b687891382fd6': {
    zhGloss: '民意测验，投票',
    acceptedZhAnswers: ['民意测验', '投票'],
  },
  'core-7b7c59e9357c5a': {
    zhGloss: '卸货，卸载',
    acceptedZhAnswers: ['卸货', '卸载'],
  },
  'core-33655e63cafac6': {
    zhGloss: '傻瓜，愚人',
    acceptedZhAnswers: ['傻瓜', '愚人'],
  },
  'core-42c65f1a90f37c': {
    zhGloss: '北方的，北部的',
    enDefinition: 'situated in or facing toward the north',
    acceptedZhAnswers: ['北方的', '北部的'],
  },
  'core-be37ec2ec8ed4c': {
    zhGloss: '磨坊，制造厂',
    enDefinition: 'a building with machinery for grinding grain; a factory',
    acceptedZhAnswers: ['磨坊', '制造厂'],
  },
  'core-1d8875eaabb42d': {
    zhGloss: '反叛者，造反',
    enDefinition: 'a person who rises in opposition to an established government or ruler',
    acceptedZhAnswers: ['反叛者', '造反'],
  },
  'core-86a8c2da8527a1': {
    zhGloss: '坦白的，直率的',
    enDefinition: 'open, honest, and direct in speech',
    acceptedZhAnswers: ['坦白的', '直率的'],
  },
  'core-070d4f9752d3d2': {
    zhGloss: '元，雄鹿',
    enDefinition: 'informal word for a dollar; a male deer',
    acceptedZhAnswers: ['元', '雄鹿'],
  },
  'core-1eac7bdcbb6c56': {
    zhGloss: '控告，起诉',
    enDefinition: 'to take legal action against someone',
    acceptedZhAnswers: ['控告', '起诉'],
  },
  'econ-a2d987356787f5': {
    acceptedEnVariants: ['cumulative preferred stock'],
  },
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const stats = {
  deleted: 0,
  renamed: 0,
  patched: 0,
  sanitized: 0,
  variantsCleaned: 0,
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
    if (patch.expression && !patch.lemma) next.lemma = patch.expression.toLocaleLowerCase('en-US')
    stats.patched += 1
  }

  const beforeZh = next.zhGloss
  const beforeAns = JSON.stringify(next.acceptedZhAnswers)
  const beforeVar = JSON.stringify(next.acceptedEnVariants)
  const beforeEn = next.enDefinition

  next.zhGloss = primaryZhGloss(next.zhGloss)
  next.acceptedZhAnswers = cleanedAnswers(beforeZh, next.acceptedZhAnswers)
  next.enDefinition = cleanEnDefinition(next.enDefinition, next.expression)
  next.acceptedEnVariants = cleanEnVariants(next.acceptedEnVariants, next.expression)

  if (beforeVar !== JSON.stringify(next.acceptedEnVariants)) stats.variantsCleaned += 1
  if (
    beforeZh !== next.zhGloss
    || beforeAns !== JSON.stringify(next.acceptedZhAnswers)
    || beforeEn !== next.enDefinition
  ) {
    stats.sanitized += 1
  }
  if (!next.zhGloss.trim()) next.zhGloss = next.acceptedZhAnswers[0] || next.expression
  kept.push(next)
}

const keptIds = new Set(kept.map((w) => w.id))
writeFileSync(packPath, `${JSON.stringify({
  ...pack,
  words: kept,
  memberships: pack.memberships.filter((m) => keptIds.has(m.wordId)),
  exportedAt: new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z'),
})}\n`)

console.log(JSON.stringify({
  ...stats,
  afterWords: kept.length,
  afterMemberships: pack.memberships.filter((m) => keptIds.has(m.wordId)).length,
}, null, 2))
