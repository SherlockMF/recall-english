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
