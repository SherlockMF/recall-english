/**
 * Batch 1 — P0 high-severity vocabulary fixes (V5.3).
 * Edits trusted_v5_2 in place; preserves Word.id and senseKey.
 *
 * Run: node scripts/fixP0HighRisk.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 pack missing')

const TS = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')

function unique(values) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

function examples(pairs) {
  return pairs.map(([en, zh]) => ({ en, zh }))
}

function cols(...items) {
  return unique(items)
}

/** Curated overrides keyed by Word.id. Only listed fields are patched. */
const FIXES = {
  'v1-can-you-offer-a-better-price-for-a-larger--9aaadd1b': {
    zhGloss: '如果订单量更大，可以给更优惠的价格吗？',
    acceptedZhAnswers: ['如果订单量更大，可以给更优惠的价格吗？', '量大能否优惠一点'],
  },
  'v1-sorry-could-you-say-that-again-d65f9c5d': {
    zhGloss: '不好意思，你可以再说一遍吗？',
    acceptedZhAnswers: ['不好意思，你可以再说一遍吗？', '抱歉，能再说一次吗'],
  },

  'econ-c8c62b60c9e028': {
    // tenure — keep office-holding sense aligned with current EN def
    zhGloss: '任期；任职期',
    acceptedZhAnswers: ['任期', '任职期'],
    enDefinition: 'the period during which a person holds an office, post, or right of occupancy',
    partOfSpeech: 'noun',
    examples: examples([
      ['Her tenure as CFO lasted five years.', '她担任首席财务官的任期持续了五年。'],
      ['Security of tenure matters for long-term planning.', '任职保障对长期规划很重要。'],
    ]),
    collocations: cols('during tenure', 'security of tenure', 'tenure as CEO'),
  },
  'econ-78f7cf5be601df': {
    zhGloss: '拒付；拒绝承认',
    acceptedZhAnswers: ['拒付', '拒绝承认', '否认有效性'],
    enDefinition: 'to refuse to accept, acknowledge, or honour as valid, especially a claim, debt, or obligation',
    partOfSpeech: 'verb',
    examples: examples([
      ['The borrower tried to repudiate the debt.', '借款人试图拒付这笔债务。'],
      ['Courts may allow a party to repudiate a fraudulently induced contract.', '法院可能允许当事人拒绝承认受欺诈诱导订立的合同。'],
    ]),
    collocations: cols('repudiate a debt', 'repudiate a claim', 'repudiate a contract'),
  },
  'econ-89415c7d82c3f4': {
    zhGloss: '拆除；拆毁',
    acceptedZhAnswers: ['拆除', '拆毁'],
    enDefinition: 'the act of pulling down or destroying a building or structure',
    examples: examples([
      ['The site is cleared after demolition of the old warehouse.', '旧仓库拆除后，场地被清理干净。'],
      ['Demolition costs were included in the project budget.', '拆除费用已计入项目预算。'],
    ]),
    collocations: cols('demolition costs', 'scheduled for demolition', 'controlled demolition'),
  },
  'econ-57872e246e82e1': {
    zhGloss: '潜逃；携款逃走',
    acceptedZhAnswers: ['潜逃', '携款逃走', '逃亡'],
    enDefinition: 'to leave hurriedly and secretly, typically to avoid arrest or creditors, often taking money or property',
    partOfSpeech: 'verb',
    examples: examples([
      ['The cashier absconded with the week’s takings.', '出纳携本周货款潜逃。'],
      ['Directors who abscond can trigger insolvency investigations.', '董事潜逃可能触发破产调查。'],
    ]),
    collocations: cols('abscond with funds', 'abscond from creditors', 'risk of absconding'),
  },
  'econ-23e54c4d0c5069': {
    zhGloss: '损耗；腐坏损失',
    acceptedZhAnswers: ['损耗', '腐坏', '物料损耗'],
    enDefinition: 'loss of goods through decay, damage, or waste, especially of inventory or raw materials',
    partOfSpeech: 'noun',
    examples: examples([
      ['The factory tracks spoilage of perishable raw materials.', '工厂追踪易腐原料的损耗。'],
      ['Normal spoilage is built into the standard cost.', '正常损耗已计入标准成本。'],
    ]),
    collocations: cols('inventory spoilage', 'normal spoilage', 'spoilage rate'),
  },
  'econ-7ca71019f55a3a': {
    zhGloss: '万亿（短尺度，10¹²）',
    acceptedZhAnswers: ['万亿', '兆（短尺度）', '一万亿'],
    enDefinition: 'the number 1,000,000,000,000 (10¹²) in the short scale used in modern English',
    examples: examples([
      ['Public debt rose above one trillion dollars.', '公共债务升至超过一万亿美元。'],
      ['The model forecasts trillion-dollar market capitalisation.', '模型预测市值将达万亿美元量级。'],
    ]),
    collocations: cols('one trillion', 'trillions of dollars', 'trillion-dollar market'),
  },
  'econ-69233843b037a1': {
    acceptedEnVariants: ['bank for international settlements', 'Bank for International Settlements', 'BIS'],
    enDefinition: 'the Bank for International Settlements (BIS), an international organisation that serves central banks and fosters monetary and financial stability',
  },
  'econ-309796a9eceb0d': {
    // Keep expression "tact"; drop wrong manufacturing gloss (takt time is a different term).
    zhGloss: '圆通；得体；机智',
    acceptedZhAnswers: ['圆通', '得体', '机智', '外交手腕'],
    enDefinition: 'skill in dealing with people or difficult situations without causing offence',
    partOfSpeech: 'noun',
    examples: examples([
      ['She handled the complaint with tact.', '她圆通地处理了投诉。'],
      ['Negotiations require tact as well as numbers.', '谈判既需要数字，也需要圆通。'],
    ]),
    collocations: cols('with tact', 'show tact', 'lack of tact'),
  },
  'econ-b449ee4c45fcb7': {
    zhGloss: '大风；强风',
    acceptedZhAnswers: ['大风', '强风', '狂风'],
    enDefinition: 'a very strong wind, typically force 7–10 on the Beaufort scale',
    examples: examples([
      ['Shipping was delayed by a severe gale.', '航运因强风而延误。'],
      ['A gale warning was issued for the coast.', '沿海发布了大风警报。'],
    ]),
    collocations: cols('gale warning', 'severe gale', 'gale-force winds'),
  },
  'econ-691a77cd21a31b': {
    zhGloss: '对；对比（versus 的缩写）',
    acceptedZhAnswers: ['对', '对比', '相对'],
    enDefinition: 'abbreviation of versus, used to show opposition or comparison between two sides or options',
    partOfSpeech: 'preposition',
    examples: examples([
      ['The case is listed as Smith vs Jones.', '案件列为 Smith vs Jones。'],
      ['Compare fixed costs vs variable costs in the model.', '在模型中比较固定成本与变动成本。'],
    ]),
    collocations: cols('A vs B', 'versus', 'compared vs'),
    acceptedEnVariants: ['vs', 'versus', 'v.'],
  },
  'econ-769116ef204ccf': {
    zhGloss: '关税与贸易总协定',
    acceptedZhAnswers: ['关税与贸易总协定', '关贸总协定'],
    enDefinition: 'the General Agreement on Tariffs and Trade (GATT), a multilateral trade agreement (1947; updated as GATT 1994) that governed much of world trade before and within the WTO framework — not a United Nations agency',
    partOfSpeech: 'noun',
    examples: examples([
      ['GATT 1947 set early rules for tariff reductions.', '1947 年的 GATT 确立了早期关税削减规则。'],
      ['GATT 1994 remains part of the WTO legal texts.', 'GATT 1994 仍是世贸组织法律文本的一部分。'],
    ]),
    collocations: cols('GATT 1947', 'GATT 1994', 'under GATT rules'),
    acceptedEnVariants: ['GATT', 'General Agreement on Tariffs and Trade'],
  },

  'core-e9ba3d3a5fcb65': {
    enDefinition: 'the reflexive or emphatic form of I/me, used when the subject and object are the same person, or for emphasis',
    examples: examples([
      ['I booked the ticket myself.', '我自己订的票。'],
      ['I myself prefer the cheaper option.', '我本人更喜欢更便宜的方案。'],
    ]),
    collocations: cols('by myself', 'I myself', 'help myself'),
  },
  'core-736b67b302dc5e': {
    enDefinition: 'in any case; used to continue, dismiss a detail, or return to the main point',
    examples: examples([
      ['The shop was closed; anyway, we can order online.', '店关门了；反正我们可以网购。'],
      ['Anyway, let’s finish the report first.', '总之，我们先把报告做完。'],
    ]),
    collocations: cols('anyway', 'anyway, let’s', 'not useful anyway'),
  },
  'core-42e184930956d0': {
    enDefinition: 'except if; except under the condition that',
    examples: examples([
      ['We will ship tomorrow unless the payment fails.', '除非付款失败，否则我们明天发货。'],
      ['Do not reply unless you are sure.', '除非你确定，否则不要回复。'],
    ]),
    collocations: cols('unless otherwise', 'not unless', 'unless required'),
  },
  'core-20770554c89615': {
    enDefinition: 'the reflexive or emphatic form of you, used when the subject and object are the same person, or for emphasis',
    examples: examples([
      ['You should introduce yourself at the meeting.', '你应该在会上自我介绍。'],
      ['Did you write this yourself?', '这是你自己写的吗？'],
    ]),
    collocations: cols('by yourself', 'help yourself', 'ask yourself'),
  },
  'core-c8fb554a62152a': {
    enDefinition: 'a large celestial body that orbits a star; under the IAU 2006 definition, the Solar System has eight planets (Pluto is classified as a dwarf planet)',
    examples: examples([
      ['Earth is the third planet from the Sun.', '地球是距太阳第三近的行星。'],
      ['Eight planets orbit the Sun in the Solar System.', '太阳系中有八颗行星绕太阳运行。'],
    ]),
    collocations: cols('planet Earth', 'dwarf planet', 'orbit a planet'),
  },
  'core-980677bac89bee': {
    enDefinition: 'the reflexive or emphatic form of we/us',
    examples: examples([
      ['We prepared the slides ourselves.', '我们自己准备了幻灯片。'],
      ['We should ask ourselves whether the fee is fair.', '我们应自问这笔费用是否合理。'],
    ]),
    collocations: cols('by ourselves', 'ask ourselves', 'among ourselves'),
  },
  'core-b3d6a9b743ac2d': {
    enDefinition: 'extraordinarily large in size, amount, or degree',
    examples: examples([
      ['The project faces an enormous budget gap.', '项目面临巨大的预算缺口。'],
      ['They made an enormous effort to meet the deadline.', '他们付出巨大努力以赶上截止日期。'],
    ]),
    collocations: cols('enormous cost', 'enormous impact', 'enormous pressure'),
  },
  'core-e6c5b8f1347fae': {
    zhGloss: '制造；制成品',
    acceptedZhAnswers: ['制造', '制成品', '产品制造'],
    enDefinition: 'the making of goods on a large scale using machinery; also, goods so made',
    partOfSpeech: 'noun',
    examples: examples([
      ['Local manufacture reduces shipping delays.', '本地制造可减少运输延误。'],
      ['The firm specialises in the manufacture of medical devices.', '该公司专营医疗器械制造。'],
    ]),
    collocations: cols('manufacture of goods', 'domestic manufacture', 'cost of manufacture'),
  },
  'core-3ab3e0b020a6d4': {
    zhGloss: '网站',
    acceptedZhAnswers: ['网站', '网页站点'],
    enDefinition: 'a set of related web pages and resources published under a domain or URL on the World Wide Web',
    examples: examples([
      ['Please check the university website for the timetable.', '请上学校网站查看课程表。'],
      ['Their website explains the refund policy.', '他们的网站说明了退款政策。'],
    ]),
    collocations: cols('visit a website', 'company website', 'website traffic'),
  },
  'core-2c65275ae0b05e': {
    enDefinition: 'a large class of nitrogenous organic compounds made of amino-acid chains, essential to living cells and obtained from foods such as meat, eggs, dairy, and legumes',
    examples: examples([
      ['Athletes often increase protein in their diet.', '运动员常在饮食中增加蛋白质。'],
      ['Eggs are a common source of protein.', '鸡蛋是常见的蛋白质来源。'],
    ]),
    collocations: cols('protein intake', 'source of protein', 'protein-rich food'),
  },
  'core-e6c8f31e98c047': {
    enDefinition: 'extremely large, great, or impressive in amount or intensity',
    examples: examples([
      ['There was tremendous demand for the course.', '这门课需求极大。'],
      ['She made a tremendous improvement this term.', '她本学期进步巨大。'],
    ]),
    collocations: cols('tremendous growth', 'tremendous pressure', 'tremendous value'),
  },
  'core-94a325fbad7745': {
    zhGloss: '除…之外；此外',
    acceptedZhAnswers: ['除…之外', '此外', '而且'],
    enDefinition: 'in addition to; apart from (also used as an adverb meaning “moreover”)',
    partOfSpeech: 'preposition',
    examples: examples([
      ['Besides rent, we pay utilities.', '除了房租，我们还付水电费。'],
      ['I don’t need a bag; besides, my hands are full.', '我不需要袋子；再说，我手里已经满了。'],
    ]),
    collocations: cols('besides that', 'besides English', 'besides working'),
  },
  'core-d6efe0c49af196': {
    enDefinition: 'careful to avoid risks or mistakes; showing careful forethought',
    examples: examples([
      ['Be cautious when sharing bank details online.', '在网上分享银行信息时要谨慎。'],
      ['The board took a cautious approach to expansion.', '董事会对扩张采取谨慎态度。'],
    ]),
    collocations: cols('cautious approach', 'be cautious', 'cautious investor'),
  },
  'core-0eb8b4484399e1': {
    zhGloss: '欧元',
    acceptedZhAnswers: ['欧元'],
    enDefinition: 'the official currency of the euro area, used by eurozone members of the European Union',
    examples: examples([
      ['The invoice is priced in euro.', '发票以欧元计价。'],
      ['Travellers exchanged dollars for euro at the airport.', '旅客在机场把美元换成欧元。'],
    ]),
    collocations: cols('pay in euro', 'euro exchange rate', 'eurozone'),
  },
  'core-ffe9451f0aa6c0': {
    enDefinition: 'strikingly odd, strange, or unusual',
    examples: examples([
      ['That’s a weird coincidence.', '那真是奇怪的巧合。'],
      ['The system made a weird error overnight.', '系统昨晚出现了奇怪的错误。'],
    ]),
    collocations: cols('weird feeling', 'sound weird', 'weird error'),
  },

  'econ-a89252e7153cfe': {
    zhGloss: '营业成本制度；经营成本系统',
    acceptedZhAnswers: ['营业成本制度', '经营成本系统'],
    enDefinition: 'a costing system that records and analyses operating (business) costs',
    examples: examples([
      ['They redesigned the operation cost system for retail outlets.', '他们为门店重新设计了营业成本制度。'],
      ['An operation cost system helps compare branches.', '营业成本制度有助于比较各分店。'],
    ]),
    collocations: cols('implement an operation cost system', 'operation cost reports', 'review the operation cost system'),
  },
  'econ-8eaeb9b8a8b103': {
    zhGloss: '预算收入；预计收入',
    acceptedZhAnswers: ['预算收入', '预计收入', '收入预算数'],
    enDefinition: 'the amount of revenue expected or budgeted for a future period',
    acceptedEnVariants: ['estimated revenue'],
    examples: examples([
      ['Estimated revenue for next year is RM 12 million.', '明年预计收入为 1200 万令吉。'],
      ['Compare estimated revenue with actual collections.', '将预计收入与实际收款对比。'],
    ]),
    collocations: cols('estimated revenue', 'budgeted revenue', 'revise estimated revenue'),
  },
  'econ-ccc4cea436e7d6': {
    enDefinition: 'a commission or tribunal that settles disputes arising from foreign trade by arbitration',
    examples: examples([
      ['The parties agreed to submit the dispute to a foreign trade arbitration commission.', '双方同意将争议提交对外贸易仲裁委员会。'],
      ['Awards of the foreign trade arbitration commission are usually final.', '对外贸易仲裁委员会的裁决通常具有终局性。'],
    ]),
    collocations: cols('submit to arbitration', 'arbitration commission', 'foreign trade dispute'),
  },
  'econ-1c569ffb6c0f24': {
    acceptedEnVariants: ['results management'],
    enDefinition: 'a management approach that focuses on defining, measuring, and achieving intended outcomes',
  },
  'econ-bfd26379697a39': {
    enDefinition: 'surety bonds that guarantee a bidder will honour the bid and enter into the contract if selected',
    examples: examples([
      ['The tender required bid bonds from all bidders.', '招标要求所有投标人提供投标保证金。'],
      ['Bid bonds protect the buyer if a winning bidder withdraws.', '若中标人撤标，投标保证金可保护买方。'],
    ]),
    collocations: cols('require bid bonds', 'post bid bonds', 'bid bond amount'),
    acceptedEnVariants: ['bid bonds', 'bid bond'],
  },
  'econ-7e65d74fd51d93': {
    acceptedEnVariants: ['absorbed manufacturing overhead'],
    enDefinition: 'manufacturing overhead allocated to units produced using a predetermined overhead rate',
  },
  'econ-173a6d0fa6452e': {
    acceptedEnVariants: ['approximation of the cost'],
    enDefinition: 'an approximate estimate of a cost when an exact figure is not yet available',
    examples: examples([
      ['Give me an approximation of the cost before we tender.', '投标前先给我一个成本近似估算。'],
      ['The approximation of the cost excluded shipping.', '该成本估算未含运费。'],
    ]),
    collocations: cols('rough approximation of the cost', 'provide an approximation', 'cost approximation'),
  },
  'econ-839f120a58548e': {
    enDefinition: 'a public commission that regulates or investigates trade and commercial practices (historical/region-specific name)',
    examples: examples([
      ['Complaints were filed with the trade practices commission.', '投诉已提交贸易惯例委员会。'],
      ['The trade practices commission reviewed misleading advertising.', '贸易惯例委员会审查了误导性广告。'],
    ]),
    collocations: cols('trade practices commission', 'file a complaint', 'competition regulator'),
  },
  'econ-335a8990ba88ee': {
    enDefinition: 'a surety bond (also called a bid bond) that supports a bidder’s obligation to enter into a contract if the tender is awarded',
    examples: examples([
      ['A tender bond must accompany the bid documents.', '投标文件须附投标保证金。'],
      ['The tender bond is released after contract signing.', '合同签署后发还投标保证金。'],
    ]),
    collocations: cols('submit a tender bond', 'tender bond amount', 'release the tender bond'),
    acceptedEnVariants: ['tender bond', 'bid bond'],
  },
  'econ-826c4bb7dd8c8c': {
    zhGloss: '初始保证金',
    acceptedZhAnswers: ['初始保证金', '原始保证金'],
    enDefinition: 'the collateral amount a trader must deposit when opening a futures or leveraged position',
    examples: examples([
      ['The broker called for a higher initial margin.', '经纪商要求提高初始保证金。'],
      ['Initial margin is set by the exchange or clearing house.', '初始保证金由交易所或清算所设定。'],
    ]),
    collocations: cols('post initial margin', 'initial margin requirement', 'meet initial margin'),
  },
  'econ-7b90aa5e57a2e2': {
    zhGloss: '成本性态；成本习性',
    acceptedZhAnswers: ['成本性态', '成本习性', '成本特性'],
    enDefinition: 'the way a cost changes in response to changes in activity level, such as fixed, variable, or mixed behaviour',
    acceptedEnVariants: ['cost behavior', 'cost behaviour'],
    examples: examples([
      ['Managers analyse cost behavior before setting prices.', '经理在定价前分析成本性态。'],
      ['Cost behavior diagrams separate fixed and variable costs.', '成本性态图区分固定与变动成本。'],
    ]),
    collocations: cols('analyse cost behavior', 'cost behavior pattern', 'variable cost behavior'),
  },
  'econ-f689704c815b3c': {
    acceptedEnVariants: ['price-earnings ratio', 'price/earnings ratio', 'P/E ratio', 'PE ratio'],
    enDefinition: 'a valuation ratio equal to a share’s market price divided by earnings per share',
  },
  'econ-835269f07e8b98': {
    enDefinition: 'a curve showing the maximum combinations of two goods an economy can produce with given resources and technology',
    examples: examples([
      ['Points inside the production-possibility frontier are inefficient.', '生产可能边界以内的点是无效率的。'],
      ['Trade can move consumption beyond the domestic production-possibility frontier.', '贸易可使消费超出国内生产可能边界。'],
    ]),
    collocations: cols('production-possibility frontier', 'PPF', 'shift the frontier'),
    acceptedEnVariants: ['production-possibility frontier', 'production possibility frontier', 'PPF'],
  },
  'econ-337d77016a9dd8': {
    zhGloss: '原始保证金；初始保证金',
    acceptedZhAnswers: ['原始保证金', '初始保证金'],
    enDefinition: 'another term for the initial margin deposit required when a position is opened',
    examples: examples([
      ['Original margin must be posted before trading starts.', '开仓交易前须缴纳原始保证金。'],
      ['The clearing house sets original margin by product.', '清算所按品种设定原始保证金。'],
    ]),
    collocations: cols('original margin', 'post original margin', 'original margin call'),
    acceptedEnVariants: ['original margin', 'initial margin'],
  },
  'econ-f5d36fb664f080': {
    acceptedEnVariants: ['sale afloat'],
  },
  'econ-0a6248d2fe8e49': {
    zhGloss: '支付凭证；付款授权书',
    acceptedZhAnswers: ['支付凭证', '付款授权书', '支付证明'],
    enDefinition: 'an official authorisation or document instructing that a payment be made',
    examples: examples([
      ['The treasury issued a pay warrant for the supplier.', '财务部门向供应商签发了支付凭证。'],
      ['No payment leaves without a signed pay warrant.', '没有签妥的支付凭证不得付款。'],
    ]),
    collocations: cols('issue a pay warrant', 'approve a pay warrant', 'pay warrant for wages'),
  },
  'econ-cb057e851bb1cb': {
    zhGloss: '硬通货；强势可兑换货币',
    acceptedZhAnswers: ['硬通货', '强势货币', '可兑换货币'],
    enDefinition: 'a currency that is widely accepted in international trade and is considered stable and readily convertible',
    examples: examples([
      ['Exporters often invoice in hard currency.', '出口商常以硬通货开票。'],
      ['Hard currency reserves support import payments.', '硬通货储备支持进口支付。'],
    ]),
    collocations: cols('hard currency reserves', 'invoice in hard currency', 'earn hard currency'),
  },
  'econ-48cd25026192af': {
    acceptedEnVariants: ['average quality of production'],
    enDefinition: 'the typical or mean quality level achieved in a production process over a period',
  },
  'econ-c6a0eeefd3fec1': {
    acceptedEnVariants: ['stuffing order'],
    enDefinition: 'a document authorising the stuffing (loading) of cargo into a container, often for customs or terminal control',
    examples: examples([
      ['Customs released the stuffing order this morning.', '海关今早签发了装箱许可。'],
      ['Without a stuffing order, the container cannot be loaded.', '没有装箱单，集装箱不能装货。'],
    ]),
    collocations: cols('issue a stuffing order', 'stuffing order number', 'container stuffing'),
  },
  'econ-e963d8d26a0c5b': {
    acceptedEnVariants: ['assignment of throughput contracts'],
  },
  'econ-3e038c066c8c7d': {
    acceptedEnVariants: ['amortization of bond issue expense', 'amortisation of bond issue expense'],
    enDefinition: 'the systematic allocation of bond issuance costs over the life of the bonds',
  },
  'econ-3d1bd2a93c7713': {
    acceptedEnVariants: ['general accounting'],
    enDefinition: 'routine financial accounting that records transactions and prepares general-purpose financial statements',
    examples: examples([
      ['She works in general accounting, not management accounting.', '她做普通会计，不做管理会计。'],
      ['General accounting closes the books each month.', '普通会计每月结账。'],
    ]),
    collocations: cols('general accounting department', 'general accounting records', 'general accounting cycle'),
  },
  'econ-7fb7d669b94fdd': {
    acceptedEnVariants: ['unaudited balance sheet'],
    enDefinition: 'a statement of financial position that has not yet been examined by an independent auditor',
  },
  'econ-07f7980151e978': {
    zhGloss: '整美元记账；整数美元会计',
    acceptedZhAnswers: ['整美元记账', '整数美元会计'],
    enDefinition: 'an accounting presentation that rounds amounts to the nearest whole dollar and omits cents',
    examples: examples([
      ['The report uses whole-dollar accounting for readability.', '报告为便于阅读采用整美元记账。'],
      ['Whole-dollar accounting still keeps detailed ledgers in cents.', '整美元列报时，明细账仍可保留到分。'],
    ]),
    collocations: cols('whole-dollar accounting', 'round to whole dollars', 'whole-dollar presentation'),
  },
  'econ-f2b6961ce70979': {
    zhGloss: '仓单；栈单',
    acceptedZhAnswers: ['仓单', '栈单', '仓储收据'],
    enDefinition: 'a document issued by a warehouse acknowledging that specified goods are stored and often used as a document of title',
    examples: examples([
      ['The bank lent against the warehouse receipt as collateral.', '银行以仓单作抵押放贷。'],
      ['Transfer of the warehouse receipt can transfer title to the goods.', '转让仓单可转让货物所有权。'],
    ]),
    collocations: cols('negotiable warehouse receipt', 'issue a warehouse receipt', 'pledge a warehouse receipt'),
  },
  'econ-495421c0113fea': {
    acceptedEnVariants: ['national association of accountants', 'NAA'],
    enDefinition: 'historical name (to 1991) of the U.S. professional body now known as the Institute of Management Accountants (IMA)',
    examples: examples([
      ['The National Association of Accountants was renamed the IMA in 1991.', '国民会计师协会于 1991 年更名为管理会计师协会（IMA）。'],
      ['Older texts still cite the National Association of Accountants.', '旧文献仍引用国民会计师协会。'],
    ]),
    collocations: cols('National Association of Accountants', 'IMA', 'management accountants'),
  },
  'econ-c238e2ed64dbd8': {
    acceptedEnVariants: ['cost accounting standards board', 'CASB'],
  },
  'econ-5f81660117e881': {
    zhGloss: '审计专员；审计委员',
    acceptedZhAnswers: ['审计专员', '审计委员', '审计官员'],
    enDefinition: 'officials appointed to examine and report on public or organisational accounts',
    examples: examples([
      ['The commissioners of audit published their annual report.', '审计专员公布了年度报告。'],
      ['Commissioners of audit review compliance with spending rules.', '审计专员审查开支规则的合规情况。'],
    ]),
    collocations: cols('commissioners of audit', 'audit commissioners', 'report of the commissioners'),
  },
  'econ-2544b93c5215d2': {
    zhGloss: '投资税收抵免',
    acceptedZhAnswers: ['投资税收抵免', '投资税贷项'],
    enDefinition: 'a reduction in tax payable based on qualifying capital investment (jurisdiction-specific incentive)',
    examples: examples([
      ['The firm claimed an investment tax credit on new equipment.', '公司就新设备申请投资税收抵免。'],
      ['Investment tax credits lower the effective tax burden.', '投资税收抵免降低有效税负。'],
    ]),
    collocations: cols('claim an investment tax credit', 'investment tax credit rate', 'qualify for the credit'),
  },
  'econ-32511632d87d7e': {
    zhGloss: '估算租金；推定租金',
    acceptedZhAnswers: ['估算租金', '推定租金', '虚拟租金'],
    enDefinition: 'the estimated rental value of owner-occupied property treated as if rent were paid',
    examples: examples([
      ['National accounts may include imputed rent for owner-occupiers.', '国民核算可能计入自住者的估算租金。'],
      ['Imputed rent is not an actual cash payment.', '估算租金并非实际现金支付。'],
    ]),
    collocations: cols('imputed rent', 'owner-occupied imputed rent', 'measure imputed rent'),
  },
  'econ-6e6e79117bb4fa': {
    enDefinition: 'a small computer system configured for bookkeeping and accounting tasks (largely historical terminology)',
    examples: examples([
      ['In the 1980s many shops ran a small accounting computer.', '上世纪八十年代许多商铺使用小型会计电脑。'],
      ['The small accounting computer stored the sales ledger.', '小型会计电脑存储了销售明细账。'],
    ]),
    collocations: cols('small accounting computer', 'accounting computer system', 'computerised bookkeeping'),
  },
  'econ-9b3dcd166dcbeb': {
    enDefinition: 'a board committee that oversees financial reporting, internal control, and the external audit process',
    examples: examples([
      ['The audit committee meets the external auditors privately.', '审计委员会与外聘审计师私下会晤。'],
      ['An independent audit committee strengthens governance.', '独立的审计委员会强化治理。'],
    ]),
    collocations: cols('audit committee meeting', 'audit committee chair', 'report to the audit committee'),
  },
  'econ-08c0f0fac72b0f': {
    enDefinition: 'a customs duty charged as a fixed amount per physical unit (for example per kilogram or per item), not as a percentage of value',
    examples: examples([
      ['A specific tariff of $2 per kilogram applies to the goods.', '该货物适用每公斤 2 美元的从量税。'],
      ['Specific tariffs differ from ad valorem tariffs.', '从量税不同于从价税。'],
    ]),
    collocations: cols('specific tariff', 'ad valorem vs specific', 'specific duty'),
  },
  'econ-2bf4b75105f03b': {
    acceptedEnVariants: ['exchange stabilization fund', 'Exchange Stabilization Fund', 'ESF'],
  },
  'econ-4849a6b1fe7de2': {
    zhGloss: '货轮；货机',
    acceptedZhAnswers: ['货轮', '货机', '货运船'],
    examples: examples([
      ['The freighter arrived at Port Klang this morning.', '货轮今早抵达巴生港。'],
      ['A freighter carries cargo rather than passengers.', '货机/货轮运货而非载客。'],
    ]),
    collocations: cols('cargo freighter', 'ocean freighter', 'freighter aircraft'),
  },
  'econ-2e5710a728674d': {
    enDefinition: 'an insurance policy covering goods in transit / shipment risks (marine or cargo insurance)',
    examples: examples([
      ['The shipment policy covers damage during ocean transit.', '装运保险单承保海运途中的损坏。'],
      ['Check whether the shipment policy is CIF or warehouse-to-warehouse.', '确认装运保险是 CIF 还是仓至仓。'],
    ]),
    collocations: cols('shipment policy', 'cargo insurance policy', 'under the shipment policy'),
  },
  'econ-3b4236692b6bf0': {
    acceptedEnVariants: ['stocks and bonds'],
    enDefinition: 'equity securities and debt securities considered together as investment instruments',
  },
  'econ-0b51ac34b1a545': {
    zhGloss: '证券交易委员会',
    acceptedZhAnswers: ['证券交易委员会', '证交会'],
    enDefinition: 'a securities market regulator titled Securities and Exchange Commission (in the U.S., the federal SEC)',
    acceptedEnVariants: ['securities and exchange commission', 'Securities and Exchange Commission', 'SEC'],
    examples: examples([
      ['Listed firms file reports with the securities and exchange commission.', '上市公司向证券交易委员会提交报告。'],
      ['The securities and exchange commission enforces disclosure rules.', '证券交易委员会执行信息披露规则。'],
    ]),
    collocations: cols('SEC filing', 'securities regulator', 'securities and exchange commission'),
  },
  'econ-fabdab6ad8cb09': {
    zhGloss: '银行货币；存款货币',
    acceptedZhAnswers: ['银行货币', '存款货币', '银行票据'],
    enDefinition: 'money held as bank deposits and transferable by cheque or electronic transfer, as distinct from physical cash',
    examples: examples([
      ['Most everyday payments use bank money, not notes and coins.', '多数日常支付使用银行货币而非现钞硬币。'],
      ['Bank money expands when banks create deposits through lending.', '银行通过放贷创造存款时，银行货币增加。'],
    ]),
    collocations: cols('bank money', 'deposit money', 'transfer bank money'),
  },
  'econ-74eb8e8170ea27': {
    zhGloss: '银行定期付款指示；银行委托书',
    acceptedZhAnswers: ['银行定期付款指示', '银行委托付款', 'standing order'],
    enDefinition: 'an instruction to a bank to make regular payments from an account to a named payee (also called a standing order)',
    examples: examples([
      ['She set up a banker’s order to pay the rent monthly.', '她设立银行定期付款指示按月付房租。'],
      ['Cancel the banker’s order if you change landlords.', '若更换房东，请取消该银行付款指示。'],
    ]),
    collocations: cols("set up a banker's order", 'standing order', "cancel a banker's order"),
    acceptedEnVariants: ["banker's order", 'bankers order', 'standing order'],
  },
  'econ-4eec27346d74fa': {
    enDefinition: 'a fidelity/crime insurance bond that protects a bank against losses from employee dishonesty, forgery, and related risks',
    examples: examples([
      ['The bank renewed its banker’s blanket bond annually.', '银行每年续保综合忠诚/犯罪保险。'],
      ['A banker’s blanket bond is insurance, not a debt security.', '银行综合保单是保险，不是债务证券。'],
    ]),
    collocations: cols("banker's blanket bond", 'fidelity bond', 'crime insurance'),
  },
  'econ-52e9371f00cdce': {
    acceptedEnVariants: ['superannuation fund', 'super fund'],
    enDefinition: 'a retirement savings fund that invests contributions to provide benefits in retirement (common term in Australia and some other jurisdictions)',
  },
  'econ-f261136d92e45b': {
    acceptedEnVariants: ['non-bearer bond', 'registered bond'],
    enDefinition: 'a bond registered in the owner’s name rather than payable to whoever holds the certificate (bearer)',
  },
  'econ-d447ec3d89428f': {
    zhGloss: '公司股票；公司股本证券',
    acceptedZhAnswers: ['公司股票', '公司股本', '公司证券'],
    enDefinition: 'shares or equity securities issued by a corporation',
    examples: examples([
      ['Investors bought corporation stock in the IPO.', '投资者在 IPO 中买入公司股票。'],
      ['Corporation stock represents ownership in the company.', '公司股票代表对公司的所有权。'],
    ]),
    collocations: cols('issue corporation stock', 'corporation stock certificate', 'trade corporation stock'),
  },
  'econ-1ce2da4427fa07': {
    zhGloss: '边际贡献率',
    acceptedZhAnswers: ['边际贡献率', '贡献毛益率'],
    enDefinition: 'contribution margin divided by sales, showing the portion of each sales dollar available to cover fixed costs and profit',
    examples: examples([
      ['A higher contribution margin ratio improves break-even.', '更高的边际贡献率改善盈亏平衡。'],
      ['Track the contribution margin ratio by product line.', '按产品线跟踪边际贡献率。'],
    ]),
    collocations: cols('contribution margin ratio', 'improve the ratio', 'contribution margin'),
  },
  'econ-873ab6e6d64366': {
    acceptedEnVariants: ['loan capital'],
    zhGloss: '借入资本；借贷资本',
    acceptedZhAnswers: ['借入资本', '借贷资本', '债务资本'],
    enDefinition: 'capital raised by borrowing, such as loans or debentures, rather than by issuing equity',
    examples: examples([
      ['Loan capital increased after the bond issue.', '发行债券后借入资本增加。'],
      ['The gearing ratio compares loan capital with equity.', '杠杆比率比较借入资本与权益。'],
    ]),
    collocations: cols('raise loan capital', 'loan capital and equity', 'cost of loan capital'),
  },
  'econ-0832220743cc42': {
    zhGloss: '被投资企业；投资对象公司',
    acceptedZhAnswers: ['被投资企业', '投资对象公司', '被投资公司'],
    enDefinition: 'a firm in which an investor holds an ownership interest',
    examples: examples([
      ['Dividends arrive from the invested firm each year.', '每年从被投资企业收到股利。'],
      ['Consolidation depends on control of the invested firm.', '是否合并取决于对被投资企业的控制。'],
    ]),
    collocations: cols('invested firm', 'interest in the invested firm', 'results of the invested firm'),
  },
  'econ-87c704c9cfeba5': {
    enDefinition: 'historical U.S. agency (OPIC) that supported private investment abroad; its functions were succeeded by the U.S. International Development Finance Corporation (DFC) from 2019',
    examples: examples([
      ['OPIC was the former Overseas Private Investment Corporation.', 'OPIC 即前海外私人投资公司。'],
      ['DFC succeeded the Overseas Private Investment Corporation in 2019.', '2019 年 DFC 承接了海外私人投资公司的职能。'],
    ]),
    collocations: cols('OPIC', 'Overseas Private Investment Corporation', 'DFC'),
    acceptedEnVariants: ['overseas private investment corporation', 'OPIC'],
  },
  'econ-cc452e291b6ff4': {
    enDefinition: 'a marine/cargo insurance policy that covers shipments under a fluctuating or open declaration of goods rather than a single fixed consignment',
    examples: examples([
      ['Exporters often use a floating policy for frequent shipments.', '出口商常为频繁出货使用流动保险单。'],
      ['Declare each shipment under the floating policy.', '每票货在流动保险单项下申报。'],
    ]),
    collocations: cols('floating policy', 'open cover', 'declare under the floating policy'),
  },
  'econ-d30164890935a5': {
    acceptedEnVariants: ['dow jones industrial average', 'Dow Jones Industrial Average', 'DJIA', 'the Dow'],
    enDefinition: 'a price-weighted index of 30 major U.S. listed companies, widely used as a benchmark for the U.S. equity market',
  },
  'econ-c47fd9c3852d3f': {
    enDefinition: 'the U.S. Securities and Exchange Commission (SEC), the federal regulator of securities markets and public-company disclosure',
    examples: examples([
      ['Public companies file Form 10-K with the US Securities and Exchange Commission.', '上市公司向美国证券交易委员会提交 10-K。'],
      ['The US Securities and Exchange Commission investigates market abuse.', '美国证券交易委员会调查市场滥用行为。'],
    ]),
    collocations: cols('US SEC', 'SEC filing', 'securities regulator'),
    acceptedEnVariants: ['us securities and exchange commission', 'U.S. Securities and Exchange Commission', 'SEC'],
  },
  'econ-981ba82bc6b197': {
    zhGloss: '联邦住房贷款银行委员会（历史机构）',
    acceptedZhAnswers: ['联邦住房贷款银行委员会', 'FHLBB'],
    enDefinition: 'historical U.S. regulator of federal home loan banks and thrifts; abolished in 1989 under FIRREA',
    examples: examples([
      ['The Federal Home Loan Bank Board was abolished in 1989.', '联邦住房贷款银行委员会于 1989 年被废止。'],
      ['Histories of the S&L crisis mention the Federal Home Loan Bank Board.', '储贷危机史常提及联邦住房贷款银行委员会。'],
    ]),
    collocations: cols('Federal Home Loan Bank Board', 'FHLBB', 'FIRREA'),
    acceptedEnVariants: ['federal home loan bank board', 'FHLBB'],
  },
  'econ-c558ffc3918573': {
    zhGloss: '远期市场',
    acceptedZhAnswers: ['远期市场'],
    enDefinition: 'a market in which forward contracts are agreed for delivery at a future date at a price set today, typically over the counter',
    examples: examples([
      ['Hedgers use the forward market to lock in prices.', '套保者用远期市场锁定价格。'],
      ['The forward market differs from exchange-traded futures.', '远期市场不同于交易所期货。'],
    ]),
    collocations: cols('forward market', 'forward contract', 'OTC forward market'),
  },
  'econ-270a705cc417eb': {
    zhGloss: '远期外汇市场',
    acceptedZhAnswers: ['远期外汇市场', '远期汇市'],
    enDefinition: 'the market for forward foreign-exchange contracts that lock in an exchange rate for a future settlement date',
    examples: examples([
      ['Importers hedge in the forward exchange market.', '进口商在远期外汇市场套保。'],
      ['The forward exchange market quotes rates for future value dates.', '远期外汇市场报出未来交割日汇率。'],
    ]),
    collocations: cols('forward exchange market', 'forward FX', 'hedge in the forward market'),
  },
  'econ-20ec77253a5975': {
    enDefinition: 'historical Singapore dollar interbank offered rate (SIBOR); last published 31 Dec 2024 and discontinued from 1 Jan 2025, with SGD markets transitioning to SORA',
    examples: examples([
      ['Legacy loans may still reference Singapore Inter-Bank Offering Rate.', '存量贷款仍可能引用新加坡银行同业拆息率。'],
      ['New contracts should use SORA instead of SIBOR.', '新合约应使用 SORA 而非 SIBOR。'],
    ]),
    collocations: cols('SIBOR', 'SORA', 'interbank offered rate'),
    acceptedEnVariants: ['singapore inter-bank offering rate', 'SIBOR', 'Singapore Interbank Offered Rate'],
  },
  'econ-1c85321cd7854a': {
    enDefinition: 'a fidelity/crime insurance bond covering losses from forgery or fraudulent alteration of financial instruments',
    examples: examples([
      ['The bank bought a forgery bond to cover cheque fraud risk.', '银行为支票伪造风险购买防伪造保险。'],
      ['A forgery bond is insurance coverage, not a traded debt bond.', '防伪造保函是保险保障，不是交易性债券。'],
    ]),
    collocations: cols('forgery bond', 'fidelity coverage', 'forgery insurance'),
  },
  'econ-d26e76e6047ce6': {
    zhGloss: '州特许银行（美国）',
    acceptedZhAnswers: ['州特许银行', '州注册银行'],
    enDefinition: 'in the United States, a bank chartered by a state banking authority (state-chartered), not necessarily owned by the government',
    examples: examples([
      ['A state bank is supervised by state regulators and often the FDIC.', '州特许银行受州监管机构监管，并常受 FDIC 监督。'],
      ['State banks differ from nationally chartered banks.', '州特许银行不同于国民银行。'],
    ]),
    collocations: cols('state-chartered bank', 'state bank charter', 'state banking department'),
  },
  'econ-2a0dff52e7e055': {
    acceptedEnVariants: ['stock loan'],
    enDefinition: 'a loan of securities (or cash loan secured by stock) arranged between parties, often for short selling or financing',
  },
  'econ-0382b97422be97': {
    enDefinition: 'a securities order that becomes a market (or limit) order once a specified stop price is reached',
    examples: examples([
      ['She placed a stop order below the purchase price.', '她在买入价下方挂了止损单。'],
      ['A stop order can limit losses in a falling market.', '止损单可在下跌行情中限制亏损。'],
    ]),
    collocations: cols('place a stop order', 'stop price', 'stop-loss order'),
    acceptedEnVariants: ['stop order', 'stop-loss order'],
  },
  'econ-5c61662a3ccfa3': {
    enDefinition: 'bearer shares or stock transferable by delivery of the certificate, without registration of the owner’s name (restricted or abolished in many jurisdictions)',
    examples: examples([
      ['Stock to bearer is uncommon under modern company law.', '在现代公司法下，无记名股票已不常见。'],
      ['Transfer of stock to bearer occurs by delivering the certificate.', '无记名股票通过交付票证转让。'],
    ]),
    collocations: cols('stock to bearer', 'bearer shares', 'bearer certificate'),
  },
  'econ-b49b2554546533': {
    acceptedEnVariants: ['stock ticker', 'ticker'],
    enDefinition: 'a system or display that streams real-time or delayed securities price and trade data; historically a telegraph ticker machine',
    examples: examples([
      ['Traders watched the stock ticker for the opening print.', '交易员盯着行情收报机看开盘价。'],
      ['The stock ticker showed a sharp drop in the index.', '行情显示指数大幅下跌。'],
    ]),
    collocations: cols('stock ticker', 'ticker tape', 'ticker symbol'),
  },
}

