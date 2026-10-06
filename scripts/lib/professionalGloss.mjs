/**
 * Shared professional gloss composer for Finance/Accounting/Business phrases.
 * Avoids naive head-noun templates such as "market in which X is bought".
 */
export function normalizeExpr(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ')
}

export function articleFor(expression) {
  const text = String(expression || '').trim()
  if (!text) return 'a'
  if (/s$/i.test(text) && !/(ss|us|is|ysis|osis|series|class|business|status)$/i.test(text)) return ''
  return /^[aeiou]/i.test(text) ? 'an' : 'a'
}

export function withArticle(expression) {
  const art = articleFor(expression)
  return art ? `${art} ${expression}` : expression
}

/** Exact multi-word overrides (never split). */
export const PHRASE_GLOSS = {
  'bull market': 'a market in which prices are generally rising and investor confidence is high',
  'bear market': 'a market in which prices are generally falling and investor confidence is low',
  'spot market': 'a market for immediate delivery and payment rather than future settlement',
  'forward market': 'a market in which forward contracts are agreed for future delivery at a price set today, typically OTC',
  'forward exchange market': 'the market for forward foreign-exchange contracts that lock in an exchange rate for a future date',
  'futures market': 'an exchange market for standardised futures contracts',
  'money market': 'the market for short-term, highly liquid debt instruments',
  'capital market': 'the market for long-term equity and debt financing',
  'primary market': 'the market in which new securities are issued and sold for the first time',
  'secondary market': 'the market in which previously issued securities are traded among investors',
  'blue-sky market': 'informal label for a speculative or loosely regulated securities market (historical U.S. “blue-sky” context)',
  'black market': 'an illegal market where goods or currency are traded outside official channels',
  'open market': 'a market open to free trading without restrictive barriers',
  'cost accounting': 'accounting that records, classifies, and analyses the costs of products or activities',
  'general accounting': 'routine financial accounting that records transactions and prepares general-purpose statements',
  'financial accounting': 'accounting focused on preparing general-purpose financial statements for external users',
  'management accounting': 'accounting that provides information for internal planning, control, and decision-making',
  'contribution margin': 'sales revenue minus variable costs; the amount available to cover fixed costs and profit',
  'contribution margin ratio': 'contribution margin divided by sales',
  'gross margin': 'sales revenue minus cost of goods sold, often expressed as a percentage of sales',
  'profit margin': 'profit expressed as a percentage of sales or another base',
  'initial margin': 'collateral required to open a futures or leveraged position',
  'original margin': 'initial margin deposit required when a position is opened',
  'variation margin': 'additional margin paid or received as a position is marked to market',
  'hard currency': 'a stable, widely accepted, readily convertible currency used in international trade',
  'soft currency': 'a currency that is less stable or less readily convertible in international markets',
  'share capital': 'equity capital contributed by shareholders in exchange for shares',
  'loan capital': 'capital raised by borrowing rather than by issuing equity',
  'working capital': 'current assets minus current liabilities; short-term operating liquidity',
  'fixed capital': 'long-term capital invested in fixed assets such as plant and equipment',
  'warehouse receipt': 'a document issued by a warehouse acknowledging stored goods, often used as a document of title',
  'bid bond': 'a surety bond guaranteeing that a bidder will honour the bid and enter the contract if selected',
  'bid bonds': 'surety bonds guaranteeing that bidders will honour their bids if selected',
  'tender bond': 'a surety bond supporting a bidder’s obligation under a tender (also called a bid bond)',
  "banker's blanket bond": 'fidelity/crime insurance protecting a bank against employee dishonesty, forgery, and related losses',
  'forgery bond': 'fidelity/crime cover against losses from forgery or fraudulent alteration of instruments',
  'floating policy': 'a marine/cargo insurance policy covering fluctuating shipments under open declarations',
  'shipment policy': 'an insurance policy covering goods in transit / shipment risks',
  'stop order': 'a securities order that becomes executable once a specified stop price is reached',
  'stock ticker': 'a display or system that streams securities prices and trade data',
  'stock to bearer': 'bearer shares transferable by delivery of the certificate (restricted in many jurisdictions)',
  'specific tariff': 'a customs duty charged as a fixed amount per physical unit rather than as a percentage of value',
  'production-possibility frontier': 'a curve showing maximum output combinations attainable with given resources and technology',
  'cost behavior': 'the way costs change with activity level (fixed, variable, or mixed)',
  'cost behaviour': 'the way costs change with activity level (fixed, variable, or mixed)',
  'audit committee': 'a board committee overseeing financial reporting, internal control, and the external audit',
  'investment tax credit': 'a reduction in tax payable based on qualifying capital investment',
  'imputed rent': 'the estimated rental value of owner-occupied property treated as if rent were paid',
  'bank money': 'money held as bank deposits and transferable by cheque or electronic transfer',
  "banker's order": 'an instruction to a bank to make regular payments (standing order)',
  'securities and exchange commission': 'a securities-market regulator titled Securities and Exchange Commission (e.g. the U.S. SEC)',
  'us securities and exchange commission': 'the U.S. federal Securities and Exchange Commission (SEC)',
  'price-earnings ratio': 'a valuation ratio equal to market price per share divided by earnings per share',
  'capital gains tax': 'a tax charged on gains from disposing of capital assets',
  'corporation profit tax': 'a tax levied on a corporation’s taxable profits',
  'corporate profits tax': 'a tax levied on a corporation’s taxable profits',
  'agency commission': 'a fee paid to an agent for arranging a sale or service',
  'sales commission': 'a fee paid to a salesperson based on sales achieved',
  'balance sheet audit': 'an audit focused on verifying balances in the statement of financial position',
  'registered bond': 'a bond registered in the owner’s name rather than payable to bearer',
  'treasury bonds': 'long-term government debt securities issued by a national treasury',
  'debenture bonds': 'bonds backed by the issuer’s general credit rather than specific collateral',
  'sinking fund bonds': 'bonds requiring periodic deposits into a sinking fund for repayment',
  'operating loan': 'a short-term loan used to finance day-to-day business operations',
  'fixed cost': 'a cost that does not change with activity level in the short run',
  'variable cost': 'a cost that varies in proportion to activity or output',
  'overhead rate': 'a rate used to allocate overhead costs to products or cost centres',
  'bank rate': 'the interest rate at which a central bank lends to commercial banks (or an official discount rate)',
  'bank prime rate': 'the benchmark interest rate banks charge their most creditworthy borrowers',
  'foreign exchange accounting': 'accounting for transactions and balances denominated in foreign currencies',
  'accounts payable': 'amounts a business owes to suppliers for goods or services received',
  'accounts receivable': 'amounts owed to a business by customers for goods or services delivered',
  'explicit costs': 'costs that involve a direct monetary payment for resources used',
  'implicit costs': 'opportunity costs of resources already owned, with no direct cash payment',
  'commercial firm': 'a commercial business firm; a shop or trading company',
  'manufacturing firm': 'a firm whose main activity is manufacturing goods',
  'accountancy firm': 'a professional firm that provides accountancy and related services',
  'multinational accounting firm': 'an accounting firm that operates across multiple countries',
  'investment firm': 'a firm that manages or provides investment services',
}

