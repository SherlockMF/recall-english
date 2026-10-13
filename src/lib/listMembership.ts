import { SYSTEM_LIST_ORDER, type ListSlug, type SystemListSlug } from '../domain/types'

export type EditCategory = SystemListSlug | 'other'

/** Resolves list membership after a library edit without dropping dual system tags. */
export function resolveListSlugsForEdit(
  currentListSlugs: readonly ListSlug[],
  previousPrimary: ListSlug,
  nextCategory: EditCategory,
): ListSlug[] {
  const hadMyVocabulary = currentListSlugs.includes('my-vocabulary')
  const system = SYSTEM_LIST_ORDER.filter((slug) => currentListSlugs.includes(slug))

  if (nextCategory === 'other') {
    return hadMyVocabulary ? ['my-vocabulary'] : []
  }

  let nextSystem: SystemListSlug[]
  if (previousPrimary === 'my-vocabulary') {
    nextSystem = [nextCategory]
  } else if (currentListSlugs.includes(nextCategory)) {
    nextSystem = system
  } else {
    nextSystem = [...new Set([
      ...system.filter((slug) => slug !== previousPrimary),
      nextCategory,
    ])]
  }

  return hadMyVocabulary
    ? [...nextSystem, 'my-vocabulary']
    : nextSystem
}
