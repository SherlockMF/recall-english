/**
 * Batch 6 — high-confidence Core/Econ sense realignment + Round9 template sweep.
 *
 * 1) Curate WordNet/wrong-POS sense mismatches (zh ↔ definition ↔ POS ↔ examples)
 * 2) Replace residual Round9 verb/adj drill banks with POS-aware examples
 *
 * Run: node scripts/fixBatch6SenseAlignment.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 missing')

const TS = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')

function unique(values) {
  return [...new Set(values.map((v) => String(v ?? '').trim()).filter(Boolean))]
}

function hashId(id) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}

function article(expression) {
  return /^[aeiou]/i.test(String(expression).trim()) ? 'an' : 'a'
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

function isRound9HostileExample(en) {
  return /They chose to .+ after reviewing the risks|Do not .+ unless the contract allows it|Investors preferred a more .+ structure|Make sure the summary stays /i.test(
    String(en || ''),
  )
}

function pickBank(bank, id) {
  const i = hashId(id)
  const a = bank[i % bank.length]
  const b = bank[(i + 2) % bank.length]
  return [
    { en: a[0], zh: a[1] },
    { en: b[0], zh: b[1] },
  ]
}

function buildPosAware(word) {
  const x = word.expression
  const zh = word.zhGloss || x
  const a = article(x)
  const posClass = normalizePos(word.partOfSpeech)

  if (posClass === 'verb') {
    return {
      examples: pickBank(
        [
          [`Please ${x} the delivery date in writing.`, `请书面${zh}交货日期。`],
          [`We need to ${x} before the deadline.`, `截止日期前我们需要${zh}。`],
          [`Can you ${x} the latest figures?`, `你能${zh}最新数字吗？`],
          [`They decided to ${x} the risky option.`, `他们决定${zh}那个高风险选项。`],
          [`I will ${x} with the supplier tomorrow.`, `我明天会与供应商${zh}。`],
        ],
        word.id,
      ),
      collocations: unique([`need to ${x}`, `please ${x}`, `refuse to ${x}`, `${x} carefully`, `decide to ${x}`]).slice(0, 4),
    }
  }
  if (posClass === 'adjective') {
    return {
      examples: pickBank(
        [
          [`We need ${a} ${x} option for this shipment.`, `这票货我们需要一个${zh}的方案。`],
          [`Is the apartment ${x}?`, `这套公寓是${zh}的吗？`],
          [`Keep ${x} records for the audit.`, `请为审计保留${zh}的记录。`],
          [`The terms are ${x}, so we can still discuss price.`, `条款是${zh}的，所以价格仍可谈。`],
          [`They offered ${a} ${x} alternative.`, `他们提供了一个${zh}的替代方案。`],
        ],
        word.id,
      ),
      collocations: unique([`${a} ${x} option`, `remain ${x}`, `${x} terms`, `clearly ${x}`]).slice(0, 4),
    }
  }
  if (posClass === 'adverb') {
    return {
      examples: pickBank(
        [
          [`She finished the report ${x} before the deadline.`, `她在截止日期前${zh}完成了报告。`],
          [`We ${x} agree with the revised forecast.`, `我们${zh}同意修订后的预测。`],
          [`He spoke ${x} during the client call.`, `他在客户电话中说得${zh}。`],
          [`Please answer ${x} and keep to the facts.`, `请${zh}回答并紧扣事实。`],
        ],
        word.id,
      ),
      collocations: unique([`speak ${x}`, `work ${x}`, `answer ${x}`, `${x} correct`]).slice(0, 4),
    }
  }
  // noun / other fallback — avoid Round9 adj templates
  return {
    examples: pickBank(
      [
        [`We discussed “${x}” in today’s tutorial.`, `今天的辅导课我们讨论了「${zh}」。`],
        [`Can you explain “${x}” in one sentence?`, `你能用一句话解释「${zh}」吗？`],
        [`The article mentions “${x}” several times.`, `这篇文章多次提到「${zh}」。`],
        [`Please use “${x}” correctly in your essay.`, `请在作文里正确使用「${zh}」。`],
      ],
      word.id,
    ),
    collocations: unique([`explain “${x}”`, `use “${x}”`, `learn “${x}”`, `define “${x}”`]).slice(0, 3),
  }
}

/** Curated high-confidence sense fixes. */
const SENSE_FIXES = {
  'core-5c1b9018b1a33a': {
    // affect — verb influence (not psychology noun)
    partOfSpeech: 'verb',
    zhGloss: '影响',
    acceptedZhAnswers: ['影响', '对…产生影响'],
    enDefinition: 'to influence someone or something; to produce a change in',
    examples: [
      { en: 'The delay will affect our delivery schedule.', zh: '延误会影响我们的交货安排。' },
      { en: 'How does this policy affect students?', zh: '这项政策会如何影响学生？' },
    ],
    collocations: ['affect the result', 'negatively affect', 'directly affect'],
  },
  'core-cd42169de3fa3c': {
    partOfSpeech: 'verb',
    zhGloss: '攀登；爬',
    acceptedZhAnswers: ['攀登', '爬', '上升'],
    enDefinition: 'to go up or ascend, especially using the hands and feet or by rising steeply',
    examples: [
      { en: 'They plan to climb the hill this weekend.', zh: '他们计划这周末爬山。' },
      { en: 'Costs continue to climb this quarter.', zh: '本季度成本持续上升。' },
    ],
    collocations: ['climb the stairs', 'climb higher', 'prices climb'],
  },
  'core-f930859e309949': {
    partOfSpeech: 'verb',
    zhGloss: '放弃；遗弃',
    acceptedZhAnswers: ['放弃', '遗弃', '抛弃'],
    enDefinition: 'to leave a place, person, or thing completely; to give up an idea or activity',
    examples: [
      { en: 'Do not abandon the project halfway.', zh: '不要中途放弃这个项目。' },
      { en: 'They had to abandon the damaged vehicle.', zh: '他们不得不弃置那辆损坏的车。' },
    ],
    collocations: ['abandon the plan', 'abandon hope', 'forced to abandon'],
  },
  'core-254f76970b57b9': {
    partOfSpeech: 'adjective',
    zhGloss: '平滑的；顺利的',
    acceptedZhAnswers: ['平滑的', '顺利的', '光滑的'],
    enDefinition: 'having an even surface; happening without difficulties or problems',
    examples: [
      { en: 'Sand the wood until the surface is smooth.', zh: '把木头打磨到表面平滑。' },
      { en: 'We want a smooth transition to the new system.', zh: '我们希望顺利过渡到新系统。' },
    ],
    collocations: ['smooth surface', 'smooth transition', 'run smooth'],
  },
  'core-adcdee7c29e76d': {
    partOfSpeech: 'verb',
    zhGloss: '冻结；结冰',
    acceptedZhAnswers: ['冻结', '结冰', '冷冻'],
    enDefinition: 'to become ice or make something very cold; to stop money, assets, or activity from moving',
    examples: [
      { en: 'Water will freeze overnight.', zh: '水一夜就会结冰。' },
      { en: 'The bank may freeze the account.', zh: '银行可能会冻结该账户。' },
    ],
    collocations: ['freeze the account', 'freeze assets', 'freeze overnight'],
  },
  'core-589ceff369dc67': {
    partOfSpeech: 'adjective',
    zhGloss: '心烦的；难过的',
    acceptedZhAnswers: ['心烦的', '难过的', '沮丧的'],
    enDefinition: 'unhappy, worried, or emotionally disturbed',
    examples: [
      { en: 'She looked upset after the meeting.', zh: '会后她看起来很心烦。' },
      { en: 'Don’t be upset about one failed quiz.', zh: '别为一次测验失败难过。' },
    ],
    collocations: ['feel upset', 'look upset', 'get upset'],
  },
  'core-1594b7a4636275': {
    partOfSpeech: 'verb',
    zhGloss: '寻求；寻找',
    acceptedZhAnswers: ['寻求', '寻找', '征求'],
    enDefinition: 'to try to find, obtain, or achieve something',
    examples: [
      { en: 'Graduates often seek advice from mentors.', zh: '毕业生常向导师寻求建议。' },
      { en: 'We seek a long-term supplier.', zh: '我们在寻找长期供应商。' },
    ],
    collocations: ['seek advice', 'seek help', 'seek opportunities'],
  },
  'core-07edc5e242b2a1': {
    partOfSpeech: 'verb',
    zhGloss: '醒来；叫醒',
    acceptedZhAnswers: ['醒来', '叫醒', '唤醒'],
    enDefinition: 'to stop sleeping, or to cause someone to stop sleeping',
    examples: [
      { en: 'I usually wake at seven.', zh: '我通常七点醒来。' },
      { en: 'Please wake me before the flight.', zh: '请在航班前叫醒我。' },
    ],
    collocations: ['wake up', 'wake early', 'wake someone'],
  },
  'core-ee9f38e186ba06': {
    partOfSpeech: 'verb',
    zhGloss: '计算；数',
    acceptedZhAnswers: ['计算', '数', '清点'],
    enDefinition: 'to find the total number of things or people; to include something when calculating',
    examples: [
      { en: 'Please count the invoices before filing.', zh: '归档前请清点发票。' },
      { en: 'Every vote will count.', zh: '每一票都会算数。' },
    ],
    collocations: ['count the votes', 'count carefully', 'count as'],
  },
  'core-3647690baf7245': {
    partOfSpeech: 'verb',
    zhGloss: '投降；交出',
    acceptedZhAnswers: ['投降', '交出', '屈服'],
    enDefinition: 'to give up control, possession, or resistance to someone else',
    examples: [
      { en: 'The army refused to surrender.', zh: '军队拒绝投降。' },
      { en: 'You must surrender your passport at the desk.', zh: '你必须在柜台交出护照。' },
    ],
    collocations: ['surrender control', 'surrender the weapon', 'forced to surrender'],
  },
  'core-0737c22d3bfae8': {
    partOfSpeech: 'adjective',
    zhGloss: '完整的；完成的',
    acceptedZhAnswers: ['完整的', '完成的', '全部的'],
    enDefinition: 'having all necessary parts; finished or total',
    examples: [
      { en: 'Please submit a complete application.', zh: '请提交完整的申请。' },
      { en: 'Is the dataset complete?', zh: '这个数据集完整吗？' },
    ],
    collocations: ['complete set', 'complete list', 'almost complete'],
  },
  'core-8fdb7e2fa84f4f': {
    partOfSpeech: 'adjective',
    zhGloss: '可以的；还行的',
    acceptedZhAnswers: ['可以的', '还行的', '好的'],
    enDefinition: 'satisfactory or acceptable; all right',
    examples: [
      { en: 'Is it okay if we meet tomorrow?', zh: '我们明天见面可以吗？' },
      { en: 'The draft is okay, but needs one more edit.', zh: '草稿还行，但还需再改一版。' },
    ],
    collocations: ['be okay', 'look okay', 'okay with'],
  },
  'core-68970a95b4a63f': {
    partOfSpeech: 'adverb',
    zhGloss: '不管怎样；无论',
    acceptedZhAnswers: ['不管怎样', '无论', '不顾'],
    enDefinition: 'without being affected by something; in spite of the circumstances',
    examples: [
      { en: 'We will continue regardless of the weather.', zh: '无论天气如何我们都会继续。' },
      { en: 'Submit the form regardless.', zh: '不管怎样都请提交表格。' },
    ],
    collocations: ['regardless of', 'continue regardless', 'proceed regardless'],
  },
  'core-f793522355b5ef': {
    partOfSpeech: 'verb',
    zhGloss: '投；扔',
    acceptedZhAnswers: ['投', '扔', '抛'],
    enDefinition: 'to send something through the air with force, usually with the hand',
    examples: [
      { en: 'Don’t throw plastic into the ocean.', zh: '不要把塑料扔进海里。' },
      { en: 'She can throw the ball accurately.', zh: '她能准确地投球。' },
    ],
    collocations: ['throw away', 'throw the ball', 'throw out'],
  },
  'core-0f12541afcce17': {
    partOfSpeech: 'noun',
    zhGloss: '使用权；通道',
    acceptedZhAnswers: ['使用权', '通道', '访问权', '通路'],
    enDefinition: 'the right or opportunity to use or reach something',
    examples: [
      { en: 'Students need access to the library databases.', zh: '学生需要使用图书馆数据库的权限。' },
      { en: 'Wheelchair access is at the side entrance.', zh: '无障碍通道在侧门。' },
    ],
    collocations: ['gain access', 'access to', 'deny access'],
  },
  'core-f9659d46b223f5': {
    partOfSpeech: 'verb',
    zhGloss: '达到；实现',
    acceptedZhAnswers: ['达到', '实现', '取得'],
    enDefinition: 'to succeed in doing or getting what you wanted, usually after effort',
    examples: [
      { en: 'She worked hard to achieve her goal.', zh: '她努力实现了目标。' },
      { en: 'We hope to achieve a 10% cost cut.', zh: '我们希望实现 10% 的成本削减。' },
    ],
    collocations: ['achieve a goal', 'achieve success', 'hard to achieve'],
  },
  'core-c979f9eda7c9e7': {
    partOfSpeech: 'noun',
    zhGloss: '成就；成绩',
    acceptedZhAnswers: ['成就', '成绩', '功绩'],
    enDefinition: 'something important that you succeed in doing by effort or skill',
    examples: [
      { en: 'Graduating on time was a major achievement.', zh: '按时毕业是一项重大成就。' },
      { en: 'The award recognises academic achievement.', zh: '该奖项表彰学术成绩。' },
    ],
    collocations: ['major achievement', 'academic achievement', 'sense of achievement'],
  },
  'core-c3805175370d19': {
    partOfSpeech: 'noun',
    zhGloss: '增加；添加',
    acceptedZhAnswers: ['增加', '添加', '附加', '加法'],
    enDefinition: 'something added; the process of adding numbers or items',
    examples: [
      { en: 'The balcony is a recent addition to the flat.', zh: '阳台是公寓最近新增的部分。' },
      { en: 'In addition, please attach your CV.', zh: '另外，请附上简历。' },
    ],
    collocations: ['in addition', 'a useful addition', 'addition to'],
  },
  'core-50f8438e2eea35': {
    partOfSpeech: 'noun',
    zhGloss: '口音；重音',
    acceptedZhAnswers: ['口音', '腔调', '重音'],
    enDefinition: 'a way of pronouncing a language that shows where a person is from; also stress on a syllable',
    examples: [
      { en: 'She speaks English with a slight accent.', zh: '她说英语带一点口音。' },
      { en: 'Put the accent on the second syllable.', zh: '把重音放在第二个音节上。' },
    ],
    collocations: ['foreign accent', 'strong accent', 'accent on'],
  },
  'core-c662180230cad1': {
    partOfSpeech: 'noun',
    zhGloss: '地址；住址',
    acceptedZhAnswers: ['地址', '住址'],
    enDefinition: 'the details of where a building or person is located, used for letters or visits',
    examples: [
      { en: 'Please write your home address clearly.', zh: '请把家庭住址写清楚。' },
      { en: 'We sent the parcel to the wrong address.', zh: '我们把包裹寄错了地址。' },
    ],
    collocations: ['home address', 'email address', 'change of address'],
  },
  'core-816d63e63c53fb': {
    partOfSpeech: 'noun',
    zhGloss: '替代方案；备选',
    acceptedZhAnswers: ['替代方案', '备选', '两者择一'],
    enDefinition: 'another possibility or choice that can be used instead',
    examples: [
      { en: 'If flights are full, take the train as an alternative.', zh: '如果航班满了，可以坐火车作为替代方案。' },
      { en: 'We have no alternative but to delay.', zh: '我们别无选择，只能延期。' },
    ],
    collocations: ['an alternative', 'no alternative', 'viable alternative'],
  },
  'econ-1a95769f3608d9': {
    // override — finance noun (commission), not generic verb template
    partOfSpeech: 'noun',
    zhGloss: '追加佣金；覆盖佣金',
    acceptedZhAnswers: ['追加佣金', '覆盖佣金', 'override 佣金', '代理佣金'],
    enDefinition: 'an extra sales commission paid to a manager or agent, often on sales made by others',
    examples: [
      { en: 'Team leaders earn an override on junior sales.', zh: '团队领导可从初级销售业绩中获得追加佣金。' },
      { en: 'The contract explains how the override is calculated.', zh: '合同说明了追加佣金如何计算。' },
    ],
    collocations: ['earn an override', 'override commission', 'sales override'],
  },
  'econ-99813501bb8fbc': {
    // overburden — verb: load with too much work (business sense)
    partOfSpeech: 'verb',
    zhGloss: '使负担过重',
    acceptedZhAnswers: ['使负担过重', '使不堪重负'],
    enDefinition: 'to give someone or something too much work, weight, or responsibility',
    examples: [
      { en: 'Do not overburden new staff in the first week.', zh: '第一周不要给新员工过重负担。' },
      { en: 'The extra reporting will overburden the finance team.', zh: '额外汇报会让财务团队不堪重负。' },
    ],
    collocations: ['overburden staff', 'overburden the system', 'heavily overburden'],
  },
  'econ-1ad6211db69698': {
    // endorse — align zh with cheque/document sense + support
    partOfSpeech: 'verb',
    zhGloss: '背书；赞同',
    acceptedZhAnswers: ['背书', '赞同', '认可', '赞成'],
    enDefinition: 'to sign the back of a cheque or document; to publicly support or approve something',
    examples: [
      { en: 'Please endorse the cheque before depositing it.', zh: '存入前请在支票背面背书。' },
      { en: 'Several experts endorse the new guideline.', zh: '多位专家赞同这项新指引。' },
    ],
    collocations: ['endorse a cheque', 'endorse the plan', 'publicly endorse'],
  },
  'econ-7eb6050d0520ac': {
    partOfSpeech: 'verb',
    zhGloss: '保留；留用',
    acceptedZhAnswers: ['保留', '留用', '保持'],
    enDefinition: 'to keep or continue to have something; to continue to employ someone',
    examples: [
      { en: 'Please retain a copy for your records.', zh: '请保留一份副本存档。' },
      { en: 'The firm decided to retain the consultant.', zh: '公司决定继续留用该顾问。' },
    ],
    collocations: ['retain a copy', 'retain staff', 'retain control'],
  },
}

