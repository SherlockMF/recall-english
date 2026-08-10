import { useEffect, useMemo, useState } from 'react'
import type { LearningTrack, SystemListSlug, VocabularyItem } from '../domain/types'
import { categoryLabels, getItemStage } from '../lib/presentation'
import { speakExample, speakWord } from '../lib/speech'
import { Icon } from './Icon'

type LibraryFilter = 'all' | 'my-vocabulary' | SystemListSlug
type VocabularyEditPatch = Pick<
  VocabularyItem,
  'zhGloss' | 'enDefinition' | 'partOfSpeech' | 'examples' | 'collocations' | 'category'
>

interface LibraryViewProps {
  items: VocabularyItem[]
  tracks: LearningTrack[]
  onToggleStatus: (item: VocabularyItem) => Promise<void>
  onUpdate: (
    id: string,
    patch: VocabularyEditPatch,
  ) => Promise<void>
  onAddToMyVocabulary: (item: VocabularyItem) => Promise<{ ok: boolean; message: string }>
}

const filters: { id: LibraryFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'daily', label: '日常生活' },
  { id: 'business', label: '商业英语' },
  { id: 'finance', label: '金融英语' },
  { id: 'accounting', label: '会计英语' },
  { id: 'my-vocabulary', label: '我的词库' },
]

const systemCategories: SystemListSlug[] = ['daily', 'business', 'finance', 'accounting']

