export const DEEPSEEK_MODEL = 'deepseek-v4-flash'
export const DEEPSEEK_API_BASE = '/api/deepseek'
export const DEEPSEEK_CHAT_PATH = '/v1/chat/completions'
/** Default chat timeout — network to DeepSeek can be slow from some regions. */
export const DEEPSEEK_TIMEOUT_MS = 30_000
/** Grading should not block recall feedback for long; fall back to rules on timeout. */
export const DEEPSEEK_GRADE_TIMEOUT_MS = 2_500
export const DEEPSEEK_ENRICH_TIMEOUT_MS = 45_000
export const DEEPSEEK_API_KEY_STORAGE = 'recall-english.deepseekApiKey'
