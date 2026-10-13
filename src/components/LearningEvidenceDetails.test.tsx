import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import type { LearningEvidence } from '../lib/learningEvidence'
import { LearningEvidenceDetails } from './LearningEvidenceDetails'

afterEach(cleanup)

it('explains basic recall separately from missing application and legacy evidence', () => {
  const evidence = {
    key: 'recall', label: '双向可回忆',
    directions: {
      receptive: { label: '无提示成功', retained: false, details: [], missing: ['尚缺间隔验证'] },
      productive: { label: '无提示成功', retained: false, details: [], missing: ['尚缺间隔验证'] },
    },
    application: { clozePassed: false, sentencePassed: false, label: '尚未验证', details: [] },
    explanations: ['两个方向都已有无提示成功。'], legacyEvidence: true,
    nextDue: '2026-09-12T00:00:00Z',
  } satisfies LearningEvidence
  render(<LearningEvidenceDetails evidence={evidence} />)
  expect(screen.getByText('双向可回忆 · 查看依据')).toBeInTheDocument()
  expect(screen.getByText('填空尚未通过验证')).toBeInTheDocument()
  expect(screen.getByText('造句尚未获得语义验证')).toBeInTheDocument()
  expect(screen.getByText('历史记录的证据有限，已保留原有复习进度。')).toBeInTheDocument()
  expect(screen.getByText(/下次复习/)).toBeInTheDocument()
})

it('deduplicates compact conditions and keeps only the five latest records across directions', () => {
  const records = Array.from({ length: 4 }, (_, index) => ({ reviewedAt: `2026-10-0${index + 1}T00:00:00Z`, hintLevel: 0 as const,
    evaluationSource: 'rules' as const, correctness: 'correct' as const, retryCount: 0, wasOverride: false, matchKind: 'exact' as const }))
  const direction = { label: '无提示成功', retained: false, details: records, missing: ['尚缺间隔验证'] }
  const evidence: LearningEvidence = { key: 'recall', label: '双向可回忆', directions: { receptive: direction, productive: direction },
    application: { label: '尚未验证', clozePassed: false, sentencePassed: false, details: [] },
    explanations: ['尚缺间隔验证'], legacyEvidence: false }
  render(<LearningEvidenceDetails evidence={evidence} compact />)
  expect(screen.getByText('学习依据与最近记录')).toBeInTheDocument()
  expect(screen.getAllByText('尚缺间隔验证')).toHaveLength(1)
  expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(5)
})