export function LibraryView({
  items,
  tracks,
  onToggleStatus,
  onUpdate,
  onAddToMyVocabulary,
}: LibraryViewProps) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<LibraryFilter>('all')
  const [visibleCount, setVisibleCount] = useState(24)
  const [editing, setEditing] = useState<VocabularyItem | null>(null)
  const [actionMessage, setActionMessage] = useState('')

  useEffect(() => setVisibleCount(24), [query, filter])

  const filtered = useMemo(() => {
    const cleaned = query.trim().toLocaleLowerCase()
    return items
      .filter((item) => {
        if (filter === 'my-vocabulary') return item.listSlugs.includes('my-vocabulary')
        if (filter !== 'all' && !item.listSlugs.includes(filter)) return false
        if (!cleaned) return true
        return [item.expression, item.zhGloss, item.enDefinition, ...item.collocations]
          .some((value) => value.toLocaleLowerCase().includes(cleaned))
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1
        if (a.listSlugs.includes('my-vocabulary') !== b.listSlugs.includes('my-vocabulary')) {
          return a.listSlugs.includes('my-vocabulary') ? -1 : 1
        }
        return a.expression.localeCompare(b.expression)
      })
  }, [filter, items, query])

  return (
    <div className="page-stack library-page">
      <section className="page-header library-header">
        <div>
          <p className="eyebrow">YOUR LANGUAGE BANK</p>
          <h1>词库不是收藏夹，是你的表达工具箱。</h1>
          <p className="page-intro">搜索、暂停或补充真实场景。每个义项保持独立，进度也分别记录。</p>
        </div>
        <div className="library-total"><strong>{items.length}</strong><span>个独立义项</span></div>
      </section>

      <section className="library-tools" aria-label="词库筛选">
        <div className="input-with-icon library-search">
          <Icon name="search" size={19} />
          <input aria-label="搜索词库" onChange={(event) => setQuery(event.target.value)} placeholder="搜索英文、中文或搭配" value={query} />
        </div>
        <div className="filter-pills">
          {filters.map((item) => (
            <button className={filter === item.id ? 'active' : ''} key={item.id} onClick={() => setFilter(item.id)} type="button">
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="library-result-line">
        <span>找到 {filtered.length} 个义项</span>
        <span>暂停的内容不会进入每日训练</span>
      </div>
      {actionMessage && <p className="form-note">{actionMessage}</p>}

      {filtered.length ? (
        <>
          <section className="word-card-grid">
            {filtered.slice(0, visibleCount).map((item) => {
              const stage = getItemStage(item, tracks)
              const inMyVocabulary = item.listSlugs.includes('my-vocabulary')
              const ipa = item.ipaUk || item.ipaUs
              return (
                <article className={item.status === 'paused' ? 'word-card paused' : 'word-card'} key={item.id}>
                  <div className="word-card-top">
                    <span className={`category-chip ${item.category}`}>{categoryLabels[item.category]}</span>
                    <div className="word-card-actions">
                      <button aria-label={`英式发音 ${item.expression}`} className="mini-text-button" onClick={() => void speakWord(item, 'uk')} type="button">UK</button>
                      <button aria-label={`美式发音 ${item.expression}`} className="mini-text-button" onClick={() => void speakWord(item, 'us')} type="button">US</button>
                      <button aria-label={`编辑 ${item.expression}`} className="mini-icon-button" onClick={() => setEditing(item)} type="button"><Icon name="edit" size={17} /></button>
                      <button
                        aria-label={item.status === 'active' ? `暂停 ${item.expression}` : `恢复 ${item.expression}`}
                        className="mini-icon-button"
                        onClick={() => void onToggleStatus(item)}
                        type="button"
                      >
                        <Icon name={item.status === 'active' ? 'pause' : 'play'} size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="word-card-expression">
                    <h2>{item.expression}</h2>
                    {ipa && <span>/{ipa}/</span>}
                  </div>
                  <p className="word-card-gloss">{item.zhGloss}</p>
                  {item.enDefinition && <p className="word-card-definition">{item.enDefinition}</p>}
                  <div className="word-card-example">
                    <span>IN CONTEXT</span>
                    <p>{item.examples[0]?.en || '补充一个真实例句后，将解锁使用练习。'}</p>
                    {item.examples[0]?.en && (
                      <button
                        className="text-button"
                        onClick={() => void speakExample(item.examples[0].en)}
                        type="button"
                      >
                        播放例句
                      </button>
                    )}
                  </div>
                  <div className="word-card-bottom">
                    <span className={`stage-dot ${stage.key}`} />
                    <span>{item.status === 'paused' ? '已暂停' : stage.label}</span>
                    {inMyVocabulary ? (
                      <span className="source-mark">已加入</span>
                    ) : (
                      <button
                        className="text-button"
                        onClick={() => {
                          void onAddToMyVocabulary(item).then((result) => setActionMessage(result.message))
                        }}
                        type="button"
                      >
                        + 加入我的词库
                      </button>
                    )}
                  </div>
                </article>
              )
            })}
          </section>
          {visibleCount < filtered.length && (
            <button className="load-more-button" onClick={() => setVisibleCount((count) => count + 24)} type="button">
              显示更多 <Icon name="chevron" size={17} />
            </button>
          )}
        </>
      ) : (
        <div className="empty-state panel">
          <span><Icon name="search" size={25} /></span>
          <h2>没有找到对应的表达</h2>
          <p>换一个关键词或分类试试。</p>
        </div>
      )}

      {editing && (
        <EditWordDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            await onUpdate(editing.id, patch)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

interface EditWordDialogProps {
  item: VocabularyItem
  onClose: () => void
  onSave: (patch: VocabularyEditPatch) => Promise<void>
}

function EditWordDialog({ item, onClose, onSave }: EditWordDialogProps) {
  const [zhGloss, setZhGloss] = useState(item.zhGloss)
  const [enDefinition, setEnDefinition] = useState(item.enDefinition)
  const [partOfSpeech, setPartOfSpeech] = useState(item.partOfSpeech)
  const [exampleEn, setExampleEn] = useState(item.examples[0]?.en ?? '')
  const [exampleZh, setExampleZh] = useState(item.examples[0]?.zh ?? '')
  const [collocations, setCollocations] = useState(item.collocations.join(', '))
  const [category, setCategory] = useState<SystemListSlug>(
    item.category === 'my-vocabulary' ? 'daily' : item.category,
  )
  const [saving, setSaving] = useState(false)

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.currentTarget === event.target) onClose()
    }}>
      <section aria-labelledby="edit-word-title" aria-modal="true" className="dialog-card edit-dialog" role="dialog">
        <div className="dialog-heading">
          <div><p className="eyebrow">EDIT ONE SENSE</p><h2 id="edit-word-title">编辑 {item.expression}</h2></div>
          <button aria-label="关闭" className="icon-button" onClick={onClose} type="button"><Icon name="close" size={20} /></button>
        </div>
        <div className="word-form">
          <div className="form-grid two-columns">
            <label><span>中文义项</span><input onChange={(event) => setZhGloss(event.target.value)} value={zhGloss} /></label>
            <label><span>词性</span><input onChange={(event) => setPartOfSpeech(event.target.value)} value={partOfSpeech} /></label>
          </div>
          <label><span>英文定义</span><textarea onChange={(event) => setEnDefinition(event.target.value)} rows={2} value={enDefinition} /></label>
          <div className="form-grid two-columns">
            <label><span>英文例句</span><textarea onChange={(event) => setExampleEn(event.target.value)} rows={3} value={exampleEn} /></label>
            <label><span>例句中文</span><textarea onChange={(event) => setExampleZh(event.target.value)} rows={3} value={exampleZh} /></label>
          </div>
          <label><span>常用搭配</span><input onChange={(event) => setCollocations(event.target.value)} value={collocations} /></label>
          <label><span>使用场景</span><select onChange={(event) => setCategory(event.target.value as SystemListSlug)} value={category}>
            {systemCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </select></label>
        </div>
        <div className="dialog-actions">
          <button className="secondary-button" onClick={onClose} type="button">取消</button>
          <button
            className="primary-button"
            disabled={!zhGloss.trim() || saving}
            onClick={async () => {
              setSaving(true)
              await onSave({
                zhGloss: zhGloss.trim(),
                enDefinition: enDefinition.trim(),
                partOfSpeech: partOfSpeech.trim() || 'expression',
                examples: exampleEn.trim() ? [{ en: exampleEn.trim(), zh: exampleZh.trim() }] : [],
                collocations: collocations.split(/[,，\n]/).map((value) => value.trim()).filter(Boolean),
                category,
              })
              setSaving(false)
            }}
            type="button"
          >
            保存修改
          </button>
        </div>
      </section>
    </div>
  )
}
