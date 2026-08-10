import type { SystemListSlug } from '../domain/types'
import { categoryLabels, formatToday, greetingFor } from '../lib/presentation'
import { Icon } from './Icon'

interface CategorySnapshot {
  category: SystemListSlug
  learned: number
  total: number
}

interface TodayViewProps {
  now: Date
  dueCount: number
  newCount: number
  usageDue: number
  estimatedMinutes: number
  noHintRate: number | null
  usableThisWeek: number
  categories: CategorySnapshot[]
  recentWords: { expression: string; zhGloss: string; stage: string }[]
  onStart: () => void
  onStartExtension: () => void
}

export function TodayView({
  now,
  dueCount,
  newCount,
  usageDue,
  estimatedMinutes,
  noHintRate,
  usableThisWeek,
  categories,
  recentWords,
  onStart,
  onStartExtension,
}: TodayViewProps) {
  const totalTasks = dueCount + newCount * 2

  return (
    <div className="page-stack today-page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{formatToday(now)}</p>
          <h1>{greetingFor(now)}，今天也把英语真正想起来。</h1>
          <p className="page-intro">先完成到期复习，再认识少量值得长期记住的新表达。</p>
        </div>
        <div className="weekly-callout" aria-label={`本周新增 ${usableThisWeek} 个会用的表达`}>
          <span className="callout-orbit"><Icon name="spark" size={17} /></span>
          <div>
            <strong>{usableThisWeek}</strong>
            <span>本周真正会用</span>
          </div>
        </div>
      </section>

      <section className="today-hero" aria-labelledby="today-session-title">
        <div className="hero-copy">
          <div className="session-kicker"><span /> TODAY'S RECALL</div>
          <h2 id="today-session-title">15 分钟核心训练</h2>
          <p>
            {dueCount > 0
              ? `有 ${dueCount} 个到期回忆，之后学习 ${newCount} 个新表达。`
              : `今天没有积压，可以专心学习 ${newCount} 个新表达。`}
          </p>

          <div className="session-metrics">
            <div><span>到期</span><strong>{dueCount}</strong></div>
            <div><span>新表达</span><strong>{newCount}</strong></div>
            <div><span>使用题</span><strong>{usageDue}</strong></div>
          </div>

          <div className="hero-actions">
            <button className="primary-button large" onClick={onStart} type="button">
              开始今天的训练 <Icon name="arrow" size={19} />
            </button>
            <button className="text-button" onClick={onStartExtension} type="button">
              我有更多时间，加练 15 分钟
            </button>
          </div>
        </div>

        <div className="time-orb-wrap" aria-label={`预计 ${estimatedMinutes} 分钟，共约 ${totalTasks} 道回忆`}>
          <div className="time-orb">
            <span className="orb-small">预计</span>
            <strong>{estimatedMinutes}</strong>
            <span>分钟</span>
          </div>
          <div className="orbit-dot one" />
          <div className="orbit-dot two" />
        </div>
      </section>

      <section className="dashboard-grid">
        <article className="panel progress-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">LEARNING MAP</p>
              <h2>三类英语，一起向前</h2>
            </div>
            <span className="subtle-badge">本地进度</span>
          </div>
          <div className="category-progress-list">
            {categories.map(({ category, learned, total }) => {
              const progress = total ? Math.min(100, Math.round((learned / total) * 100)) : 0
              return (
                <div className="category-progress" key={category}>
                  <div className={`category-icon ${category}`}><Icon name={category === 'daily' ? 'book' : category === 'finance' ? 'brain' : 'spark'} size={19} /></div>
                  <div className="category-progress-main">
                    <div><strong>{categoryLabels[category]}</strong><span>{learned} / {total}</span></div>
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="panel memory-panel">
          <div className="panel-heading compact">
            <div>
              <p className="eyebrow">MEMORY SIGNAL</p>
              <h2>记忆状态</h2>
            </div>
            <Icon name="brain" size={25} />
          </div>
          <div className="memory-score">
            <strong>{noHintRate === null ? '—' : `${noHintRate}%`}</strong>
            <span>近 7 天无提示想起率</span>
          </div>
          <p className="memory-note">
            {noHintRate === null
              ? '完成第一轮训练后，这里会显示真实的延迟回忆表现。'
              : noHintRate >= 90
                ? '保持得很好。系统会谨慎增加新的表达。'
                : noHintRate >= 85
                  ? '节奏合适，继续把到期内容放在最前面。'
                  : '先减少新词，把容易忘的表达重新练牢。'}
          </p>
        </article>
      </section>

      <section className="panel recent-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">RECENT EXPRESSIONS</p>
            <h2>最近留下的表达</h2>
          </div>
          <span className="quiet-copy">少看，多想</span>
        </div>
        {recentWords.length ? (
          <div className="recent-word-list">
            {recentWords.map((word) => (
              <div className="recent-word" key={`${word.expression}-${word.zhGloss}`}>
                <div><strong>{word.expression}</strong><span>{word.zhGloss}</span></div>
                <span className="stage-pill">{word.stage}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-inline">完成一次训练后，你最近接触的表达会出现在这里。</div>
        )}
      </section>
    </div>
  )
}
