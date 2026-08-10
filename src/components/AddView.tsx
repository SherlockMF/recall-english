import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import type { DictionaryMeaning, DictionaryResult, SystemListSlug } from '../domain/types'
import { hasDeepseekApiKey } from '../lib/llm/config'
import type { EnrichmentDraft } from '../lib/llm/enrich'
import { categoryLabels } from '../lib/presentation'
import { Icon } from './Icon'

export interface CustomItemDraft {
  expression: string
  zhGloss: string
  enDefinition: string
  partOfSpeech: string
  category: SystemListSlug
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
    rows: { expression: string; zhGloss: string }[],
    category: SystemListSlug,
  ) => Promise<{ added: number; skipped: number }>
  onEnrich?: (
    expression: string,
    category: SystemListSlug,
    existingDefinition?: string,
  ) => Promise<EnrichmentDraft>
}

const domainCategories: SystemListSlug[] = ['daily', 'business', 'finance', 'accounting']

export function AddView({ onLookup, onAdd, onBulkAdd, onEnrich }: AddViewProps) {
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [query, setQuery] = useState('')
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [lookupMessage, setLookupMessage] = useState('')
  const [dictionaryResult, setDictionaryResult] = useState<DictionaryResult | null>(null)
  const [selectedMeaning, setSelectedMeaning] = useState(0)
  const [expression, setExpression] = useState('')
  const [zhGloss, setZhGloss] = useState('')
  const [enDefinition, setEnDefinition] = useState('')
  const [partOfSpeech, setPartOfSpeech] = useState('expression')
  const [exampleEn, setExampleEn] = useState('')
  const [exampleZh, setExampleZh] = useState('')
  const [collocations, setCollocations] = useState('')
  const [category, setCategory] = useState<SystemListSlug>('daily')
  const [saveMessage, setSaveMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [bulkText, setBulkText] = useState('')

  const selectedDictionaryMeaning: DictionaryMeaning | undefined = dictionaryResult?.meanings[selectedMeaning]
  const bulkRows = useMemo(() => parseBulkRows(bulkText), [bulkText])

  function applyMeaning(result: DictionaryResult, index: number) {
    const meaning = result.meanings[index]
    if (!meaning) return
    setSelectedMeaning(index)
    setExpression(result.word)
    setEnDefinition(meaning.definition)
    setPartOfSpeech(meaning.partOfSpeech || 'expression')
    setExampleEn(meaning.example ?? '')
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
      setDictionaryResult(result)
      setLookupState('success')
      applyMeaning(result, 0)
    } catch (error) {
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
      const draft = await onEnrich(cleaned, category, enDefinition || undefined)
      setExpression(cleaned)
      if (!zhGloss.trim()) setZhGloss(draft.zhGloss)
      if (!enDefinition.trim()) setEnDefinition(draft.enDefinition)
      if (!partOfSpeech.trim() || partOfSpeech === 'expression') setPartOfSpeech(draft.partOfSpeech)
      if (!exampleEn.trim()) setExampleEn(draft.exampleEn)
      if (!exampleZh.trim()) setExampleZh(draft.exampleZh)
      if (!collocations.trim() && draft.collocations.length) setCollocations(draft.collocations.join(', '))
      setSaveMessage('已用 AI 补全空字段，请确认后再保存。')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'AI 补全失败，请稍后重试。')
    } finally {
      setEnriching(false)
    }
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!expression.trim() || !zhGloss.trim()) {
      setSaveMessage('请至少填写英文表达和一个明确的中文义项。')
      return
    }
    setSaving(true)
    const result = await onAdd({
      expression: expression.trim(),
      zhGloss: zhGloss.trim(),
      enDefinition: enDefinition.trim(),
      partOfSpeech: partOfSpeech.trim() || 'expression',
      category,
      exampleEn: exampleEn.trim(),
      exampleZh: exampleZh.trim(),
      collocations: collocations.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean),
      ipaUk: dictionaryResult?.ipaUk,
      ipaUs: dictionaryResult?.ipaUs,
      audioUk: dictionaryResult?.audioUk,
      audioUs: dictionaryResult?.audioUs,
      source: dictionaryResult ? 'dictionary' : 'custom',
    })
    setSaving(false)
    setSaveMessage(result.message)
    if (result.ok) {
      setQuery('')
      setDictionaryResult(null)
      setLookupState('idle')
      setExpression('')
      setZhGloss('')
      setEnDefinition('')
      setExampleEn('')
      setExampleZh('')
      setCollocations('')
    }
  }

  async function handleBulkSave() {
    if (!bulkRows.length) return
    setSaving(true)
    const result = await onBulkAdd(bulkRows, category)
    setSaving(false)
    setSaveMessage(`已加入 ${result.added} 条，跳过 ${result.skipped} 条重复或无效内容。`)
    if (result.added) setBulkText('')
  }

  return (
    <div className="page-stack add-page">
      <section className="page-header split-header">
        <div>
          <p className="eyebrow">BUILD YOUR MEMORY</p>
          <h1>把今天遇到的词，变成明天能想起的表达。</h1>
          <p className="page-intro">一个词只记一个具体意思。词典帮你补充资料，中文义项由你最后确认。</p>
        </div>
        <div className="segmented-control" aria-label="添加方式">
          <button className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')} type="button">单条添加</button>
          <button className={mode === 'bulk' ? 'active' : ''} onClick={() => setMode('bulk')} type="button">批量粘贴</button>
        </div>
      </section>

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
                <button className="secondary-button" disabled={!query.trim() || lookupState === 'loading'} onClick={() => void handleLookup()} type="button">
                  {lookupState === 'loading' ? '查询中…' : '词典辅助'}
                </button>
                <button
                  className="secondary-button"
                  disabled={!(expression || query).trim() || enriching || !onEnrich}
                  onClick={() => void handleEnrich()}
                  type="button"
                >
                  {enriching ? 'AI 补全中…' : 'AI 补全'}
                </button>
              </div>
              <p className="field-help">短语或离线时可以直接填写下面的表单，不会阻止保存。</p>
              {lookupState === 'error' && <div className="inline-alert warning">{lookupMessage}</div>}
            </div>

            {dictionaryResult && dictionaryResult.meanings.length > 0 && (
              <div className="meaning-picker">
                <div className="meaning-picker-title">
                  <span>选择这次要学的具体义项</span>
                  {dictionaryResult.phonetic && <small>/{dictionaryResult.phonetic}/</small>}
                </div>
                <div className="meaning-options">
                  {dictionaryResult.meanings.slice(0, 6).map((meaning, index) => (
                    <button
                      className={selectedMeaning === index ? 'meaning-option selected' : 'meaning-option'}
                      key={`${meaning.partOfSpeech}-${meaning.definition}-${index}`}
                      onClick={() => applyMeaning(dictionaryResult, index)}
                      type="button"
                    >
                      <span>{meaning.partOfSpeech}</span>
                      <p>{meaning.definition}</p>
                      {selectedMeaning === index && <Icon name="check" size={17} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <form className="word-form" onSubmit={(event) => void handleSave(event)}>
              <div className="form-grid two-columns">
                <label>
                  <span>英文表达 *</span>
                  <input onChange={(event) => setExpression(event.target.value)} placeholder="word or phrase" value={expression} />
                </label>
                <label>
                  <span>中文义项 *</span>
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
                  <select onChange={(event) => setCategory(event.target.value as SystemListSlug)} value={category}>
                    {domainCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
                  </select>
                </label>
              </div>
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
              <button className="primary-button form-submit" disabled={saving} type="submit">
                <Icon name="plus" size={18} /> {saving ? '保存中…' : '加入我的记忆队列'}
              </button>
            </form>
          </section>

          <aside className="add-guidance">
            <div className="guidance-card dark">
              <span className="guidance-number">01</span>
              <h3>一个义项，一条记忆</h3>
              <p><em>equity</em> 的“权益”和“公平”需要分开添加，系统才知道你到底忘了哪个意思。</p>
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
            <h2>每行一个表达，用 Tab 隔开中英文</h2>
            <p>例：<code>cash flow&#9;现金流</code>。批量项目会先训练双向回忆，之后可以在词库中补充例句。</p>
          </div>
          <label>
            <span className="sr-only">批量词汇</span>
            <textarea
              className="bulk-textarea"
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={'cash flow\t现金流\nmeet a deadline\t按时完成\nreconcile an account\t核对账户'}
              rows={12}
              value={bulkText}
            />
          </label>
          <div className="bulk-footer">
            <label className="compact-select">
              <span>统一归类</span>
              <select onChange={(event) => setCategory(event.target.value as SystemListSlug)} value={category}>
                {domainCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
              </select>
            </label>
            <span className="parsed-count">识别到 {bulkRows.length} 条有效内容</span>
            <button className="primary-button" disabled={!bulkRows.length || saving} onClick={() => void handleBulkSave()} type="button">
              <Icon name="plus" size={18} /> 加入队列
            </button>
          </div>
          {saveMessage && <div className="inline-alert success">{saveMessage}</div>}
        </section>
      )}
    </div>
  )
}

function parseBulkRows(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => {
      const [expression, ...meaningParts] = line.split('\t')
      return { expression: expression?.trim() ?? '', zhGloss: meaningParts.join(' ').trim() }
    })
    .filter((row) => row.expression && row.zhGloss)
}