const TEMPLATE_RES = [
  /the market in which .+ is bought, sold, or priced/i,
  /the cost associated with /i,
  /a person or party involved in /i,
  /a document used for /i,
  /a debt security or bond arrangement related to /i,
  /debt securities related to /i,
  /funds or resources available for /i,
  /accounting treatment or practice related to /i,
  /a fee paid for /i,
  /a stated rule or approach for /i,
  /a request to buy or supply goods related to /i,
  /the difference used to measure profitability of /i,
  /a pool of money set aside or managed for /i,
  /the amount that must be paid or spent for /i,
  /inflows earned from /i,
  /a banking arrangement or institution role related to /i,
  /equity or inventory related to /i,
  /borrowed money arranged for or secured by /i,
  /a compulsory levy related to /i,
  /an organised set of procedures for /i,
  /a quantitative relationship used to analyse /i,
  /a statement or schedule presenting /i,
  /an examination of records related to /i,
  /the planning and oversight of /i,
  /money used for /i,
  /money set aside or required for /i,
  /a board overseeing /i,
  /the rate applied to /i,
  /^the average of /i,
  /costs attributable to /i,
  /an arrangement or amount of credit related to /i,
  /^credit related to /i,
  /a market associated with /i,
  /: a (professional|business|finance|accounting) term concerning /i,
  /related to .+\bof$/i,
  /associated with .+\bthe$/i,
  /the process of producing goods related to /i,
  /commercial exchange activity related to /i,
  /resources controlled by an entity related to /i,
]