// Also clean the duplicate sibling entries that share expression but were not the flagged ID.
const SIBLING_FIXES = {
  'econ-206f7025fed625': {
    // other "general accounting"
    acceptedEnVariants: ['general accounting'],
    enDefinition: 'routine financial accounting that records transactions and prepares general-purpose financial statements',
    zhGloss: '普通会计',
    acceptedZhAnswers: ['普通会计'],
  },
  'econ-3311b09154eb63': {
    // other "loan capital"
    acceptedEnVariants: ['loan capital'],
    enDefinition: 'capital raised by borrowing, such as loans or debentures, rather than by issuing equity',
    zhGloss: '借入资本；借贷资本',
    acceptedZhAnswers: ['借入资本', '借贷资本'],
  },
  'econ-ee4c3a37c5d1c5': {
    // other "explicit costs" — not in high list but same duplicate class; light fix if present
    enDefinition: 'costs that involve a direct monetary payment to suppliers of resources',
    zhGloss: '显性成本；直接货币支付的成本',
    acceptedZhAnswers: ['显性成本', '直接货币成本'],
    acceptedEnVariants: ['explicit costs', 'explicit cost'],
  },
  'econ-841b3cb61b79d5': {
    enDefinition: 'costs that involve a direct monetary payment to suppliers of resources',
    zhGloss: '显性成本；直接货币支付的成本',
    acceptedZhAnswers: ['显性成本', '直接货币成本'],
    acceptedEnVariants: ['explicit costs', 'explicit cost'],
  },
}

