/**
 * Batch 7 — rebuild weak/garbled professional defs + curated Core/Econ sense fixes.
 *
 * Run: node scripts/fixBatch7SenseAlignment.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  composeProfessionalDefinition,
  isWeakComposedDefinition,
} from '../lib/professionalGloss.mjs'

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
    word.acceptedZhAnswers = unique([word.zhGloss, ...(word.acceptedZhAnswers || [])])
    word.acceptedEnVariants = unique([word.expression, ...(word.acceptedEnVariants || [])])
    word.usagePrompts = []
    word.updatedAt = TS
  }
  return changed
}

const SENSE_FIXES = {
  'econ-cd357c16c63f61': {
    // mandatory — required, not “mandatee”
    partOfSpeech: 'adjective',
    zhGloss: '强制的；必须的',
    acceptedZhAnswers: ['强制的', '必须的', '强制性的'],
    enDefinition: 'required by law, rule, or authority; compulsory',
    examples: [
      { en: 'Safety training is mandatory for all staff.', zh: '安全培训对全体员工是强制的。' },
      { en: 'A mandatory deposit must be paid today.', zh: '必须在今天支付强制押金。' },
    ],
    collocations: ['mandatory requirement', 'mandatory training', 'make mandatory'],
  },
  'econ-f76f0792db4d08': {
    partOfSpeech: 'adjective',
    zhGloss: '连续的；接连的',
    acceptedZhAnswers: ['连续的', '接连的', '相继的'],
    enDefinition: 'following one after another without interruption',
    examples: [
      { en: 'The firm reported successive quarterly losses.', zh: '该公司连续几个季度亏损。' },
      { en: 'Three successive audits raised the same issue.', zh: '连续三次审计提出了同一问题。' },
    ],
    collocations: ['successive years', 'successive quarters', 'on successive days'],
  },
  'econ-332aaf8204c13d': {
    partOfSpeech: 'adjective',
    zhGloss: '机密的；保密的',
    acceptedZhAnswers: ['机密的', '保密的', '秘密的'],
    enDefinition: 'meant to be kept secret or private; not for public disclosure',
    examples: [
      { en: 'Please keep this report confidential.', zh: '请对这份报告保密。' },
      { en: 'Only managers may open confidential files.', zh: '只有经理可以打开机密文件。' },
    ],
    collocations: ['confidential information', 'keep confidential', 'strictly confidential'],
  },
  'econ-752bb3ff18055f': {
    partOfSpeech: 'adjective',
    zhGloss: '不安全的',
    acceptedZhAnswers: ['不安全的', '危险的'],
    enDefinition: 'not safe; involving risk of harm, loss, or failure',
    examples: [
      { en: 'The warehouse staircase is unsafe.', zh: '仓库楼梯不安全。' },
      { en: 'Sharing passwords is an unsafe practice.', zh: '共享密码是不安全的做法。' },
    ],
    collocations: ['unsafe conditions', 'unsafe practice', 'declare unsafe'],
  },
  'econ-0679624a366f1f': {
    partOfSpeech: 'adjective',
    zhGloss: '初步的；未完成的',
    acceptedZhAnswers: ['初步的', '未完成的', '不完整的'],
    enDefinition: 'only partly formed or developed; not yet complete',
    examples: [
      { en: 'The proposal is still inchoate.', zh: '该提案仍不成熟。' },
      { en: 'Inchoate rights may become enforceable later.', zh: '初步权利日后可能变得可强制执行。' },
    ],
    collocations: ['inchoate right', 'inchoate idea', 'still inchoate'],
  },
  'core-883bac1f7b9dc9': {
    // affair — align to event/matter (zh 事件), not only sexual sense
    partOfSpeech: 'noun',
    zhGloss: '事件；事务',
    acceptedZhAnswers: ['事件', '事务', '事情'],
    enDefinition: 'an event or set of related events; a matter of public or private concern',
    examples: [
      { en: 'The press covered the whole affair.', zh: '媒体报道了整起事件。' },
      { en: 'Foreign affairs dominate the agenda.', zh: '外交事务主导了议程。' },
    ],
    collocations: ['public affair', 'foreign affairs', 'state of affairs'],
  },
  'core-80ff69d5f5b55c': {
    // annual — publication sense matching zh 年刊 (not botany)
    partOfSpeech: 'noun',
    zhGloss: '年刊；年鉴',
    acceptedZhAnswers: ['年刊', '年鉴', '年报'],
    enDefinition: 'a book or magazine published once a year; also an annual report in business contexts',
    examples: [
      { en: 'The university published its alumni annual.', zh: '大学出版了校友年刊。' },
      { en: 'I bought this year’s photography annual.', zh: '我买了今年的摄影年刊。' },
    ],
    collocations: ['college annual', 'photography annual', 'latest annual'],
  },
  'core-61a7508ed1b04e': {
    partOfSpeech: 'adjective',
    zhGloss: '基本的；基础的',
    acceptedZhAnswers: ['基本的', '基础的'],
    enDefinition: 'forming an essential foundation; fundamental or simple',
    examples: [
      { en: 'Please learn the basic rules first.', zh: '请先学习基本规则。' },
      { en: 'Housing is a basic need.', zh: '住房是基本需求。' },
    ],
    collocations: ['basic rules', 'basic need', 'basic skills'],
  },
  'core-f64cd8e32f5ac7': {
    partOfSpeech: 'noun',
    zhGloss: '作者；作家',
    acceptedZhAnswers: ['作者', '作家'],
    enDefinition: 'a person who writes books, articles, or other texts',
    examples: [
      { en: 'The author signed copies after the talk.', zh: '作者在讲座后为书签名。' },
      { en: 'Who is the author of this report?', zh: '这份报告的作者是谁？' },
    ],
    collocations: ['best-selling author', 'the author of', 'unknown author'],
  },
  'econ-74eb8e8170ea27': {
    examples: [
      { en: "She set up a banker's order to pay the rent monthly.", zh: '她设置了银行定期付款指示按月付房租。' },
      { en: "Cancel the banker's order if you change landlords.", zh: '如果换房东，请取消该银行委托书。' },
    ],
  },
  'econ-4eec27346d74fa': {
    examples: [
      { en: "The bank renewed its banker's blanket bond annually.", zh: '银行每年续保银行综合保单。' },
      { en: "A banker's blanket bond is insurance, not a debt security.", zh: '银行综合保单是保险，不是债务证券。' },
    ],
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

let defsRebuilt = 0
const rebuiltSample = []
for (const word of pack.words) {
  if (SENSE_FIXES[word.id]?.enDefinition) continue
  if (String(word.id).startsWith('v1-')) continue
  if (!isWeakComposedDefinition(word.enDefinition)) continue
  const next = composeProfessionalDefinition({
    expression: word.expression,
    partOfSpeech: word.partOfSpeech,
    zhGloss: word.zhGloss,
    listSlug: word.id.startsWith('econ-') ? 'professional' : 'daily',
  })
  if (next && next !== word.enDefinition) {
    word.enDefinition = next
    word.updatedAt = TS
    defsRebuilt += 1
    if (rebuiltSample.length < 25) {
      rebuiltSample.push({ id: word.id, expression: word.expression, def: next })
    }
  }
}

pack.exportedAt = TS
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const report = { senseFixed, senseFixedIds, defsRebuilt, rebuiltSample, words: pack.words.length }
writeFileSync(join(root, 'scripts/_b7_fix_report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
