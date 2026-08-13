# Vocabulary V5 — Trusted 996 Design

**Date:** 2026-08-14  
**Status:** V5.0–V5.2 shipped locally (trusted core → ~3000 → ~7500)  
**Audit source:** `c:\Users\84754\Downloads\recall-english-vocabulary-audit-2026-08-14.xlsx`

## Goal

Ship a **production learning library of ~996 high-trust senses** (240 handcrafted seed + ~756 V1) that is safe to study. Prefer a small trustworthy library over 7590 senses whose `senseKey ↔ definition ↔ zhGloss ↔ acceptedZhAnswers` alignment cannot be trusted.

Later milestones (out of scope for V5.0 implementation):

| Milestone | Target | Note |
| --- | --- | --- |
| **V5.0** | ~996 | Trusted seed + V1 only |
| **V5.1** | ~3000 | Rebuild from quarantined core/econ by real need (Business / Malaysia daily / Accounting / Finance first), not original dump order |
| **V5.2** | 5000–8000 | Bulk expand only after the generation pipeline is proven stable |

## Decision summary

- **Approach:** Source-pack split + repeatable quality harness (not “filter at runtime while shipping dirty data”).
- **Quarantine:** Move `core-*` / `econ-*` out of the production seed path into `data/vocabulary-packs/_quarantine/` (keep for rebuild; do not load into default study library).
- **Generation / review:** Agent model regenerates V1 collocations and examples; offline hard-rule harness flags failures; human reviews only red-flagged rows.
- **No DeepSeek required** for V5.0 content regeneration.

## Production library boundary (V5.0)

### Included

1. **240 handcrafted seeds** (`seed-*` in `src/data/seedVocabulary.ts`) — golden sample.
2. **V1 skeleton** — pack entries with `id` prefix `v1-*` that survive the existing handcrafted expression overlap skip (~756 in bundled output; ~860 in combined pack before overlap skip).

Expected app totals after rebuild: **~996 seed words** (240 + ~756). Track counts in `App.test.tsx` / README must be recomputed from the rebuilt membership graph (daily / business / professional).

### Excluded from production

- All `core-*` and `econ-*` words (~2764 + ~3830 in current bundled seeds; ~6594 total to rebuild later).
- Quarantined data must **not** be written into `src/data/bundledSeedWords.json` / `bundledSeedMemberships.json`.
- Quarantined data must **not** be on the default import / seed initialization path.

### Overlap with handcrafted seed

- Combined pack currently has **135** expression overlaps with handcrafted seed; about **104** of those are `v1-*`.
- `seed:pack` continues to **skip pack entries whose normalized expression already exists in handcrafted seed**, so handcrafted wording remains authoritative.
- Importer identity remains `normalize(expression) + "\0" + normalize(senseKey)` (see Identity section). Do not “dedupe by expression only” in the importer; resolve true multi-sense vs duplicate sense in later rebuild work using audit sheet「导入与重复」.

## Content fixes (V5.0)

### Handcrafted seed (golden sample) — confirmed audit issues

Apply the audit「已确认问题」seed rows (5):

| ID | Expression | Fix intent |
| --- | --- | --- |
| `seed-finance-034` | share capital | Rewrite for Malaysia Companies Act 2016 no-par-value regime; do not center definition on nominal/par value |
| `seed-daily-064` | Wi-Fi | Wireless LAN / IEEE 802.11; not “must connect to the internet” |
| `seed-finance-077` | tax liability | Primary zh → 应纳税额/应付税款; keep 应交税费 only as accounting-subject context if needed |
| `seed-finance-082` | recognition | Align with current Conceptual Framework recognition language |
| `seed-finance-059` | bond | Principal repayment required; coupons/other return optional (zero-coupon aware) |

Handcrafted rows remain the quality bar for examples, collocations, and prompts.

### V1 professional definition fixes — confirmed audit issues

Apply the audit v1 rows (13), including at least:

| Expression | Fix intent |
| --- | --- |
| bad debt | Irrecoverable / written off — not “unlikely to be collected” (that is closer to doubtful debt) |
| effective interest rate | IFRS 9 EIR (rate that discounts expected cash flows to amortised cost), not EAR/compounding slogan |
| inventory write-down | IAS 2: write down to NRV when NRV &lt; cost — not “recoverable value” |
| recoverable amount | Higher of fair value less costs of disposal and value in use |
| account balance | Broader than bank-only, or drop accounting membership if kept bank-narrow |
| current asset / current liability | Full IAS 1 (and successor) criteria, not operating-cycle-only shorthand |
| non-current asset / liability | Residual of current criteria |
| inventory provision | Prefer write-down terminology; if kept, mark as practical/legacy wording |
| useful life | Period **or** production/similar units |
| weighted average cost | IAS 2 formula (opening + purchases/production) |
| financial year | Reporting period, normally about twelve months — not absolute “twelve months” |