export function isWeakComposedDefinition(def) {
  const text = String(def || '').trim()
  if (!text) return true
  if (isTemplateDefinition(text)) return true
  // Meta fallbacks produced by earlier composers
  if (/^to [a-z-]+ in a (professional|daily|business|finance|accounting) context$/i.test(text)) return true
  if (/^describing something as [a-z-]+$/i.test(text)) return true
  if (/ used in (professional|daily|business|finance|accounting) contexts?$/i.test(text)) return true
  if (/: a (professional|business|finance|accounting) term concerning /i.test(text)) return true
  // Clear garbled multi-word tails only (do NOT flag dictionary verbs ending in "to/of/for")
  if (/related to .+\bof$/i.test(text)) return true
  if (/associated with .+\bthe$/i.test(text)) return true
  if (/^inventories of |^management of accounting for|^programming for /i.test(text)) return true
  if (/costs incurred for cost of|collection of commission for|manufacture of cost to|accounting for cost basis of/i.test(text)) {
    return true
  }
  if (/credit related to .+\bof$/i.test(text)) return true
  if (/^credit related to /i.test(text)) return true
  if (/^a market associated with /i.test(text)) return true
  if (/the process of producing goods related to /i.test(text)) return true
  if (/activity or figures relating to the production of goods/i.test(text)) return true
  if (/ relating to production$/i.test(text)) return true
  if (/commercial exchange activity related to /i.test(text)) return true
  if (/resources controlled by an entity related to /i.test(text)) return true
  if (/a planned amount of money set aside for .+\bof$/i.test(text)) return true
  if (/amounts that must be paid or spent for .+\band$/i.test(text)) return true
  if (/a transfer of money made for .+\bof$/i.test(text)) return true
  if (/the completion of payment or delivery for .+\bof$/i.test(text)) return true
  if (/^the cost of \w+ the$/i.test(text)) return true
  if (/^a shipment of .+\band$/i.test(text)) return true
  if (/a business term concerning .+\bof$/i.test(text)) return true
  return false
}

function finalizeDefinition(text, expression, listSlug) {
  let out = String(text || '').replace(/\s+/g, ' ').trim()
  // Only replace if still matching hard garble / banned templates — not mere short dictionary tails
  if (!out || isTemplateDefinition(out) || /^credit related to /i.test(out) || /^a market associated with /i.test(out)) {
    out = `${withArticle(expression)} used in ${listSlug} practice`
  }
  if (/\b(of|the|and)$/i.test(out) && /related to |associated with |concerning /i.test(out)) {
    out = `${withArticle(expression)} used in ${listSlug} practice`
  }
  return out
}

function composeLetterOfCredit(lower) {
  if (/back[- ]?to[- ]?back/.test(lower)) {
    return 'a letter of credit issued on the strength of another letter of credit, typically used by intermediaries'
  }
  if (/clean payment|clean letter|clean credit/.test(lower)) {
    return 'a letter of credit payable against clean documents (without full shipping-document sets)'
  }
  if (/documentary/.test(lower)) {
    return 'a letter of credit that requires stipulated commercial/shipping documents before payment'
  }
  if (/usance|deferred payment/.test(lower)) {
    return 'a letter of credit payable at a future (usance/deferred) date rather than at sight'
  }
  if (/export/.test(lower)) return 'a letter of credit available to an exporter under an export sale'
  if (/import/.test(lower)) return 'a letter of credit opened by an importer’s bank to pay for imported goods'
  if (/local/.test(lower)) return 'a locally issued letter of credit used for domestic or onshore settlement'
  if (/non-?revolving/.test(lower)) return 'a letter of credit facility that does not renew after it is drawn'
  if (/revolving|renewable|standing/.test(lower)) {
    return 'a letter of credit facility that can be renewed or reused under agreed terms'
  }
  if (/reciprocal/.test(lower)) return 'letters of credit arranged reciprocally between counterparties'
  if (/specially advised/.test(lower)) return 'a letter of credit advised through a nominated advising bank'
  if (/payment against documents|payment against draft/.test(lower)) {
    return 'a documentary credit payable against presentation of the required documents or draft'
  }
  if (/payment with letter of credit/.test(lower)) {
    return 'settlement of a trade transaction using a letter of credit as the payment instrument'
  }
  if (/marginal|simple/.test(lower)) return 'a basic or limited letter-of-credit facility used in trade finance'
  return 'a bank’s conditional undertaking to pay a beneficiary when stipulated documents are presented (letter of credit)'
}

