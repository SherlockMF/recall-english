import { readFileSync } from 'node:fs'

const pack = JSON.parse(readFileSync('data/vocabulary-packs/all_batches_combined_vocabulary_pack.json', 'utf8'))

const issues = []

for (const w of pack.words) {
  const e = w.expression
  const zh = w.zhGloss || ''
  const en = w.enDefinition || ''

  if (/customary's/i.test(e)) {
    issues.push({ severity: 'error', type: 'typo_expression', e, zh, en, note: "likely customer's" })
  }
  if (/devidend/i.test(e)) {
    issues.push({ severity: 'error', type: 'typo_expression', e, zh, en, note: 'dividend misspelled' })
  }
  if (/in active$/i.test(e)) {
    issues.push({ severity: 'error', type: 'truncated_expression', e, zh, en, note: "likely 'in active use'" })
  }
  if (/^depreciation cause$/i.test(e)) {
    issues.push({
      severity: 'error',
      type: 'headword_mismatch',
      e,
      zh,
      en,
      note: 'English headword does not match Chinese method name',
    })
  }
  if (/^rape$/i.test(e)) {
    issues.push({
      severity: 'content',
      type: 'wrong_primary_or_unsuitable',
      e,
      zh,
      en: en.slice(0, 120),
      note: 'plant sense first; crime sense in zh — unsuitable for this product',
    })
  }
  if (/^chop$/i.test(e) && /wave|tide/i.test(en)) {
    issues.push({
      severity: 'warn',
      type: 'primary_sense_mismatch',
      e,
      zh,
      en: en.slice(0, 120),
      note: 'EN primary sense is wave motion; ZH is meat/cut',
    })
  }
  if (e.toLowerCase() === 'depreciation' && zh.includes('贬值') && !zh.includes('折旧')) {
    issues.push({
      severity: 'warn',
      type: 'domain_sense',
      e,
      zh,
      en,
      note: 'pack gloss is FX/value decline; accounting seed uses 折旧 (handcrafted wins on overlap)',
    })
  }
  // Chinese says 溢价 but expression is generic amortization without premium
  if (/^bond amortization$/i.test(e) && zh.includes('溢价') && !/premium/i.test(e)) {
    issues.push({
      severity: 'warn',
      type: 'narrow_zh_vs_broad_en',
      e,
      zh,
      en,
      note: 'ZH specifies premium amortization; EN headword is broader',
    })
  }
}

// Count placeholder defs in dictionary source
const placeholderN = pack.words.filter((w) =>
  /^(Business|Accounting|Finance|Daily) sense of/i.test(w.enDefinition || ''),
).length

console.log(JSON.stringify({
  confirmedIssues: issues,
  placeholderDefinitionCount: placeholderN,
  packWords: pack.words.length,
}, null, 2))
