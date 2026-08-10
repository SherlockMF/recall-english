import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  HintLevel,
  LearningTrack,
  ReviewRating,
  SessionSummary,
  SessionTask,
  VocabularyItem,
} from '../domain/types'
import { expressionHint, trackLabels } from '../lib/presentation'
import { speakWord } from '../lib/speech'
import { Icon } from './Icon'

export interface EvaluationResult {
  rating: ReviewRating
  matched: boolean
  message?: string
  feedbackZh?: string
}

interface StudySessionProps {
  mode: 'core' | 'extension'
  initialTasks: SessionTask[]
  items: VocabularyItem[]
  tracks: LearningTrack[]
  usableThisWeek: number
  evaluate: (
    task: SessionTask,
    item: VocabularyItem,
    answer: string,
    hintLevel: HintLevel,
    revealed: boolean,
    responseMs: number,
  ) => EvaluationResult | Promise<EvaluationResult>
  resolveHint?: (
    task: SessionTask,
    item: VocabularyItem,
    hintLevel: HintLevel,
  ) => Promise<string>
  ensureUsageItem?: (item: VocabularyItem) => Promise<VocabularyItem>
  onRate: (
    task: SessionTask,
    rating: ReviewRating,
    detail: {
      answer: string
      hintLevel: HintLevel
      responseMs: number
      promptType: string
      wasOverride: boolean
    },
  ) => Promise<void>
  onExit: () => void
  onFinish: (summary: SessionSummary) => void
}

