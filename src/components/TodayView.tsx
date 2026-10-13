import type { MapLearningProgress, LearningTrackSnapshot } from '../lib/learningTracks'
import type { DailyPlan } from '../lib/scheduler'
import type { LearningStats } from '../lib/learningStats'
import { formatToday, greetingFor } from '../lib/presentation'
import { Icon } from './Icon'

interface TodayViewProps {
  now: Date
  plan: DailyPlan
  stats: LearningStats
  tracks: LearningTrackSnapshot[]
  mapProgress: MapLearningProgress
  recentWords: { expression: string; zhGloss: string; stage: string }[]
  onStart: () => void
}

export function TodayView({
  now,
  plan,
  stats,
  tracks,
  mapProgress,
  recentWords,
  onStart,
}: TodayViewProps) {
  const noHintRate = stats.delayedRecall.rate === null ? null : Math.round(stats.delayedRecall.rate * 100)
  const usedMinutes = Math.round(plan.usedMs / 6000) / 10
  const startedProgress = mapProgress.total
    ? Math.min(100, Math.round((mapProgress.started / mapProgress.total) * 100))
    : 0

  return (
    <div className="page-stack today-page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{formatToday(now)}</p>
          <h1>{greetingFor(now)}，今天也把英语真正想起来。</h1>
          <p className="page-intro">先完成到期复习，再认识少量值得长期记住的新表达。</p>
        </div>
        <div className="weekly-callout" aria-label={`${stats.retainedCount} 个表达的保持已验证`}>
          <span className="callout-orbit"><Icon name="spark" size={17} /></span>
          <div>
            <strong>{stats.retainedCount}</strong>
            <span>保持已验证</span>
          </div>
        </div>
      </section>

      <section className="today-hero" aria-labelledby="today-session-title">
        <div className="hero-copy">
          <div className="session-kicker"><span /> TODAY'S RECALL</div>
          <h2 id="today-session-title">今日学习计划</h2>
          <p>今日已学习 {usedMinutes} 分钟 · 按自己的节奏完成</p>
          <p>本次 {plan.totalTasks} 道练习，包含 {plan.newItemCount} 个新表达。只记录学习时间，不限时。</p>

          <div className="session-metrics">
            <div><span>复习题</span><strong>{plan.reviewTaskCount}</strong></div>
            <div><span>新表达</span><strong>{plan.newItemCount}</strong></div>
            <div><span>应用题</span><strong>{plan.usageTaskCount}</strong></div>
          </div>
          <div className="plan-explanation">
            <p>今日已引入 {plan.introducedToday} 个新表达 · 剩余额度 {plan.remainingNewItems} 个</p>
            {plan.overflowDueCount > 0 && <p>仍有 {plan.overflowDueCount} 道到期练习未安排</p>}
            {plan.reasons.map((reason) => <p key={reason}>{reason}</p>)}
          </div>

          <div className="hero-actions">
            <button className="primary-button large" disabled={plan.totalTasks === 0} onClick={onStart} type="button">
              {plan.totalTasks === 0 ? '当前计划已完成' : '开始今天的训练'} <Icon name="arrow" size={19} />
            </button>
          </div>
        </div>

        <div className="time-orb-wrap" aria-label={`预计 ${plan.estimatedMinutes} 分钟，共 ${plan.totalTasks} 道练习`}>
          <div className="time-orb">
            <span className="orb-small">预计</span>
            <strong>{plan.estimatedMinutes}</strong>
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
              <h2>看见学习证据</h2>
            </div>
            <span className="subtle-badge">三条主线</span>
          </div>

          <div
            className="map-goal"
            aria-label={`学习进度：已开始 ${mapProgress.started}，双向可回忆 ${mapProgress.usable}，词库 ${mapProgress.total}`}
          >
            <div className="map-goal-copy">
              <strong>学习进度</strong>
              <span>已开始练习的表达 / 三条主线词库</span>
            </div>
            <div className="map-goal-meter">
              <div className="map-goal-numbers">
                <span>{mapProgress.started.toLocaleString('zh-CN')}</span>
                <span>/ {mapProgress.total.toLocaleString('zh-CN')}</span>
              </div>
              <div className="progress-track map-goal-track">
                <span style={{ width: `${startedProgress}%` }} />
              </div>
              <p className="map-goal-usable">
                双向可回忆 <strong>{mapProgress.usable.toLocaleString('zh-CN')}</strong>
                <span>理解意思与主动表达分别有无提示成功证据</span>
              </p>
            </div>
          </div>

          <div className="category-progress-list">
            {tracks.map((track) => {
              const progress = track.total
                ? Math.min(100, Math.round((track.learned / track.total) * 100))
                : 0
              return (
                <div className="category-progress" key={track.id}>
                  <div className={`category-icon ${track.id}`}>
                    <Icon name={track.icon} size={19} />
                  </div>
                  <div className="category-progress-main">
                    <div>
                      <div className="category-progress-label">
                        <strong>{track.label}</strong>
                        <em>{track.purpose}</em>
                      </div>
                      <span>{track.learned} / {track.total}</span>
                    </div>
                    <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="map-footnote">应用已有验证的表达 {stats.applicationCount} 个。保持与应用分别统计；词库中可展开查看依据。</p>
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
            <span>近 7 天延迟回忆正确率</span>
          </div>
          <p className="memory-note">
            {stats.delayedRecall.total < 10
              ? '可判定样本不足 10 条。首次学习、即时重试、提示与自评不计入此指标；每日新词数量保持设置值。'
              : noHintRate !== null && noHintRate < 80
                ? '延迟回忆较弱，可加强复习；每日新词数量保持设置值，不自动减少。'
                : '先完成到期复习，新词按固定每日数量安排，优先词不足时补充普通词。'}
          </p>
          <p className="quiet-copy">{stats.delayedRecall.correct} / {stats.delayedRecall.total} 次可判定延迟回忆正确</p>
          <p className="quiet-copy">今日练习 {stats.practicedItems} 个表达 · {stats.taskCount} 道不同题 · {stats.attemptCount} 次作答</p>
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
