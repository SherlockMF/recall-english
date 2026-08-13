import type { ListSlug, VocabularyList } from '../domain/types'

const CREATED_AT = '2026-08-10T00:00:00.000Z'

export const LIST_IDS = {
  daily: 'list-daily',
  business: 'list-business',
  finance: 'list-finance',
  accounting: 'list-accounting',
  'my-vocabulary': 'list-my-vocabulary',
} as const satisfies Record<ListSlug, string>

export const SYSTEM_VOCABULARY_LISTS: VocabularyList[] = [
  {
    id: LIST_IDS.daily,
    name: 'Daily Life',
    slug: 'daily',
    description: '马来西亚日常生活与校园英语',
    category: 'daily',
    isSystem: true,
    createdAt: CREATED_AT,
  },
  {
    id: LIST_IDS.business,
    name: 'Business',
    slug: 'business',
    description: '商业沟通、采购销售与合作',
    category: 'business',
    isSystem: true,
    createdAt: CREATED_AT,
  },
  {
    id: LIST_IDS.finance,
    name: 'Finance',
    slug: 'finance',
    description: '金融、投资与公司财务',
    category: 'finance',
    isSystem: true,
    createdAt: CREATED_AT,
  },
  {
    id: LIST_IDS.accounting,
    name: 'Accounting',
    slug: 'accounting',
    description: '会计、审计、税务与报表',
    category: 'accounting',
    isSystem: true,
    createdAt: CREATED_AT,
  },
]

/** Personal priority list — not a system content library. */
export const MY_VOCABULARY_LIST: VocabularyList = {
  id: LIST_IDS['my-vocabulary'],
  name: 'Priority Study',
  slug: 'my-vocabulary',
  description: '优先进入每日训练的表达',
  category: 'my-vocabulary',
  isSystem: false,
  createdAt: CREATED_AT,
}

export const ALL_VOCABULARY_LISTS: VocabularyList[] = [
  ...SYSTEM_VOCABULARY_LISTS,
  MY_VOCABULARY_LIST,
]

export function listIdForSlug(slug: ListSlug): string {
  return LIST_IDS[slug]
}
