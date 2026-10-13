import { useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { DictionaryMeaning, DictionaryResult } from '../domain/types'
import { hasDeepseekApiKey } from '../lib/llm/config'
import type { EnrichCategory, EnrichmentDraft } from '../lib/llm/enrich'
import { inferCategoryFromDictionary } from '../lib/inferCategory'
import { categoryLabels } from '../lib/presentation'
import { splitListValues } from '../lib/text'
import { dictionarySenseKey, expressionKey, type DictionarySenseEdit } from '../lib/wordSenses'
import { parseVocabularyImport, VOCABULARY_ADD_GUIDE, type ImportCategory, type VocabularyImportRow, type VocabularyImportSummary } from '../lib/vocabularyImport'
import { speakWord } from '../lib/speech'
import { Icon } from './Icon'

export type AddCategory = EnrichCategory

export interface CustomItemDraft {
  expression: string
  zhGloss: string
  enDefinition: string
  partOfSpeech: string
  category: AddCategory
  scenarioNote?: string
  exampleEn: string
  exampleZh: string
  collocations: string[]
  ipaUk?: string
  ipaUs?: string
  audioUk?: string
  audioUs?: string
  source?: 'custom' | 'dictionary'
}

interface AddViewProps {
  onLookup: (query: string) => Promise<DictionaryResult>
  onAdd: (draft: CustomItemDraft) => Promise<{ ok: boolean; message: string }>
  onBulkAdd: (
    rows: VocabularyImportRow[],
    category: ImportCategory,
    onProgress?: (completed: number, total: number) => void,
  ) => Promise<VocabularyImportSummary>
  onEnrich?: (
    expression: string,
    category: AddCategory,
    existingDefinition?: string,
  ) => Promise<EnrichmentDraft>
  onSaveDictionary?: (result: DictionaryResult, selectedIndices: number[], category: AddCategory | 'auto',
    scenarioNote?: string, preserveExistingTraining?: boolean, edits?: DictionarySenseEdit[]) => Promise<{ ok: boolean; message: string }>
  onAddWorkVocabulary?: () => Promise<{ ok: boolean; message: string }>
}

const domainCategories: AddCategory[] = ['daily', 'business', 'finance', 'accounting', 'other']

function editableMeaningContent(meaning: DictionaryMeaning) {
  return JSON.stringify([meaning.zhGloss?.trim() ?? '', meaning.definition.trim(), meaning.partOfSpeech.trim(),
    meaning.example?.trim() ?? '', meaning.exampleZh?.trim() ?? '', meaning.collocations ?? []])
}

export function AddView({ onLookup, onAdd, onBulkAdd, onEnrich, onSaveDictionary, onAddWorkVocabulary }: AddViewProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [query, setQuery] = useState('')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [lookupMessage, setLookupMessage] = useState('')
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult | null>(null)
  const originalDictionaryResult = useRef<DictionaryResult | null>(null)
  const [selectedMeaning, setSelectedMeaning] = useState(0)
  const [trainingMeanings, setTrainingMeanings] = useState<number[]>([])
  const [expression, setExpression] = useState('')
  const [zhGloss, setZhGloss] = useState('')
  const [enDefinition, setEnDefinition] = useState('')
  const [partOfSpeech, setPartOfSpeech] = useState('expression')
  const [exampleEn, setExampleEn] = useState('')
  const [exampleZh, setExampleZh] = useState('')
  const [collocations, setCollocations] = useState('')
  const [category, setCategory] = useState<AddCategory | 'auto'>('auto')
  const [scenarioNote, setScenarioNote] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkCategory, setBulkCategory] = useState<ImportCategory>('auto')
  const [bulkProgress, setBulkProgress] = useState('')
  const [bulkSummary, setBulkSummary] = useState<VocabularyImportSummary | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [workMessage, setWorkMessage] = useState('')

  const selectedDictionaryMeaning: DictionaryMeaning | undefined = dictionaryResult?.meanings[selectedMeaning]
  const bulkParsed = useMemo(() => parseVocabularyImport(bulkText), [bulkText])
  const inferredCategory = inferCategoryFromDictionary(expression || query, `${enDefinition} ${zhGloss}`, partOfSpeech) ?? 'daily'

  function applyMeaning(result: DictionaryResult, index: number) {
    const meaning = result.meanings[index]
    if (!meaning) return
    setSelectedMeaning(index)
    setExpression(result.word)
    setEnDefinition(meaning.definition)
    setPartOfSpeech(meaning.partOfSpeech || 'expression')
    setExampleEn(meaning.example ?? '')
    setExampleZh(meaning.exampleZh ?? '')
    setZhGloss(meaning.zhGloss ?? '')
    setCollocations((meaning.collocations ?? []).join(', '))
  }

  function editedDictionaryResult(): DictionaryResult {
    return {
      ...dictionaryResult!,
      meanings: dictionaryResult!.meanings.map((meaning, index) => index !== selectedMeaning ? meaning : {
        ...meaning, senseKey: dictionarySenseKey(meaning), zhGloss: zhGloss.trim(), definition: enDefinition.trim(), partOfSpeech: partOfSpeech.trim(),
        example: exampleEn.trim() || undefined, exampleZh: exampleZh.trim() || undefined,
        collocations: splitListValues(collocations),
      }),
    }
  }

  function chooseMeaning(index: number) {
    const edited = editedDictionaryResult()
    setDictionaryResult(edited)
    applyMeaning(edited, index)
  }

  async function handleLookup() {
    const cleaned = query.trim()
    if (!cleaned) return
    setLookupState('loading')
    setLookupMessage('')
    setSaveMessage('')
    setExpression(cleaned)
    try {
      const result = await onLookup(cleaned)
      originalDictionaryResult.current = result
      setDictionaryResult(result)
      setLookupState('success')
      const firstBilingual = result.meanings.findIndex((meaning) => meaning.zhGloss?.trim())
      setTrainingMeanings(firstBilingual >= 0 ? [firstBilingual] : [])
      applyMeaning(result, Math.max(0, firstBilingual))
    } catch (error) {
      originalDictionaryResult.current = null
      setDictionaryResult(null)
      setLookupState('error')
      setLookupMessage(error instanceof Error ? error.message : '词典暂时不可用，请手动填写。')
    }
  }

  async function handleEnrich() {
    const cleaned = (expression || query).trim()
    if (!cleaned || !onEnrich) return
    if (!hasDeepseekApiKey()) {
      setSaveMessage('请先在设置中填写 DeepSeek API Key。')
      return
    }
    setEnriching(true)
    setSaveMessage('')
    try {
      const draft = await onEnrich(cleaned, category === 'auto' ? inferredCategory : category, enDefinition || undefined)
      const nextExpression = draft.expression || cleaned
      setQuery(nextExpression)
      setExpression(nextExpression)
      setCategory(draft.category)
      if (draft.category === 'other') {
        setScenarioNote(draft.scenarioNote?.trim() || scenarioNote)
      }
      if (!zhGloss.trim()) setZhGloss(draft.zhGloss)
      if (!enDefinition.trim()) setEnDefinition(draft.enDefinition)
      if (!partOfSpeech.trim() || partOfSpeech === 'expression') setPartOfSpeech(draft.partOfSpeech)
      if (!exampleEn.trim()) setExampleEn(draft.exampleEn)
      if (!exampleZh.trim()) setExampleZh(draft.exampleZh)
      if (!collocations.trim() && draft.collocations.length) setCollocations(draft.collocations.join(', '))
      setSaveMessage(
        draft.expression && draft.expression.toLocaleLowerCase('en-US') !== cleaned.toLocaleLowerCase('en-US')
          ? `已用 AI 补全，并纠正拼写为 “${draft.expression}”。请确认场景后再保存。`
          : '已用 AI 补全，并更新了使用场景。请确认后再保存。',
      )
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'AI 补全失败，请稍后重试。')
    } finally {
      setEnriching(false)
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    const cleaned = (expression || query).trim()
    const isDictionaryEntry = dictionaryResult && onSaveDictionary
      && expressionKey(expression) === expressionKey(dictionaryResult.word)
    if (!cleaned || (!zhGloss.trim() && isDictionaryEntry && trainingMeanings.includes(selectedMeaning))) {
      setSaveMessage('请填写英文表达；加入训练的义项需要明确的中文。')
      return
    }
    if (category === 'other' && !scenarioNote.trim()) {
      setSaveMessage('选择「其他」时，请填写自定义场景备注。')
      return
    }
    setSaving(true)
    setSaveMessage('')
    try {
      let result: { ok: boolean; message: string }
      if (!isDictionaryEntry && !zhGloss.trim() && onSaveDictionary) {
        const lookedUp = await onLookup(cleaned)
        if (!lookedUp.meanings.some((meaning) => meaning.zhGloss?.trim() || meaning.definition.trim())) throw new Error('词典未返回可保存的词义，请补充中文或稍后重试。')
        const first = lookedUp.meanings.findIndex((meaning) => meaning.zhGloss?.trim())
        result = await onSaveDictionary(lookedUp, first >= 0 ? [first] : [], category,
          category === 'other' ? scenarioNote.trim() : undefined, true)
      } else {
        if (!isDictionaryEntry && !zhGloss.trim()) throw new Error('请补充中文义项，或使用词典辅助。')
        const draft: CustomItemDraft = {
          expression: cleaned,
          zhGloss: zhGloss.trim(),
          enDefinition: enDefinition.trim(),
          partOfSpeech: partOfSpeech.trim() || 'expression',
          category: category === 'auto' ? inferredCategory : category,
          scenarioNote: category === 'other' ? scenarioNote.trim() : undefined,
          exampleEn: exampleEn.trim(),
          exampleZh: exampleZh.trim(),
          collocations: splitListValues(collocations),
          ipaUk: dictionaryResult?.ipaUk,
          ipaUs: dictionaryResult?.ipaUs,
          audioUk: dictionaryResult?.audioUk,
          audioUs: dictionaryResult?.audioUs,
          source: dictionaryResult ? 'dictionary' : 'custom',
        }
        if (isDictionaryEntry) {
          const edited = editedDictionaryResult()
          const edits = edited.meanings.flatMap((meaning, index): DictionarySenseEdit[] => {
            const original = originalDictionaryResult.current?.meanings[index]
            return original && editableMeaningContent(original) !== editableMeaningContent(meaning)
              ? [{ senseKey: dictionarySenseKey(meaning), original }] : []
          })
          result = edits.length
            ? await onSaveDictionary!(edited, trainingMeanings, category,
              category === 'other' ? scenarioNote.trim() : undefined, false, edits)
            : await onSaveDictionary!(edited, trainingMeanings, category,
              category === 'other' ? scenarioNote.trim() : undefined)
        } else result = await onAdd(draft)
      }
      setSaveMessage(result.message)
      if (result.ok) {
        setQuery('')
        setDictionaryResult(null)
        originalDictionaryResult.current = null
        setLookupState('idle')
        setExpression('')
        setZhGloss('')
        setEnDefinition('')
        setExampleEn('')
        setExampleZh('')
        setCollocations('')
        setScenarioNote('')
        setCategory('auto')
      }
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkSave() {
    if (!bulkParsed.rows.length) return
    setSaving(true)
    setSaveMessage('')
    setBulkSummary(null)
    setBulkProgress(`正在补全 0 / ${bulkParsed.rows.length}`)
    try {
      const result = await onBulkAdd(bulkParsed.rows, bulkCategory,
        (completed, total) => setBulkProgress(`正在补全 ${completed} / ${total}`))
      setBulkSummary(result)
      setSaveMessage(`已处理 ${result.added} 条新增内容，新增 ${result.sensesAdded} 个义项；跳过 ${result.skipped} 条重复内容，失败 ${result.failed.length} 条。${bulkParsed.errors.length ? '还有格式待修正，已保留整段输入及表头；再次添加会跳过已有义项。' : ''}`)
      const failedLines = result.failed.map(({ row }) => !row.zhGloss && !row.partOfSpeech && !row.category && !row.enDefinition && !row.exampleEn && !row.exampleZh ? row.expression
        : [row.expression, row.zhGloss, row.partOfSpeech ?? '', row.category ?? '', row.enDefinition ?? '', row.exampleEn ?? '', row.exampleZh ?? ''].map((field) => `"${field.replaceAll('"', '""')}"`).join(','))
      if (!bulkParsed.errors.length) setBulkText(failedLines.join('\n'))
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '批量保存失败，请重试。')
    } finally {
      setSaving(false)
      setBulkProgress('')
    }
  }

  async function copyGuide() {
    try { await navigator.clipboard.writeText(VOCABULARY_ADD_GUIDE); setCopyMessage('添加说明已复制。') }
    catch { setCopyMessage('无法自动复制，请选中下方说明手动复制。') }
  }

  async function addWorkVocabulary() {
    if (!onAddWorkVocabulary) return
    setSaving(true)
    setWorkMessage('')
    try { setWorkMessage((await onAddWorkVocabulary()).message) }
    catch (error) { setWorkMessage(error instanceof Error ? error.message : '工作词库加入失败，请重试。') }
    finally { setSaving(false) }
  }

  return (
    <div className="page-stack add-page">
      <section className="page-header split-header">
        <div>
          <p className="eyebrow">BUILD YOUR MEMORY</p>
          <h1>把今天遇到的词，变成明天能想起的表达。</h1>
          <p className="page-intro">一个词保存多个义项，勾选需要训练的意思；每个义项独立记录进度。</p>
        </div>
        <div className="segmented-control" aria-label="添加方式">
          <button className={mode === 'single' ? 'active' : ''} disabled={saving} onClick={() => { setMode('single'); setSaveMessage('') }} type="button">单条添加</button>
          <button className={mode === 'bulk' ? 'active' : ''} disabled={saving} onClick={() => { setMode('bulk'); setSaveMessage('') }} type="button">批量粘贴</button>
        </div>
      </section>

      <details className="panel vocabulary-add-guide">
        <summary>添加格式说明与示例</summary>
        <p>可以只提供英文，也可以从表格复制中英文及分类；每个义项独立保存。点击添加后自动补全，分类可在词库修正。</p>
        <button className="secondary-button" type="button" onClick={() => void copyGuide()}>复制添加说明</button>
        {copyMessage && <p role="status">{copyMessage}</p>}
        <pre>{VOCABULARY_ADD_GUIDE}</pre>
      </details>

      {onAddWorkVocabulary && <section className="panel add-work-vocabulary">
        <div><h2>共享充电宝商业化</h2><p>42 个工作表达：点位拓展、商户合作、设备运营、收入分成与结算。含定义及双语例句，分别归类，加入优先学习。</p></div>
        <button className="secondary-button" disabled={saving} onClick={() => void addWorkVocabulary()} type="button">加入 42 个工作表达</button>
        {workMessage && <p className="field-help" role="status">{workMessage}</p>}
      </section>}

      {mode === 'single' ? (
        <div className="add-layout">
          <section className="panel add-form-panel">
            <div className="lookup-block">
              <label htmlFor="dictionary-query">先查一个英文单词</label>
              <div className="lookup-row">
                <div className="input-with-icon">
                  <Icon name="search" size={19} />
                  <input
                    autoComplete="off"
                    disabled={saving}
                    id="dictionary-query"
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void handleLookup()
                      }
                    }}
                    placeholder="例如：reconcile"
                    value={query}
                  />
                </div>
                <button className="secondary-button" disabled={saving || !query.trim() || lookupState === 'loading'} onClick={() => void handleLookup()} type="button">
                  {lookupState === 'loading' ? '查询中…' : '词典辅助'}
                </button>
                <button
                  className="secondary-button"
                  disabled={saving || !(expression || query).trim() || enriching || !onEnrich}
                  onClick={() => void handleEnrich()}
                  type="button"
                >
                  {enriching ? 'AI 补全中…' : 'AI 补全'}
                </button>
              </div>
              <p className="field-help">词典辅助：补双语义项/例句与音标，并尽量推断使用场景。AI 补全：补中文义项、例句、搭配，并纠正拼写与场景。短语或离线时也可直接填表。</p>
              {lookupState === 'error' && <div className="inline-alert warning">{lookupMessage}</div>}
            </div>

            {dictionaryResult && dictionaryResult.meanings.length > 0 && (
              <div className="meaning-picker">
                <div className="meaning-picker-title">
                  <span>查看全部词义，勾选加入训练</span>
                  <div className="meaning-picker-meta">
                    {dictionaryResult.phonetic && <small>/{dictionaryResult.phonetic}/</small>}
                    <div className="accent-toggle" aria-label="发音">
                      <button
                        aria-label={`英式发音 ${dictionaryResult.word}`}
                        className="mini-text-button"
                        onClick={() => void speakWord({
                          expression: dictionaryResult.word,
                          audioUk: dictionaryResult.audioUk,
                          audioUs: dictionaryResult.audioUs,
                        }, 'uk')}
                        type="button"
                      >
                        UK
                      </button>
                      <button
                        aria-label={`美式发音 ${dictionaryResult.word}`}
                        className="mini-text-button"
                        onClick={() => void speakWord({
                          expression: dictionaryResult.word,
                          audioUk: dictionaryResult.audioUk,
                          audioUs: dictionaryResult.audioUs,
                        }, 'us')}
                        type="button"
                      >
                        US
                      </button>
                    </div>
                  </div>
                </div>
                <div className="meaning-options">
                  {dictionaryResult.meanings.map((meaning, index) => (
                    <div className="meaning-choice" key={dictionarySenseKey(meaning)}>
                    <button
                      disabled={saving}
                      className={selectedMeaning === index ? 'meaning-option selected' : 'meaning-option'}
                      onClick={() => chooseMeaning(index)}
                      type="button"
                    >
                      <span>{meaning.partOfSpeech}</span>
                      {meaning.zhGloss ? (
                        <>
                          <p className="meaning-zh">{meaning.zhGloss}</p>
                          {meaning.definition && <p className="meaning-en">{meaning.definition}</p>}
                        </>
                      ) : (
                        <p>{meaning.definition}</p>
                      )}
                      {selectedMeaning === index && <Icon name="check" size={17} />}
                    </button>
                    <label className="meaning-training">
                      <input type="checkbox" aria-label={`训练：${meaning.zhGloss || meaning.definition}`}
                        checked={trainingMeanings.includes(index)} disabled={saving || (!trainingMeanings.includes(index)
                          && !(index === selectedMeaning ? zhGloss.trim() : meaning.zhGloss?.trim()))}
                        onChange={(event) => setTrainingMeanings((current) => event.target.checked
                          ? [...current, index].sort((a, b) => a - b) : current.filter((value) => value !== index))} />
                      {meaning.zhGloss || (index === selectedMeaning && zhGloss.trim()) ? '加入训练' : '补充中文后可训练'}
                    </label>
                    </div>
                  ))}
                </div>
                <p className="field-help">点击词义可在下方编辑，修改会随全部词义一起保存。未勾选的新增义项默认暂停，已有义项保留状态；来源返回的词义不保证穷尽所有用法。</p>
              </div>
            )}

            <form className="word-form" onSubmit={(event) => void handleSave(event)}>
              <fieldset className="word-form-fields" disabled={saving}>
              <div className="form-grid two-columns">
                <label>
                  <span>英文表达 *</span>
                  <input onChange={(event) => setExpression(event.target.value)} placeholder="word or phrase" value={expression} />
                </label>
                <label>
                  <span>中文义项（可选）</span>
                  <input onChange={(event) => setZhGloss(event.target.value)} placeholder="只写这次要记的一个意思" value={zhGloss} />
                </label>
              </div>
              <div className="form-grid two-columns">
                <label>
                  <span>词性</span>
                  <input onChange={(event) => setPartOfSpeech(event.target.value)} placeholder="noun / verb / phrase" value={partOfSpeech} />
                </label>
                <label>
                  <span>使用场景</span>
                  <select onChange={(event) => setCategory(event.target.value as AddCategory | 'auto')} value={category}>
                    <option value="auto">自动识别（按义项归类）</option>
                    {domainCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
                  </select>
                </label>
              </div>
              <p className="field-help">只填英文也可直接添加并自动补全多个词义。自动分类以当前义项为依据，可手动指定或之后编辑修正。{category === 'auto' && zhGloss.trim() ? `当前义项参考分类：${categoryLabels[inferredCategory]}。` : ''}</p>
              {category === 'other' && (
                <label>
                  <span>其他场景备注 *</span>
                  <input
                    onChange={(event) => setScenarioNote(event.target.value)}
                    placeholder="例如：宿舍维修、社团活动、签证材料"
                    value={scenarioNote}
                  />
                </label>
              )}
              <label>
                <span>简短英文定义</span>
                <textarea onChange={(event) => setEnDefinition(event.target.value)} placeholder="Keep it short and clear." rows={2} value={enDefinition} />
              </label>
              <div className="form-grid two-columns">
                <label>
                  <span>英文例句</span>
                  <textarea onChange={(event) => setExampleEn(event.target.value)} placeholder={selectedDictionaryMeaning?.example ?? 'Where did you meet this expression?'} rows={3} value={exampleEn} />
                </label>
                <label>
                  <span>例句中文</span>
                  <textarea onChange={(event) => setExampleZh(event.target.value)} placeholder="用自己的话理解这个场景" rows={3} value={exampleZh} />
                </label>
              </div>
              <label>
                <span>常用搭配</span>
                <input onChange={(event) => setCollocations(event.target.value)} placeholder="用逗号分隔，例如 reconcile an account, reconcile differences" value={collocations} />
              </label>
              {saveMessage && <div className={saveMessage.startsWith('已') ? 'inline-alert success' : 'inline-alert'}>{saveMessage}</div>}
              <button className="primary-button form-submit" disabled={saving || lookupState === 'loading' || enriching} type="submit">
                <Icon name="plus" size={18} /> {saving ? '保存中…' : dictionaryResult && onSaveDictionary
                  && expressionKey(expression) === expressionKey(dictionaryResult.word) ? '保存全部词义与训练选择' : '加入我的记忆队列'}
              </button>
              </fieldset>
            </form>
          </section>

          <aside className="add-guidance">
            <div className="guidance-card dark">
              <span className="guidance-number">01</span>
              <h3>一个义项，一条记忆</h3>
              <p><em>equity</em> 的“权益”和“公平”归在同一个词条中，分别勾选、训练和记录进度。</p>
            </div>
            <div className="guidance-card">
              <span className="guidance-number">02</span>
              <h3>保留遇见它的场景</h3>
              <p>把课堂、邮件或真实对话中的句子带进来，比复制一整页字典更容易再次想起。</p>
            </div>
          </aside>
        </div>
      ) : (
        <section className="panel bulk-panel">
          <div className="bulk-copy">
            <p className="eyebrow">PASTE & GO</p>
            <h2>粘贴你的词库，逐条补全与归类</h2>
            <p>支持纯英文、Tab、CSV、竖线及英文后接中文；英文短语内的空格保留。自动保存多个义项，默认训练首个双语义项，或你提供的中文意思。</p>
          </div>
          <label>
            <span className="sr-only">批量词汇</span>
            <textarea
              className="bulk-textarea"
              disabled={saving}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={'power bank\nmerchant partnership | 商户合作\ncash flow\t现金流\nsettlement statement,结算对账单,noun,accounting'}
              rows={12}
              value={bulkText}
            />
          </label>
          <div className="bulk-footer">
            <label className="compact-select">
              <span>批量分类方式</span>
              <select disabled={saving} onChange={(event) => setBulkCategory(event.target.value as ImportCategory)} value={bulkCategory}>
                <option value="auto">自动识别（逐义项）</option>
                {domainCategories.filter((item) => item !== 'other').map((item) => <option key={item} value={item}>未指定分类时使用{categoryLabels[item]}</option>)}
              </select>
            </label>
            <span className="parsed-count">
              {bulkProgress || `识别到 ${bulkParsed.rows.length} 条内容，${bulkParsed.errors.length} 条格式待修正`}
            </span>
            <button className="primary-button" disabled={!bulkParsed.rows.length || saving} onClick={() => void handleBulkSave()} type="button">
              <Icon name="plus" size={18} /> {saving ? '补全并保存中…' : '补全并加入队列'}
            </button>
          </div>
          <p className="field-help">每行明确写出的分类优先。自动分类可在词库编辑修正；重复导入保留已有训练状态和进度。失败内容会保留在输入框。</p>
          {bulkParsed.rows.length > 0 && <ul className="bulk-preview" aria-label="批量内容预览">{bulkParsed.rows.slice(0, 5).map((row, index) => <li key={index}>
            <strong>{row.expression}</strong><span>{row.zhGloss || '自动补全词义'}</span><small>{row.category ? categoryLabels[row.category] : bulkCategory === 'auto' ? '逐义项自动归类' : categoryLabels[bulkCategory]}</small>
          </li>)}</ul>}
          {bulkParsed.errors.length > 0 && <div className="inline-alert warning" role="alert">{bulkParsed.errors.map((error) => <p key={error.line}>第 {error.line} 行：{error.message}</p>)}</div>}
          {saveMessage && <div className="inline-alert" role="status">{saveMessage}</div>}
          {bulkSummary && (bulkSummary.failed.length > 0 || bulkSummary.warnings.length > 0) && <div className="inline-alert warning">
            {bulkSummary.failed.map(({ row, message }, index) => <p key={`failed-${index}`}>{row.expression}：{message}</p>)}
            {bulkSummary.warnings.map((message, index) => <p key={`warning-${index}`}>{message}</p>)}
          </div>}
        </section>
      )}
    </div>
  )
}
