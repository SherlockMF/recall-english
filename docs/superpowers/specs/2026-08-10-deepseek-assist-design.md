# DeepSeek Assist Design

**Date:** 2026-08-10  
**Status:** Approved for implementation (user: 方案1，直接写计划自己审核然后实施)  
**Model:** `deepseek-v4-flash` only

## Goal

Add five optional LLM assists to Recall English without breaking local-first study:

1. Semantic grading when rule grading fails  
2. Dynamic usage prompt generation (lazy + cached on word)  
3. Layered AI hints  
4. Custom vocabulary enrichment  
5. Short writing/usage feedback

## Decisions (locked)

| Topic | Choice |
|---|---|
| Call path | Browser initiates; user API key in settings |
| Key storage | `localStorage` only — never IndexedDB backup |
| CORS | Vite proxy `/api/deepseek` → `https://api.deepseek.com` (key still sent from browser) |
| Fallback | No key / timeout / error → existing rules & content |
| Grading | `gradeAttempt` first; LLM only when incorrect / uncertain |
| Generation | Add page “AI 补全” button; usage prompts lazy-generated when studying usage with too few prompts |
| Model | `deepseek-v4-flash`, thinking **disabled**, JSON object responses |

## Architecture

```
UI (Settings / Study / Add)
        │
        ▼
src/lib/llm/config.ts     get/set API key
src/lib/llm/client.ts     chatJson(messages) via /api/deepseek/v1/chat/completions
src/lib/llm/*.ts          gradeAssist, hints, enrich, usageGenerate
src/lib/llm/evaluateAssist.ts   rules-first orchestration (+ feedback)
```

Units:

- **client**: auth header, timeout, parse JSON content, typed errors  
- **gradeAssist**: maps to `again|hard|good` + Chinese feedback string  
- **hints**: returns one hint string for requested level without revealing full answer when level &lt; 2  
- **enrich**: returns zh gloss, definition, POS, examples, collocations, accepted variants drafts  
- **usageGenerate**: returns 2 `UsagePrompt` objects (1 cloze + 1 sentence) for Malaysia uni / business / finance / accounting context when category fits  
- **evaluateAssist**: sync rules → optional async LLM grade+feedback

## Data flow

### Grading + feedback

1. Study submit → `evaluateAssist`  
2. If revealed → `again`  
3. Else `gradeAttempt`  
4. If correct → return rule result (no LLM)  
5. If incorrect and key present → LLM JSON `{ rating, correct, feedbackZh }`  
6. On LLM failure → keep rule `again`  
7. Show `feedbackZh` in feedback phase when present

### Hints

1. User taps hint  
2. If key present → LLM hint for level; on failure → existing `buildHint`  
3. Hint still increments `hintLevel` and keeps FSRS penalty rules

### Enrichment

1. AddView “AI 补全” with expression (+ optional definition)  
2. Fill empty form fields only (do not overwrite user-typed values unless field empty)  
3. User still saves manually

### Usage generation

1. Before usage card (or when `usagePrompts.length < 2`) and key present → generate & `putWord`  
2. Seed words already have prompts → skip  
3. Failure → fall back to any existing prompts or simple local template

## Settings UI

Settings section “DeepSeek 辅助”:

- API Key input (password)  
- Saved / cleared locally  
- Short note: optional; offline uses rules; key never enters backup JSON

## Error / privacy

- Timeout default 12s  
- Never log full API key  
- Backup import/export unchanged (no key field)  
- LLM optional: app fully usable without key

## Testing

- Unit tests with mocked `fetch` for client + each capability parser  
- `evaluateAssist`: rules hit skips fetch; miss calls fetch; fetch fail keeps again  
- Component tests keep sync mock evaluate where possible; async path covered in lib tests  
- No live DeepSeek calls in CI

## Out of scope

- Multi-model routing  
- Server-held secrets  
- Chat / roleplay mode  
- Replacing seed vocabulary wholesale
