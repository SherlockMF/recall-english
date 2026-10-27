import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { VocabularyItem } from '../domain/types'
import type { LearningEvidence } from '../lib/learningEvidence'
import type { WordEntry } from '../lib/wordSenses'
import { categoryLabels, recallContext } from '../lib/presentation'
import { getVocabularyDifficulty } from '../lib/studyDifficulty'
import { speakExample, speakWord } from '../lib/speech'
import { useEscapeToClose } from '../lib/useEscapeToClose'
import { useFocusTrap } from '../lib/useFocusTrap'
import { Icon } from './Icon'
import { LearningEvidenceDetails } from './LearningEvidenceDetails'

interface WordEntryDialogProps {
  onRequestLogin?: () => void
  entry: WordEntry
  item: VocabularyItem
  evidenceByItemId: ReadonlyMap<string, LearningEvidence>
  onSelectSense: (id: string) => void
  onClose: () => void
  onEdit: (item: VocabularyItem) => void
  onToggleStatus: (item: VocabularyItem) => Promise<void>
  onToggleKnown: (item: VocabularyItem) => Promise<void>
  onAddToMyVocabulary: (item: VocabularyItem) => Promise<{ ok: boolean; message: string }>
  onRemoveFromMyVocabulary: (item: VocabularyItem) => Promise<{ ok: boolean; message: string }>
  onCompleteSenses?: (item: VocabularyItem) => Promise<{ message: string }>
}