function applyPatch(word, patch) {
  const next = { ...word }
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    const before = JSON.stringify(next[key] ?? null)
    const after = JSON.stringify(value)
    if (before !== after) {
      next[key] = value
      changed = true
    }
  }
  if (changed) {
    if (Array.isArray(next.acceptedEnVariants)) {
      next.acceptedEnVariants = unique([next.expression, ...next.acceptedEnVariants])
    }
    if (Array.isArray(next.acceptedZhAnswers)) {
      next.acceptedZhAnswers = unique([next.zhGloss, ...next.acceptedZhAnswers])
    }
    next.updatedAt = TS
  }
  return { word: next, changed }
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
const allFixes = { ...FIXES, ...SIBLING_FIXES }
const missing = []
const updatedIds = []
const fieldCounts = {
  zhGloss: 0,
  enDefinition: 0,
  acceptedZhAnswers: 0,
  acceptedEnVariants: 0,
  examples: 0,
  collocations: 0,
  partOfSpeech: 0,
}

for (const word of pack.words) {
  const patch = allFixes[word.id]
  if (!patch) continue
  for (const key of Object.keys(fieldCounts)) {
    if (key in patch) fieldCounts[key] += 1
  }
  const { word: next, changed } = applyPatch(word, patch)
  if (changed) {
    Object.assign(word, next)
    updatedIds.push(word.id)
  }
}

for (const id of Object.keys(FIXES)) {
  if (!pack.words.some((w) => w.id === id)) missing.push(id)
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

console.log(JSON.stringify({
  packPath,
  highRiskFixKeys: Object.keys(FIXES).length,
  siblingFixKeys: Object.keys(SIBLING_FIXES).length,
  updatedWordCount: updatedIds.length,
  updatedIds,
  fieldCounts,
  missing,
}, null, 2))
