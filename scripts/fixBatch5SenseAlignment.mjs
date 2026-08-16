/**
 * Batch 5 — sense alignment, duplicate-sense merge, leftover drill-example cleanup.
 *
 * - Merge identical duplicate expressions (keep stable canonical ids)
 * - Curate clear Core sense mismatches (zh ↔ definition ↔ POS)
 * - Rebuild remaining drill/template examples on any POS
 *
 * Run: node scripts/fixBatch5SenseAlignment.mjs && npm run seed:pack && npm run seed:quality
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

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function isDrillExample(en) {
  return /Pair the .+ with a collocation|weekly drill recycles the |Before the quiz, revise the |Our notes group the |workbook asks you to translate the |Write one sentence that uses the |tutor marked a misuse of the |case study hinges on understanding the |listening clip mentions the |spaced-repetition deck|Explain the .+ without reading the gloss|I added the .+ to my spaced-repetition/i.test(
    String(en || ''),
  )
}

function isGenericCol(col, expression) {
  const c = String(col || '')
  const x = escapeRe(expression)
  return new RegExp(
    `^(ask about|keep|share|check|use|review|note|look up|double-check|price|hedge|value|fund) (the |“|")?${x}`,
    'i',
  ).test(c)
}

/** Keep left id; drop right id. */
const MERGE_DROP = [
  // expression, keepId, dropId
  ['general accounting', 'econ-3d1bd2a93c7713', 'econ-206f7025fed625'],
  ['loan capital', 'econ-873ab6e6d64366', 'econ-3311b09154eb63'],
  ['explicit costs', 'econ-841b3cb61b79d5', 'econ-ee4c3a37c5d1c5'],
]

