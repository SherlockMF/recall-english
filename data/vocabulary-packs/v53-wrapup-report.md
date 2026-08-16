# Vocabulary V5.3 wrap-up report

**Date:** 2026-08-16  
**Production size:** 7497 senses (handcrafted 240 + bundled 7257)  
**Seed content revision:** `5.3.0`

## Goal (original plan)

Repair the ~7500 production library into a trustworthy **V5.3** without expanding the lexicon. Audit CSV was an input, not a blind patch script.

## Batches completed

| Batch | Scope | Result |
|---|---|---|
| 1 | P0 high-risk (~89) | Facts, variants, POS examples fixed; pack builder zh-split hardened |
| 2 | acceptedEnVariants + V1 | Pack-wide sanitizer; known-bad variants gated |
| 3 | ~315 POS/example/usage | POS-aware example banks; Round9 semantic classes tightened later |
| 4 | Econ template defs | `professionalGloss.mjs`; banned head-noun templates |
| 5 | Sense validator + merges | 3 identical-sense dups removed; curated Core fixes; drill cleanup |
| 6 | WordNet wrong senses + Round9 templates | 25 curated + 963 template rebuilds |
| 7 | Garbled composed defs + adj sense | LC/production families; soft adj cleared |
| 8 | Wrap-up 1–8 | See below |

## Remaining-plan items (1–8) — done in Batch 8 / wrap-up

### 1. Pack `note` (Design A)
- Importer strips top-level `note` before strict schema validation.
- Builders (`buildV51`, `buildV52`, `sliceTrusted`) write importable JSON **without** `note`; human text goes to `*.meta.json`.
- Existing `v51` / `v52` / quarantine packs stripped via `npm run seed:strip-notes`.

### 2. ~104 pack ↔ handcrafted expression overlaps
- `seed:pack` still skips pack rows whose **expression** overlaps handcrafted (~104).
- Production therefore has **one** Word per overlapping expression (handcrafted wins).
- These are **not** duplicate production identities; pack-side rows remain in `trusted_v5_2` only as unused overlap fodder / future dual-sense candidates.
- Policy: do **not** expression-only merge into DB; true multi-sense would need identity-aware pack skip + new Word ids. No false dual tracks introduced.

### 3. Temporal / superseded institutions
**Policy:** keep historical headwords; annotate zh + definition with historical status and successor.

| Expression | Successor / status |
|---|---|
| singapore inter-bank offering rate (SIBOR) | → SORA (discontinued 2025) |
| overseas private investment corporation (OPIC) | → DFC (2019) |
| federal home loan bank board (FHLBB) | abolished 1989 (FIRREA) |
| national association of accountants (NAA) | → IMA (1991) |

### 4. Seed content sync (no-user / future-proof)
- `UserSettings.seedContentRevision` + `SEED_CONTENT_REVISION` (`5.3.0`).
- On revision mismatch, `initializeDatabase` overwrites seed Word **bodies by id**, keeps tracks/memberships, stamps new revision.
- Same revision still add-only (no silent overwrite of local edits).

### 5. Further high-confidence Core medium fixes
- Batch 8 curated 11 additional Core senses (adolescent, advance, alert, ancient, absent, absolute, abstract, abuse, accidental, acquire, characterize) plus temporal polish.

### 6. Tests / validators (plan §9 gaps)
- Pack note import test; seed revision refresh test; temporal regression; weak composed def hard fails in quality + sense validator.
- Sense validator `--strict` now fails on hard **or** near-duplicate collisions; soft alarms for many zh answers / adj adverb leakage.
- Remaining soft (`noun_def_looks_verbal`, short trailing function words) are intentional dictionary-style signals, not auto-bulk-fixed.

### 7. V5.3 packaging
- README updated (7497, V5.3, maintenance commands, temporal policy, note design).
- This report is the canonical wrap-up artifact.

### 8. Batch archive
- This file archives Batches 1–8 outcomes and the original open items closure.
- ID merge map (Batch 5): `data/vocabulary-packs/v53_id_merge_map.json`.

## Verification (wrap-up)

Run:

```bash
npm run seed:quality
npm run seed:validate-sense
npm test
npm run build
```

Expected: quality hardFailures 0; sense validator hard 0 / collisions 0; tests green.

## Still out of scope (by original plan)

- Bulk-auto-fixing hundreds of remaining “medium” Core audit rows with boilerplate notes.
- Changing pack skip from expression-only to identity-only (would allow true dual senses for the 104 overlaps).
- Publishing / npm version bump beyond documenting V5.3 library status.
