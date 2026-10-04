/**
 * Round-8 quality upgrade: kill remaining "used in business and finance" floors.
 * Run: node scripts/upgradeVocabularyQualityRound8.mjs && npm run seed:pack && npm run seed:quality
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const packPath = join(root, 'data/vocabulary-packs/trusted_v5_2_vocabulary_pack.json')
if (!existsSync(packPath)) throw new Error('trusted_v5_2 pack missing')

function withArticle(expression) {
  const text = expression.trim()
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series|plus|class|business|status)$/i.test(text)) return text
  if (/^(advances|cash|collections|notes|debit)\b/i.test(text)) return text
  return /^[aeiou]/i.test(text) ? `an ${text}` : `a ${text}`
}

function isWeakDefinition(def) {
  const d = String(def || '')
  if (!d) return true
  if (/used in business and finance$/i.test(d)) return true
  if (/used in professional practice$/i.test(d)) return true
  if (/in commercial or accounting use$/i.test(d)) return true
  return false
}

const PHRASE = {
  'advances from customers': 'amounts received from customers before goods or services are delivered',
  'advance from customers': 'an amount received from a customer before delivery of goods or services',
  'advanced deposit': 'a deposit required in advance, often under an import-deposit scheme',
  "customer's deposit": 'a deposit placed by a customer with a seller or bank',
  'import deposit': 'a cash deposit required of importers before or when importing',
  'cash receipts from customers': 'cash collected from customers for sales or receivables',
  'export trade bill': 'a bill of exchange arising from an export trade transaction',
  'export bill': 'a bill of exchange used in an export transaction',
  'commercial bill': 'a bill of exchange used to finance commercial trade',
  'marginal deposit': 'a margin deposit lodged when opening a letter of credit',
  'prior import deposit': 'an import deposit that must be lodged before importation',
  "customer's container deposit": 'a deposit paid by a customer for returnable containers',
  "ratification of agents' contracts": 'approval that confirms contracts made by an agent',
  'guarantee deposit': 'a deposit lodged as security for a guarantee or obligation',
  'import trade bill': 'a bill of exchange arising from an import trade transaction',
  'petty deposit': 'a small deposit held as security',
  'assessment of offers and tenders': 'evaluation of offers and tenders to select a supplier or contractor',
  'general index of retail prices': 'an overall index measuring retail price changes',
  'manufacturing expenses of work shop': 'manufacturing expenses incurred in a workshop',
  'shipment of crude': 'a shipment of crude oil',
  'shrinkage of production capacity': 'a reduction in available production capacity',
  'fine trade bill': 'a high-quality trade bill considered low credit risk',
  'assignment of throughput contracts': 'transfer of rights under a throughput processing contract',
  'analysis of inventory costing methods': 'an analysis comparing methods of costing inventory',
  'statement to customers': 'a statement of account sent to customers',
  'debit customers': 'customers with debit balances owed to the entity',
  'advances to customers': 'amounts advanced or loaned to customers',
  'collections receivable for customers': 'amounts collected or to be collected on behalf of customers',
  'notes receivable from customers': 'promissory notes receivable from customers',
  'budgeted financial position': 'the projected financial position in a budgeted balance sheet',
  'yield gap': 'the difference between yields on government bonds and equities',
  'safe deposit': 'safe-deposit custody of valuables, typically in a bank vault',
  'foreign exchange fund bill': 'a bill or security related to a foreign-exchange fund',
  'fine bank bill': 'a bank bill of high credit quality, often bank-accepted',
  'special safe-deposit': 'a specialised safe-deposit facility or vault service',
  'bill discount deposit': 'a deposit required when discounting a bill',
  'gold deposit': 'gold deposited by an issuing bank with a foreign bank',
  'cash in deposit': 'cash held on deposit with a bank',
  'stock deposit': 'securities lodged as collateral for a facility or obligation',
}

function composeDefinition(expression) {
  const lower = expression.trim().toLocaleLowerCase('en-US')
  if (PHRASE[lower]) return PHRASE[lower]

  if (/deposit$/i.test(lower)) return `a deposit related to ${lower.replace(/\s+deposit$/, '')}`
  if (/bill$/i.test(lower)) return `a bill used in ${lower.replace(/\s+bill$/, '')} transactions`
  if (/ from customers$/i.test(lower)) return `${lower.replace(/ from customers$/, '')} arising from customer transactions`
  if (/ to customers$/i.test(lower)) return `${lower.replace(/ to customers$/, '')} provided to customers`
  if (/ of /i.test(lower)) {
    const [left, right] = lower.split(/\s+of\s+/, 2)
    return `${withArticle(left)} concerning ${right}`
  }
  return `${withArticle(expression)} in accounting and trade practice`
}

const pack = JSON.parse(readFileSync(packPath, 'utf8'))
let defs = 0

for (const word of pack.words) {
  if (String(word.id).startsWith('v1-')) continue
  if (!isWeakDefinition(word.enDefinition)) continue
  word.enDefinition = composeDefinition(word.expression)
  if (isWeakDefinition(word.enDefinition)) {
    word.enDefinition = `${withArticle(word.expression)} in accounting and trade practice`
  }
  word.updatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
  defs += 1
}

pack.exportedAt = new Date().toISOString().replace(/\.\d{3}Z$/, '.000Z')
writeFileSync(packPath, `${JSON.stringify(pack)}\n`)

const left = pack.words.filter((w) => !w.id.startsWith('v1-') && isWeakDefinition(w.enDefinition))
mkdirSync(join(root, 'data/vocabulary-packs/_export'), { recursive: true })
writeFileSync(
  join(root, 'data/vocabulary-packs/_export/v52-quality-round8-report.json'),
  `${JSON.stringify({ defs, stillWeak: left.length, sample: left.slice(0, 15).map((w) => ({ e: w.expression, d: w.enDefinition })) }, null, 2)}\n`,
)
console.log(JSON.stringify({ defs, stillWeak: left.length }, null, 2))