/** Curated sense fixes: align zhGloss / definition / POS / examples. */
const SENSE_FIXES = {
  'core-89b8d783289b98': {
    // whose
    enDefinition: 'the possessive form of who; belonging to which person',
    zhGloss: '谁的',
    acceptedZhAnswers: ['谁的'],
    examples: [
      { en: 'Whose laptop is this?', zh: '这是谁的笔记本电脑？' },
      { en: 'The student whose essay won will present tomorrow.', zh: '作文获奖的那位学生明天将上台。' },
    ],
    collocations: ['whose turn', 'whose idea', 'the team whose'],
  },
  'core-03558a3d33559f': {
    // herself
    enDefinition: 'the reflexive or emphatic form of she/her',
    examples: [
      { en: 'She completed the form herself.', zh: '她自己填完了表格。' },
      { en: 'She blamed herself for the delay.', zh: '她把延误归咎于自己。' },
    ],
    collocations: ['by herself', 'ask herself', 'help herself'],
  },
  'core-f90409b98ffb61': {
    // officer — align to organisational officer (campus/business), keep 军官 as secondary answer only if needed
    zhGloss: '官员；干事',
    acceptedZhAnswers: ['官员', '干事', '军官'],
    enDefinition: 'a person who holds a position of authority in an organisation, government, or the armed forces',
    examples: [
      { en: 'Please speak to the admissions officer.', zh: '请找招生干事谈谈。' },
      { en: 'A customs officer checked our documents.', zh: '海关官员检查了我们的文件。' },
    ],
    collocations: ['customs officer', 'admissions officer', 'senior officer'],
  },
  'core-ce0b1612aa711b': {
    // single adjective — unmarried / only one (not baseball)
    zhGloss: '单身的；单一的',
    acceptedZhAnswers: ['单身的', '单一的', '单个的'],
    enDefinition: 'only one; not married or not in a romantic relationship',
    partOfSpeech: 'adjective',
    examples: [
      { en: 'She is still single and focusing on her studies.', zh: '她仍是单身，专注于学业。' },
      { en: 'Please submit a single copy of the form.', zh: '请提交一份表格即可。' },
    ],
    collocations: ['remain single', 'a single copy', 'single room'],
  },
  'core-f49f577d627d39': {
    // chance — opportunity
    zhGloss: '机会',
    acceptedZhAnswers: ['机会', '可能性'],
    enDefinition: 'an opportunity to do something; a possibility that something will happen',
    examples: [
      { en: 'This internship is a great chance to learn.', zh: '这次实习是很好的学习机会。' },
      { en: 'There is a good chance of rain this evening.', zh: '今晚很可能下雨。' },
    ],
    collocations: ['a chance to', 'take a chance', 'by chance'],
  },
  'core-fcb60bc535f449': {
    // operation
    zhGloss: '操作；运营；手术',
    acceptedZhAnswers: ['操作', '运营', '手术'],
    enDefinition: 'the way a machine, system, or organisation works; also a surgical procedure',
    examples: [
      { en: 'The new system is now in operation.', zh: '新系统现已投入运行。' },
      { en: 'Day-to-day operation of the shop is simple.', zh: '商店的日常运营很简单。' },
    ],
    collocations: ['in operation', 'business operation', 'surgical operation'],
  },
  'core-baf0bf92eb7915': {
    // plant — living plant (matches zh 植物); industrial sense would need another Word
    zhGloss: '植物',
    acceptedZhAnswers: ['植物'],
    enDefinition: 'a living organism such as a tree, flower, or grass that typically grows in soil',
    examples: [
      { en: 'She watered the plants on the balcony.', zh: '她给阳台上的植物浇了水。' },
      { en: 'This plant needs more sunlight.', zh: '这种植物需要更多阳光。' },
    ],
    collocations: ['water the plants', 'house plant', 'plant leaves'],
  },
  'core-23f43ae94d2546': {
    // campaign — keep general organised effort (zh 战役 is narrow); broaden zh
    zhGloss: '战役；运动；活动',
    acceptedZhAnswers: ['战役', '运动', '宣传活动'],
    enDefinition: 'a planned series of actions intended to achieve a particular goal, in war, politics, or marketing',
    examples: [
      { en: 'The charity launched a fundraising campaign.', zh: '慈善机构发起了筹款活动。' },
      { en: 'The advertising campaign increased sales.', zh: '广告宣传活动提升了销售额。' },
    ],
    collocations: ['marketing campaign', 'election campaign', 'launch a campaign'],
  },
  'core-79d41a47e8fec5': {
    // colour
    zhGloss: '颜色',
    acceptedZhAnswers: ['颜色', '色彩'],
    enDefinition: 'the property of an object that is perceived as red, blue, green, etc.; also UK spelling of color',
    examples: [
      { en: 'What colour is your new notebook?', zh: '你的新笔记本是什么颜色？' },
      { en: 'Please print the chart in colour.', zh: '请彩色打印该图表。' },
    ],
    collocations: ['favourite colour', 'in colour', 'change colour'],
    acceptedEnVariants: ['colour', 'color'],
  },
  'core-405ab5d2b930fe': {
    // current — electricity / flow (zh 涌流 is odd); use 电流 as primary for this def
    zhGloss: '电流；水流',
    acceptedZhAnswers: ['电流', '水流', '潮流'],
    enDefinition: 'a flow of electricity, water, or air; also the present period of time when used as an adjective in other senses',
    examples: [
      { en: 'A strong current makes swimming dangerous.', zh: '湍急的水流使游泳很危险。' },
      { en: 'Check the electric current before repairing the device.', zh: '维修设备前请检查电流。' },
    ],
    collocations: ['electric current', 'strong current', 'current flow'],
  },
  'core-5ea9c348e59fe7': {
    // charge — accusation matches zh 指控; also common fee sense as secondary answer
    zhGloss: '指控；费用',
    acceptedZhAnswers: ['指控', '控告', '费用'],
    enDefinition: 'a formal accusation that someone has committed an offence; also an amount of money asked for a service',
    examples: [
      { en: 'He denied the charge of fraud.', zh: '他否认欺诈指控。' },
      { en: 'Is there an extra charge for delivery?', zh: '送货另外收费吗？' },
    ],
    collocations: ['face a charge', 'deny the charge', 'service charge'],
  },
  'core-3b4c0c6565e036': {
    // pressure
    zhGloss: '压力',
    acceptedZhAnswers: ['压力', '压强'],
    enDefinition: 'physical force against a surface; also stress caused by demands or difficulties',
    examples: [
      { en: 'Students feel pressure before final exams.', zh: '期末考前学生感到压力。' },
      { en: 'Tyre pressure should be checked monthly.', zh: '应每月检查轮胎气压。' },
    ],
    collocations: ['under pressure', 'peer pressure', 'blood pressure'],
  },
  'econ-e066133fdba5e5': {
    // ex — finance adverb/prefix
    partOfSpeech: 'adverb',
    zhGloss: '除权；不含（红利等）',
    acceptedZhAnswers: ['除权', '不含红利', '除息'],
    enDefinition: 'used before a benefit word to mean “without” that benefit (for example ex dividend, ex rights)',
    examples: [
      { en: 'The shares are trading ex dividend from tomorrow.', zh: '该股从明天起除息交易。' },
      { en: 'Buyers of ex-rights shares do not receive the new issue.', zh: '买入除权股份的人拿不到新股。' },
    ],
    collocations: ['ex dividend', 'ex rights', 'trade ex dividend'],
    acceptedEnVariants: ['ex', 'ex-'],
  },
}