### V1 collocations and examples — full rebuild

For every retained `v1-*` sense:

- Regenerate **collocations** (≥2): real multi-word patterns that include the expression in a natural phrase; must fail the “fake collocation” checks below.
- Regenerate **examples** (≥2): natural EN+ZH pairs usable for study; no template filler.
- Rebuild **usage prompts** from the new examples (same shape as current seed: cloze + sentence).
- **Chinese answers:** `acceptedZhAnswers` = only synonyms for the **current sense**; never dump an entire dictionary entry’s Chinese gloss list into one sense.

Agent-driven batch generation is acceptable; harness + human red-flag review is mandatory before calling V5.0 done.

## Quality harness (offline, repeatable)

Location: `scripts/` (e.g. quality report + pack slice helpers). Must run without DeepSeek / network LLM.

### Hard bans (fail CI / fail pack build)

1. English definition matching placeholder pattern:  
   `(Business|Accounting|Finance|Daily) sense of …`
2. Example or usage text matching:  
   `Please notice … in context`
3. Collocations that, after case/punctuation normalize, equal only `expression` or `expression + POS` (or trivial `use ${expression}`)
4. Empty / truncated / obviously broken definitions where detectable by rules already used in audit (optional heuristics may **warn** rather than fail)

### Sense-aligned Chinese answers

- Heuristic checks that flag verb/adjective answers attached to a noun sense (and similar POS/sense mismatches) as **red** for human review.
- Exact linguistic perfection is not required from rules alone; false negatives go to human review via red list.

### Outputs

- Machine-readable report (e.g. JSON) listing failing word ids and rule ids.
- Human-readable red-flag list for manual pass.

### Generator and importer identity (unified)

Canonical identity (already in `src/lib/vocabularyPack.ts`):

```text
normalize(expression) + "\0" + normalize(senseKey)
normalize = NFKC → trim → en-US lower case → collapse whitespace
```

Requirements:

- Document and reuse the **same** helper conceptually in pack build scripts and importer (no divergent “expression-only” merge for production packs).
- `seed:pack` handcrafted skip remains **expression-level** (handcrafted wins on expression), which is intentional and must be documented so it is not confused with importer identity.
- Adding custom words in the UI may still use expression+zhGloss for UX dedupe; that is separate from pack identity and must not redefine pack merge rules.

## Professional fact regression tests

Add vitest coverage for audit gold facts so V5.1+ cannot silently regress, including at least:

- `share capital` — no-par-value / Malaysia-aware wording; not par-value-centric
- `bad debt` — irrecoverable / written off language
- `effective interest rate` — amortised-cost / expected cash-flow discounting language; not mere “after compounding”
- `inventory write-down` — NRV / IAS 2 language
- `recoverable amount` — max(FVLCD, VIU) language
- Placeholder / template bans on **all** production bundled seeds
- Collocation authenticity rule on **all** production bundled seeds
- Production seed count ≈ 996 (exact numbers locked after rebuild)
- No `core-*` / `econ-*` ids in production bundled seeds

## Pack / seed pipeline changes

1. Slice `all_batches_combined_vocabulary_pack.json` (or successor) into:
   - **Trusted production pack** (V1-only words + memberships + system lists)
   - **Quarantine archive** (`core` + `econ`) under `data/vocabulary-packs/_quarantine/`
2. Update `scripts/buildBundledSeedPack.mjs`:
   - Read **trusted** pack only
   - Stop generating `Please notice …` fallbacks and stop normalizing placeholder “sense of” definitions into acceptable output — missing quality must fail or omit, not paper over
   - Keep ECDICT debris sanitization only where still relevant to V1
3. Update README seed counts and App / seed tests.
4. Keep fix / verify scripts that remain useful; retire or quarantine scripts that assume 7k dirty senses as production.

## Explicit non-goals (V5.0)

- Rebuilding the 6594 core/econ senses
- Putting quarantine packs on the default Settings import path
- Literary perfection of every example beyond “correct, natural, harness-pass”
- Changing FSRS / UI product behaviour beyond counts and seed content

## Acceptance criteria (V5.0 done)

1. App seeds **~996** active senses; tracks and library UI numbers match tests.
2. Zero `core-*` / `econ-*` in `bundledSeedWords.json`.
3. Five seed + thirteen V1 definition/zh fixes applied as specified.
4. All retained V1 entries have rebuilt collocations and examples; harness reports **zero hard-ban failures** on production seeds.
5. Red-flag list reviewed by human (user); remaining accepted warnings documented or fixed.
6. Professional fact regression tests pass.
7. Quarantine archive exists and is excluded from production build.

## Open points resolved in conversation

- V1 enrichment: agent model + harness (not DeepSeek-required).
- Quarantine strategy: option 1 — move out of production seed, keep under `_quarantine/`.
- Phasing: V5.0 → V5.1 → V5.2 as in Goal table.