function applySenseFix(word, fix) {
  let changed = false
  for (const [key, value] of Object.entries(fix)) {
    if (JSON.stringify(word[key] ?? null) !== JSON.stringify(value)) {
      word[key] = value
      changed = true
    }
  }
  if (changed) {
    word.acceptedZhAnswers = unique([word.zhGloss, ...(word.acceptedZhAnswers || [])])
    word.acceptedEnVariants = unique([word.expression, ...(word.acceptedEnVariants || [])])
    word.usagePrompts = []
    word.updatedAt = TS
  }
  return changed
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))

let senseFixed = 0
const senseFixedIds = []
for (const word of pack.words) {
  const fix = SENSE_FIXES[word.id]
  if (!fix) continue
  if (applySenseFix(word, fix)) {
    senseFixed += 1
    senseFixedIds.push(word.id)
  }
}

let templateRebuilt = 0
const rebuiltIds = []
for (const word of pack.words) {
  if (SENSE_FIXES[word.id]) continue
  if (String(word.id).startsWith('v1-')) continue
  const needs = (word.examples || []).some((ex) => isRound9HostileExample(ex.en))
  if (!needs) continue
  const built = buildPosAware(word)
  word.examples = built.examples
  word.collocations = built.collocations
  word.usagePrompts = []
  word.updatedAt = TS
  templateRebuilt += 1
  rebuiltIds.push(word.id)
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const report = {
  senseFixed,
  senseFixedIds,
  templateRebuilt,
  rebuiltSample: rebuiltIds.slice(0, 25),
  words: pack.words.length,
}
writeFileSync(join(root, 'scripts/_b6_fix_report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
