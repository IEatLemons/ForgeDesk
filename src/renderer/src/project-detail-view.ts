export type ProjectDetailTabKey = 'data' | 'log-tree' | 'remote-alignment' | 'service-monitor'

export const PROJECT_DETAIL_TABS: Array<{ key: ProjectDetailTabKey; label: string }> = [
  { key: 'data', label: '数据' },
  { key: 'log-tree', label: 'Log 树' },
  { key: 'remote-alignment', label: '多端对齐' },
  { key: 'service-monitor', label: '服务监控' }
]

export type RepositorySummarySource = {
  currentBranch: string
  latestCommit: string
  localPath: string
  name: string
}

export type RepositorySummaryField = {
  label: string
  value: string
  strong?: boolean
}

export function shouldShowRepositorySummary(_tab: ProjectDetailTabKey, hasRepository: boolean): boolean {
  return hasRepository && _tab !== 'service-monitor'
}

export function createRepositorySummaryFields(repository: RepositorySummarySource, commitCount: number): RepositorySummaryField[] {
  return [
    {
      label: '当前分支',
      value: repository.currentBranch,
      strong: true
    },
    {
      label: '最近提交',
      value: repository.latestCommit
    },
    {
      label: '提交总数',
      value: String(commitCount),
      strong: true
    }
  ]
}
