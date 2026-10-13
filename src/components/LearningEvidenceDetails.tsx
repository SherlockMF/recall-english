import type { LearningEvidence } from '../lib/learningEvidence'

const sourceLabels = { rules: '本地规则', llm: 'AI 辅助', reveal: '揭晓答案' }
const correctnessLabels = { correct: '正确', incorrect: '未通过', unverified: '待验证' }

export function LearningEvidenceDetails({ evidence, compact = false }: { evidence: LearningEvidence; compact?: boolean }) {
  if (compact) {
    const missing = [...new Set([...evidence.directions.receptive.missing, ...evidence.directions.productive.missing])]
    const records = [
      ...evidence.directions.receptive.details.map((detail) => ({ ...detail, direction: '理解意思' })),
      ...evidence.directions.productive.details.map((detail) => ({ ...detail, direction: '主动表达' })),
      ...evidence.application.details.map((detail) => ({ ...detail, direction: '场景应用' })),
    ].sort((left, right) => Date.parse(right.reviewedAt) - Date.parse(left.reviewedAt)).slice(0, 5)
    return (
      <details className="learning-evidence compact-evidence">
        <summary>学习依据与最近记录</summary>
        <div className="evidence-content">
          {missing.map((text) => <p key={text}>{text}</p>)}
          {records.length > 0 ? <ul aria-label="最近五条学习记录">
            {records.map((detail) => <li key={`${detail.direction}:${detail.reviewedAt}:${detail.promptId ?? ''}`}>
              <span>{detail.direction} · {new Date(detail.reviewedAt).toLocaleString('zh-CN')}</span>
              <span>{detail.evaluationSource ? sourceLabels[detail.evaluationSource] : '历史来源未知'} · {detail.correctness ? correctnessLabels[detail.correctness] : '历史证据有限'} · 提示 {detail.hintLevel}{detail.retryCount ? ' · 即时重试' : ''}{detail.wasOverride ? ' · 自评覆写' : ''}{detail.matchKind === 'minor-typo' ? ' · 拼写接近' : ''}</span>
            </li>)}
          </ul> : <p>尚无作答记录。</p>}
          {evidence.legacyEvidence && <p>历史记录的证据有限，已保留原有复习进度。</p>}
          <p>保持验证需两个方向均在至少 7 天未练该方向后成功回忆；自报已会与练习证据分别记录。</p>
        </div>
      </details>
    )
  }
  return (
    <details className="learning-evidence">
      <summary>{evidence.label} · 查看依据</summary>
      <div className="evidence-content">
        {evidence.explanations.map((text) => <p key={text}>{text}</p>)}
        {(['receptive', 'productive'] as const).map((type) => {
          const direction = evidence.directions[type]
          return (
            <section key={type}>
              <h3>{type === 'receptive' ? '理解意思' : '主动表达'} · {direction.label}</h3>
              {direction.successAt && <p>有效成功：{new Date(direction.successAt).toLocaleString('zh-CN')}</p>}
              {direction.missing.map((text) => <p key={text}>{text}</p>)}
              {direction.details.length > 0 && <ul aria-label={`${type === 'receptive' ? '理解意思' : '主动表达'}最近记录`}>
                {direction.details.slice(-5).map((detail, index) => (
                  <li key={`${detail.reviewedAt}:${index}`}>
                    {new Date(detail.reviewedAt).toLocaleString('zh-CN')} · {detail.evaluationSource ? sourceLabels[detail.evaluationSource] : '历史来源未知'}
                    {' · '}{detail.correctness ? correctnessLabels[detail.correctness] : '历史证据有限'}
                    {' · '}提示 {detail.hintLevel}
                    {detail.retryCount ? ' · 即时重试' : ''}
                    {detail.wasOverride ? ' · 自评覆写' : ''}
                    {detail.matchKind === 'minor-typo' ? ' · 拼写接近' : ''}
                  </li>
                ))}
              </ul>}
            </section>
          )
        })}
        <section>
          <h3>场景应用 · {evidence.application.label}</h3>
          <p>{evidence.application.clozePassed ? '填空已通过验证' : '填空尚未通过验证'}</p>
          <p>{evidence.application.sentencePassed ? '造句经 AI 辅助验证通过' : '造句尚未获得语义验证'}</p>
          <p>此处记录练习证据，不代表已验证其他场景的迁移能力。</p>
          {evidence.application.details.length > 0 && <ul aria-label="应用最近记录">
            {evidence.application.details.slice(-5).map((detail, index) => <li key={`${detail.reviewedAt}:${index}`}>
              {new Date(detail.reviewedAt).toLocaleString('zh-CN')} · {detail.evaluationSource ? sourceLabels[detail.evaluationSource] : '历史来源未知'}
              {' · '}{detail.correctness ? correctnessLabels[detail.correctness] : '历史证据有限'}
              {' · '}提示 {detail.hintLevel}
              {detail.retryCount ? ' · 即时重试' : ''}{detail.wasOverride ? ' · 自评覆写' : ''}
            </li>)}
          </ul>}
        </section>
        {evidence.nextDue && <p>下次复习：{new Date(evidence.nextDue).toLocaleString('zh-CN')}</p>}
        {evidence.legacyEvidence && <p>历史记录的证据有限，已保留原有复习进度。</p>}
        <p>保持验证要求两个方向均在至少 7 天未练该方向后成功回忆。到期提醒与能力证据分别展示。</p>
      </div>
    </details>
  )
}
