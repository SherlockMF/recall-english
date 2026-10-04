/**
 * Batch 3 — fix POS / example / usage conflicts (~315 audit rows + residual drill templates).
 * Regenerates examples + collocations for non-noun POS; preserves id/senseKey/definitions.
 *
 * Run: node scripts/fixBatch3PosUsage.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 missing')

const TS = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
// Optional audit list from a prior extract; not required for re-runs.
const conflictPath = join(root, 'scripts/_b3_pos_conflicts.json')
const conflictIds = new Set(
  existsSync(conflictPath)
    ? JSON.parse(readFileSync(conflictPath, 'utf8')).map((row) => row.id)
    : [],
)

function unique(values) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

function hashId(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function normalizePos(pos) {
  const p = String(pos || '').toLocaleLowerCase('en-US')
  if (/\badverb\b|\badv\b/.test(p)) return 'adverb'
  if (/\badjective\b|\badj\b/.test(p)) return 'adjective'
  if (/\bpronoun\b/.test(p)) return 'pronoun'
  if (/\bpreposition\b|\bprep\b/.test(p)) return 'preposition'
  if (/\bconjunction\b|\bconj\b/.test(p)) return 'conjunction'
  if (/\bnumeral\b|\bnumber\b|\bnum\b/.test(p)) return 'numeral'
  if (/\binterjection\b/.test(p)) return 'interjection'
  if (/\bmodal\b/.test(p)) return 'modal'
  if (/\bverb\b/.test(p) && !/phrase/.test(p)) return 'verb'
  if (/\bnoun\b/.test(p)) return 'noun'
  if (/\bsentence\b|\bphrase\b/.test(p)) return 'phrase'
  return 'other'
}

function article(expression) {
  const text = expression.trim()
  if (/^[aeiou]/i.test(text)) return 'an'
  return 'a'
}

/** Detect noun-forcing drill / template examples that break non-noun POS. */
function isPosHostileExample(en, expression, posClass) {
  const text = String(en || '')
  const x = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!text) return true
  if (/Pair the .+ with a collocation|weekly drill recycles the |Before the quiz, revise the |Our notes group the |workbook asks you to translate the |Write one sentence that uses the |tutor marked a misuse of the |case study hinges on understanding the |listening clip mentions the |spaced-repetition deck|Explain the .+ without reading the gloss/i.test(text)) {
    return true
  }
  if (posClass === 'adverb' || posClass === 'preposition' || posClass === 'pronoun' || posClass === 'conjunction' || posClass === 'modal' || posClass === 'interjection') {
    if (new RegExp(`\\bthe ${x}\\b`, 'i').test(text)) return true
    if (new RegExp(`\\ba[n]? ${x}\\b`, 'i').test(text) && posClass !== 'adjective') return true
  }
  if (posClass === 'adjective' && new RegExp(`\\bthe ${x}\\b`, 'i').test(text) && !new RegExp(`${x} (room|flat|apartment|option|goods|product|section|menu|item|price|terms?)\\b`, 'i').test(text)) {
    // bare "the frozen" / "the negotiable" without a noun head — hostile
    if (new RegExp(`\\bthe ${x}[.,?!\\"']?(?:\\s|$)`, 'i').test(text)) return true
  }
  if (posClass === 'verb') {
    if (new RegExp(`\\bthe ${x}\\b`, 'i').test(text)) {
      // Allow normal objects: "confirm the order" / "reorder the SKU"
      if (new RegExp(`\\b${x} the\\b`, 'i').test(text)) return false
      return true
    }
  }
  if (posClass === 'numeral' && new RegExp(`\\bthe ${x}\\b`, 'i').test(text)) return true
  return false
}

function isPosHostileCollocation(col, expression, posClass) {
  const c = String(col || '')
  const x = expression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!c) return true
  if (posClass === 'adverb' || posClass === 'preposition' || posClass === 'pronoun' || posClass === 'conjunction' || posClass === 'modal') {
    if (new RegExp(`^(check|use|review|note|discuss|explain|analyse|monitor|report|confirm|negotiate|follow up on) the ${x}$`, 'i').test(c)) {
      return true
    }
    if (new RegExp(`^the ${x}$`, 'i').test(c)) return true
  }
  if (posClass === 'adjective' && new RegExp(`^(confirm|negotiate|follow up on|review|record|explain) the ${x}$`, 'i').test(c)) {
    return true
  }
  if (posClass === 'verb' && new RegExp(`^(confirm|negotiate|follow up on|review) the ${x}$`, 'i').test(c)) {
    return true
  }
  return false
}

