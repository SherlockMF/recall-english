# DeepSeek Assist Implementation Plan

> **For agentic workers:** Implement task-by-task with TDD. Steps use checkbox syntax.

**Goal:** Ship five optional DeepSeek V4 Flash assists (grade, usage gen, hints, enrich, feedback) behind a shared browser client with rule fallback.

**Architecture:** Shared `src/lib/llm/*` modules; Vite proxies `/api/deepseek` to DeepSeek; API key in `localStorage`; `evaluateAssist` wraps `gradeAttempt` then optional LLM; UI wires Settings / Study / Add.

**Tech Stack:** React 19, Vite 8, Vitest, `fetch`, DeepSeek OpenAI-compatible Chat Completions (`deepseek-v4-flash`).

## Global Constraints

- Model id exactly `deepseek-v4-flash`
- Thinking disabled: `thinking: { type: "disabled" }`
- `response_format: { type: "json_object" }`
- API key never in backup / IndexedDB
- No key or LLM errors must not block study
- Prefer existing patterns in `grading.ts`, `dictionary.ts`, Settings/Add/Study

## File map

| File | Responsibility |
|---|---|
| `vite.config.ts` | Proxy `/api/deepseek` → `https://api.deepseek.com` |
| `src/lib/llm/constants.ts` | Base path, model, timeouts |
| `src/lib/llm/config.ts` | localStorage get/set/clear key |
| `src/lib/llm/client.ts` | `chatJson` |
| `src/lib/llm/gradeAssist.ts` | Semantic grade + feedback JSON |
| `src/lib/llm/hints.ts` | Hint text JSON |
| `src/lib/llm/enrich.ts` | Enrichment draft JSON |
| `src/lib/llm/usageGenerate.ts` | UsagePrompt[] JSON |
| `src/lib/llm/evaluateAssist.ts` | Rules-first orchestration |
| `src/components/SettingsDialog.tsx` | Key UI |
| `src/components/StudySession.tsx` | Async evaluate, AI hint, feedback copy, usage ensure |
| `src/components/AddView.tsx` | AI enrich button |
| `src/App.tsx` | Wire evaluateAssist, ensureUsage, persist enriched words |
| `*.test.ts` | Mocked fetch coverage |

---

### Task 1: Config + client + Vite proxy

**Files:**
- Create: `src/lib/llm/constants.ts`, `config.ts`, `client.ts`
- Create: `src/lib/llm/config.test.ts`, `client.test.ts`
- Modify: `vite.config.ts`, `.gitignore` (add `.env*`, `.superpowers/`)

**Produces:**
- `getDeepseekApiKey(): string`
- `setDeepseekApiKey(key: string): void`
- `clearDeepseekApiKey(): void`
- `chatJson(args): Promise<unknown>`

- [ ] **Step 1:** Write failing tests for config storage and `chatJson` success/error/timeout parsing
- [ ] **Step 2:** Run tests — expect fail
- [ ] **Step 3:** Implement constants, config, client; add Vite proxy
- [ ] **Step 4:** Run tests — expect pass

### Task 2: gradeAssist + evaluateAssist (+ feedback)

**Files:**
- Create: `src/lib/llm/gradeAssist.ts`, `evaluateAssist.ts` + tests

**Produces:**
- `gradeWithLlm(...): Promise<{ rating, correct, feedbackZh, source: 'llm' }>`
- `evaluateAssist(...): Promise<EvaluationResult & { feedbackZh?: string; source: 'rules' | 'llm' | 'reveal' }>`

- [ ] **Step 1:** Failing tests — rules hit skips fetch; miss calls LLM; LLM fail keeps again
- [ ] **Step 2:** Implement
- [ ] **Step 3:** Tests pass

### Task 3: hints + enrich + usageGenerate

**Files:**
- Create: `hints.ts`, `enrich.ts`, `usageGenerate.ts` + tests

**Produces:**
- `hintWithLlm(...): Promise<string>`
- `enrichWithLlm(...): Promise<EnrichmentDraft>`
- `generateUsagePromptsWithLlm(...): Promise<UsagePrompt[]>`

- [ ] **Step 1:** Failing parser/contract tests with mocked fetch
- [ ] **Step 2:** Implement prompts + parsers with local fallbacks where needed
- [ ] **Step 3:** Tests pass

### Task 4: Settings + Study + Add wiring

**Files:**
- Modify: `SettingsDialog.tsx`, `StudySession.tsx`, `AddView.tsx`, `App.tsx`, styles as needed
- Update tests that break from async `evaluate`

- [ ] **Step 1:** Settings key field
- [ ] **Step 2:** StudySession async evaluate + loading + feedbackZh + AI hint fallback + ensureUsage hook
- [ ] **Step 3:** AddView enrich button
- [ ] **Step 4:** App wires functions; `npm test` + `npm run build`

---

## Spec self-review notes

- No TBD left; grading trigger = rule incorrect only (not vague “uncertain”)
- Feedback folded into grade LLM call (capability 5) to avoid double latency
- Proxy addresses CORS while keeping user-held key (decision A)
