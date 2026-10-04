/**
 * Batch 8 wrap-up — temporal policy polish + curated Core/Econ sense fixes.
 * Run: node scripts/fixBatch8WrapUp.mjs && npm run seed:pack && npm run seed:quality
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

function applySenseFix(word, fix) {
  let changed = false
  for (const [key, value] of Object.entries(fix)) {
    if (JSON.stringify(word[key] ?? null) !== JSON.stringify(value)) {
      word[key] = value
      changed = true
    }
  }
  if (changed) {
    if (fix.zhGloss || fix.acceptedZhAnswers) {
      word.acceptedZhAnswers = unique([word.zhGloss, ...(word.acceptedZhAnswers || [])])
    }
    if (fix.acceptedEnVariants || fix.expression) {
      word.acceptedEnVariants = unique([word.expression, ...(word.acceptedEnVariants || [])])
    }
    word.usagePrompts = []
    word.updatedAt = TS
  }
  return changed
}

/**
 * Temporal policy: keep historical headwords learners still meet in texts;
 * definition + zh must mark historical and name the successor where known.
 */
const SENSE_FIXES = {
  'econ-495421c0113fea': {
    zhGloss: '国民会计师协会（历史名称）',
    acceptedZhAnswers: ['国民会计师协会（历史名称）', '国民会计师协会', 'NAA'],
    enDefinition:
      'historical name (to 1991) of the U.S. professional body now known as the Institute of Management Accountants (IMA)',
    examples: [
      { en: 'Older texts may still say National Association of Accountants instead of IMA.', zh: '较旧文献仍可能写 National Association of Accountants，而不是 IMA。' },
      { en: 'The NAA was renamed and is now the IMA.', zh: 'NAA 已更名，现为 IMA。' },
    ],
    collocations: ['former NAA', 'NAA members', 'renamed IMA'],
  },
  'econ-87c704c9cfeba5': {
    zhGloss: '海外私人投资公司（历史机构）',
    acceptedZhAnswers: ['海外私人投资公司（历史机构）', '海外私人投资公司', 'OPIC'],
    enDefinition:
      'historical U.S. agency (OPIC) that supported private investment abroad; succeeded by the U.S. International Development Finance Corporation (DFC) from 2019',
    examples: [
      { en: 'OPIC political-risk cover is now discussed under the DFC.', zh: 'OPIC 的政治风险保险现多在 DFC 框架下讨论。' },
      { en: 'The Overseas Private Investment Corporation was succeeded by the DFC.', zh: '海外私人投资公司已由 DFC 接替。' },
    ],
    collocations: ['OPIC insurance', 'succeeded by DFC', 'former OPIC'],
  },
  'econ-981ba82bc6b197': {
    zhGloss: '联邦住房贷款银行委员会（历史机构）',
    acceptedZhAnswers: ['联邦住房贷款银行委员会（历史机构）', '联邦住房贷款银行委员会', 'FHLBB'],
    enDefinition:
      'historical U.S. regulator of federal home loan banks and thrifts; abolished in 1989 under FIRREA',
    examples: [
      { en: 'The Federal Home Loan Bank Board was abolished in 1989.', zh: '联邦住房贷款银行委员会于 1989 年被废止。' },
      { en: 'Histories of the thrift crisis often mention the FHLBB.', zh: '储贷危机史常提到 FHLBB。' },
    ],
    collocations: ['former FHLBB', 'abolished FHLBB', 'FHLBB era'],
  },
  'econ-20ec77253a5975': {
    zhGloss: '新加坡银行同业拆息率（历史基准）',
    acceptedZhAnswers: ['新加坡银行同业拆息率（历史基准）', '新加坡银行同业拆息率', 'SIBOR'],
    enDefinition:
      'historical Singapore dollar interbank offered rate (SIBOR); last published 31 Dec 2024 and discontinued from 1 Jan 2025, with SGD markets transitioning to SORA',
    examples: [
      { en: 'New contracts should use SORA instead of SIBOR.', zh: '新合同应使用 SORA，而不是 SIBOR。' },
      { en: 'Legacy loans may still reference the Singapore Inter-bank Offering Rate.', zh: '存量贷款仍可能引用新加坡银行同业拆息率。' },
    ],
    collocations: ['SIBOR fixings', 'replace SIBOR', 'transition to SORA'],
  },
  // More high-confidence Core sense polish
  'core-289414acf77084': {
    // adolescent — zh 青春期的 is adj; ensure POS/def match
    partOfSpeech: 'adjective',
    zhGloss: '青春期的；青少年的',
    acceptedZhAnswers: ['青春期的', '青少年的'],
    enDefinition: 'in the stage between childhood and adulthood; typical of teenagers',
    examples: [
      { en: 'Adolescent learners need clear feedback.', zh: '青春期的学习者需要清晰反馈。' },
      { en: 'The clinic treats adolescent patients.', zh: '该诊所接诊青少年患者。' },
    ],
    collocations: ['adolescent learners', 'adolescent health', 'adolescent years'],
  },
  'core-6ef7c4c1946020': {
    // advance — zh 前进 vs money advance; lock verb/noun carefully — use noun money/progress dual with clear def
    partOfSpeech: 'noun',
    zhGloss: '进展；预付款',
    acceptedZhAnswers: ['进展', '预付款', '前进'],
    enDefinition: 'forward movement or progress; also money paid before it is due',
    examples: [
      { en: 'We have made little advance on the plan.', zh: '我们在计划上几乎没有进展。' },
      { en: 'The supplier asked for an advance of 20%.', zh: '供应商要求预付 20%。' },
    ],
    collocations: ['make an advance', 'cash advance', 'in advance'],
  },
  'core-8f1dba76b56168': {
    // alert — adj 警觉的
    partOfSpeech: 'adjective',
    zhGloss: '警觉的；留心的',
    acceptedZhAnswers: ['警觉的', '留心的', '警惕的'],
    enDefinition: 'quick to notice and respond to something; watchful',
    examples: [
      { en: 'Stay alert during night driving.', zh: '夜间驾驶时保持警觉。' },
      { en: 'Security staff must remain alert.', zh: '安保人员必须保持警惕。' },
    ],
    collocations: ['stay alert', 'remain alert', 'alert to'],
  },
  'core-9c92ad25076f83': {
    partOfSpeech: 'adjective',
    zhGloss: '古代的；古老的',
    acceptedZhAnswers: ['古代的', '古老的'],
    enDefinition: 'belonging to the very distant past; very old',
    examples: [
      { en: 'We visited an ancient temple.', zh: '我们参观了一座古庙。' },
      { en: 'The manuscript is ancient and fragile.', zh: '这份手稿很古老且易损。' },
    ],
    collocations: ['ancient history', 'ancient city', 'ancient times'],
  },
  'core-16ca7689b5f953': {
    partOfSpeech: 'adjective',
    zhGloss: '缺席的；不在的',
    acceptedZhAnswers: ['缺席的', '不在的', '缺勤的'],
    enDefinition: 'not present in a place or at an event',
    examples: [
      { en: 'Three students were absent today.', zh: '今天有三名学生缺席。' },
      { en: 'She has been absent from work all week.', zh: '她整周都没来上班。' },
    ],
    collocations: ['absent from', 'absent today', 'mark absent'],
  },
  'core-da4dbfbc4fdc56': {
    partOfSpeech: 'adjective',
    zhGloss: '绝对的；完全的',
    acceptedZhAnswers: ['绝对的', '完全的'],
    enDefinition: 'total and complete; not limited or relative',
    examples: [
      { en: 'We need absolute accuracy in the accounts.', zh: '账目需要绝对准确。' },
      { en: 'There is no absolute rule here.', zh: '这里没有绝对的规则。' },
    ],
    collocations: ['absolute certainty', 'absolute rule', 'absolute value'],
  },
  'core-ec3ec33367ae71': {
    partOfSpeech: 'adjective',
    zhGloss: '抽象的',
    acceptedZhAnswers: ['抽象的'],
    enDefinition: 'existing as an idea rather than as a physical object; not concrete',
    examples: [
      { en: 'Freedom is an abstract concept.', zh: '自由是一个抽象概念。' },
      { en: 'Keep the summary less abstract.', zh: '请让摘要少一些抽象。' },
    ],
    collocations: ['abstract concept', 'abstract idea', 'too abstract'],
  },
  'core-39ca1c87e425d1': {
    partOfSpeech: 'noun',
    zhGloss: '滥用；虐待',
    acceptedZhAnswers: ['滥用', '虐待', '辱骂'],
    enDefinition: 'cruel or violent treatment; also the wrongful use of something',
    examples: [
      { en: 'The report investigates child abuse.', zh: '该报告调查虐待儿童问题。' },
      { en: 'Drug abuse remains a public-health issue.', zh: '药物滥用仍是公共卫生问题。' },
    ],
    collocations: ['drug abuse', 'abuse of power', 'report abuse'],
  },
  'core-e36a73f9a49a47': {
    partOfSpeech: 'adjective',
    zhGloss: '意外的；偶然的',
    acceptedZhAnswers: ['意外的', '偶然的'],
    enDefinition: 'happening by chance; not planned or intended',
    examples: [
      { en: 'The damage was accidental.', zh: '损坏是意外造成的。' },
      { en: 'We met in an accidental encounter.', zh: '我们偶然相遇。' },
    ],
    collocations: ['accidental damage', 'accidental meeting', 'purely accidental'],
  },
  'core-657d3c7714fb8d': {
    partOfSpeech: 'verb',
    zhGloss: '获得；习得',
    acceptedZhAnswers: ['获得', '取得', '习得'],
    enDefinition: 'to get or gain something, especially by your own effort or over time',
    examples: [
      { en: 'She acquired fluency after a year abroad.', zh: '她出国一年后获得了流利口语。' },
      { en: 'The firm acquired a smaller rival.', zh: '该公司收购了一家较小的竞争对手。' },
    ],
    collocations: ['acquire skills', 'acquire a company', 'newly acquired'],
  },
  'core-a04111d77adeb4': {
    partOfSpeech: 'verb',
    zhGloss: '刻画；具有…特征',
    acceptedZhAnswers: ['刻画', '描绘特征', '以…为特征'],
    enDefinition: 'to describe the distinctive nature of; to be typical of',
    examples: [
      { en: 'Honesty characterizes her leadership.', zh: '诚实是她领导风格的特征。' },
      { en: 'Can you characterize the main risk?', zh: '你能概括主要风险的特征吗？' },
    ],
    collocations: ['characterize as', 'characterize the market', 'best characterize'],
  },
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

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)
console.log(JSON.stringify({ senseFixed, senseFixedIds, words: pack.words.length }, null, 2))