export function WordEntryDialog({ entry, item, evidenceByItemId, onSelectSense, onClose, onEdit,
  onToggleStatus, onToggleKnown, onAddToMyVocabulary, onRemoveFromMyVocabulary, onCompleteSenses, onRequestLogin }: WordEntryDialogProps) {
  const dialogRef = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ itemId: string; message: string; error: boolean } | null>(null)
  const evidence = evidenceByItemId.get(item.id)
  const difficulty = getVocabularyDifficulty(item)
  const inMyVocabulary = item.listSlugs.includes('my-vocabulary')
  const actionLabel = entry.senses.length > 1 ? `${item.expression}：${item.zhGloss || item.enDefinition}` : item.expression
  const example = item.examples.find((value) => value.en.trim())
  const currentFeedback = feedback?.itemId === item.id ? feedback : null

  useEscapeToClose(onClose)
  useFocusTrap(dialogRef)
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  async function perform(action: string, operation: () => Promise<{ message: string; ok?: boolean } | void>) {
    if (onRequestLogin) { onRequestLogin(); return }
    setBusy(action)
    setFeedback(null)
    try {
      const result = await operation()
      if (result?.message) setFeedback({ itemId: item.id, message: result.message, error: result.ok === false })
    } catch (error) {
      setFeedback({ itemId: item.id, message: error instanceof Error ? error.message : '操作失败，请重试。', error: true })
    } finally { setBusy(null) }
  }

  return createPortal(
    <div className="dialog-backdrop word-detail-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section ref={dialogRef} className="dialog-card word-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="word-detail-title">
        <header className="word-detail-heading">
          <div><h2 id="word-detail-title">{entry.expression}</h2><p>{item.ipaUk || item.ipaUs ? `/${item.ipaUk || item.ipaUs}/ · ` : ''}{entry.senses.length} 个义项</p></div>
          <div className="word-detail-heading-actions">
            <button className="mini-text-button" aria-label={`英式发音 ${entry.expression}`} type="button" onClick={() => void perform('speech', () => speakWord(item, 'uk'))} disabled={busy !== null}>UK</button>
            <button className="mini-text-button" aria-label={`美式发音 ${entry.expression}`} type="button" onClick={() => void perform('speech', () => speakWord(item, 'us'))} disabled={busy !== null}>US</button>
            <button className="icon-button" aria-label="关闭词条详情" onClick={onClose} type="button"><Icon name="close" size={20} /></button>
          </div>
        </header>
        <div className="word-detail-body">
          <nav className="word-detail-senses" aria-label={`${entry.expression} 的全部义项`}>
            <span className="word-detail-nav-label">词义</span>
            {entry.senses.map((sense, index) => (
              <button key={sense.id} type="button" aria-label={`选择义项 ${index + 1}：${sense.zhGloss || sense.enDefinition || '待补充词义'}`}
                aria-pressed={sense.id === item.id} disabled={busy !== null}
                onClick={() => { setFeedback(null); onSelectSense(sense.id) }}>
                <span className="word-detail-sense-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{sense.zhGloss || sense.enDefinition || '待补充词义'}</span>
              </button>
            ))}
          </nav>
          <div className="word-detail-content" key={item.id}>
            <div className="word-detail-sense-heading">
              <h3>{item.zhGloss || '待补充中文义项'}</h3>
              <span className="word-detail-badge">{item.partOfSpeech} · {difficulty.level}</span>
              <span className="word-detail-badge">{item.knownAt ? '已会（自报）' : item.status === 'paused' ? '已暂停' : evidence?.label ?? '未开始'}</span>
            </div>
            <p className="word-detail-meta">{categoryLabels[item.category === 'my-vocabulary' && !inMyVocabulary ? 'other' : item.category]}{item.scenarioNote ? ` · ${item.scenarioNote}` : ''} · {difficulty.source === 'estimated' ? '难度估算，可编辑修正' : difficulty.source === 'manual' ? '当前义项手动设置难度' : '词头参考，义项可修正'}</p>
            {item.enDefinition && <p className="word-detail-definition">{item.enDefinition}</p>}
            {!item.zhGloss.trim() && <p className="field-help">此义项仅供查阅，编辑补充中文后可加入训练。</p>}
            {entry.senses.length > 1 && item.zhGloss.trim() && !recallContext(item) && <p className="field-help">缺少英语语境，暂不安排英译中；可编辑补充定义、例句或搭配。</p>}
            <section className="word-detail-example" aria-label="当前义项例句">
              <div><span>例句</span>{example && <button type="button" aria-label="播放例句" onClick={() => void perform('example', () => speakExample(example.en))} disabled={busy !== null}><Icon name="volume" size={16} /></button>}</div>
              <p>{example?.en || '尚无例句，可编辑补充。'}</p>
              {example?.zh && <p className="word-detail-example-zh">{example.zh}</p>}
            </section>
            {item.collocations.length > 0 && <p className="word-detail-collocations"><span>搭配</span>{item.collocations.join(' · ')}</p>}
            <section className="word-detail-learning" aria-label="当前义项学习情况">
              <h4>学习情况</h4>
              <dl>
                <div><dt>理解意思</dt><dd>{evidence?.directions.receptive.label ?? '尚未验证'}</dd></div>
                <div><dt>主动表达</dt><dd>{evidence?.directions.productive.label ?? '尚未验证'}</dd></div>
                <div><dt>场景应用</dt><dd>{evidence?.application.label ?? '尚未验证'}</dd></div>
              </dl>
              <p className="word-detail-due"><span>下次复习</span><span>{item.knownAt ? '已会，已跳过' : item.status === 'paused' ? '加入训练后安排' : evidence?.nextDue ? new Date(evidence.nextDue).toLocaleString('zh-CN') : '首次学习待安排'}</span></p>
            </section>
            {evidence && <LearningEvidenceDetails evidence={evidence} compact />}
          </div>
        </div>
        <footer className="word-detail-actions">
          <button className="primary-button" type="button" disabled={busy !== null || !item.zhGloss.trim() || Boolean(item.knownAt)}
            aria-label={item.status === 'active' ? `暂停 ${actionLabel}` : `恢复 ${actionLabel}`}
            onClick={() => void perform('status', () => onToggleStatus(item))}>
            <Icon name={item.status === 'active' ? 'pause' : 'play'} size={16} />{item.knownAt ? '已会，已跳过' : item.status === 'active' ? '暂停训练' : '加入训练'}
          </button>
          <button className="secondary-button" type="button" disabled={busy !== null || (!inMyVocabulary && !item.zhGloss.trim())}
            aria-label={`${inMyVocabulary ? '移除' : '加入'}优先学习 ${actionLabel}`}
            onClick={() => void perform('priority', () => inMyVocabulary ? onRemoveFromMyVocabulary(item) : onAddToMyVocabulary(item))}>
            {inMyVocabulary ? '取消优先' : '优先学习'}
          </button>
          <button className="word-detail-text-button" type="button" disabled={busy !== null} aria-label={`${item.knownAt ? '撤销已会' : '设为已会'} ${actionLabel}`}
            onClick={() => void perform('known', async () => {
              await onToggleKnown(item)
              return { message: item.knownAt ? `已恢复学习：${item.expression}` : `已设为已会：${item.expression}` }
            })}>{item.knownAt ? '撤销已会' : '已会，跳过'}</button>
          <button className="word-detail-text-button" type="button" disabled={busy !== null} aria-label={`编辑 ${actionLabel}`} onClick={() => { if (onRequestLogin) onRequestLogin(); else onEdit(item) }}><Icon name="edit" size={16} />编辑</button>
          {onCompleteSenses && <button className="word-detail-text-button word-detail-complete" type="button" disabled={busy !== null} aria-label={`补全词义 ${entry.expression}`}
            onClick={() => void perform('complete', () => onCompleteSenses(item))}><Icon name="book" size={16} />{busy === 'complete' ? '补全中…' : '补全词义'}</button>}
        </footer>
        {currentFeedback && <p className={`word-detail-feedback${currentFeedback.error ? ' error' : ''}`} role={currentFeedback.error ? 'alert' : 'status'}>{currentFeedback.message}</p>}
      </section>
    </div>, document.body,
  )
}