function nounExamples(expression, zh, id) {
  const x = expression
  const i = hashId(id)
  const bank = [
    [
      `We discussed “${x}” in today’s tutorial.`,
      `今天的辅导课我们讨论了「${zh}」。`,
    ],
    [
      `Can you explain “${x}” in one sentence?`,
      `你能用一句话解释「${zh}」吗？`,
    ],
    [
      `The article mentions “${x}” several times.`,
      `这篇文章多次提到「${zh}」。`,
    ],
    [
      `I looked up “${x}” before the quiz.`,
      `小测前我查阅了「${zh}」。`,
    ],
    [
      `Please use “${x}” correctly in your essay.`,
      `请在作文里正确使用「${zh}」。`,
    ],
  ]
  const a = bank[i % bank.length]
  const b = bank[(i + 2) % bank.length]
  return [
    { en: a[0], zh: a[1] },
    { en: b[0], zh: b[1] },
  ]
}

function nounCols(expression) {
  return unique([`explain “${expression}”`, `use “${expression}”`, `learn “${expression}”`]).slice(0, 3)
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
    if (Array.isArray(word.acceptedZhAnswers)) {
      word.acceptedZhAnswers = unique([word.zhGloss, ...word.acceptedZhAnswers])
    }
    if (Array.isArray(word.acceptedEnVariants)) {
      word.acceptedEnVariants = unique([word.expression, ...word.acceptedEnVariants])
    }
    word.usagePrompts = []
    word.updatedAt = TS
  }
  return changed
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))

// --- merge duplicates ---
const dropIds = new Set(MERGE_DROP.map((row) => row[2]))
const keepByDrop = new Map(MERGE_DROP.map((row) => [row[2], row[1]]))
const beforeWords = pack.words.length
pack.words = pack.words.filter((w) => !dropIds.has(w.id))

const membershipsBefore = pack.memberships.length
const seenMembership = new Set()
const nextMemberships = []
for (const item of pack.memberships) {
  let wordId = item.wordId
  if (dropIds.has(wordId)) wordId = keepByDrop.get(wordId)
  if (!wordId) continue
  if (!pack.words.some((w) => w.id === wordId)) continue
  const key = `${wordId}\u0000${item.listId}`
  if (seenMembership.has(key)) continue
  seenMembership.add(key)
  nextMemberships.push({
    ...item,
    id: item.id.includes(item.wordId) ? item.id.replace(item.wordId, wordId) : `membership-${wordId}-${item.listId}`,
    wordId,
  })
}
pack.memberships = nextMemberships

// --- curated sense fixes ---
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

// --- rebuild leftover drill examples only (never touch v1; never rebuild on cols alone) ---
let exampleRebuilt = 0
const exampleIds = []
for (const word of pack.words) {
  if (SENSE_FIXES[word.id]) continue
  if (String(word.id).startsWith('v1-')) continue
  const needsEx = (word.examples || []).some((ex) => isDrillExample(ex.en))
  if (!needsEx) continue

  word.examples = nounExamples(word.expression, word.zhGloss || word.expression, word.id)
  const genericCols = (word.collocations || []).filter((c) => isGenericCol(c, word.expression))
  if (genericCols.length >= 2 || (word.collocations || []).length < 2) {
    word.collocations = nounCols(word.expression)
  }
  word.usagePrompts = []
  word.updatedAt = TS
  exampleRebuilt += 1
  exampleIds.push(word.id)
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

// Compatibility map for any future importers / docs
const compat = {
  version: 1,
  kind: 'vocabulary-id-merge-map',
  exportedAt: TS,
  merges: MERGE_DROP.map(([expression, keepId, dropId]) => ({
    expression,
    keepId,
    dropId,
    reason: 'identical-sense-duplicate',
  })),
}
writeFileSync(
  join(root, 'data/vocabulary-packs/v53_id_merge_map.json'),
  `${JSON.stringify(compat, null, 2)}\n`,
)

const report = {
  wordsBefore: beforeWords,
  wordsAfter: pack.words.length,
  droppedIds: [...dropIds],
  membershipsBefore,
  membershipsAfter: pack.memberships.length,
  senseFixed,
  senseFixedIds,
  exampleRebuilt,
  exampleSample: exampleIds.slice(0, 20),
}
writeFileSync(join(root, 'scripts/_b5_fix_report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