export function StudySession({
  mode,
  initialTasks,
  items,
  tracks,
  usableThisWeek,
  evaluate,
  resolveHint,
  ensureUsageItem,
  onRate,
  onExit,
  onFinish,
}: StudySessionProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [hintLevel, setHintLevel] = useState<HintLevel>(0)
  const [hintText, setHintText] = useState('')
  const [phase, setPhase] = useState<'question' | 'feedback' | 'complete'>(initialTasks.length ? 'question' : 'complete')
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [correction, setCorrection] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [grading, setGrading] = useState(false)
  const [hinting, setHinting] = useState(false)
  const [ensuringUsage, setEnsuringUsage] = useState(false)
  const [itemOverrides, setItemOverrides] = useState<Record<string, VocabularyItem>>({})
  const [summary, setSummary] = useState<SessionSummary>({
    total: 0,
    noHintGood: 0,
    again: 0,
    usageCompleted: 0,
    usableThisWeek,
  })
  const [failedWords, setFailedWords] = useState<string[]>([])
  const startedAt = useRef(Date.now())
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const finishCalled = useRef(false)

  const task = tasks[index]
  const item = useMemo(() => {
    if (!task) return undefined
    return itemOverrides[task.itemId] ?? items.find((candidate) => candidate.id === task.itemId)
  }, [itemOverrides, items, task])
  const track = useMemo(() => tracks.find((candidate) => candidate.id === task?.trackId), [tracks, task?.trackId])
  const usagePrompt = item?.usagePrompts[task?.promptIndex ?? 0]
  const isSentence = task?.trackType === 'usage' && usagePrompt?.type === 'sentence'
  const needsCorrection = phase === 'feedback'
    && evaluation?.rating === 'again'
    && !isSentence
    && task?.trackType !== 'receptive'
  const correctionTarget = task?.trackType === 'usage' && usagePrompt?.answer
    ? usagePrompt.answer
    : item?.expression ?? ''
  const correctionComplete = !needsCorrection || answerMatches(correction, correctionTarget, item?.acceptedEnVariants ?? [])

  useEffect(() => {
    startedAt.current = Date.now()
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80)
    return () => window.clearTimeout(timer)
  }, [index, phase])

  useEffect(() => {
    if (phase === 'complete' && !finishCalled.current) {
      finishCalled.current = true
      onFinish(summary)
    }
  }, [onFinish, phase, summary])

  useEffect(() => {
    if (!task || !item || task.trackType !== 'usage' || !ensureUsageItem) return
    if (item.usagePrompts.length >= 2) return
    let cancelled = false
    setEnsuringUsage(true)
    void ensureUsageItem(item)
      .then((updated) => {
        if (!cancelled) {
          setItemOverrides((current) => ({ ...current, [updated.id]: updated }))
        }
      })
      .finally(() => {
        if (!cancelled) setEnsuringUsage(false)
      })
    return () => { cancelled = true }
  }, [ensureUsageItem, item, task])

  async function showForgottenAnswer() {
    if (!item || !task || grading) return
    setGrading(true)
    const result = await evaluate(task, item, '', 3, true, Math.max(0, Date.now() - startedAt.current))
    setHintLevel(3)
    setRevealed(true)
    setEvaluation({ ...result, rating: 'again', matched: false })
    setPhase('feedback')
    setGrading(false)
    void speakWord(item, 'uk')
  }

  async function submitAnswer() {
    if (!task || !item || !answer.trim() || grading) return
    setGrading(true)
    const result = await evaluate(
      task,
      item,
      answer,
      hintLevel,
      false,
      Math.max(0, Date.now() - startedAt.current),
    )
    setEvaluation(result)
    setPhase('feedback')
    setGrading(false)
    void speakWord(item, 'uk')
  }

  async function requestHint() {
    if (!task || !item || hintLevel >= 2 || hinting) return
    const nextLevel = Math.min(2, hintLevel + 1) as HintLevel
    setHinting(true)
    let text = buildHint(task, item, nextLevel, usagePrompt)
    if (resolveHint) {
      try {
        text = await resolveHint(task, item, nextLevel)
      } catch {
        // keep local hint
      }
    }
    setHintLevel(nextLevel)
    setHintText(text)
    setHinting(false)
  }

  async function chooseRating(selected: ReviewRating) {
    if (!task || !item || !evaluation || !correctionComplete || saving) return
    let rating = selected
    if (revealed) rating = 'again'
    else if (hintLevel > 0 && rating === 'good') rating = 'hard'
    else if (needsCorrection && rating === 'good') rating = 'hard'

    setSaving(true)
    setSaveError(null)
    try {
      await onRate(task, rating, {
        answer,
        hintLevel,
        responseMs: Math.max(0, Date.now() - startedAt.current),
        promptType: task.trackType === 'usage' ? usagePrompt?.type ?? 'usage' : task.trackType,
        wasOverride: rating !== evaluation.rating,
      })
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : '保存复习结果失败，请重试')
      return
    } finally {
      setSaving(false)
    }

    const nextSummary: SessionSummary = {
      ...summary,
      total: summary.total + 1,
      noHintGood: summary.noHintGood + (rating === 'good' && hintLevel === 0 ? 1 : 0),
      again: summary.again + (rating === 'again' ? 1 : 0),
      usageCompleted: summary.usageCompleted + (task.trackType === 'usage' && rating !== 'again' ? 1 : 0),
    }
    setSummary(nextSummary)
    if (rating === 'again') {
      setFailedWords((words) => words.includes(item.expression) ? words : [...words, item.expression])
    }

    let nextTasks = tasks
    if (rating === 'again' && (task.retryCount ?? 0) < 2) {
      const retry: SessionTask = {
        ...task,
        id: `${task.id}-retry-${(task.retryCount ?? 0) + 1}`,
        isNew: false,
        retryCount: (task.retryCount ?? 0) + 1,
      }
      nextTasks = [...tasks]
      const insertionIndex = Math.min(nextTasks.length, index + 4)
      nextTasks.splice(insertionIndex, 0, retry)
      setTasks(nextTasks)
    }

    if (index + 1 >= nextTasks.length) {
      setPhase('complete')
      return
    }
    setIndex((value) => value + 1)
    setAnswer('')
    setCorrection('')
    setHintLevel(0)
    setHintText('')
    setRevealed(false)
    setEvaluation(null)
    setPhase('question')
  }

  if (phase === 'complete') {
    const recallRate = summary.total ? Math.round((summary.noHintGood / summary.total) * 100) : 0
    return (
      <div className="study-overlay complete-overlay">
        <div className="completion-card">
          <div className="completion-mark"><Icon name="check" size={31} /></div>
          <p className="eyebrow">SESSION COMPLETE</p>
          <h1>{summary.total ? '今天的记忆已经重新连上。' : '现在没有需要完成的训练。'}</h1>
          <p>{summary.total ? '真正困难的内容已经安排在更合适的时间再次出现。' : '稍后再来，或先添加一个你想记住的表达。'}</p>
          <div className="completion-stats">
            <div><strong>{recallRate}%</strong><span>无提示想起</span></div>
            <div><strong>{failedWords.length}</strong><span>需要再练</span></div>
            <div><strong>{summary.usageCompleted}</strong><span>完成使用题</span></div>
          </div>
          {failedWords.length > 0 && (
            <div className="failed-word-strip">
              <span>很快会再出现</span>
              <div>{failedWords.slice(0, 5).map((word) => <em key={word}>{word}</em>)}</div>
            </div>
          )}
          <div className="completion-weekly">
            <Icon name="spark" size={18} /> 本周已有 {summary.usableThisWeek} 个表达进入“会使用”阶段
          </div>
          <button className="primary-button large" onClick={onExit} type="button">回到今天</button>
        </div>
      </div>
    )
  }

  if (!task || !item || !track) return null

  const progress = Math.round((index / Math.max(1, tasks.length)) * 100)
  const prompt = buildPrompt(task, item, usagePrompt)

  return (
    <div className="study-overlay">
      <header className="study-header">
        <button aria-label="退出训练" className="icon-button" onClick={onExit} type="button"><Icon name="close" size={20} /></button>
        <div className="study-progress-wrap">
          <div className="study-progress-copy"><span>{mode === 'core' ? '核心训练' : '加练时间'}</span><span>{index + 1} / {tasks.length}</span></div>
          <div className="study-progress"><span style={{ width: `${progress}%` }} /></div>
        </div>
        <span className="study-time"><Icon name="clock" size={17} /> {mode === 'core' ? '15 min' : '+15 min'}</span>
      </header>

      <main className="study-main">
        <section className={phase === 'feedback' ? 'recall-card feedback' : 'recall-card'} aria-live="polite">
          {phase === 'question' ? (
            <>
              <div className="recall-card-meta">
                <span className={`direction-chip ${task.trackType}`}>{trackLabels[task.trackType]}</span>
                <span>{prompt.direction}</span>
              </div>
              <div className="prompt-block">
                <p className="prompt-instruction">{prompt.instruction}</p>
                <h1>{prompt.title}</h1>
                {prompt.context && <p className="prompt-context">{prompt.context}</p>}
                {task.trackType === 'receptive' && (item.ipaUk || item.ipaUs) && (
                  <span className="prompt-phonetic">/{item.ipaUk || item.ipaUs}/ · {item.partOfSpeech}</span>
                )}
              </div>

              {ensuringUsage && task.trackType === 'usage' && (
                <p className="field-help">正在生成使用题…</p>
              )}

              {hintLevel > 0 && (
                <div className="hint-box">
                  <span>提示 {hintLevel}/2</span>
                  <p>{hintText || buildHint(task, item, hintLevel, usagePrompt)}</p>
                </div>
              )}

              <div className="answer-area">
                <label htmlFor="recall-answer">{prompt.answerLabel}</label>
                {isSentence ? (
                  <textarea
                    id="recall-answer"
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') submitAnswer()
                    }}
                    placeholder={prompt.placeholder}
                    ref={(node) => { inputRef.current = node }}
                    rows={4}
                    value={answer}
                  />
                ) : (
                  <input
                    autoComplete="off"
                    id="recall-answer"
                    onChange={(event) => setAnswer(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') submitAnswer() }}
                    placeholder={prompt.placeholder}
                    ref={(node) => { inputRef.current = node }}
                    value={answer}
                  />
                )}
              </div>

              <div className="recall-actions">
                <div>
                  <button className="hint-button" disabled={hintLevel >= 2 || hinting || grading} onClick={() => void requestHint()} type="button">
                    <Icon name="spark" size={17} /> {hinting ? '生成提示…' : hintLevel ? '再给一点提示' : '给一点提示'}
                  </button>
                  <button className="forgot-button" disabled={grading} onClick={() => void showForgottenAnswer()} type="button">想不起来</button>
                </div>
                <button className="primary-button" disabled={!answer.trim() || grading} onClick={() => void submitAnswer()} type="button">
                  {grading ? '判分中…' : '提交回忆'} <Icon name="arrow" size={18} />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="feedback-topline">
                <span className={`feedback-signal ${evaluation?.rating}`}>
                  <Icon name={evaluation?.rating === 'good' ? 'check' : evaluation?.rating === 'hard' ? 'refresh' : 'brain'} size={18} />
                  {evaluation?.rating === 'good' ? '无提示想起来了' : evaluation?.rating === 'hard' ? '接近了，再加固一次' : '现在忘记很正常'}
                </span>
                <button aria-label={`播放 ${item.expression}`} className="audio-button" onClick={() => void speakWord(item, 'uk')} type="button"><Icon name="volume" size={19} /> 再听一次</button>
              </div>

              <div className="answer-reveal">
                <span>目标表达</span>
                <h1>{item.expression}</h1>
                {(item.ipaUk || item.ipaUs) && <p>/{item.ipaUk || item.ipaUs}/ · {item.partOfSpeech}</p>}
                <strong>{item.zhGloss}</strong>
                {item.enDefinition && <p className="reveal-definition">{item.enDefinition}</p>}
              </div>

              {answer && <div className="your-answer"><span>你的回答</span><p>{answer}</p></div>}

              {evaluation?.feedbackZh && (
                <div className="ai-feedback">
                  <span>AI 反馈</span>
                  <p>{evaluation.feedbackZh}</p>
                </div>
              )}

              {isSentence && usagePrompt ? (
                <div className="model-answer">
                  <span>自然范例</span>
                  <p>{usagePrompt.modelAnswer}</p>
                  <ul>{usagePrompt.checkpoints.map((checkpoint) => <li key={checkpoint}><Icon name="check" size={15} /> {checkpoint}</li>)}</ul>
                </div>
              ) : (
                <div className="context-reveal">
                  <div>
                    <span>IN CONTEXT</span>
                    <p>{item.examples[(track.reps + index) % Math.max(1, item.examples.length)]?.en ?? '还没有例句，可以稍后在词库中补充。'}</p>
                    {item.examples[(track.reps + index) % Math.max(1, item.examples.length)]?.zh && <small>{item.examples[(track.reps + index) % item.examples.length].zh}</small>}
                  </div>
                  {item.collocations.length > 0 && <div className="collocation-list">{item.collocations.slice(0, 3).map((value) => <em key={value}>{value}</em>)}</div>}
                </div>
              )}

              {needsCorrection && (
                <label className="correction-field">
                  <span>看完答案后，再正确输入一次</span>
                  <input autoComplete="off" onChange={(event) => setCorrection(event.target.value)} placeholder={expressionHint(correctionTarget, 1)} value={correction} />
                  {correction && !correctionComplete && <small>还差一点，注意完整拼写。</small>}
                  {correctionComplete && <small className="corrected"><Icon name="check" size={14} /> 已正确输入</small>}
                </label>
              )}

              {task.trackType === 'receptive' && evaluation?.rating === 'again' && !revealed && (
                <p className="override-note">中文表达可能不同。如果意思确实相同，可以在下面改为“想起来了”。</p>
              )}

              <div className="rating-block">
                <p>这次实际想起到什么程度？</p>
                <div className="rating-buttons">
                  <button className={evaluation?.rating === 'again' ? 'rating-button again recommended' : 'rating-button again'} disabled={!correctionComplete || saving} onClick={() => void chooseRating('again')} type="button">
                    <strong>忘记了</strong><span>很快再练</span>
                  </button>
                  <button className={evaluation?.rating === 'hard' ? 'rating-button hard recommended' : 'rating-button hard'} disabled={revealed || !correctionComplete || saving} onClick={() => void chooseRating('hard')} type="button">
                    <strong>有点模糊</strong><span>缩短间隔</span>
                  </button>
                  <button className={evaluation?.rating === 'good' ? 'rating-button good recommended' : 'rating-button good'} disabled={revealed || hintLevel > 0 || needsCorrection || saving} onClick={() => void chooseRating('good')} type="button">
                    <strong>想起来了</strong><span>正常间隔</span>
                  </button>
                </div>
                {saveError && <p className="save-error" role="alert">{saveError}</p>}
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

function buildPrompt(task: SessionTask, item: VocabularyItem, usagePrompt?: VocabularyItem['usagePrompts'][number]) {
  if (task.trackType === 'receptive') {
    return {
      direction: 'English → 中文',
      instruction: '不要翻译整句，先从记忆里找出这个具体意思。',
      title: item.expression,
      context: '',
      answerLabel: '你记得的中文意思',
      placeholder: '用自己的中文表达即可',
    }
  }
  if (task.trackType === 'productive') {
    return {
      direction: '中文 / 场景 → English',
      instruction: '不看选项，从中文意思主动写出英文。',
      title: item.zhGloss,
      context: item.examples[0]?.zh ?? '',
      answerLabel: '完整英文表达',
      placeholder: 'Type the expression from memory',
    }
  }
  return {
    direction: usagePrompt?.type === 'sentence' ? '场景 → 自己造句' : '语境 → 填入表达',
    instruction: usagePrompt?.type === 'sentence'
      ? '写一个能在真实生活中直接说出口的句子。'
      : '根据完整语境，从记忆里填入最自然的表达。',
    title: usagePrompt?.prompt ?? `用 ${item.expression} 写一句话`,
    context: '',
    answerLabel: usagePrompt?.type === 'sentence' ? '你的句子' : '缺少的英文表达',
    placeholder: usagePrompt?.type === 'sentence' ? `Use “${item.expression}” in your sentence` : 'Type the missing expression',
  }
}

function buildHint(
  task: SessionTask,
  item: VocabularyItem,
  level: HintLevel,
  usagePrompt?: VocabularyItem['usagePrompts'][number],
) {
  if (task.trackType === 'receptive') {
    if (level === 1) return `${item.partOfSpeech} · ${item.enDefinition}`
    return item.examples[0]?.en ?? '想想你第一次遇见它的场景。'
  }
  if (level === 1) return expressionHint(item.expression, 1)
  if (task.trackType === 'usage' && usagePrompt?.modelAnswer) {
    return usagePrompt.modelAnswer.replace(new RegExp(escapeRegExp(item.expression), 'gi'), '_____')
  }
  return item.examples[0]?.en.replace(new RegExp(escapeRegExp(item.expression), 'gi'), '_____')
    ?? expressionHint(item.expression, 2)
}

function normalize(value: string) {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function answerMatches(value: string, target: string, alternatives: string[]) {
  const candidate = normalize(value)
  return [target, ...alternatives].some((answer) => normalize(answer) === candidate)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
