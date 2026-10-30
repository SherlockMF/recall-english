import type { SpeechAccent, SystemListSlug, UserSettings, VocabularyLevel } from '../domain/types'
import { buildDailyPlan } from './scheduler'

export const LEARNING_GOALS: Record<SystemListSlug, string> = { daily: '日常生活', business: '商务沟通', finance: '金融交流', accounting: '会计工作' }
export interface OnboardingChoices { goal: SystemListSlug; level: VocabularyLevel; count: number; accent: SpeechAccent }

export function onboardingSettings(settings: UserSettings, choices: OnboardingChoices, now = new Date()): UserSettings {
  return { ...settings, learningGoal: choices.goal, vocabularyLevel: choices.level, newItemsPerDay: choices.count,
    speechAccent: choices.accent, onboardingCompletedAt: now.toISOString(), difficultyResetAt: now.toISOString() }
}

export function buildFirstLessonPlan(input: Parameters<typeof buildDailyPlan>[0]) {
  const scenarioItems = input.items.filter(item => item.listSlugs.includes(input.settings.learningGoal ?? 'daily'))
  return buildDailyPlan({ ...input, settings: { ...input.settings, newItemsPerDay: Math.min(3, input.settings.newItemsPerDay) },
    items: scenarioItems.some(item => item.status === 'active' && !item.knownAt) ? scenarioItems : input.items })
}
