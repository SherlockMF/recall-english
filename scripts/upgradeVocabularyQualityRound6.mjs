/**
 * Round-6 quality upgrade on trusted_v5_2 pack.
 * Focus: semantic collocations + head-aware examples (kill formula banks / role mismatches).
 *
 * Run: node scripts/upgradeVocabularyQualityRound6.mjs && npm run seed:pack && npm run seed:quality
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

  if (
    /^(assess|raise|compare|calculate|prepare|review|monitor|negotiate|appoint|issue|record|disclose|hedge|fund|price)\b/i.test(
      lower,
    )
  ) {
    return 'directive'
  }

  if (
    /^(agent|attorney|auditor|investor|wholesaler|entrepreneur|keeper|clerk|manager|dealer|stockholder|attach[eé]|banker|accountant|procurator|franchisee|receiver)$/i.test(
      head,
    ) ||
    /\b(agent|attorney|auditor|investor|clerk|manager|wholesaler|entrepreneur|dealer)\b/i.test(lower)
  ) {
    // Prefer document/fee when head is report/fee/receipt after role words
    if (/^(report|fee|receipt|invoice|certificate|statement|memo|slip|ticket)$/i.test(head)) return 'document'
    if (/^(fee|cost|charge|premium|discount|rate)$/i.test(head)) return 'money'
    if (/\b(bank|exchange|institute|company|firm)\b/i.test(head)) return 'institution'
    return 'person'
  }

  if (
    /^(report|memo|slip|ticket|invoice|invoices|certificate|certificates|statement|bulletin|indenture|indentures|advice|tag|manual|book|books|form|proposal|schedule|schedules|card|cards|coupon|coupons|scrip)$/i.test(
      head,
    )
  ) {
    return 'document'
  }

  if (
    /^(rate|rates|ratio|ratios|index|indices|yield|margin|price|prices|cost|costs|percentage|average|averages)$/i.test(
      head,
    )
  ) {
    return 'metric'
  }

  if (
    /^(fee|fees|debt|deposit|deposits|loan|loans|capital|fund|funds|credit|credits|dividend|premium|discount|proceeds|outlay|outlays|rebate|indemnity|guaranty|bond|bonds|debenture|debentures|cash|equity|income|revenue|revenues|expense|expenses|tax|taxes|duty|duties)$/i.test(
      head,
    )
  ) {
    return 'money'
  }

  if (
    /^(warehouse|godown|depot|zone|garden|place|box|exchange|exchanges|market|store|center|centre|centers|centres|office|branch)$/i.test(
      head,
    )
  ) {
    return 'place'
  }

  if (/^(bank|banks|institute|company|firm|firms|agency|guild)$/i.test(head)) return 'institution'

  if (/^(shipment|shipping|delivery|transport|transit|consignment)$/i.test(head)) return 'logistics'

  if (/^(contract|contracts|agreement|agreements|treaty|treaties|policy|policies)$/i.test(head)) return 'legal'

  return 'general'
}

function isSoftBankExample(en) {
  return /Before we sign, let’s confirm the|Ops put the .+ on this week|We closed the week by settling the|The client asked for clarity on the|Ops follows up on the|We put “.+” on Thursday’s agenda|We escalated the .+ to the steering group|Ops flagged a delay around the|Sales needs a decision on the .+ by Friday|The proposal restates our position on the|Legal asked us to redefine the|The kickoff deck covers the|Ops tracked the .+ against the SLA|We renegotiated terms around the|The customer FAQ explains the|The working paper documents the|We adjusted the accounts for the|Auditors queried the measurement of the|Month-end close hinges on the|The deal model hinges on the|Risk reported a spike in the|We stress-tested assumptions about the|Treasury flagged the .+ in the morning pack|I compared this year.?s|She explained the .+ in plain English|The board wanted a more|Keep the wording clearly|The lead schedule supports the|The credit memo references the|Please bring proof of the|I noted the .+ in my planner|Keep a copy of the .+ for your records|Customs released goods from the/i.test(
    String(en || ''),
  )
}

function isMismatchedColSet(cols, expression, partOfSpeech) {
  const list = Array.isArray(cols) ? cols : []
  if (list.length < 2) return true
  if (list.some((col) => /^a [aeiou]/i.test(col))) return true

  const klass = semanticClass(expression, partOfSpeech)
  const joined = list.join(' || ')

  if (klass === 'adjective') {
    const ok = list.some((col) =>
      new RegExp(`^(an?|more|remain|sound|clearly) .*${expression.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}`, 'i').test(
        col,
      ),
    )
    return !ok
  }

  if (klass === 'person') {
    return list.some((col) =>
      /^(model|hedge|post|accrue|stress-test|price|fund|value|reconcile|disclose|pilot|scale) (a |an |the )/i.test(col),
    )
  }

  if (klass === 'document') {
    return (
      list.some((col) => /^(hedge|fund|underwrite|syndicate|appoint|brief) (a |an |the )/i.test(col)) ||
      list.filter((col) => /^(benchmark|escalate|close out|pilot|scale|narrow|finance) (a |an |the )/i.test(col))
        .length >= 2
    )
  }

  if (klass === 'place' || klass === 'institution') {
    return list.some((col) =>
      /^(post|accrue|hedge|amortis|amortiz|benchmark|escalate|close out) (a |an |the )/i.test(col),
    )
  }

  // Overused generic clusters
  if (
    list.filter((col) =>
      /^(brief the team on the|agree the|document the|scope the|own the|close out the|clarify “|use “|benchmark the|escalate the)/i.test(
        col,
      ),
    ).length >= 2
  ) {
    return true
  }

  if (
    list.filter((col) => /^(post the|reconcile the|disclose the|model the|stress-test the|hedge the)/i.test(col))
      .length >= 2 &&
    klass === 'general'
  ) {
    return true
  }

  void joined
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
  while (out.length < 2) out.push(`refer to the ${expression}`, `check the ${expression}`)
  return unique(out).filter((c) => !isFakeCol(c, expression, pos)).slice(0, 3)
}

function buildCollocations(expression, partOfSpeech, id) {
  const x = expression
  const pos = String(partOfSpeech || '').toLocaleLowerCase('en-US')
  const klass = semanticClass(x, partOfSpeech)
  const art = withArticle(x)

  if (klass === 'utterance') return [`say “${x}”`, `ask “${x}”`, `practise “${x}”`]
  if (klass === 'verb') {
    return pickCols([`${x} carefully`, `decide whether to ${x}`, `refuse to ${x}`], x, partOfSpeech)
  }
  if (klass === 'adjective') {
    const a = /^[aeiou]/i.test(x) ? 'an' : 'a'
    return pickCols([`${a} ${x} decision`, `remain ${x}`, `sound ${x}`], x, partOfSpeech)
  }
  if (klass === 'directive') {
    return pickCols([`need to ${x}`, `how to ${x}`, `fail to ${x}`], x, partOfSpeech)
  }

  const pools = {
    person: [
      [`appoint ${art}`, `brief the ${x}`, `replace the ${x}`],
      [`hire ${art}`, `consult the ${x}`, `train the ${x}`],
      [`meet the ${x}`, `recommend ${art}`, `rely on the ${x}`],
    ],
    document: [
      [`issue the ${x}`, `file the ${x}`, `review the ${x}`],
      [`sign the ${x}`, `attach the ${x}`, `archive the ${x}`],
      [`draft the ${x}`, `circulate the ${x}`, `amend the ${x}`],
    ],
    metric: [
      [`calculate the ${x}`, `compare the ${x}`, `revise the ${x}`],
      [`set the ${x}`, `benchmark the ${x}`, `publish the ${x}`],
      [`track the ${x}`, `explain the ${x}`, `challenge the ${x}`],
    ],
    money: [
      [`settle the ${x}`, `estimate the ${x}`, `approve the ${x}`],
      [`recover the ${x}`, `allocate the ${x}`, `defer the ${x}`],
      [`book the ${x}`, `forecast the ${x}`, `limit the ${x}`],
    ],
    place: [
      [`inspect the ${x}`, `operate the ${x}`, `relocate the ${x}`],
      [`secure the ${x}`, `visit the ${x}`, `lease the ${x}`],
      [`clear goods through the ${x}`, `stock the ${x}`, `audit the ${x}`],
    ],
    institution: [
      [`engage the ${x}`, `bank with the ${x}`, `instruct the ${x}`],
      [`open an account at the ${x}`, `deal with the ${x}`, `audit the ${x}`],
      [`partner with the ${x}`, `switch to the ${x}`, `evaluate the ${x}`],
    ],
    logistics: [
      [`arrange the ${x}`, `track the ${x}`, `expedite the ${x}`],
      [`confirm the ${x}`, `delay the ${x}`, `reroute the ${x}`],
      [`schedule the ${x}`, `document the ${x}`, `insure the ${x}`],
    ],
    legal: [
      [`draft the ${x}`, `sign the ${x}`, `enforce the ${x}`],
      [`negotiate the ${x}`, `renew the ${x}`, `terminate the ${x}`],
      [`review the ${x}`, `redline the ${x}`, `execute the ${x}`],
    ],
    general: [
      [`clarify the ${x}`, `apply the ${x}`, `update the ${x}`],
      [`define the ${x}`, `validate the ${x}`, `communicate the ${x}`],
      [`prioritise the ${x}`, `standardise the ${x}`, `monitor the ${x}`],
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
      { en: `We replaced the ${x} after the handover.`, zh: `交接后我们更换了「${zh}」。` },
    ],
    document: [
      { en: `Please issue the ${x} today.`, zh: `请今天开具「${zh}」。` },
      { en: `Legal redlined the ${x} overnight.`, zh: `法务连夜修改了「${zh}」。` },
      { en: `File the ${x} with the working papers.`, zh: `把「${zh}」归入工作底稿。` },
      { en: `The ${x} still needs two signatures.`, zh: `「${zh}」还差两个签字。` },
    ],
    metric: [
      { en: `Finance recalculated the ${x}.`, zh: `财务重新计算了「${zh}」。` },
      { en: `The board challenged the ${x} assumption.`, zh: `董事会质疑「${zh}」假设。` },
      { en: `We published the updated ${x}.`, zh: `我们公布了更新后的「${zh}」。` },
      { en: `Compare last quarter’s ${x} with this one.`, zh: `把上季度「${zh}」与本季对比。` },
    ],
    money: [
      { en: `Treasury settled the ${x} yesterday.`, zh: `资金部昨天结清了「${zh}」。` },
      { en: `We need approval before booking the ${x}.`, zh: `入账「${zh}」前需要审批。` },
      { en: `The forecast includes the ${x}.`, zh: `预测已包含「${zh}」。` },
      { en: `Auditors sampled the ${x} balance.`, zh: `审计师抽样检查了「${zh}」余额。` },
    ],
    place: [
      { en: `We inspected the ${x} this morning.`, zh: `我们今早检查了「${zh}」。` },
      { en: `Access to the ${x} is restricted.`, zh: `「${zh}」的进出受限。` },
      { en: `Lease terms for the ${x} expire in June.`, zh: `「${zh}」租约六月到期。` },
      { en: `Security logged every visit to the ${x}.`, zh: `安保记录了每次进入「${zh}」。` },
      { en: `Stock counts at the ${x} were clean.`, zh: `「${zh}」盘点结果正常。` },
      { en: `Customs cleared cargo through the ${x}.`, zh: `海关经「${zh}」完成了放行。` },
    ],
    institution: [
      { en: `We opened the facility with the ${x}.`, zh: `我们与「${zh}」开立了授信。` },
      { en: `Please instruct the ${x} in writing.`, zh: `请书面指示「${zh}」。` },
      { en: `The ${x} requested updated KYC files.`, zh: `「${zh}」要求更新尽调材料。` },
      { en: `We switched clearing to the ${x}.`, zh: `我们把清算转到了「${zh}」。` },
    ],
    logistics: [
      { en: `Ops expedited the ${x} after the delay.`, zh: `延误后运营加急了「${zh}」。` },
      { en: `Confirm the ${x} before loading.`, zh: `装货前确认「${zh}」。` },
      { en: `The ${x} was rerouted via Singapore.`, zh: `「${zh}」改道经新加坡。` },
      { en: `Insure the ${x} at invoice value.`, zh: `按发票金额为「${zh}」投保。` },
    ],
    legal: [
      { en: `Counsel redlined the ${x}.`, zh: `律师修改了「${zh}」。` },
      { en: `Both parties executed the ${x}.`, zh: `双方签署了「${zh}」。` },
      { en: `We renewed the ${x} for two years.`, zh: `我们把「${zh}」续签了两年。` },
      { en: `Do not terminate the ${x} without notice.`, zh: `未经通知不得终止「${zh}」。` },
    ],
    general: [
      { en: `The briefing clarified the ${x}.`, zh: `简报澄清了「${zh}」。` },
      { en: `We validated the ${x} against source data.`, zh: `我们对照源数据核验了「${zh}」。` },
      { en: `Please update the ${x} in the pack.`, zh: `请在材料中更新「${zh}」。` },
      { en: `Ownership of the ${x} sits with finance.`, zh: `「${zh}」由财务负责。` },
      { en: `The checklist now includes the ${x}.`, zh: `清单现已包含「${zh}」。` },
      { en: `We standardised wording for the ${x}.`, zh: `我们统一了「${zh}」的表述。` },
      { en: `A short note explains the ${x}.`, zh: `一则短说明解释了「${zh}」。` },
      { en: `The team aligned on the ${x} yesterday.`, zh: `团队昨天就「${zh}」达成一致。` },
      { en: `Put the ${x} next to the assumptions.`, zh: `把「${zh}」放在假设旁边。` },
      { en: `We flagged uncertainty around the ${x}.`, zh: `我们标出了「${zh}」相关的不确定点。` },
    ],
  }

  // Prefer non-warehouse templates for boxes / vault items
  if (klass === 'place' && /\bbox\b/i.test(x)) {
    const boxPool = [
      { en: `We inspected the ${x} this morning.`, zh: `我们今早检查了「${zh}」。` },
      { en: `Access to the ${x} is restricted.`, zh: `「${zh}」的进出受限。` },
      { en: `Security logged every visit to the ${x}.`, zh: `安保记录了每次进入「${zh}」。` },
      { en: `Lease terms for the ${x} expire in June.`, zh: `「${zh}」租约六月到期。` },
    ]
    const i = hashId(id) % boxPool.length
    return [boxPool[i], boxPool[(i + 1) % boxPool.length]]
  }

  const pool = pools[klass] || pools.general
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
let examples = 0
let cols = 0
const classCounts = {}

for (const word of pack.words) {
  if (String(word.id).startsWith('v1-')) continue
  primaryMeta(word.id, pack.memberships) // keep membership resolution warm / future use
  const klass = semanticClass(word.expression, word.partOfSpeech)
  classCounts[klass] = (classCounts[klass] || 0) + 1

  if (
    !Array.isArray(word.examples) ||
    word.examples.length < 2 ||
    word.examples.some((ex) => isSoftBankExample(ex.en))
  ) {
    word.examples = buildExamples(word.expression, word.zhGloss, word.id, word.partOfSpeech)
    examples += 1
  }

  if (isMismatchedColSet(word.collocations, word.expression, word.partOfSpeech) || (word.collocations || []).length < 2) {
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
const roleBad = pack.words.filter((w) => {
  if (w.id.startsWith('v1-')) return false
  if (semanticClass(w.expression, w.partOfSpeech) !== 'person') return false
  return (w.collocations || []).some((c) =>
    /^(model|hedge|post|accrue|stress-test|price|fund|value|reconcile|disclose) (a |an |the )/i.test(c),
  )
})

mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round6-report.json'),
  `${JSON.stringify(
    {
      examples,
      cols,
      softLeft: softLeft.length,
      roleBad: roleBad.length,
      classCounts,
      sampleRoleBad: roleBad.slice(0, 10).map((w) => ({ e: w.expression, c: w.collocations })),
    },
    null,
    2,
  )}\n`,
)

console.log(JSON.stringify({ examples, cols, softLeft: softLeft.length, roleBad: roleBad.length, classCounts }, null, 2))
