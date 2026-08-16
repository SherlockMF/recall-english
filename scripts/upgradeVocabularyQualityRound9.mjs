/**
 * Round-9 quality upgrade: split general class + diversify formulaic examples/cols.
 * Final planned quality pass for V5.2 bulk vocabulary.
 *
 * Run: node scripts/upgradeVocabularyQualityRound9.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 pack missing')

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
  if (
    /\b(goods|assets|liabilities|earnings|proceeds|funds|terms|data|income|expense|equity|inventory|equipment|costs|expenses|securities|bonds|prices|accounts|receivables|receipts|supplies|revenues|documents|contracts|stocks|companies|quotas|schedules|interests|inventories|banks|taxes|duties|records|ratios|methods|procedures|rules|indicators|cards|reports|dividends|deposits|debentures|indices|holdings|outlays|warrants|coupons|classes|certificates|exchanges|advances|collections|notes)\b/i.test(
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
  if (/\badverb\b|\badv\b/.test(pos)) return 'adverb'
  if (/\bpronoun\b/.test(pos)) return 'pronoun'
  if (/\bpreposition\b|\bprep\b/.test(pos)) return 'preposition'
  if (/\bconjunction\b|\bconj\b/.test(pos)) return 'conjunction'
  if (/\bnumeral\b|\bnumber\b/.test(pos)) return 'numeral'
  if (/\bmodal\b/.test(pos)) return 'modal'
  if (/\binterjection\b/.test(pos)) return 'interjection'
  if (/\badj/.test(pos) || isLikelyAdjective(x)) return 'adjective'
  if (/[.?!]$/.test(x)) return 'utterance'
  if (/^(assess|raise|compare|calculate|prepare|review|monitor|negotiate|appoint|issue|record|disclose|hedge|fund|price)\b/i.test(lower)) {
    return 'directive'
  }
  if (/bank$/i.test(head) || /\bbank\b/i.test(lower)) return 'institution'
  if (
    /\b(advances|deposit|receipts|receivable|receivables|collections|notes|statement|debit)\b/i.test(lower) &&
    /\bcustomers?\b/i.test(lower)
  ) {
    if (/statement/i.test(lower)) return 'document'
    return 'money'
  }
  if (/^(investor|clerk|manager|agent|attorney|auditor|wholesaler|entrepreneur|dealer|stockholder|attach[eé]|banker|accountant)$/i.test(head)) {
    return 'person'
  }
  if (/^(report|memo|slip|ticket|invoice|certificate|statement|bulletin|indenture|advice|tag|manual|book|form|proposal|schedule|card|coupon|scrip|bill)$/i.test(head)) {
    return 'document'
  }
  if (/^(rate|ratio|index|indices|yield|margin|price|cost|costs|percentage|average|expenses)$/i.test(head)) return 'metric'
  if (/^(fee|debt|deposit|loan|capital|fund|credit|dividend|premium|discount|proceeds|outlay|rebate|bond|cash|equity|income|revenue|expense|tax|duty|advances|collections)$/i.test(head)) {
    return 'money'
  }
  if (/^(warehouse|godown|depot|zone|garden|place|box|exchange|market|store|center|centre|office|branch|safe-deposit)$/i.test(head)) {
    return 'place'
  }
  if (/^(shipment|shipping|delivery|transport|transit|consignment)$/i.test(head)) return 'logistics'
  if (/^(contract|contracts|agreement|treaty|policy|ratification|assignment)$/i.test(head)) return 'legal'
  if (/^(system|method|methods|procedure|process|approach|basis|model|scheme|structure|analysis|assessment)$/i.test(head)) {
    return 'method'
  }
  if (/^(deficit|surplus|gap|boom|rally|risk|hazard|failure|out|split|shrinkage|position)$/i.test(head)) {
    return 'condition'
  }
  if (/^(control|controls|capacity|productivity|efficiency|autonomy|leadership|rigidity|sovereignty)$/i.test(head)) {
    return 'ops'
  }
  if (/^(quota|quotas|tariff|tariffs|duty|duties|customs|tender|tenders|offer|offers)$/i.test(head)) {
    return 'trade'
  }
  return 'general'
}

function isSoftBankExample(en) {
  return /The memo defines the|Add the .+ to tomorrow.?s agenda|Two teams share ownership of the|We cross-checked the .+ with operations|The training slide covers the|Keep evidence supporting the|The policy annex mentions the|Please paraphrase the .+ for the client|We timed the discussion of the|The glossary entry for the .+ was updated|The briefing clarified the|We validated the .+ against source data|Legal asked us to redefine the|The kickoff deck covers the|The deal model hinges on the|She explained the .+ in plain English|We escalated the .+ to the steering group/i.test(
    String(en || ''),
  )
}

function isGenericColSet(cols, expression, partOfSpeech) {
  const list = Array.isArray(cols) ? cols : []
  if (list.length < 2) return true
  const klass = semanticClass(expression, partOfSpeech)
  if (klass === 'adjective') {
    const ok = list.some((col) =>
      new RegExp(`^(an?|more|remain|sound|clearly) .*${expression.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i').test(col),
    )
    return !ok
  }
  if (
    list.filter((col) =>
      /^(clarify the|define the|validate the|prioritise the|communicate the|update the|refer to the|check the)/i.test(col),
    ).length >= 2
  ) {
    return true
  }
  if ((klass === 'money' || klass === 'document' || klass === 'metric') && list.some((col) => /^(appoint|brief|hire|consult|meet) (a |an |the )?/i.test(col))) {
    return true
  }
  if (klass === 'document' && list.some((col) => /^(appoint|hedge|fund|price) (a |an |the )?/i.test(col))) {
    return true
  }
  return false
}

function pickCols(cands, expression, pos) {
  const out = []
  for (const c of cands) {
    if (isFakeCol(c, expression, pos)) continue
    if (!c.toLocaleLowerCase('en-US').includes(expression.toLocaleLowerCase('en-US'))) continue
    out.push(c)
    if (out.length >= 3) break
  }
  while (out.length < 2) out.push(`refer to “${expression}”`, `check “${expression}”`)
  return unique(out).filter((c) => !isFakeCol(c, expression, pos)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, id) {
  const x = expression
  const klass = semanticClass(x, partOfSpeech)
  const art = withArticle(x)

  if (klass === 'utterance') return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  if (klass === 'verb') return pickCols([`${x} carefully`, `decide whether to ${x}`, `refuse to ${x}`], x, partOfSpeech)
  if (klass === 'adverb') return pickCols([`speak ${x}`, `work ${x}`, `answer ${x}`], x, partOfSpeech)
  if (klass === 'pronoun') return pickCols([`by ${x}`, `ask ${x}`, `help ${x}`], x, partOfSpeech)
  if (klass === 'preposition') return pickCols([`${x} work`, `${x} that`, `go ${x}`], x, partOfSpeech)
  if (klass === 'conjunction') return pickCols([`${x} otherwise`, `not ${x}`, `${x} required`], x, partOfSpeech)
  if (klass === 'numeral') return pickCols([`${x} units`, `about ${x}`, `page ${x}`], x, partOfSpeech)
  if (klass === 'modal') return pickCols([`${x} not`, `you ${x}`, `${x} have`], x, partOfSpeech)
  if (klass === 'interjection') return pickCols([`say “${x}”`, `start with “${x}”`], x, partOfSpeech)
  if (klass === 'adjective') {
    const a = /^[aeiou]/i.test(x) ? 'an' : 'a'
    return pickCols([`${a} ${x} decision`, `remain ${x}`, `sound ${x}`], x, partOfSpeech)
  }
  if (klass === 'directive') return pickCols([`need to ${x}`, `how to ${x}`, `fail to ${x}`], x, partOfSpeech)

  const pools = {
    person: [
      [`appoint ${art}`, `brief the ${x}`, `consult the ${x}`],
      [`meet the ${x}`, `recommend ${art}`, `rely on the ${x}`],
    ],
    document: [
      [`issue the ${x}`, `file the ${x}`, `review the ${x}`],
      [`draft the ${x}`, `circulate the ${x}`, `amend the ${x}`],
      [`present the ${x}`, `sign the ${x}`, `archive the ${x}`],
    ],
    metric: [
      [`calculate the ${x}`, `compare the ${x}`, `revise the ${x}`],
      [`set the ${x}`, `publish the ${x}`, `challenge the ${x}`],
    ],
    money: [
      [`settle the ${x}`, `estimate the ${x}`, `approve the ${x}`],
      [`book the ${x}`, `forecast the ${x}`, `allocate the ${x}`],
      [`collect the ${x}`, `release the ${x}`, `secure the ${x}`],
    ],
    place: [
      [`inspect the ${x}`, `secure the ${x}`, `visit the ${x}`],
      [`lease the ${x}`, `audit the ${x}`, `relocate the ${x}`],
    ],
    institution: [
      [`engage the ${x}`, `instruct the ${x}`, `evaluate the ${x}`],
      [`bank with the ${x}`, `deal with the ${x}`, `open an account at the ${x}`],
    ],
    logistics: [
      [`arrange the ${x}`, `track the ${x}`, `expedite the ${x}`],
      [`confirm the ${x}`, `reroute the ${x}`, `insure the ${x}`],
    ],
    legal: [
      [`draft the ${x}`, `sign the ${x}`, `enforce the ${x}`],
      [`negotiate the ${x}`, `renew the ${x}`, `assign the ${x}`],
    ],
    method: [
      [`apply the ${x}`, `adopt the ${x}`, `document the ${x}`],
      [`test the ${x}`, `refine the ${x}`, `compare the ${x}`],
    ],
    condition: [
      [`monitor the ${x}`, `explain the ${x}`, `mitigate the ${x}`],
      [`report the ${x}`, `narrow the ${x}`, `stress-test the ${x}`],
    ],
    ops: [
      [`improve the ${x}`, `measure the ${x}`, `benchmark the ${x}`],
      [`govern the ${x}`, `escalate the ${x}`, `stabilise the ${x}`],
    ],
    trade: [
      [`set the ${x}`, `negotiate the ${x}`, `comply with the ${x}`],
      [`apply the ${x}`, `review the ${x}`, `challenge the ${x}`],
    ],
    general: [
      [`clarify “${x}”`, `apply “${x}”`, `update “${x}”`],
      [`define “${x}”`, `teach “${x}”`, `revise “${x}”`],
      [`map the ${x}`, `own the ${x}`, `review the ${x}`],
    ],
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
      { en: `Please ${x} the delivery date in writing.`, zh: `请书面${zh}交货日期。` },
      { en: `We need to ${x} before the deadline.`, zh: `截止日期前我们需要${zh}。` },
    ]
  }
  if (klass === 'adverb') {
    return [
      { en: `She finished the task ${x}.`, zh: `她${zh}完成了任务。` },
      { en: `We ${x} agree with the plan.`, zh: `我们${zh}同意该计划。` },
    ]
  }
  if (klass === 'pronoun') {
    return [
      { en: `I completed the form ${x}.`, zh: `我${zh}填完了表格。` },
      { en: `Did you check this ${x}?`, zh: `这是你${zh}核对的吗？` },
    ]
  }
  if (klass === 'preposition') {
    return [
      { en: `Put the file ${x} the folder.`, zh: `把文件放在文件夹${zh}。` },
      { en: `${x} rent, we pay utilities.`, zh: `${zh}房租，我们还付水电。` },
    ]
  }
  if (klass === 'conjunction') {
    return [
      { en: `We will continue ${x} costs rise further.`, zh: `${zh}成本继续上升，否则我们会继续。` },
      { en: `Save the file ${x} you leave.`, zh: `${zh}离开前请保存文件。` },
    ]
  }
  if (klass === 'numeral') {
    return [
      { en: `We ordered ${x} units.`, zh: `我们订了${zh}件。` },
      { en: `About ${x} people joined.`, zh: `大约${zh}人参加。` },
    ]
  }
  if (klass === 'modal') {
    return [
      { en: `You ${x} submit the form today.`, zh: `你${zh}今天提交表格。` },
      { en: `We ${x} review the contract again.`, zh: `我们${zh}再审一遍合同。` },
    ]
  }
  if (klass === 'interjection') {
    return [
      { en: `${x}, I almost forgot the file.`, zh: `${zh}，我差点忘了文件。` },
      { en: `${x}! That was close.`, zh: `${zh}！好险。` },
    ]
  }
  if (klass === 'adjective') {
    return [
      { en: `We need ${art} ${x} option for this shipment.`, zh: `这票货我们需要一个${zh}的方案。` },
      { en: `Keep the summary ${x} and easy to scan.`, zh: `请让摘要保持${zh}并便于扫读。` },
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
      { en: `We presented the ${x} to the buyer.`, zh: `我们向买方出示了「${zh}」。` },
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
      { en: `Release the ${x} after inspection.`, zh: `验收后释放「${zh}」。` },
    ],
    place: [
      { en: `We inspected the ${x} this morning.`, zh: `我们今早检查了「${zh}」。` },
      { en: `Access to the ${x} is restricted.`, zh: `「${zh}」的进出受限。` },
      { en: `Security logged every visit to the ${x}.`, zh: `安保记录了每次进入「${zh}」。` },
    ],
    institution: [
      { en: `Please instruct the ${x} in writing.`, zh: `请书面指示「${zh}」。` },
      { en: `The ${x} requested updated KYC files.`, zh: `「${zh}」要求更新尽调材料。` },
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
      { en: `We assigned rights under the ${x}.`, zh: `我们转让了「${zh}」项下的权利。` },
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
    ops: [
      { en: `Ops tracked the ${x} against the target.`, zh: `运营对照目标跟踪「${zh}」。` },
      { en: `We benchmarked the ${x} with peers.`, zh: `我们与同业对标了「${zh}」。` },
      { en: `The scorecard now includes the ${x}.`, zh: `记分卡现已包含「${zh}」。` },
    ],
    trade: [
      { en: `Customs applied the ${x} at clearance.`, zh: `清关时海关适用了「${zh}」。` },
      { en: `Buyers challenged the ${x} in talks.`, zh: `买方在谈判中质疑「${zh}」。` },
      { en: `The tender pack explains the ${x}.`, zh: `招标文件说明了「${zh}」。` },
    ],
    general: [
      { en: `In class we contrasted “${x}” with a near synonym.`, zh: `课堂上我们把「${zh}」和近义词对比了。` },
      { en: `The case study hinges on understanding the ${x}.`, zh: `案例关键键在于理解「${zh}」。` },
      { en: `Write one sentence that uses the ${x} accurately.`, zh: `写一句准确使用「${zh}」的句子。` },
      { en: `The tutor marked a misuse of the ${x}.`, zh: `老师标出了「${zh}」的误用。` },
      { en: `Before the quiz, revise the ${x}.`, zh: `测验前复习「${zh}」。` },
      { en: `Our notes group the ${x} under trade terms.`, zh: `笔记把「${zh}」归在贸易术语下。` },
      { en: `The workbook asks you to translate the ${x}.`, zh: `练习册要求翻译「${zh}」。` },
      { en: `I added the ${x} to my spaced-repetition deck.`, zh: `我把「${zh}」加进了间隔复习卡组。` },
      { en: `Explain the ${x} without reading the gloss.`, zh: `不看释义说明「${zh}」。` },
      { en: `The listening clip mentions the ${x} twice.`, zh: `听力片段两次提到「${zh}」。` },
      { en: `Pair the ${x} with a collocation you can reuse.`, zh: `给「${zh}」配一个可复用搭配。` },
      { en: `The weekly drill recycles the ${x}.`, zh: `每周操练会复现「${zh}」。` },
    ],
  }

  const pool = pools[klass] || pools.general
  const i = hashId(id) % pool.length
  return [pool[i], pool[(i + 1) % pool.length]]
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let examples = 0
let cols = 0
const classCounts = {}

for (const word of pack.words) {
  if (String(word.id).startsWith('v1-')) continue
  const klass = semanticClass(word.expression, word.partOfSpeech)
  classCounts[klass] = (classCounts[klass] || 0) + 1

  if (!Array.isArray(word.examples) || word.examples.length < 2 || word.examples.some((ex) => isSoftBankExample(ex.en))) {
    word.examples = buildExamples(word.expression, word.zhGloss, word.id, word.partOfSpeech)
    examples += 1
  } else if (
    (klass === 'money' || klass === 'document') &&
    (word.examples || []).some((ex) => /appointed .+ for the region|brief the .+ before Friday/i.test(ex.en || ''))
  ) {
    word.examples = buildExamples(word.expression, word.zhGloss, word.id, word.partOfSpeech)
    examples += 1
  }

  if (isGenericColSet(word.collocations, word.expression, word.partOfSpeech)) {
    word.collocations = buildCollocations(word.expression, word.partOfSpeech, word.id)
    cols += 1
  }

  word.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const softLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && (w.examples || []).some((e) => isSoftBankExample(e.en)),
)
const bfLeft = pack.words.filter(
  (w) => !w.id.startsWith('v1-') && /used in business and finance$/i.test(w.enDefinition || ''),
)

mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round9-report.json'),
  `${JSON.stringify({ examples, cols, softLeft: softLeft.length, bfLeft: bfLeft.length, classCounts }, null, 2)}\n`,
)
console.log(JSON.stringify({ examples, cols, softLeft: softLeft.length, bfLeft: bfLeft.length, classCounts }, null, 2))
