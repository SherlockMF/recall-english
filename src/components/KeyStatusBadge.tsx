export type KeyStatus = 'missing' | 'pending' | 'saved' | 'checking' | 'busy' | 'error'

const LABELS: Record<KeyStatus, string> = {
  missing: '未配置', pending: '待保存', saved: '已保存', checking: '检查中', busy: '更新中', error: '需检查',
}

export function KeyStatusBadge({ service, status }: { service: string; status: KeyStatus }) {
  return <span className={`key-status-badge key-status-${status}`} role="status" aria-label={`${service} Key 状态`} title={status === 'saved' ? '本机配置已保存；尚未在此验证接口权限、额度和网络可用性。' : LABELS[status]}><i aria-hidden="true" />{LABELS[status]}</span>
}