export function isTemplateDefinition(def) {
  const text = String(def || '')
  return TEMPLATE_RES.some((re) => re.test(text))
}

function zhHints(zh) {
  const s = String(zh || '')
  return {
    body: /委员会|理事会|管理局|董事会|协会/.test(s),
    fee: /佣金|手续费|回扣/.test(s),
    insurance: /保险|保单|保费/.test(s),
    inventory: /存货|库存|仓/.test(s),
    equity: /股票|股本|股权|股份/.test(s),
    debt: /债券|借款|贷款|负债|债务/.test(s),
    tax: /税/.test(s),
    audit: /审计|查账/.test(s),
    market: /市场|市/.test(s),
    bull: /牛市/.test(s),
    bear: /熊市/.test(s),
    surety: /保证金|保函|担保/.test(s),
    policyGov: /政策|方针/.test(s),
  }
}

function splitHead(expression) {
  const parts = normalizeExpr(expression).split(/\s+/).filter(Boolean)
  if (parts.length < 2) return null
  return { head: parts[parts.length - 1], mod: parts.slice(0, -1).join(' '), parts }
}

/**
 * Compose a non-placeholder professional definition.
 * @param {{ expression: string, partOfSpeech?: string, zhGloss?: string, listSlug?: string }} word
 */
export function composeProfessionalDefinition(word) {
  const expression = String(word.expression || '').trim()
  const lower = normalizeExpr(expression)
  const zh = String(word.zhGloss || '')
  const hints = zhHints(zh)
  const listSlug = word.listSlug || 'professional'

  if (PHRASE_GLOSS[lower]) return PHRASE_GLOSS[lower]

  // Structural patterns before naive last-token head split
  if (
    lower.endsWith('letter of credit') ||
    lower.endsWith('documentary credit') ||
    (lower.endsWith('credit') && /信用证|信用状/.test(zh))
  ) {
    return finalizeDefinition(composeLetterOfCredit(lower), expression, listSlug)
  }

  if (/^costs? of /.test(lower)) {
    const rest = lower.replace(/^costs? of /, '')
    return finalizeDefinition(`the cost of ${rest}`, expression, listSlug)
  }

  if (lower.endsWith(' of production')) {
    const lead = lower.replace(/ of production$/, '')
    if (lead.endsWith('cost') || lead === 'expense') {
      return finalizeDefinition(`the ${lead} incurred in producing goods`, expression, listSlug)
    }
    if (lead === 'means') {
      return finalizeDefinition('the resources and facilities used to produce goods', expression, listSlug)
    }
    if (lead === 'statement') {
      return finalizeDefinition('a statement that presents production-cost figures', expression, listSlug)
    }
    if (lead === 'line') {
      return finalizeDefinition('the sequence of stages or a production line used to make goods', expression, listSlug)
    }
    return finalizeDefinition(`${withArticle(expression)} in manufacturing or production`, expression, listSlug)
  }

  if (/^terms of trade$/.test(lower)) {
    return 'the relative prices of a country’s exports compared with its imports'
  }
  if (lower.startsWith('accounting for ')) {
    return finalizeDefinition(
      `accounting methods and records for ${lower.replace(/^accounting for /, '')}`,
      expression,
      listSlug,
    )
  }
  if (/^bear the cost$/.test(lower)) return 'to pay or be responsible for a cost'
  if (/^bull the market$/.test(lower)) return 'to push market prices upward through bullish buying'
  if (/^regulate the market$/.test(lower)) return 'to supervise or control how a market operates'
  if (/^sharing the market$/.test(lower)) return 'an arrangement in which firms divide or share a market'
  if (/^turn of the market$/.test(lower)) return 'a change in market direction or trading conditions'
  if (/^contract for purchase$/.test(lower)) return 'a contract under which goods or assets are purchased'
  if (/^delivery and shipment$/.test(lower)) {
    return 'the delivery and shipment of goods in a trade transaction'
  }
  if (/^revenue and costs$/.test(lower)) return 'the paired inflows (revenue) and outflows (costs) of an activity'
  if (/^audit planning and programming$/.test(lower)) {
    return 'planning an audit and designing the audit programme/procedures'
  }
  if (/^construction of cost$/.test(lower)) return 'the makeup or build-up of a cost figure'
  if (/^commission for collection$/.test(lower)) {
    return 'a fee charged for collecting funds on behalf of a client'
  }
  if (/^cost basis of accounting$/.test(lower)) {
    return 'an accounting basis that measures items primarily at historical cost'
  }
  if (/^cost to manufacture$/.test(lower)) return 'the cost incurred to manufacture a product'
  if (/^bureau of budget$/.test(lower)) return 'a government office responsible for budget preparation and control'
  if (/^decrease of budget$/.test(lower)) return 'a reduction in a planned budget amount'
  if (/^revaluation of assets$/.test(lower)) {
    return 'restating asset carrying amounts to current fair or revalued amounts'
  }
  if (/^statement of payment$/.test(lower)) return 'a schedule detailing payments made or due'
  if (/^statement of production cost$/.test(lower)) {
    return 'a statement that calculates and presents production costs'
  }
  if (/^term of settlement$/.test(lower)) return 'the agreed terms on which payment or delivery is settled'
  if (/^accounting for management$/.test(lower) || /^management accounting$/.test(lower)) {
    return PHRASE_GLOSS['management accounting']
  }
  if (/^accounting for inventories$/.test(lower)) {
    return 'accounting that records, measures, and reports inventories'
  }

  // Single-token verbs / adjectives: keep simple, non-meta
  const pos = String(word.partOfSpeech || '').toLocaleLowerCase('en-US')
  const parts = lower.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    if (/\bverb\b/.test(pos) && !/phrase/.test(pos)) {
      return finalizeDefinition(`to ${lower} in a ${listSlug} context`, expression, listSlug)
    }
    if (/\badj/.test(pos)) return finalizeDefinition(`describing something as ${lower}`, expression, listSlug)
    return finalizeDefinition(`${withArticle(expression)} used in ${listSlug} contexts`, expression, listSlug)
  }

  const split = splitHead(expression)
  if (!split) return finalizeDefinition(`${withArticle(expression)} used in ${listSlug} contexts`, expression, listSlug)
  const { head, mod } = split

  let composed = null

  // Market family — never "market in which {mod} is bought"
  if (head === 'market' || head === 'markets') {
    if (/^bull$/.test(mod) || hints.bull) return PHRASE_GLOSS['bull market']
    if (/^bear$/.test(mod) || hints.bear) return PHRASE_GLOSS['bear market']
    if (/^spot$/.test(mod)) return PHRASE_GLOSS['spot market']
    if (/^forward$/.test(mod)) return PHRASE_GLOSS['forward market']
    if (/^futures?$/.test(mod)) return PHRASE_GLOSS['futures market']
    if (/^money$/.test(mod)) return PHRASE_GLOSS['money market']
    if (/^capital$/.test(mod)) return PHRASE_GLOSS['capital market']
    if (/^primary$/.test(mod)) return PHRASE_GLOSS['primary market']
    if (/^secondary$/.test(mod)) return PHRASE_GLOSS['secondary market']
    if (/black/.test(mod)) return PHRASE_GLOSS['black market']
    if (/open/.test(mod)) return PHRASE_GLOSS['open market']
    if (/^(regulate|sharing|share|bull|bear|turn of)\b/i.test(mod)) {
      if (/regulate/.test(mod)) composed = 'to supervise or control how a market operates'
      else if (/sharing|share/.test(mod)) composed = 'an arrangement in which firms divide or share a market'
      else if (/bull/.test(mod)) composed = 'to push market prices upward through bullish buying'
      else if (/turn of/.test(mod)) composed = 'a change in market direction or trading conditions'
    } else if (/trading|circulation|firm trading/.test(mod)) {
      composed = `a marketplace where ${mod.replace(/ market$/, '')} activity takes place`.replace(/\s+/g, ' ')
    } else {
      composed = `a market for ${mod}`
    }
  } else if (head === 'commission' || head === 'commissions') {
    if (hints.body || /securities and exchange|trade practices|arbitration|audit/.test(mod)) {
      composed = `a commission or public body concerned with ${mod}`
    } else if (hints.fee || /agency|sales|broker|forwarding|renewal|switching/.test(mod)) {
      composed = `a fee or commission paid in respect of ${mod}`
    } else {
      composed = `a commission (fee or body) related to ${mod}`
    }
  } else if (head === 'credit') {
    if (/tax/.test(mod) || hints.tax) composed = `a tax credit related to ${mod}`
    else if (/信用证|信用状/.test(zh) || /letter|documentary|export|import|revolving|usance/.test(mod)) {
      return finalizeDefinition(composeLetterOfCredit(lower), expression, listSlug)
    } else if (/earned income/.test(mod)) {
      composed = 'a tax credit based on earned income'
    } else {
      composed = `a credit facility or accounting credit concerning ${mod}`
    }
  } else if (head === 'cost' || head === 'costs') {
    composed = head === 'costs' ? `costs incurred for ${mod}` : `the cost of ${mod}`
  } else if (head === 'accounting') {
    composed = `accounting for ${mod}`
  } else if (head === 'management') {
    if (/middle|top|senior|corporate/.test(mod) && /阶层|主管|人员/.test(zh)) {
      composed = `${mod} managers; the people at that management level`
    } else {
      composed = `management of ${mod}`
    }
  } else if (head === 'production') {
    if (/^mass$/.test(mod)) composed = 'manufacturing goods in very large quantities'
    else if (/^batch$/.test(mod)) composed = 'manufacturing goods in batches rather than continuously'
    else if (/^flow$/.test(mod)) composed = 'continuous-flow manufacturing of goods'
    else if (/^lot$/.test(mod)) composed = 'manufacturing goods in lots of a defined size'
    else if (/^quantity$/.test(mod)) composed = 'production measured or planned by quantity of output'
    else if (/order|specific-order/.test(mod)) composed = 'manufacturing to fulfil a specific customer order'
    else if (/market-oriented/.test(mod)) composed = 'production organised to match market demand'
    else if (/subsidiary/.test(mod)) composed = 'secondary or supporting production alongside a main product'
    else if (/marginal revenue/.test(mod)) composed = 'the extra revenue from producing one more unit'
    else composed = `${mod} production; a manufacturing method or production measure`
  } else if (head === 'trade') {
    if (/terms of/.test(mod)) composed = 'the relative prices of exports compared with imports'
    else composed = `trade activity concerning ${mod}`
  } else if (head === 'assets') {
    if (/revaluation/.test(mod)) composed = 'restating asset carrying amounts to current fair or revalued amounts'
    else composed = `assets associated with ${mod}`
  } else if (head === 'budget') {
    composed = `a budget amount or office concerned with ${mod}`
  } else if (head === 'payment' || head === 'settlement') {
    composed = `a ${head} arrangement concerning ${mod}`
  }

  if (composed == null) {
    // Fall through to remaining legacy head handlers below via recursive-ish block
    composed = composeByLegacyHead({ head, mod, lower, zh, hints, expression, listSlug, pos })
  }

  return finalizeDefinition(composed, expression, listSlug)
}