function buildForPos(word) {
  const x = word.expression
  const zh = word.zhGloss || x
  const posClass = normalizePos(word.partOfSpeech)
  const a = article(x)
  const i = hashId(word.id)

  const banks = {
    adverb: {
      examples: [
        [
          `She finished the report ${x} before the deadline.`,
          `她在截止日期前${zh}完成了报告。`,
        ],
        [
          `We ${x} agree with the revised forecast.`,
          `我们${zh}同意修订后的预测。`,
        ],
        [
          `He spoke ${x} during the client call.`,
          `他在客户电话中说得${zh}。`,
        ],
        [
          `The numbers moved ${x} in line with the plan.`,
          `数字${zh}按计划变动。`,
        ],
        [
          `Please answer ${x} and keep to the facts.`,
          `请${zh}回答并紧扣事实。`,
        ],
      ],
      cols: [`speak ${x}`, `work ${x}`, `answer ${x}`, `${x} correct`, `almost ${x}`],
    },
    adjective: {
      examples: [
        [
          `We need ${a} ${x} option for this shipment.`,
          `这票货我们需要一个${zh}的方案。`,
        ],
        [
          `Is the apartment ${x}?`,
          `这套公寓是${zh}的吗？`,
        ],
        [
          `Keep ${x} goods in the cold chain.`,
          `请把${zh}的货物放在冷链中。`,
        ],
        [
          `The terms are ${x}, so we can still discuss price.`,
          `条款是${zh}的，所以价格仍可谈。`,
        ],
        [
          `They offered ${a} ${x} menu item.`,
          `他们提供了一道${zh}的菜品。`,
        ],
      ],
      cols: [`${a} ${x} option`, `remain ${x}`, `${x} goods`, `${x} terms`, `clearly ${x}`],
    },
    verb: {
      examples: [
        [
          `Please ${x} the delivery date in writing.`,
          `请书面${zh}交货日期。`,
        ],
        [
          `We need to ${x} before the stock runs out.`,
          `库存耗尽前我们需要${zh}。`,
        ],
        [
          `Can you ${x} receipt of the payment?`,
          `你能${zh}已收到付款吗？`,
        ],
        [
          `They decided to ${x} the popular SKU.`,
          `他们决定对畅销 SKU 进行${zh}。`,
        ],
        [
          `I will ${x} with the supplier tomorrow.`,
          `我明天会与供应商${zh}。`,
        ],
      ],
      cols: [`need to ${x}`, `please ${x}`, `refuse to ${x}`, `${x} carefully`, `decide to ${x}`],
    },
    pronoun: {
      examples: [
        [
          `I completed the form ${x}.`,
          `我${zh}填完了表格。`,
        ],
        [
          `Did you write this ${x}?`,
          `这是你${zh}写的吗？`,
        ],
        [
          `We prepared the slides ${x}.`,
          `我们${zh}准备了幻灯片。`,
        ],
        [
          `She blamed ${x} for the delay.`,
          `她把延误归咎于${zh}。`,
        ],
      ],
      cols: [`by ${x}`, `ask ${x}`, `help ${x}`, `${x} alone`],
    },
    preposition: {
      examples: [
        [
          `Put the keys ${x} the laptop.`,
          `把钥匙放在笔记本电脑${zh}。`,
        ],
        [
          `${x} rent, we also pay utilities.`,
          `${zh}房租，我们还付水电。`,
        ],
        [
          `The meeting is scheduled ${x} lunch.`,
          `会议安排在午餐${zh}。`,
        ],
        [
          `Compare cost ${x} quality before you decide.`,
          `决定前请比较成本${zh}质量。`,
        ],
      ],
      cols: [`${x} work`, `${x} that`, `go ${x}`, `come ${x}`],
    },
    conjunction: {
      examples: [
        [
          `We will ship tomorrow ${x} the payment fails.`,
          `${zh}付款失败，否则我们明天发货。`,
        ],
        [
          `Stay focused ${x} the task feels difficult.`,
          `${zh}任务很难，也要保持专注。`,
        ],
        [
          `Save the file ${x} you leave.`,
          `${zh}离开前请保存文件。`,
        ],
      ],
      cols: [`${x} otherwise`, `not ${x}`, `${x} required`],
    },
    numeral: {
      examples: [
        [
          `We ordered ${x} units for the pilot.`,
          `试点我们订了${zh}件。`,
        ],
        [
          `The invoice shows ${x} line items.`,
          `发票上有${zh}个明细项。`,
        ],
        [
          `About ${x} students joined the tutorial.`,
          `大约${zh}名学生参加了辅导课。`,
        ],
      ],
      cols: [`${x} units`, `about ${x}`, `${x} percent`, `page ${x}`],
    },
    interjection: {
      examples: [
        [
          `${x}, I almost forgot the attachment.`,
          `${zh}，我差点忘了附件。`,
        ],
        [
          `${x}! That was a close call.`,
          `${zh}！好险。`,
        ],
      ],
      cols: [`say “${x}”`, `start with “${x}”`],
    },
    modal: {
      examples: [
        [
          `You ${x} submit the form today.`,
          `你${zh}今天提交表格。`,
        ],
        [
          `We ${x} review the contract again.`,
          `我们${zh}再审一遍合同。`,
        ],
      ],
      cols: [`${x} not`, `${x} have`, `you ${x}`],
    },
  }

  // Expression-specific overrides for common audit offenders
  const overrides = {
    confirm: {
      examples: [
        ['Please confirm the meeting time by email.', '请用电邮确认会议时间。'],
        ['Can you confirm that the payment went through?', '你能确认付款已经到账吗？'],
      ],
      cols: ['confirm the order', 'confirm in writing', 'need to confirm'],
    },
    exchange: {
      examples: [
        ['Tourists exchange cash at the counter.', '游客在柜台兑换现金。'],
        ['We can exchange the damaged item for a new one.', '我们可以把损坏的商品换成新的。'],
      ],
      cols: ['exchange money', 'exchange for', 'currency exchange'],
    },
    reorder: {
      examples: [
        ['Please reorder the best-selling SKU this week.', '请本周重新订购畅销 SKU。'],
        ['We had to reorder after the stockout.', '缺货后我们不得不重新下单。'],
      ],
      cols: ['reorder stock', 'need to reorder', 'reorder point'],
    },
    restock: {
      examples: [
        ['The store will restock fresh milk tomorrow.', '商店明天会补给鲜奶。'],
        ['Please restock the shelves before opening.', '开业前请把货架补满。'],
      ],
      cols: ['restock shelves', 'restock inventory', 'need to restock'],
    },
    frozen: {
      examples: [
        ['Keep frozen food below −18°C.', '冷冻食品请保持在 −18°C 以下。'],
        ['We bought frozen vegetables for the week.', '我们买了本周用的冷冻蔬菜。'],
      ],
      cols: ['frozen food', 'frozen goods', 'keep frozen'],
    },
    furnished: {
      examples: [
        ['They rented a furnished flat near campus.', '他们在校园附近租了一套配家具的公寓。'],
        ['Is the room fully furnished?', '房间是全配家具的吗？'],
      ],
      cols: ['furnished flat', 'fully furnished', 'furnished apartment'],
    },
    unfurnished: {
      examples: [
        ['An unfurnished unit is cheaper to rent.', '未配家具的单位租金更便宜。'],
        ['We prefer an unfurnished house so we can bring our own furniture.', '我们更想要未配家具的房子，好带自己的家具。'],
      ],
      cols: ['unfurnished unit', 'rent unfurnished', 'unfurnished house'],
    },
    negotiable: {
      examples: [
        ['The price is negotiable if you order more.', '如果订量更大，价格可以谈。'],
        ['Are the payment terms negotiable?', '付款条件可以协商吗？'],
      ],
      cols: ['negotiable price', 'terms are negotiable', 'fully negotiable'],
    },
    'non-exclusive': {
      examples: [
        ['This is a non-exclusive distribution agreement.', '这是一份非独家分销协议。'],
        ['We granted a non-exclusive licence to two partners.', '我们向两家伙伴授予了非独家许可。'],
      ],
      cols: ['non-exclusive licence', 'non-exclusive rights', 'non-exclusive agreement'],
    },
    refrigerated: {
      examples: [
        ['Ship the samples in a refrigerated truck.', '请用冷藏车运送样品。'],
        ['Store refrigerated medicines at 2–8°C.', '冷藏药品请存放在 2–8°C。'],
      ],
      cols: ['refrigerated truck', 'refrigerated storage', 'keep refrigerated'],
    },
    vegetarian: {
      examples: [
        ['Do you have a vegetarian option on the menu?', '菜单上有素食选项吗？'],
        ['She ordered a vegetarian meal for lunch.', '她点了一份素食午餐。'],
      ],
      cols: ['vegetarian option', 'vegetarian meal', 'vegetarian menu'],
      enDefinition: 'of food or a diet that does not include meat; suitable for people who do not eat meat',
      zhGloss: '素食的',
      acceptedZhAnswers: ['素食的', '素的'],
    },
    myself: {
      examples: [
        ['I booked the ticket myself.', '我自己订的票。'],
        ['I myself prefer the cheaper plan.', '我本人更喜欢更便宜的方案。'],
      ],
      cols: ['by myself', 'I myself', 'help myself'],
    },
    yourself: {
      examples: [
        ['You should introduce yourself at the meeting.', '你应该在会上自我介绍。'],
        ['Did you check the figures yourself?', '这些数字是你自己核对的吗？'],
      ],
      cols: ['by yourself', 'help yourself', 'ask yourself'],
    },
    ourselves: {
      examples: [
        ['We prepared the slides ourselves.', '我们自己准备了幻灯片。'],
        ['We should ask ourselves whether the fee is fair.', '我们应自问这笔费用是否合理。'],
      ],
      cols: ['by ourselves', 'ask ourselves', 'among ourselves'],
    },
    anyway: {
      examples: [
        ['The shop was closed; anyway, we can order online.', '店关门了；反正我们可以网购。'],
        ['Anyway, let’s finish the report first.', '总之，我们先把报告做完。'],
      ],
      cols: ['anyway', 'anyway, let’s', 'not useful anyway'],
    },
    besides: {
      examples: [
        ['Besides rent, we pay utilities.', '除了房租，我们还付水电费。'],
        ['I don’t need a bag; besides, my hands are full.', '我不需要袋子；再说，我手里已经满了。'],
      ],
      cols: ['besides that', 'besides English', 'besides working'],
    },
    vs: {
      examples: [
        ['The case is listed as Smith vs Jones.', '案件列为 Smith vs Jones。'],
        ['Compare fixed costs vs variable costs in the model.', '在模型中比较固定成本与变动成本。'],
      ],
      cols: ['A vs B', 'versus', 'compared vs'],
    },
    mostly: {
      examples: [
        ['The class is mostly international students.', '这个班大多是国际学生。'],
        ['We mostly work from the campus library.', '我们多半在校园图书馆学习。'],
      ],
      cols: ['mostly correct', 'mostly online', 'consist mostly of'],
    },
    approximately: {
      examples: [
        ['The trip takes approximately two hours.', '路程大约两小时。'],
        ['Sales rose by approximately 8% this quarter.', '本季度销售额大约上升 8%。'],
      ],
      cols: ['approximately equal', 'approximately 10%', 'lasts approximately'],
    },
    whose: {
      examples: [
        ['Whose laptop is this?', '这是谁的笔记本电脑？'],
        ['The student whose essay won will present tomorrow.', '作文获奖的那位学生明天将上台。'],
      ],
      cols: ['whose turn', 'whose idea', 'the team whose'],
    },
    per: {
      examples: [
        ['The fee is RM 5 per page.', '费用是每页 5 令吉。'],
        ['Output is measured per worker per hour.', '产出按每名工人每小时计量。'],
      ],
      cols: ['per unit', 'per hour', 'as per'],
    },
    'dine in': {
      examples: [
        ['Would you like to dine in or take away?', '您要堂食还是外带？'],
        ['We decided to dine in because of the rain.', '因为下雨我们决定堂食。'],
      ],
      cols: ['dine in or take away', 'prefer to dine in', 'dine-in customers'],
    },
    'move in': {
      examples: [
        ['We will move in next Monday.', '我们下周一搬入。'],
        ['You can move in after paying the deposit.', '付押金后就可以搬入。'],
      ],
      cols: ['move in date', 'ready to move in', 'move in next week'],
    },
    'move out': {
      examples: [
        ['Please move out by the end of the month.', '请在月底前搬出。'],
        ['They had to move out when the lease ended.', '租约到期后他们不得不搬出。'],
      ],
      cols: ['move out date', 'notice to move out', 'move out inspection'],
    },
  }

  const key = String(x).toLocaleLowerCase('en-US')
  if (overrides[key]) {
    const o = overrides[key]
    return {
      examples: o.examples.map(([en, zhv]) => ({ en, zh: zhv })),
      collocations: unique(o.cols).slice(0, 3),
      ...(o.enDefinition ? { enDefinition: o.enDefinition } : {}),
      ...(o.zhGloss ? { zhGloss: o.zhGloss } : {}),
      ...(o.acceptedZhAnswers ? { acceptedZhAnswers: unique(o.acceptedZhAnswers) } : {}),
    }
  }

  const bank = banks[posClass]
  if (!bank) return null

  const e1 = bank.examples[i % bank.examples.length]
  const e2 = bank.examples[(i + 1) % bank.examples.length]
  // Ensure expression appears naturally
  const examples = [e1, e2].map(([en, zhv]) => {
    let sentence = en
    if (!new RegExp(x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(sentence)) {
      if (posClass === 'adverb') sentence = `She completed the task ${x}.`
      else if (posClass === 'adjective') sentence = `This is ${a} ${x} choice.`
      else if (posClass === 'verb') sentence = `Please ${x} now.`
      else sentence = `${sentence} (${x})`
    }
    return { en: sentence, zh: zhv }
  })

  const cols = unique(bank.cols.filter((c) => c.toLocaleLowerCase('en-US').includes(key))).slice(0, 3)
  while (cols.length < 2) {
    if (posClass === 'adverb') cols.push(`use “${x}” in a sentence`)
    else if (posClass === 'adjective') cols.push(`${a} ${x} example`)
    else if (posClass === 'verb') cols.push(`need to ${x}`)
    else cols.push(`practise “${x}”`)
  }

  return { examples, collocations: cols.slice(0, 3) }
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let updated = 0
const updatedIds = []
const fieldCounts = { examples: 0, collocations: 0, enDefinition: 0, zhGloss: 0, acceptedZhAnswers: 0 }
const skipped = []

for (const word of pack.words) {
  const posClass = normalizePos(word.partOfSpeech)
  const examplesHostile = (word.examples || []).some((ex) => isPosHostileExample(ex.en, word.expression, posClass))
  const colsHostile = (word.collocations || []).some((col) => isPosHostileCollocation(col, word.expression, posClass))
  const inAudit = conflictIds.has(word.id)
  if (!inAudit && !examplesHostile && !colsHostile) continue

  // Only rewrite when POS is one we know how to fix, or audit-listed.
  const patch = buildForPos(word)
  if (!patch) {
    if (inAudit) skipped.push({ id: word.id, expression: word.expression, pos: word.partOfSpeech })
    continue
  }

  let changed = false
  if (patch.examples) {
    word.examples = patch.examples
    fieldCounts.examples += 1
    changed = true
  }
  if (patch.collocations) {
    word.collocations = patch.collocations
    fieldCounts.collocations += 1
    changed = true
  }
  if (patch.enDefinition && patch.enDefinition !== word.enDefinition) {
    word.enDefinition = patch.enDefinition
    fieldCounts.enDefinition += 1
    changed = true
  }
  if (patch.zhGloss && patch.zhGloss !== word.zhGloss) {
    word.zhGloss = patch.zhGloss
    fieldCounts.zhGloss += 1
    changed = true
  }
  if (patch.acceptedZhAnswers) {
    word.acceptedZhAnswers = unique([word.zhGloss, ...patch.acceptedZhAnswers])
    fieldCounts.acceptedZhAnswers += 1
    changed = true
  }

  if (changed) {
    // Clear pack usagePrompts; seed:pack rebuilds from examples.
    word.usagePrompts = []
    word.updatedAt = TS
    updated += 1
    updatedIds.push(word.id)
  }
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const report = {
  auditConflicts: conflictIds.size,
  updated,
  fieldCounts,
  skipped,
  updatedIds,
}
writeFileSync(join(root, 'scripts/_b3_report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  auditConflicts: report.auditConflicts,
  updated: report.updated,
  fieldCounts: report.fieldCounts,
  skipped: report.skipped,
  sampleIds: updatedIds.slice(0, 20),
}, null, 2))