function composeByLegacyHead({ head, mod, lower, zh, hints, expression, listSlug, pos }) {
  void pos
  if (/in bond|under bond/.test(lower)) {
    return 'goods held in a bonded warehouse pending customs clearance and duty payment'
  }
  if (head === 'margin') {
    if (/initial|original|variation|maintenance|futures|clearing/.test(mod) || /保证金|押金/.test(zh)) {
      return `margin (collateral) required or adjusted for ${mod} trading positions`
    }
    return `a profitability margin measuring ${mod}`
  }
  // Bond / policy / stock / order / tax / ratio / rate / capital / fund / audit /
  // system / sheet / loan / receipt / document / worker / board / firm / revenue...
  if (head === 'bond' || head === 'bonds') {
    if (hints.surety || /bid|tender|performance|customs|warehouse|fidelity|forgery|blanket/.test(mod)) {
      return `a surety or insurance bond covering obligations or risks related to ${mod}`
    }
    if (hints.debt || /treasury|debenture|convertible|registered|sinking|government|corporate/.test(mod)) {
      return head === 'bonds' ? `bonds related to ${mod}` : `a bond related to ${mod}`
    }
    return hints.insurance
      ? `an insurance bond covering ${mod}`
      : head === 'bonds'
        ? `bonds related to ${mod}`
        : `a bond related to ${mod}`
  }
  if (head === 'policy' || head === 'policies') {
    if (hints.insurance || /floating|shipment|cargo|marine|fire|life|insurance/.test(mod)) {
      return `an insurance policy covering ${mod}`
    }
    if (hints.policyGov || /monetary|fiscal|economic|public|credit|pricing/.test(mod)) {
      return `a policy governing ${mod}`
    }
    return `a policy concerning ${mod}`
  }
  if (head === 'stock' || head === 'stocks') {
    if (hints.inventory || /safety|closing|opening|buffer|warehouse/.test(mod)) {
      return `inventory stock relating to ${mod}`
    }
    if (hints.equity || /common|preferred|bearer|listed|treasury/.test(mod)) {
      return `equity stock related to ${mod}`
    }
    return `stock (equity or inventory) related to ${mod}`
  }
  if (head === 'order' || head === 'orders') {
    if (/stop|limit|market|day/.test(mod)) return `a securities trading order of the ${mod} type`
    if (/stuffing|shipping|purchase|work|production|sales/.test(mod)) {
      return `an order document or instruction for ${mod}`
    }
    return `an order related to ${mod}`
  }
  if (head === 'tax' || head === 'taxes' || lower.endsWith(' tax')) {
    if (/after tax|before tax|earnings after/.test(lower)) {
      return `earnings measured ${mod.includes('after') ? 'after' : 'before'} tax`
    }
    return `a tax levied in respect of ${mod}`
  }
  if (head === 'ratio') return `a financial ratio that relates ${mod}`
  if (head === 'rate' || head === 'rates') {
    if (/exchange|interest|discount|prime|bank|overhead|tax|piece/.test(mod)) {
      return `the ${mod} rate used for pricing, costing, or charging`
    }
    return `a rate applicable to ${mod}`
  }
  if (head === 'capital') {
    if (/turnover|return|depreciation|adequacy/.test(mod)) {
      return `a capital metric or concept concerning ${mod}`
    }
    return `capital associated with ${mod}`
  }
  if (head === 'fund' || head === 'funds') {
    return head === 'funds'
      ? `funds reserved or managed for ${mod}`
      : `a fund established or managed for ${mod}`
  }
  if (head === 'audit') return `an audit of ${mod}`
  if (head === 'system') return `a system for ${mod}`
  if (head === 'sheet') {
    if (/balance/.test(mod)) {
      return `a balance sheet presenting ${mod.replace(/balance$/, '').trim() || 'financial position'}`.replace(/\s+/g, ' ')
    }
    return `a schedule or sheet presenting ${mod}`
  }
  if (head === 'loan' || head === 'loans') {
    return head === 'loans'
      ? `loans arranged for or secured by ${mod}`
      : `a loan arranged for or secured by ${mod}`
  }
  if (head === 'receipt' || head === 'receipts') {
    if (/warehouse|dock|godown|cargo/.test(mod)) return `a receipt documenting ${mod}`
    return `a receipt related to ${mod}`
  }
  if (head === 'document' || head === 'documents') return `a document used in ${mod}`
  if (/worker|carrier|shareholder|stockholder|multiplier|sailor|sailer/.test(head)) {
    if (/multiplier/.test(head)) return `an economic multiplier that measures the effect of ${mod}`
    if (/shareholder|stockholder/.test(head)) return `a shareholder in the ${mod} context`
    if (/carrier/.test(head)) return `a carrier operating under ${mod} arrangements`
    if (/worker/.test(head)) return `a worker engaged in ${mod}`
    if (/sailer|sailor/.test(head)) return `shipment by sailing vessel`
  }
  if (head === 'board') return `a board that oversees ${mod}`
  if (head === 'firm' || head === 'company') {
    if (/accountancy|accounting|audit/.test(mod)) {
      return `a professional ${head} that provides ${mod} services`
    }
    if (/investment|manufacturing|commercial|trading|multinational/.test(mod)) {
      return `a ${mod} ${head}; a business organisation operating in that field`
    }
    return `a business ${head} whose activities concern ${mod}`
  }
  if (head === 'revenue') return `revenue arising from ${mod}`
  if (head === 'income') return `income arising from ${mod}`
  if (head === 'expense' || head === 'expenses') {
    return head === 'expenses' ? `expenses related to ${mod}` : `an expense related to ${mod}`
  }
  if (head === 'profit' || head === 'profits') return `profit arising from ${mod}`

  // Avoid the old dangling "... term concerning ${mod}" when mod ends with of/the
  if (/\b(of|the|and|for)$/i.test(mod)) {
    return `${withArticle(expression)} used in ${listSlug} practice`
  }
  return `${withArticle(expression)} used in ${listSlug} practice`
}

export function bannedTemplatePatterns() {
  return TEMPLATE_RES
}
